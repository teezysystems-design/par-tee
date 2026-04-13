import { Hono } from 'hono';
import { createAdminClient } from '../lib/supabase';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { standardRateLimit } from '../middleware/rate-limit';
import { badRequest, notFound } from '../lib/errors';

const router = new Hono();

/** Resolve Supabase Auth UUID → profile users.id */
async function resolveProfileId(supabaseUserId: string): Promise<string> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from('users')
    .select('id')
    .eq('supabase_user_id', supabaseUserId)
    .single();
  if (error || !data) notFound('Profile not found — complete onboarding first');
  return data.id;
}

// ─── GET /rankings/me — caller's ranking across all leaderboards ─────────

router.get('/me', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const sb = createAdminClient();
  const type = c.req.query('type') ?? 'main';

  // Get ranking for requested leaderboard type
  const { data: ranking } = await sb
    .from('player_rankings')
    .select('*')
    .eq('user_id', profileId)
    .eq('leaderboard_type', type)
    .single();

  // Calculate global rank position
  let globalRank: number | null = null;
  if (ranking) {
    const { count } = await sb
      .from('player_rankings')
      .select('id', { count: 'exact', head: true })
      .eq('leaderboard_type', type)
      .gt('points', ranking.points);
    globalRank = (count ?? 0) + 1;
  }

  // Get recent ranking history
  const { data: recentHistory } = await sb
    .from('ranking_history')
    .select('event_type, points_delta, points_after, tier_before, tier_after, created_at, note')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(10);

  return c.json({
    data: {
      tier: ranking?.tier ?? 'bronze_1',
      points: ranking?.points ?? 0,
      rank: globalRank,
      wins: ranking?.wins ?? 0,
      losses: ranking?.losses ?? 0,
      draws: ranking?.draws ?? 0,
      roundsPlayed: ranking?.rounds_played ?? 0,
      avgScore: ranking?.avg_score ?? null,
      recentHistory: (recentHistory ?? []).map((h: Record<string, unknown>) => ({
        eventType: h.event_type,
        pointsDelta: h.points_delta,
        pointsAfter: h.points_after,
        tierBefore: h.tier_before,
        tierAfter: h.tier_after,
        createdAt: h.created_at,
        note: h.note,
      })),
    },
  });
});

// ─── GET /rankings/user/:userId — public ranking for any user ────────────

router.get('/user/:userId', standardRateLimit, async (c) => {
  const sb = createAdminClient();
  const userId = c.req.param('userId');

  const { data: ranking } = await sb
    .from('player_rankings')
    .select('*, users(display_name, username, avatar_url)')
    .eq('user_id', userId)
    .eq('leaderboard_type', 'main')
    .single();

  if (!ranking) notFound('Ranking not found');

  // Calculate global rank
  const { count } = await sb
    .from('player_rankings')
    .select('id', { count: 'exact', head: true })
    .eq('leaderboard_type', 'main')
    .gt('points', ranking.points);

  const u = ranking.users as Record<string, unknown> | null;

  return c.json({
    data: {
      userId,
      userName: u?.display_name ?? u?.username ?? 'Unknown',
      avatarUrl: u?.avatar_url ?? null,
      tier: ranking.tier,
      points: ranking.points,
      rank: (count ?? 0) + 1,
      wins: ranking.wins,
      losses: ranking.losses,
      roundsPlayed: ranking.rounds_played,
      avgScore: ranking.avg_score,
    },
  });
});

// ─── GET /rankings/history — caller's monthly rank progression ───────────

router.get('/history', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const sb = createAdminClient();

  const { data: events } = await sb
    .from('ranking_history')
    .select('points_delta, points_after, tier_after, created_at')
    .eq('user_id', profileId)
    .order('created_at', { ascending: true });

  if (!events || events.length === 0) {
    return c.json({ data: [] });
  }

  // Group by year-month, take last entry per month
  const monthly: Record<string, { points: number; tier: string }> = {};
  for (const row of events) {
    const d = new Date(row.created_at as string);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthly[key] = { points: row.points_after as number, tier: row.tier_after as string };
  }

  const history = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, { points, tier }]) => {
      const [, m] = month.split('-');
      const label = new Date(0, Number(m) - 1).toLocaleString('en-US', { month: 'short' });
      return { label, points, tier };
    });

  return c.json({ data: history });
});

// ─── GET /rankings/leaderboard — top players ─────────────────────────────

