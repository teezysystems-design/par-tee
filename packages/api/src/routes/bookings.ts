import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db, bookings, teeTimeSlots } from '@teezy/db';
import { authMiddleware } from '../middleware/auth';

export const bookingsRouter = new Hono();

const createBookingSchema = z.object({
  slotId: z.string().uuid(),
  partySize: z.number().int().min(1).max(4).default(1),
});

// GET /v1/bookings — list my bookings
bookingsRouter.get('/', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');

  // Resolve internal user ID from supabaseUserId
  const [{ userId }] = await db
    .select({ userId: sql<string>`id` })
    .from(sql`users`)
    .where(sql`supabase_user_id = ${supabaseUserId}`)
    .limit(1);

  if (!userId) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const myBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.userId, userId))
    .orderBy(sql`created_at DESC`);

  return c.json({ data: myBookings });
});

// POST /v1/bookings — create a booking
bookingsRouter.post('/', authMiddleware, zValidator('json', createBookingSchema), async (c) => {
  const { supabaseUserId } = c.get('user');
  const { slotId, partySize } = c.req.valid('json');

  // Resolve internal user
  const [userRow] = await db
    .select({ id: sql<string>`id` })
    .from(sql`users`)
    .where(sql`supabase_user_id = ${supabaseUserId}`)
    .limit(1);

  if (!userRow) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  // Load slot and check availability
  const [slot] = await db
    .select()
    .from(teeTimeSlots)
    .where(eq(teeTimeSlots.id, slotId))
    .limit(1);

  if (!slot) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Tee time slot not found' } }, 404);
  }

  if (slot.bookedCount + partySize > slot.capacity) {
    return c.json(
      { error: { code: 'SLOT_FULL', message: 'Not enough capacity for requested party size' } },
      409
    );
  }

  const totalPriceInCents = slot.priceInCents * partySize;

  // Create booking and increment booked_count atomically
  const [booking] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(bookings)
      .values({
        userId: userRow.id,
        slotId,
        courseId: slot.courseId,
        partySize,
        totalPriceInCents,
        status: 'pending',
        paymentStatus: 'pending',
      })
      .returning();

    await tx
      .update(teeTimeSlots)
      .set({ bookedCount: slot.bookedCount + partySize })
      .where(
        and(
          eq(teeTimeSlots.id, slotId),
          // Guard: re-check capacity inside transaction
          sql`booked_count + ${partySize} <= capacity`
        )
      );

    return [created];
  });

  return c.json({ data: booking }, 201);
});

// DELETE /v1/bookings/:id — cancel a booking
bookingsRouter.delete('/:id', authMiddleware, async (c) => {
  const { id } = c.req.param();
  const { supabaseUserId } = c.get('user');

  const [userRow] = await db
    .select({ id: sql<string>`id` })
    .from(sql`users`)
    .where(sql`supabase_user_id = ${supabaseUserId}`)
    .limit(1);

  if (!userRow) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.userId, userRow.id)))
    .limit(1);

  if (!booking) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
  }

  if (booking.status === 'cancelled') {
    return c.json({ error: { code: 'ALREADY_CANCELLED', message: 'Booking already cancelled' } }, 409);
  }

  const [cancelled] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(bookings)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();

    // Release capacity
    await tx
      .update(teeTimeSlots)
      .set({ bookedCount: sql`booked_count - ${booking.partySize}` })
      .where(eq(teeTimeSlots.id, booking.slotId));

    return [updated];
  });

  return c.json({ data: cancelled });
});
