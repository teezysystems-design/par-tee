import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db, playerRankings, users } from '@par-tee/db';
import { authMiddleware } from '../middleware/auth';
import { RANK_TIERS } from '@par-tee/shared';

export const rankingsRouter = new Hono();

// ─── Helpers ───────────────────────────────────────────────────────────────

async function resolveUserId(supabaseUserId: string): Promise<string | null> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseUserId, supabaseUserId)).limit(1);
  return row?.id ?? null;
}

function tierForPoints(points: number): string {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (points >= RANK_TIERS[i]!.minPoints) return RANK_TIERS[i]!.tier;
  }
  return 'rookie';
}

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /v1/rankings/leaderboard?type=main|1v1|2v2&limit=50
rankingsRouter.get('/leaderboard', authMiddleware, async (c) => {
  const type = (c.req.query('type') ?? 'main') as '1v1' | '2v2' | 'main';
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);

  const rows = await db
    .select({
      rank: playerRankings.rank,
      userId: playerRankings.userId,
      userName: users.name,
      avatarUrl: users.avatarUrl,
      tier: playerRankings.tier,
      points: playerRankings.points,
      wins: playerRankings.wins,
      losses: playerRankings.losses,
      avgScore: playerRankings.avgScore,
    })
    .from(playerRankings)
    .leftJoin(users, eq(playerRankings.userId, users.id))
    .where(eq(playerRankings.leaderboardType, type))
    .orderBy(desc(playerRankings.points))
    .limit(limit);

  return c.json({ data: rows });
});

// GET /v1/rankings/me?type=main|1v1|2v2
rankingsRouter.get('/me', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const type = (c.req.query('type') ?? 'main') as '1v1' | '2v2' | 'main';

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [ranking] = await db
    .select()
    .from(playerRankings)
    .where(and(eq(playerRankings.userId, userId), eq(playerRankings.leaderboardType, type)))
    .limit(1);

  if (!ranking) {
    // Return default rookie ranking
    return c.json({
      data: {
        userId,
        tier: 'rookie',
        points: 0,
        rank: null,
        wins: 0,
        losses: 0,
        roundsPlayed: 0,
        avgScore: null,
      },
    });
  }

  return c.json({ data: ranking });
});

// POST /v1/rankings/award — award points after a round/match (internal use)
const awardSchema = z.object({
  targetUserId: z.string().uuid(),
  leaderboardType: z.enum(['main', '1v1', '2v2']).default('main'),
  pointsDelta: z.number().int(),
  won: z.boolean().optional(),
  lost: z.boolean().optional(),
  drew: z.boolean().optional(),
  strokesForAvg: z.number().optional(),
});

rankingsRouter.post('/award', authMiddleware, zValidator('json', awardSchema), async (c) => {
  const { targetUserId, leaderboardType, pointsDelta, won, lost, drew, strokesForAvg } = c.req.valid('json');

  // Upsert ranking row
  const existing = await db
    .select()
    .from(playerRankings)
    .where(and(eq(playerRankings.userId, targetUserId), eq(playerRankings.leaderboardType, leaderboardType)))
    .limit(1);

  if (existing.length === 0) {
    const newPoints = Math.max(0, pointsDelta);
    await db.insert(playerRankings).values({
      userId: targetUserId,
      leaderboardType,
      points: newPoints,
      tier: tierForPoints(newPoints) as any,
      wins: won ? 1 : 0,
      losses: lost ? 1 : 0,
      draws: drew ? 1 : 0,
      roundsPlayed: 1,
      avgScore: strokesForAvg ?? null,
    });
  } else {
    const row = existing[0]!;
    const newPoints = Math.max(0, row.points + pointsDelta);
    const newRoundsPlayed = row.roundsPlayed + 1;
    let newAvg: number | null = row.avgScore;
    if (strokesForAvg != null) {
      newAvg = row.avgScore == null
        ? strokesForAvg
        : (row.avgScore * row.roundsPlayed + strokesForAvg) / newRoundsPlayed;
    }

    await db
      .update(playerRankings)
      .set({
        points: newPoints,
        tier: tierForPoints(newPoints) as any,
        wins: sql`${playerRankings.wins} + ${won ? 1 : 0}`,
        losses: sql`${playerRankings.losses} + ${lost ? 1 : 0}`,
        draws: sql`${playerRankings.draws} + ${drew ? 1 : 0}`,
        roundsPlayed: newRoundsPlayed,
        avgScore: newAvg,
        updatedAt: new Date(),
      })
      .where(eq(playerRankings.id, row.id));
  }

  // Recompute global rank for this leaderboard (dense rank by points DESC)
  await db.execute(sql`
    UPDATE player_rankings pr
    SET rank = sub.new_rank
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY points DESC) AS new_rank
      FROM player_rankings
      WHERE leaderboard_type = ${leaderboardType}
    ) sub
    WHERE pr.id = sub.id AND pr.leaderboard_type = ${leaderboardType}
  `);

  return c.json({ data: { ok: true } });
});
