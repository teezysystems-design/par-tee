import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createAdminClient } from '../lib/supabase';
import { authMiddleware, optionalAuth } from '../middleware/auth';
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

// ─── GET /tournaments — browse tournaments ──────────────────────────────────

router.get('/', standardRateLimit, async (c) => {
  const { status, courseId, limit } = c.req.query();
  const sb = createAdminClient();
  const limitNum = Math.min(Number(limit) || 20, 50);

  let query = sb
    .from('tournaments')
    .select('*, courses(name, address)')
    .order('start_date', { ascending: true })
    .limit(limitNum);

  if (status) {
    query = query.eq('status', status);
  } else {
    query = query.in('status', ['open', 'live']);
  }

  if (courseId) {
    query = query.eq('course_id', courseId);
  }

  const { data: tournaments, error } = await query;
  if (error) badRequest(error.message);

  // Get entry counts
  const formatted = await Promise.all(
    (tournaments ?? []).map(async (t: Record<string, unknown>) => {
      const { count } = await sb
        .from('tournament_entries')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', t.id);

      const course = t.courses as Record<string, unknown> | null;
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        courseId: t.course_id,
        courseName: course?.name ?? null,
        courseAddress: course?.address ?? null,
        format: t.format,
        status: t.status,
        startDate: t.start_date,
        endDate: t.end_date,
        maxEntrants: t.max_entrants,
        currentEntrants: count ?? 0,
        createdAt: t.created_at,
      };
    })
  );

  return c.json({ data: formatted });
});

// ─── GET /tournaments/:id — tournament detail ───────────────────────────────

router.get('/:id', standardRateLimit, async (c) => {
  const tournamentId = c.req.param('id');
  const sb = createAdminClient();

  const { data: tournament } = await sb
    .from('tournaments')
    .select('*, courses(name, address, hole_count, par_score)')
    .eq('id', tournamentId)
    .single();

  if (!tournament) notFound('Tournament not found');

  // Get entry count
  const { count } = await sb
    .from('tournament_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId);

  const course = tournament.courses as Record<string, unknown> | null;

  return c.json({
    data: {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      courseId: tournament.course_id,
      courseName: course?.name ?? null,
      courseAddress: course?.address ?? null,
      holeCount: course?.hole_count ?? 18,
      parScore: course?.par_score ?? 72,
      format: tournament.format,
      status: tournament.status,
      startDate: tournament.start_date,
      endDate: tournament.end_date,
      maxEntrants: tournament.max_entrants,
      currentEntrants: count ?? 0,
      createdByUserId: tournament.created_by_user_id,
      createdAt: tournament.created_at,
    },
  });
});

// ─── GET /tournaments/:id/leaderboard — live leaderboard ────────────────────

router.get('/:id/leaderboard', standardRateLimit, async (c) => {
  const tournamentId = c.req.param('id');
  const sb = createAdminClient();

  const { data: entries, error } = await sb
    .from('tournament_entries')
    .select('user_id, total_strokes, score_to_par, holes_completed, completed_at, users(display_name, username, avatar_url)')
    .eq('tournament_id', tournamentId)
    .order('score_to_par', { ascending: true, nullsFirst: false })
    .order('total_strokes', { ascending: true, nullsFirst: false });

  if (error) badRequest(error.message);

  const leaderboard = (entries ?? []).map((e: Record<string, unknown>, idx: number) => {
    const u = e.users as Record<string, unknown> | null;
    return {
      position: idx + 1,
      userId: e.user_id,
      displayName: u?.display_name ?? u?.username ?? 'Unknown',
      username: u?.username ?? null,
      avatarUrl: u?.avatar_url ?? null,
      totalStrokes: e.total_strokes,
      scoreToPar: e.score_to_par,
      holesCompleted: e.holes_completed ?? 0,
      completedAt: e.completed_at,
    };
  });

  return c.json({ data: leaderboard });
});

// ─── POST /tournaments — create tournament (course managers) ────────────────

const createTournamentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  courseId: z.string().uuid(),
  maxEntrants: z.number().int().min(2).max(128).default(32),
  startDate: z.string(),
  endDate: z.string(),
  format: z.enum(['stroke_play', 'stableford', 'net_stroke_play']).default('stroke_play'),
});

router.post(
  '/',
  standardRateLimit,
  authMiddleware,
  zValidator('json', createTournamentSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const body = c.req.valid('json');
    const sb = createAdminClient();

    const { data: tournament, error } = await sb
      .from('tournaments')
      .insert({
        id: crypto.randomUUID(),
        name: body.name,
        description: body.description ?? null,
        created_by_user_id: profileId,
        course_id: body.courseId,
        max_entrants: body.maxEntrants,
        start_date: body.startDate,
        end_date: body.endDate,
        format: body.format,
        status: 'open',
      })
      .select()
      .single();

    if (error) badRequest(error.message);

    return c.json({ data: { id: tournament.id, name: tournament.name } }, 201);
  }
);

// ─── POST /tournaments/:id/enter — golfer enters tournament ─────────────────

