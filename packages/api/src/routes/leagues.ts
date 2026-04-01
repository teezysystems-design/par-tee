import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, leagues, leagueMembers, leagueMatches, users } from '@par-tee/db';
import { authMiddleware } from '../middleware/auth';

export const leaguesRouter = new Hono();

// ─── Helpers ───────────────────────────────────────────────────────────────

async function resolveUserId(supabaseUserId: string): Promise<string | null> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseUserId, supabaseUserId)).limit(1);
  return row?.id ?? null;
}

// ─── Schemas ───────────────────────────────────────────────────────────────

const createLeagueSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxMembers: z.number().int().min(4).max(32).default(8),
  courseId: z.string().uuid().optional(),
  seasonStartDate: z.string().datetime().optional(),
  seasonEndDate: z.string().datetime().optional(),
});

const inviteMemberSchema = z.object({
  userId: z.string().uuid(),
});

const recordMatchSchema = z.object({
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
  score1: z.number().int().optional(),
  score2: z.number().int().optional(),
  winnerId: z.string().uuid().optional(),
  round: z.number().int().min(1).default(1),
  matchNumber: z.number().int().min(1).default(1),
  isPlayoff: z.boolean().default(false),
  scheduledAt: z.string().datetime().optional(),
});

// ─── Routes ────────────────────────────────────────────────────────────────

// POST /v1/leagues — create league
leaguesRouter.post('/', authMiddleware, zValidator('json', createLeagueSchema), async (c) => {
  const { supabaseUserId } = c.get('user');
  const body = c.req.valid('json');

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [league] = await db
    .insert(leagues)
    .values({
      ...body,
      createdByUserId: userId,
      seasonStartDate: body.seasonStartDate ? new Date(body.seasonStartDate) : null,
      seasonEndDate: body.seasonEndDate ? new Date(body.seasonEndDate) : null,
    })
    .returning();

  // Creator auto-joins as active member
  await db.insert(leagueMembers).values({ leagueId: league!.id, userId, status: 'active' });

  return c.json({ data: league }, 201);
});

// GET /v1/leagues — list my leagues
leaguesRouter.get('/', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const myLeagueIds = await db
    .select({ leagueId: leagueMembers.leagueId })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.userId, userId), eq(leagueMembers.status, 'active')));

  if (myLeagueIds.length === 0) return c.json({ data: [] });

  const ids = myLeagueIds.map((r) => r.leagueId);

  const result = await db
    .select({
      id: leagues.id,
      name: leagues.name,
      description: leagues.description,
      status: leagues.status,
      maxMembers: leagues.maxMembers,
      seasonStartDate: leagues.seasonStartDate,
      seasonEndDate: leagues.seasonEndDate,
      courseId: leagues.courseId,
      createdByUserId: leagues.createdByUserId,
      createdAt: leagues.createdAt,
      currentMembers: sql<number>`(
        SELECT COUNT(*) FROM league_members lm
        WHERE lm.league_id = ${leagues.id} AND lm.status = 'active'
      )`,
    })
    .from(leagues)
    .where(sql`${leagues.id} = ANY(${ids})`)
    .orderBy(desc(leagues.createdAt));

  return c.json({ data: result });
});

// GET /v1/leagues/open — open leagues to browse/join
leaguesRouter.get('/open', authMiddleware, async (c) => {
  const result = await db
    .select({
      id: leagues.id,
      name: leagues.name,
      description: leagues.description,
      status: leagues.status,
      maxMembers: leagues.maxMembers,
      courseId: leagues.courseId,
      createdAt: leagues.createdAt,
      currentMembers: sql<number>`(
        SELECT COUNT(*) FROM league_members lm
        WHERE lm.league_id = ${leagues.id} AND lm.status = 'active'
      )`,
    })
    .from(leagues)
    .where(eq(leagues.status, 'recruiting'))
    .orderBy(desc(leagues.createdAt))
    .limit(20);

  return c.json({ data: result });
});

// GET /v1/leagues/:leagueId — get league details + standings
leaguesRouter.get('/:leagueId', authMiddleware, async (c) => {
  const { leagueId } = c.req.param();

  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return c.json({ error: { code: 'NOT_FOUND', message: 'League not found' } }, 404);

  const members = await db
    .select({
      id: leagueMembers.id,
      userId: leagueMembers.userId,
      status: leagueMembers.status,
      wins: leagueMembers.wins,
      losses: leagueMembers.losses,
      draws: leagueMembers.draws,
      points: leagueMembers.points,
      joinedAt: leagueMembers.joinedAt,
      userName: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(leagueMembers)
    .leftJoin(users, eq(leagueMembers.userId, users.id))
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.status, 'active')))
    .orderBy(desc(leagueMembers.points));

  // Compute standings rank
  const standings = members.map((m, i) => ({
    rank: i + 1,
    userId: m.userId,
    userName: m.userName ?? '',
    avatarUrl: m.avatarUrl ?? null,
    wins: m.wins,
    losses: m.losses,
    draws: m.draws,
    points: m.points,
    matchesPlayed: m.wins + m.losses + m.draws,
  }));

  return c.json({ data: { ...league, standings } });
});

