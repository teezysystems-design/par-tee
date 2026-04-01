import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db, tournaments, tournamentEntries, users, courses } from '@par-tee/db';
import { authMiddleware } from '../middleware/auth';

export const tournamentsRouter = new Hono();

// ─── Helpers ───────────────────────────────────────────────────────────────

async function resolveUserId(supabaseUserId: string): Promise<string | null> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseUserId, supabaseUserId)).limit(1);
  return row?.id ?? null;
}

// ─── Schemas ───────────────────────────────────────────────────────────────

const createTournamentSchema = z.object({
  name: z.string().min(1).max(120),
  courseId: z.string().uuid(),
  format: z.enum(['stroke_play', 'match_play', 'stableford']).default('stroke_play'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  maxEntrants: z.number().int().min(2).max(256).default(64),
  entryFeeInCents: z.number().int().min(0).default(0),
  prizePoolInCents: z.number().int().min(0).default(0),
  prizeName: z.string().max(200).optional(),
});

const submitScoreSchema = z.object({
  totalScore: z.number().int(),
  holesCompleted: z.number().int().min(0).max(18),
  scoreToPar: z.number().int(),
  roundScores: z.array(z.number().int()).default([]),
});

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /v1/tournaments — list upcoming/active tournaments
tournamentsRouter.get('/', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const status = c.req.query('status') ?? 'upcoming,registration,live';
  const statuses = status.split(',').filter(Boolean) as ('upcoming' | 'registration' | 'live' | 'completed')[];

  const userId = await resolveUserId(supabaseUserId);

  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      courseId: tournaments.courseId,
      courseName: courses.name,
      format: tournaments.format,
      status: tournaments.status,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      maxEntrants: tournaments.maxEntrants,
      entryFeeInCents: tournaments.entryFeeInCents,
      prizePoolInCents: tournaments.prizePoolInCents,
      prizeName: tournaments.prizeName,
      createdAt: tournaments.createdAt,
      currentEntrants: sql<number>`(
        SELECT COUNT(*) FROM tournament_entries te WHERE te.tournament_id = ${tournaments.id}
      )`,
    })
    .from(tournaments)
    .leftJoin(courses, eq(tournaments.courseId, courses.id))
    .where(sql`${tournaments.status} = ANY(${statuses})`)
    .orderBy(asc(tournaments.startDate))
    .limit(50);

  // If we have a userId, flag which ones the user is opted into
  let enteredIds = new Set<string>();
  if (userId) {
    const entries = await db
      .select({ tournamentId: tournamentEntries.tournamentId })
      .from(tournamentEntries)
      .where(eq(tournamentEntries.userId, userId));
    enteredIds = new Set(entries.map((e) => e.tournamentId));
  }

  const result = rows.map((t) => ({ ...t, isOptedIn: enteredIds.has(t.id) }));

  return c.json({ data: result });
});

// GET /v1/tournaments/:tournamentId — tournament detail + leaderboard
tournamentsRouter.get('/:tournamentId', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const { tournamentId } = c.req.param();

  const userId = await resolveUserId(supabaseUserId);

  const [tournament] = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      courseId: tournaments.courseId,
      courseName: courses.name,
      format: tournaments.format,
      status: tournaments.status,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      maxEntrants: tournaments.maxEntrants,
      entryFeeInCents: tournaments.entryFeeInCents,
      prizePoolInCents: tournaments.prizePoolInCents,
      prizeName: tournaments.prizeName,
      createdAt: tournaments.createdAt,
    })
    .from(tournaments)
    .leftJoin(courses, eq(tournaments.courseId, courses.id))
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament) return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);

  // Leaderboard
  const entries = await db
    .select({
      userId: tournamentEntries.userId,
      totalScore: tournamentEntries.totalScore,
      holesCompleted: tournamentEntries.holesCompleted,
      scoreToPar: tournamentEntries.scoreToPar,
      roundScores: tournamentEntries.roundScores,
      finalRank: tournamentEntries.finalRank,
      userName: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(tournamentEntries)
    .leftJoin(users, eq(tournamentEntries.userId, users.id))
    .where(eq(tournamentEntries.tournamentId, tournamentId))
    .orderBy(asc(tournamentEntries.scoreToPar), desc(tournamentEntries.holesCompleted));

  const leaderboard = entries.map((e, i) => ({
    rank: i + 1,
    userId: e.userId,
    userName: e.userName ?? '',
    avatarUrl: e.avatarUrl ?? null,
    totalScore: e.totalScore ?? 0,
    holesCompleted: e.holesCompleted,
    scoreToPar: e.scoreToPar ?? 0,
    roundScores: (e.roundScores as number[]) ?? [],
  }));

  const currentEntrants = entries.length;
  const isOptedIn = userId ? entries.some((e) => e.userId === userId) : false;

  return c.json({ data: { ...tournament, currentEntrants, isOptedIn, leaderboard } });
});