router.post('/:id/enter', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const tournamentId = c.req.param('id');
  const sb = createAdminClient();

  const { data: tournament } = await sb
    .from('tournaments')
    .select('id, status, max_entrants, name')
    .eq('id', tournamentId)
    .single();

  if (!tournament) notFound('Tournament not found');
  if (!['open', 'live'].includes(tournament.status)) badRequest('Tournament is not open for entry');

  // Check capacity
  const { count } = await sb
    .from('tournament_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId);

  if ((count ?? 0) >= tournament.max_entrants) conflict('Tournament is full');

  // Check if already entered
  const { data: existing } = await sb
    .from('tournament_entries')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', profileId)
    .maybeSingle();

  if (existing) return c.json({ data: { message: 'Already entered' } });

  const { error } = await sb
    .from('tournament_entries')
    .insert({
      id: crypto.randomUUID(),
      tournament_id: tournamentId,
      user_id: profileId,
    });

  if (error) badRequest(error.message);

  return c.json({ data: { entered: true, tournamentName: tournament.name } }, 201);
});

// ─── POST /tournaments/:id/submit-score — submit tournament score ───────────

const submitScoreSchema = z.object({
  totalStrokes: z.number().int().min(1),
  scoreToPar: z.number().int(),
  holesCompleted: z.number().int().min(1).max(36),
  roundId: z.string().uuid().optional(),
});

router.post(
  '/:id/submit-score',
  standardRateLimit,
  authMiddleware,
  zValidator('json', submitScoreSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const tournamentId = c.req.param('id');
    const body = c.req.valid('json');
    const sb = createAdminClient();

    // Verify entered
    const { data: entry } = await sb
      .from('tournament_entries')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', profileId)
      .single();

    if (!entry) forbidden('You are not entered in this tournament');

    // Update score
    await sb
      .from('tournament_entries')
      .update({
        total_strokes: body.totalStrokes,
        score_to_par: body.scoreToPar,
        holes_completed: body.holesCompleted,
        round_id: body.roundId ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', entry.id);

    return c.json({ data: { submitted: true } });
  }
);

// ─── POST /tournaments/:id/complete — end tournament + post results ─────────

router.post('/:id/complete', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const tournamentId = c.req.param('id');
  const sb = createAdminClient();

  const { data: tournament } = await sb
    .from('tournaments')
    .select('id, created_by_user_id, name, course_id')
    .eq('id', tournamentId)
    .single();

  if (!tournament) notFound('Tournament not found');
  if (tournament.created_by_user_id !== profileId) forbidden('Only the creator can complete');

  await sb.from('tournaments').update({ status: 'completed' }).eq('id', tournamentId);

  // Get winner
  const { data: topEntry } = await sb
    .from('tournament_entries')
    .select('user_id, total_strokes, score_to_par, users(display_name)')
    .eq('tournament_id', tournamentId)
    .not('total_strokes', 'is', null)
    .order('score_to_par', { ascending: true })
    .limit(1)
    .single();

  if (topEntry) {
    const u = topEntry.users as Record<string, unknown> | null;
    const scoreStr = topEntry.score_to_par === 0
      ? 'Even par'
      : topEntry.score_to_par > 0
        ? `+${topEntry.score_to_par}`
        : `${topEntry.score_to_par}`;

    // Auto-post tournament result for winner
    createAutoPost({
      authorId: topEntry.user_id as string,
      body: `Won the ${tournament.name} tournament! Shot ${scoreStr} (${topEntry.total_strokes} total) 🏆`,
      postType: 'tournament_result',
      courseId: tournament.course_id,
    }).catch(() => {});

    // Grant ranking points to top finishers
    const { data: allEntries } = await sb
      .from('tournament_entries')
      .select('user_id')
      .eq('tournament_id', tournamentId)
      .not('total_strokes', 'is', null)
      .order('score_to_par', { ascending: true });

    const pointsByPlace = [100, 60, 40, 25, 15, 10, 5];
    for (let i = 0; i < Math.min((allEntries ?? []).length, pointsByPlace.length); i++) {
      const entry = (allEntries ?? [])[i];
      const pts = pointsByPlace[i];
      await sb.rpc('increment_ranking_points', {
        p_user_id: entry.user_id,
        p_points: pts,
      }).catch(() => {
        // If RPC doesn't exist, manually upsert
        sb.from('player_rankings')
          .upsert(
            { user_id: entry.user_id, points: pts, rounds_played: 1 },
            { onConflict: 'user_id' }
          )
          .then(() => {});
      });
    }
  }

  return c.json({ data: { completed: true } });
});

// ─── GET /tournaments/:id/check-entry — check if user is entered ────────────

router.get('/:id/check-entry', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const tournamentId = c.req.param('id');
  const sb = createAdminClient();

  const { data: entry } = await sb
    .from('tournament_entries')
    .select('id, total_strokes, score_to_par, holes_completed')
    .eq('tournament_id', tournamentId)
    .eq('user_id', profileId)
    .maybeSingle();

  return c.json({
    data: {
      entered: !!entry,
      scoreSubmitted: entry?.total_strokes != null,
      totalStrokes: entry?.total_strokes ?? null,
      scoreToPar: entry?.score_to_par ?? null,
      holesCompleted: entry?.holes_completed ?? 0,
    },
  });
});

export { router as tournamentsRouter };
