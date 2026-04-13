import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createAdminClient } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { standardRateLimit } from '../middleware/rate-limit';
import { badRequest, notFound, forbidden, conflict } from '../lib/errors';
import { createAutoPost } from './social';

const router = new Hono();

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── GET /leagues — list leagues (mine or recruiting) ────────────────────────

router.get('/', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const { status, mine, limit } = c.req.query();
  const sb = createAdminClient();
  const limitNum = Math.min(Number(limit) || 20, 50);

  if (mine === 'true') {
    // Get league IDs where user is a member
    const { data: memberships } = await sb
      .from('league_members')
      .select('league_id')
      .eq('user_id', profileId)
      .eq('status', 'active');

    if (!memberships || memberships.length === 0) {
      return c.json({ data: [] });
    }

    const leagueIds = memberships.map((m: { league_id: string }) => m.league_id);

    const { data: leagues } = await sb
      .from('leagues')
      .select('*, courses(name)')
      .in('id', leagueIds)
      .order('created_at', { ascending: false })
      .limit(limitNum);

    // Get member counts
    const formatted = await Promise.all(
      (leagues ?? []).map(async (l: Record<string, unknown>) => {
        const { count } = await sb
          .from('league_members')
          .select('id', { count: 'exact', head: true })
          .eq('league_id', l.id)
          .eq('status', 'active');
        const course = l.courses as Record<string, unknown> | null;
        return {
          id: l.id,
          name: l.name,
          description: l.description,
          leagueType: l.league_type,
          scoringFormat: l.scoring_format,
          status: l.status,
          maxMembers: l.max_members,
          currentMembers: count ?? 0,
          seasonStartDate: l.season_start_date,
          seasonEndDate: l.season_end_date,
          currentRound: l.current_round,
          courseName: course?.name ?? null,
          createdAt: l.created_at,
        };
      })
    );

    return c.json({ data: formatted });
  }

  // Public recruiting leagues
  let query = sb
    .from('leagues')
    .select('*, courses(name)')
    .order('created_at', { ascending: false })
    .limit(limitNum);

  if (status) {
    query = query.eq('status', status);
  } else {
    query = query.eq('status', 'recruiting');
  }

  const { data: leagues } = await query;

  const formatted = await Promise.all(
    (leagues ?? []).map(async (l: Record<string, unknown>) => {
      const { count } = await sb
        .from('league_members')
        .select('id', { count: 'exact', head: true })
        .eq('league_id', l.id)
        .eq('status', 'active');
      const course = l.courses as Record<string, unknown> | null;
      return {
        id: l.id,
        name: l.name,
        description: l.description,
        leagueType: l.league_type,
        scoringFormat: l.scoring_format,
        status: l.status,
        maxMembers: l.max_members,
        currentMembers: count ?? 0,
        seasonStartDate: l.season_start_date,
        seasonEndDate: l.season_end_date,
        courseName: course?.name ?? null,
        createdAt: l.created_at,
      };
    })
  );

  return c.json({ data: formatted });
});

// ─── GET /leagues/:id — league detail ────────────────────────────────────────

router.get('/:id', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  await resolveProfileId(user.id);
  const leagueId = c.req.param('id');
  const sb = createAdminClient();

  const { data: league } = await sb
    .from('leagues')
    .select('*, courses(name, hole_count, par_score)')
    .eq('id', leagueId)
    .single();

  if (!league) notFound('League not found');

  // Get members with user info
  const { data: members } = await sb
    .from('league_members')
    .select('id, user_id, status, elo_rating, wins, losses, draws, team_name, partner_id, users(display_name, username, avatar_url, handicap)')
    .eq('league_id', leagueId)
    .eq('status', 'active')
    .order('elo_rating', { ascending: false });

  const formattedMembers = (members ?? []).map((m: Record<string, unknown>, idx: number) => {
    const u = m.users as Record<string, unknown> | null;
    return {
      rank: idx + 1,
      userId: m.user_id,
      displayName: u?.display_name ?? u?.username ?? 'Unknown',
      username: u?.username ?? null,
      avatarUrl: u?.avatar_url ?? null,
      handicap: u?.handicap ?? null,
      eloRating: m.elo_rating,
      wins: m.wins,
      losses: m.losses,
      draws: m.draws,
      teamName: m.team_name,
      partnerId: m.partner_id,
    };
  });

  // Recent matches
  const { data: matches } = await sb
    .from('league_matches')
    .select(`
      id, round, is_playoff, status, score1, score2, played_at, deadline_at,
      player1:users!league_matches_player1_id_fkey(display_name, username),
      player2:users!league_matches_player2_id_fkey(display_name, username),
      winner:users!league_matches_winner_id_fkey(display_name, username)
    `)
    .eq('league_id', leagueId)
    .order('round', { ascending: false })
    .order('played_at', { ascending: false })
    .limit(20);

  const formattedMatches = (matches ?? []).map((m: Record<string, unknown>) => {
    const p1 = m.player1 as Record<string, unknown> | null;
    const p2 = m.player2 as Record<string, unknown> | null;
    const w = m.winner as Record<string, unknown> | null;
    return {
      id: m.id,
      round: m.round,
      isPlayoff: m.is_playoff,
      status: m.status,
      score1: m.score1,
      score2: m.score2,
      playedAt: m.played_at,
      deadlineAt: m.deadline_at,
      player1Name: p1?.display_name ?? p1?.username ?? 'TBD',
      player2Name: p2?.display_name ?? p2?.username ?? 'TBD',
      winnerName: w?.display_name ?? w?.username ?? null,
    };
  });

  const course = league.courses as Record<string, unknown> | null;

  return c.json({
    data: {
      id: league.id,
      name: league.name,
      description: league.description,
      leagueType: league.league_type,
      scoringFormat: league.scoring_format,
      status: league.status,
      maxMembers: league.max_members,
      currentRound: league.current_round,
      allowRematches: league.allow_rematches,
      partnerConfig: league.partner_config,
      playoffFormat: league.playoff_format,
      playoffSize: league.playoff_size,
      seasonStartDate: league.season_start_date,
      seasonEndDate: league.season_end_date,
      courseName: course?.name ?? null,
      createdByUserId: league.created_by_user_id,
      members: formattedMembers,
      matches: formattedMatches,
    },
  });
});