// POST /v1/tournaments — create tournament (course managers)
tournamentsRouter.post('/', authMiddleware, zValidator('json', createTournamentSchema), async (c) => {
  const { supabaseUserId } = c.get('user');
  const body = c.req.valid('json');

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [tournament] = await db
    .insert(tournaments)
    .values({
      ...body,
      createdByUserId: userId,
      status: 'upcoming',
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
    })
    .returning();

  return c.json({ data: tournament }, 201);
});

// POST /v1/tournaments/:tournamentId/enter — opt in to tournament
tournamentsRouter.post('/:tournamentId/enter', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const { tournamentId } = c.req.param();

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);
  if (!['upcoming', 'registration'].includes(tournament.status))
    return c.json({ error: { code: 'NOT_OPEN', message: 'Tournament is not accepting entries' } }, 422);

  const currentCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tournamentEntries)
    .where(eq(tournamentEntries.tournamentId, tournamentId));
  if (Number(currentCount[0]?.count ?? 0) >= tournament.maxEntrants)
    return c.json({ error: { code: 'TOURNAMENT_FULL', message: 'Tournament is full' } }, 422);

  const [entry] = await db
    .insert(tournamentEntries)
    .values({ tournamentId, userId })
    .onConflictDoNothing()
    .returning();

  return c.json({ data: entry ?? { tournamentId, userId, already: true } }, 201);
});

// DELETE /v1/tournaments/:tournamentId/enter — withdraw
tournamentsRouter.delete('/:tournamentId/enter', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const { tournamentId } = c.req.param();

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  await db
    .delete(tournamentEntries)
    .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.userId, userId)));

  return c.json({ data: { ok: true } });
});

// PATCH /v1/tournaments/:tournamentId/scores — submit score
tournamentsRouter.patch(
  '/:tournamentId/scores',
  authMiddleware,
  zValidator('json', submitScoreSchema),
  async (c) => {
    const { supabaseUserId } = c.get('user');
    const { tournamentId } = c.req.param();
    const body = c.req.valid('json');

    const userId = await resolveUserId(supabaseUserId);
    if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const [entry] = await db
      .select()
      .from(tournamentEntries)
      .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.userId, userId)))
      .limit(1);
    if (!entry)
      return c.json({ error: { code: 'NOT_ENTERED', message: 'You have not entered this tournament' } }, 403);

    const [updated] = await db
      .update(tournamentEntries)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(tournamentEntries.id, entry.id))
      .returning();

    return c.json({ data: updated });
  }
);

// PATCH /v1/tournaments/:tournamentId — update status (creator)
tournamentsRouter.patch('/:tournamentId', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const { tournamentId } = c.req.param();

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);
  if (tournament.createdByUserId !== userId)
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the creator can update this tournament' } }, 403);

  const body = await c.req.json();
  const allowed = ['status', 'name', 'startDate', 'endDate', 'maxEntrants', 'prizePoolInCents', 'prizeName'];
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const [updated] = await db.update(tournaments).set(updates).where(eq(tournaments.id, tournamentId)).returning();

  return c.json({ data: updated });
});