router.get('/leaderboard', standardRateLimit, optionalAuth, async (c) => {
  const { type, tier, limit, offset } = c.req.query();
  const sb = createAdminClient();
  const leaderboardType = type ?? 'main';
  const limitNum = Number(limit) || 50;
  const offsetNum = Number(offset) || 0;

  let query = sb
    .from('player_rankings')
    .select('user_id, points, tier, wins, losses, draws, rounds_played, avg_score, users(id, display_name, username, avatar_url)')
    .eq('leaderboard_type', leaderboardType)
    .gt('points', 0)
    .order('points', { ascending: false })
    .range(offsetNum, offsetNum + limitNum - 1);

  if (tier) query = query.eq('tier', tier);

  const { data, error } = await query;
  if (error) badRequest(error.message);

  const entries = (data ?? []).map((entry: Record<string, unknown>, idx: number) => {
    const u = entry.users as Record<string, unknown> | null;
    return {
      rank: offsetNum + idx + 1,
      userId: entry.user_id ?? u?.id,
      userName: u?.display_name ?? u?.username ?? 'Unknown',
      username: u?.username ?? null,
      avatarUrl: u?.avatar_url ?? null,
      tier: entry.tier,
      points: entry.points,
      wins: entry.wins ?? 0,
      losses: entry.losses ?? 0,
      avgScore: entry.avg_score ?? null,
      roundsPlayed: entry.rounds_played ?? 0,
    };
  });

  return c.json({ data: entries });
});

// ─── GET /rankings/tiers — tier reference with point thresholds ──────────

router.get('/tiers', standardRateLimit, async (c) => {
  const tiers = [
    { tier: 'bronze_1', label: 'Bronze 1', icon: '🥉', minPoints: 0, maxPoints: 99 },
    { tier: 'bronze_2', label: 'Bronze 2', icon: '🥉', minPoints: 100, maxPoints: 249 },
    { tier: 'bronze_3', label: 'Bronze 3', icon: '🥉', minPoints: 250, maxPoints: 499 },
    { tier: 'silver_1', label: 'Silver 1', icon: '🥈', minPoints: 500, maxPoints: 749 },
    { tier: 'silver_2', label: 'Silver 2', icon: '🥈', minPoints: 750, maxPoints: 999 },
    { tier: 'silver_3', label: 'Silver 3', icon: '🥈', minPoints: 1000, maxPoints: 1499 },
    { tier: 'gold_1', label: 'Gold 1', icon: '🥇', minPoints: 1500, maxPoints: 1999 },
    { tier: 'gold_2', label: 'Gold 2', icon: '🥇', minPoints: 2000, maxPoints: 2749 },
    { tier: 'gold_3', label: 'Gold 3', icon: '🥇', minPoints: 2750, maxPoints: 3499 },
    { tier: 'platinum_1', label: 'Platinum 1', icon: '💎', minPoints: 3500, maxPoints: 4499 },
    { tier: 'platinum_2', label: 'Platinum 2', icon: '💎', minPoints: 4500, maxPoints: 5499 },
    { tier: 'platinum_3', label: 'Platinum 3', icon: '💎', minPoints: 5500, maxPoints: 6999 },
    { tier: 'diamond_1', label: 'Diamond 1', icon: '💠', minPoints: 7000, maxPoints: 8499 },
    { tier: 'diamond_2', label: 'Diamond 2', icon: '💠', minPoints: 8500, maxPoints: 9999 },
    { tier: 'diamond_3', label: 'Diamond 3', icon: '💠', minPoints: 10000, maxPoints: 12499 },
    { tier: 'master', label: 'Master', icon: '🔮', minPoints: 12500, maxPoints: 14999 },
    { tier: 'grandmaster', label: 'Grandmaster', icon: '👑', minPoints: 15000, maxPoints: 19999 },
    { tier: 'unreal', label: 'Unreal', icon: '⚡', minPoints: 20000, maxPoints: null },
  ];
  return c.json({ data: tiers });
});

// ─── GET /rankings/check-rankup — check if user ranked up recently ───────

router.get('/check-rankup', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const sb = createAdminClient();

  // Check the most recent ranking history event
  const { data: latest } = await sb
    .from('ranking_history')
    .select('tier_before, tier_after, points_after, points_delta, created_at')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!latest || latest.tier_before === latest.tier_after) {
    return c.json({ data: { rankedUp: false } });
  }

  // Check if this was within the last 5 minutes (fresh rank-up)
  const eventAge = Date.now() - new Date(latest.created_at as string).getTime();
  const isFresh = eventAge < 5 * 60 * 1000;

  return c.json({
    data: {
      rankedUp: isFresh,
      fromTier: latest.tier_before,
      toTier: latest.tier_after,
      newPoints: latest.points_after,
      pointsEarned: latest.points_delta,
    },
  });
});

export { router as rankingsRouter };