// ─── POST /leagues — create league ───────────────────────────────────────────

const createLeagueSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  leagueType: z.enum(['1v1', '2v2']).default('1v1'),
  scoringFormat: z.enum(['stroke_play', 'net_stroke_play', 'match_play']).default('stroke_play'),
  courseId: z.string().uuid().optional(),
  maxMembers: z.number().int().min(2).max(32).default(8),
  seasonStartDate: z.string().optional(),
  seasonEndDate: z.string().optional(),
  allowRematches: z.boolean().default(false),
  partnerConfig: z.enum(['locked', 'flexible']).default('locked'),
  playoffFormat: z.enum(['single_elimination', 'double_elimination', 'best_of_three']).default('single_elimination'),
  playoffSize: z.number().int().min(2).max(16).default(4),
});

router.post(
  '/',
  standardRateLimit,
  authMiddleware,
  zValidator('json', createLeagueSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const body = c.req.valid('json');
    const sb = createAdminClient();

    const { data: league, error } = await sb
      .from('leagues')
      .insert({
        id: crypto.randomUUID(),
        name: body.name,
        description: body.description ?? null,
        created_by_user_id: profileId,
        league_type: body.leagueType,
        scoring_format: body.scoringFormat,
        course_id: body.courseId ?? null,
        max_members: body.maxMembers,
        season_start_date: body.seasonStartDate ?? null,
        season_end_date: body.seasonEndDate ?? null,
        allow_rematches: body.allowRematches,
        partner_config: body.partnerConfig,
        playoff_format: body.playoffFormat,
        playoff_size: body.playoffSize,
        status: 'recruiting',
        current_round: 1,
      })
      .select()
      .single();

    if (error) badRequest(error.message);

    // Auto-join commissioner
    await sb.from('league_members').insert({
      id: crypto.randomUUID(),
      league_id: league.id,
      user_id: profileId,
      status: 'active',
      elo_rating: 1200,
    });

    return c.json({ data: { id: league.id, name: league.name } }, 201);
  }
);

// ─── POST /leagues/:id/invite — invite by username ───────────────────────────

const inviteSchema = z.object({
  username: z.string().min(1).max(30),
});

router.post(
  '/:id/invite',
  standardRateLimit,
  authMiddleware,
  zValidator('json', inviteSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const leagueId = c.req.param('id');
    const { username } = c.req.valid('json');
    const sb = createAdminClient();

    // Verify league + commissioner
    const { data: league } = await sb
      .from('leagues')
      .select('id, created_by_user_id, max_members, status')
      .eq('id', leagueId)
      .single();

    if (!league) notFound('League not found');
    if (league.created_by_user_id !== profileId) forbidden('Only the commissioner can invite');
    if (league.status !== 'recruiting') badRequest('League is no longer recruiting');

    // Check capacity
    const { count } = await sb
      .from('league_members')
      .select('id', { count: 'exact', head: true })
      .eq('league_id', leagueId)
      .neq('status', 'declined');

    if ((count ?? 0) >= league.max_members) badRequest('League is full');

    // Find user by username
    const { data: target } = await sb
      .from('users')
      .select('id, username')
      .eq('username', username.toLowerCase())
      .single();

    if (!target) notFound(`No user found with username "${username}"`);
    if (target.id === profileId) badRequest('Cannot invite yourself');

    // Check not already member
    const { data: existing } = await sb
      .from('league_members')
      .select('id, status')
      .eq('league_id', leagueId)
      .eq('user_id', target.id)
      .single();

    if (existing && existing.status === 'active') {
      return c.json({ data: { message: `@${username} is already a member` } });
    }

    if (existing) {
      await sb.from('league_members').update({ status: 'invited' }).eq('id', existing.id);
    } else {
      await sb.from('league_members').insert({
        id: crypto.randomUUID(),
        league_id: leagueId,
        user_id: target.id,
        status: 'invited',
        elo_rating: 1200,
      });
    }

    // Fire-and-forget notification
    sb.from('notifications')
      .insert({
        id: crypto.randomUUID(),
        user_id: target.id,
        type: 'league_invite',
        title: 'League Invite',
        body: `You've been invited to a league!`,
        data: { leagueId },
      })
      .then(() => {});

    return c.json({ data: { message: `Invited @${username}` } }, 201);
  }
);