// GET /v1/leagues/:leagueId/bracket — playoff bracket matches
leaguesRouter.get('/:leagueId/bracket', authMiddleware, async (c) => {
  const { leagueId } = c.req.param();

  const matches = await db
    .select({
      id: leagueMatches.id,
      round: leagueMatches.round,
      matchNumber: leagueMatches.matchNumber,
      player1Id: leagueMatches.player1Id,
      player2Id: leagueMatches.player2Id,
      winnerId: leagueMatches.winnerId,
      score1: leagueMatches.score1,
      score2: leagueMatches.score2,
      scheduledAt: leagueMatches.scheduledAt,
    })
    .from(leagueMatches)
    .where(and(eq(leagueMatches.leagueId, leagueId), eq(leagueMatches.isPlayoff, true)))
    .orderBy(leagueMatches.round, leagueMatches.matchNumber);

  // Enrich with user names
  const userIds = [...new Set(matches.flatMap((m) => [m.player1Id, m.player2Id].filter(Boolean) as string[]))];
  let nameMap: Record<string, { name: string; avatarUrl: string | null }> = {};
  if (userIds.length > 0) {
    const rows = await db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(sql`${users.id} = ANY(${userIds})`);
    nameMap = Object.fromEntries(rows.map((r) => [r.id, { name: r.name, avatarUrl: r.avatarUrl }]));
  }

  const enriched = matches.map((m) => ({
    ...m,
    player1Name: m.player1Id ? (nameMap[m.player1Id]?.name ?? null) : null,
    player2Name: m.player2Id ? (nameMap[m.player2Id]?.name ?? null) : null,
  }));

  return c.json({ data: enriched });
});

// POST /v1/leagues/:leagueId/invite — invite player
leaguesRouter.post('/:leagueId/invite', authMiddleware, zValidator('json', inviteMemberSchema), async (c) => {
  const { supabaseUserId } = c.get('user');
  const { leagueId } = c.req.param();
  const { userId: inviteeId } = c.req.valid('json');

  const callerId = await resolveUserId(supabaseUserId);
  if (!callerId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return c.json({ error: { code: 'NOT_FOUND', message: 'League not found' } }, 404);
  if (league.createdByUserId !== callerId)
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the league creator can invite members' } }, 403);

  const memberCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.status, 'active')));
  if (Number(memberCount[0]?.count ?? 0) >= league.maxMembers)
    return c.json({ error: { code: 'LEAGUE_FULL', message: 'League is full' } }, 422);

  const [invite] = await db
    .insert(leagueMembers)
    .values({ leagueId, userId: inviteeId, status: 'invited' })
    .onConflictDoUpdate({
      target: [leagueMembers.leagueId, leagueMembers.userId],
      set: { status: 'invited' },
    })
    .returning();

  return c.json({ data: invite }, 201);
});

// POST /v1/leagues/:leagueId/join — self-join open league
leaguesRouter.post('/:leagueId/join', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const { leagueId } = c.req.param();

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return c.json({ error: { code: 'NOT_FOUND', message: 'League not found' } }, 404);
  if (league.status !== 'recruiting')
    return c.json({ error: { code: 'NOT_OPEN', message: 'League is not recruiting' } }, 422);

  const memberCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.status, 'active')));
  if (Number(memberCount[0]?.count ?? 0) >= league.maxMembers)
    return c.json({ error: { code: 'LEAGUE_FULL', message: 'League is full' } }, 422);

  const [member] = await db
    .insert(leagueMembers)
    .values({ leagueId, userId, status: 'active' })
    .onConflictDoUpdate({ target: [leagueMembers.leagueId, leagueMembers.userId], set: { status: 'active' } })
    .returning();

  return c.json({ data: member }, 201);
});

// POST /v1/leagues/:leagueId/matches — record a match result
leaguesRouter.post('/:leagueId/matches', authMiddleware, zValidator('json', recordMatchSchema), async (c) => {
  const { supabaseUserId } = c.get('user');
  const { leagueId } = c.req.param();
  const body = c.req.valid('json');

  const callerId = await resolveUserId(supabaseUserId);
  if (!callerId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return c.json({ error: { code: 'NOT_FOUND', message: 'League not found' } }, 404);

  const [match] = await db
    .insert(leagueMatches)
    .values({
      leagueId,
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      playedAt: body.winnerId ? new Date() : null,
    })
    .returning();

  // Update standings if match is complete
  if (body.winnerId && body.player1Id && body.player2Id) {
    const loserId = body.winnerId === body.player1Id ? body.player2Id : body.player1Id;

    await db
      .update(leagueMembers)
      .set({
        wins: sql`${leagueMembers.wins} + 1`,
        points: sql`${leagueMembers.points} + 3`,
      })
      .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, body.winnerId)));

    await db
      .update(leagueMembers)
      .set({ losses: sql`${leagueMembers.losses} + 1` })
      .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, loserId)));
  }

  return c.json({ data: match }, 201);
});

// PATCH /v1/leagues/:leagueId — update league status
leaguesRouter.patch('/:leagueId', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const { leagueId } = c.req.param();

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return c.json({ error: { code: 'NOT_FOUND', message: 'League not found' } }, 404);
  if (league.createdByUserId !== userId)
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the creator can update the league' } }, 403);

  const body = await c.req.json();
  const allowed = ['status', 'name', 'description', 'seasonStartDate', 'seasonEndDate'];
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const [updated] = await db.update(leagues).set(updates).where(eq(leagues.id, leagueId)).returning();

  return c.json({ data: updated });
});
