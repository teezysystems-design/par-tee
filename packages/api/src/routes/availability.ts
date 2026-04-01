import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, sql, gte, lt } from 'drizzle-orm';
import { db, teeTimeSlots, courses } from '@par-tee/db';
import { authMiddleware } from '../middleware/auth';

export const availabilityRouter = new Hono();

const createSlotSchema = z.object({
  startsAt: z.string().datetime({ message: 'startsAt must be a valid ISO datetime string' }),
  capacity: z.number().int().min(1).max(8),
  priceInCents: z.number().int().min(0),
});

const updateSlotSchema = z.object({
  startsAt: z.string().datetime().optional(),
  capacity: z.number().int().min(1).max(8).optional(),
  priceInCents: z.number().int().min(0).optional(),
});

const listSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Resolve internal user id from supabaseUserId */
async function resolveUserId(supabaseUserId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: sql<string>`id` })
    .from(sql`users`)
    .where(sql`supabase_user_id = ${supabaseUserId}`)
    .limit(1);
  return row?.id ?? null;
}

/** Return 403 if the user does not own the course (ownership is enforced when createdByUserId is set). */
async function assertCourseOwner(courseId: string, userId: string): Promise<boolean> {
  const [course] = await db
    .select({ createdByUserId: courses.createdByUserId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) return false; // course not found — caller should 404
  // Allow access if ownership is not tracked (null = legacy/seeded course)
  if (course.createdByUserId === null) return true;
  return course.createdByUserId === userId;
}

// GET /v1/availability/:courseId/slots — list slots for a course
availabilityRouter.get('/:courseId/slots', authMiddleware, zValidator('query', listSlotsQuerySchema), async (c) => {
  const { courseId } = c.req.param();
  const { date, page, pageSize } = c.req.valid('query');

  const conditions = [eq(teeTimeSlots.courseId, courseId)];

  if (date) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    conditions.push(
      gte(teeTimeSlots.startsAt, dayStart),
      lt(teeTimeSlots.startsAt, dayEnd)
    );
  }

  const offset = (page - 1) * pageSize;

  const slots = await db
    .select()
    .from(teeTimeSlots)
    .where(and(...conditions))
    .orderBy(teeTimeSlots.startsAt)
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(teeTimeSlots)
    .where(and(...conditions));

  return c.json({
    data: slots,
    pagination: { page, pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / pageSize) },
  });
});

// POST /v1/availability/:courseId/slots — create a new slot
availabilityRouter.post(
  '/:courseId/slots',
  authMiddleware,
  zValidator('json', createSlotSchema),
  async (c) => {
    const { courseId } = c.req.param();
    const { supabaseUserId } = c.get('user');
    const { startsAt, capacity, priceInCents } = c.req.valid('json');

    const userId = await resolveUserId(supabaseUserId);
    if (!userId) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    }

    const allowed = await assertCourseOwner(courseId, userId);
    if (!allowed) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this course' } }, 403);
    }

    const [slot] = await db
      .insert(teeTimeSlots)
      .values({
        courseId,
        startsAt: new Date(startsAt),
        capacity,
        priceInCents,
        bookedCount: 0,
      })
      .returning();

    return c.json({ data: slot }, 201);
  }
);

// PATCH /v1/availability/slots/:slotId — update a slot
availabilityRouter.patch(
  '/slots/:slotId',
  authMiddleware,
  zValidator('json', updateSlotSchema),
  async (c) => {
    const { slotId } = c.req.param();
    const { supabaseUserId } = c.get('user');
    const updates = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(teeTimeSlots)
      .where(eq(teeTimeSlots.id, slotId))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Slot not found' } }, 404);
    }

    const userId = await resolveUserId(supabaseUserId);
    if (!userId) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    }

    const allowed = await assertCourseOwner(existing.courseId, userId);
    if (!allowed) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this course' } }, 403);
    }

    const updateData: Partial<typeof teeTimeSlots.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (updates.startsAt !== undefined) updateData.startsAt = new Date(updates.startsAt);
    if (updates.capacity !== undefined) updateData.capacity = updates.capacity;
    if (updates.priceInCents !== undefined) updateData.priceInCents = updates.priceInCents;

    const [updated] = await db
      .update(teeTimeSlots)
      .set(updateData)
      .where(eq(teeTimeSlots.id, slotId))
      .returning();

    return c.json({ data: updated });
  }
);

// DELETE /v1/availability/slots/:slotId — soft-delete only if bookedCount === 0
availabilityRouter.delete('/slots/:slotId', authMiddleware, async (c) => {
  const { slotId } = c.req.param();
  const { supabaseUserId } = c.get('user');

  const [slot] = await db
    .select()
    .from(teeTimeSlots)
    .where(eq(teeTimeSlots.id, slotId))
    .limit(1);

  if (!slot) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Slot not found' } }, 404);
  }

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const allowed = await assertCourseOwner(slot.courseId, userId);
  if (!allowed) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this course' } }, 403);
  }

  if (slot.bookedCount > 0) {
    return c.json(
      {
        error: {
          code: 'SLOT_HAS_BOOKINGS',
          message: 'Cannot delete a slot with active bookings',
        },
      },
      409
    );
  }

  await db.delete(teeTimeSlots).where(eq(teeTimeSlots.id, slotId));

  return c.json({ data: { deleted: true, id: slotId } });
});