// ─── POST /leagues/:id/join — accept invite ─────────────────────────────────

router.post('/:id/join', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const leagueId = c.req.param('id');
  const sb = createAdminClient();

  const { data: member } = await sb
    .from('league_members')
    .select('id, status')
    .eq('league_id', leagueId)
    .eq('user_id', profileId)
    .single();

  if (!member) forbidden('You have not been invited to this league');
  if (member.status === 'active') return c.json({ data: { message: 'Already a member' } });

  await sb
    .from('league_members')
    .update({ status: 'active', joined_at: new Date().toISOString() })
    .eq('id', member.id);

  return c.json({ data: { joined: true } });
});

// ─── POST /leagues/:id/start — commissioner starts the season ───────────────

router.post('/:id/start', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const leagueId = c.req.param('id');
  const sb = createAdminClient();

  const { data: league } = await sb
    .from('leagues')
    .select('id, created_by_user_id, status')
    .eq('id', leagueId)
    .single();

  if (!league) notFound('League not found');
  if (league.created_by_user_id !== profileId) forbidden('Only the commissioner can start');
  if (league.status !== 'recruiting') badRequest('League has already started');

  // Need at least 2 active members
  const { count } = await sb
    .from('league_members')
    .select('id', { count: 'exact', head: true })
    .eq('league_id', leagueId)
    .eq('status', 'active');

  if ((count ?? 0) < 2) badRequest('Need at least 2 members to start');

  await sb
    .from('leagues')
    .update({
      status: 'active',
      current_round: 1,
      season_start_date: new Date().toISOString(),
    })
    .eq('id', leagueId);

  return c.json({ data: { started: true } });
});

// ─── GET /leagues/:id/standings — current standings ─────────────────────────

router.get('/:id/standings', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  await resolveProfileId(user.id);
  const leagueId = c.req.param('id');
  const sb = createAdminClient();

  const { data: members } = await sb
    .from('league_members')
    .select('user_id, elo_rating, wins, losses, draws, team_name, users(display_name, username, avatar_url)')
    .eq('league_id', leagueId)
    .eq('status', 'active')
    .order('elo_rating', { ascending: false });

  const standings = (members ?? []).map((m: Record<string, unknown>, idx: number) => {
    const u = m.users as Record<string, unknown> | null;
    const matchesPlayed = ((m.wins as number) ?? 0) + ((m.losses as number) ?? 0) + ((m.draws as number) ?? 0);
    return {
      rank: idx + 1,
      userId: m.user_id,
      displayName: u?.display_name ?? u?.username ?? 'Unknown',
      username: u?.username ?? null,
      avatarUrl: u?.avatar_url ?? null,
      eloRating: m.elo_rating,
      wins: m.wins ?? 0,
      losses: m.losses ?? 0,
      draws: m.draws ?? 0,
      matchesPlayed,
      winRate: matchesPlayed > 0 ? Math.round(((m.wins as number) ?? 0) / matchesPlayed * 100) : 0,
      teamName: m.team_name,
    };
  });

  return c.json({ data: standings });
});

// ─── POST /leagues/:id/matches — submit match result ────────────────────────

const matchResultSchema = z.object({
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
  score1: z.number().int().min(0),
  score2: z.number().int().min(0),
  round: z.number().int().min(1).optional(),
  playedAt: z.string(),
  isPlayoff: z.boolean().default(false),
  partyId: z.string().uuid().optional(),
});

