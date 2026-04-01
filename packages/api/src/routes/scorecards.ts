import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db, scoreCards, bookings, courses } from '@par-tee/db';
import { authMiddleware } from '../middleware/auth';

export const scorecardsRouter = new Hono();

const createScorecardSchema = z.object({
  bookingId: z.string().uuid(),
  holeScores: z.array(z.number().int().min(1).max(15)).min(1).max(18),
  notes: z.string().max(1000).optional(),
});

// GET /v1/scorecards — list my scorecards
scorecardsRouter.get('/', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');

  const [userRow] = await db
    .select({ id: sql<string>`id` })
    .from(sql`users`)
    .where(sql`supabase_user_id = ${supabaseUserId}`)
    .limit(1);

  if (!userRow) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const myScoreCards = await db
    .select({
      id: scoreCards.id,
      bookingId: scoreCards.bookingId,
      courseId: scoreCards.courseId,
      courseName: courses.name,
      holeScores: scoreCards.holeScores,
      totalStrokes: scoreCards.totalStrokes,
      notes: scoreCards.notes,
      playedAt: scoreCards.playedAt,
      createdAt: scoreCards.createdAt,
    })
    .from(scoreCards)
    .leftJoin(courses, eq(scoreCards.courseId, courses.id))
    .where(eq(scoreCards.userId, userRow.id))
    .orderBy(sql`${scoreCards.playedAt} DESC`);

  return c.json({ data: myScoreCards });
});

// POST /v1/scorecards — create a scorecard
scorecardsRouter.post(
  '/',
  authMiddleware,
  zValidator('json', createScorecardSchema),
  async (c) => {
    const { supabaseUserId } = c.get('user');
    const { bookingId, holeScores, notes } = c.req.valid('json');

    const [userRow] = await db
      .select({ id: sql<string>`id` })
      .from(sql`users`)
      .where(sql`supabase_user_id = ${supabaseUserId}`)
      .limit(1);

    if (!userRow) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    }

    // Validate booking belongs to user
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
    }

    if (booking.userId !== userRow.id) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'This booking does not belong to you' } }, 403);
    }

    const totalStrokes = holeScores.reduce((sum, s) => sum + s, 0);

    const [scoreCard] = await db
      .insert(scoreCards)
      .values({
        bookingId,
        userId: userRow.id,
        courseId: booking.courseId,
        holeScores,
        totalStrokes,
        notes,
      })
      .returning();

    return c.json({ data: scoreCard }, 201);
  }
);