router.post(
  '/:id/matches',
  standardRateLimit,
  authMiddleware,
  zValidator('json', matchResultSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const leagueId = c.req.param('id');
    const body = c.req.valid('json');
    const sb = createAdminClient();

    const { data: league } = await sb
      .from('leagues')
      .select('id, created_by_user_id, name, league_type, current_round, status')
      .eq('id', leagueId)
      .single();

    if (!league) notFound('League not found');
    if (league.created_by_user_id !== profileId) forbidden('Only the commissioner can submit results');
    if (!['active', 'playoffs'].includes(league.status as string)) badRequest('League is not active');

    const winnerId = body.score1 > body.score2
      ? body.player1Id
      : body.score2 > body.score1
        ? body.player2Id
        : null;

    const { data: match, error } = await sb
      .from('league_matches')
      .insert({
        id: crypto.randomUUID(),
        league_id: leagueId,
        player1_id: body.player1Id,
        player2_id: body.player2Id,
        winner_id: winnerId,
        score1: body.score1,
        score2: body.score2,
        round: body.round ?? league.current_round,
        is_playoff: body.isPlayoff,
        played_at: body.playedAt,
        party_id: body.partyId ?? null,
        status: 'completed',
      })
      .select()
      .single();

    if (error) badRequest(error.message);

    // Update ELO + win/loss via stored procedure
    if (winnerId) {
      const loserId = winnerId === body.player1Id ? body.player2Id : body.player1Id;
      await sb.rpc('record_match_result', {
        p_league_id: leagueId,
        p_winner_id: winnerId,
        p_loser_id: loserId,
      }).catch(() => {});
    } else {
      // Draw — increment draws for both
      await sb.from('league_members').update({ draws: sb.rpc('increment_draws') as unknown as number })
        .eq('league_id', leagueId)
        .eq('user_id', body.player1Id)
        .catch(() => {});
    }

    // Auto-post match result
    if (winnerId) {
      const { data: winner } = await sb.from('users').select('display_name').eq('id', winnerId).single();
      const { data: loser } = await sb.from('users').select('display_name').eq('id', winnerId === body.player1Id ? body.player2Id : body.player1Id).single();
      createAutoPost({
        authorId: winnerId,
        body: `Won a ${league.league_type} league match in ${league.name}! ${body.score1}-${body.score2} vs ${loser?.display_name ?? 'opponent'}`,
        postType: 'challenge',
      }).catch(() => {});
    }

    return c.json({ data: { matchId: match.id, winnerId } }, 201);
  }
);

// ─── POST /leagues/:id/advance — advance to next round or playoffs ──────────

router.post('/:id/advance', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const leagueId = c.req.param('id');
  const sb = createAdminClient();

  const { data: league } = await sb
    .from('leagues')
    .select('id, created_by_user_id, status, current_round')
    .eq('id', leagueId)
    .single();

  if (!league) notFound('League not found');
  if (league.created_by_user_id !== profileId) forbidden('Only the commissioner can advance');

  if (league.status === 'active') {
    await sb
      .from('leagues')
      .update({ current_round: (league.current_round ?? 1) + 1 })
      .eq('id', leagueId);
    return c.json({ data: { round: (league.current_round ?? 1) + 1, status: 'active' } });
  }

  return c.json({ data: { status: league.status } });
});

// ─── POST /leagues/:id/playoffs — start playoffs ────────────────────────────

router.post('/:id/playoffs', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const leagueId = c.req.param('id');
  const sb = createAdminClient();

  const { data: league } = await sb
    .from('leagues')
    .select('id, created_by_user_id, status, playoff_size')
    .eq('id', leagueId)
    .single();

  if (!league) notFound('League not found');
  if (league.created_by_user_id !== profileId) forbidden('Only the commissioner');
  if (league.status !== 'active') badRequest('League must be active to start playoffs');

  await sb.from('leagues').update({ status: 'playoffs' }).eq('id', leagueId);

  return c.json({ data: { status: 'playoffs', playoffSize: league.playoff_size } });
});

// ─── POST /leagues/:id/complete — end the league ────────────────────────────

router.post('/:id/complete', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const leagueId = c.req.param('id');
  const sb = createAdminClient();

  const { data: league } = await sb
    .from('leagues')
    .select('id, created_by_user_id, name, league_type')
    .eq('id', leagueId)
    .single();

  if (!league) notFound('League not found');
  if (league.created_by_user_id !== profileId) forbidden('Only the commissioner');

  await sb.from('leagues').update({ status: 'completed', season_end_date: new Date().toISOString() }).eq('id', leagueId);

  // Get champion (highest ELO)
  const { data: champion } = await sb
    .from('league_members')
    .select('user_id, users(display_name)')
    .eq('league_id', leagueId)
    .eq('status', 'active')
    .order('elo_rating', { ascending: false })
    .limit(1)
    .single();

  if (champion) {
    const champ = champion.users as Record<string, unknown> | null;
    createAutoPost({
      authorId: champion.user_id as string,
      body: `Won the ${league.name} ${league.league_type} league! Champion! 🏅`,
      postType: 'challenge',
    }).catch(() => {});
  }

  return c.json({ data: { completed: true } });
});

export { router as leaguesRouter };
