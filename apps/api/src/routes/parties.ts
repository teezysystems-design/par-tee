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

function toCamelCase(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

// ─── POST /parties — create a party for a booking ─────────────────────────────

const createPartySchema = z.object({
  bookingId: z.string().uuid(),
  gameMode: z.enum(['solo', 'match_1v1', 'match_2v2', 'tournament', 'casual']),
  notes: z.string().max(500).optional(),
});

router.post(
  '/',
  standardRateLimit,
  authMiddleware,
  zValidator('json', createPartySchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const body = c.req.valid('json');
    const sb = createAdminClient();

    // Verify booking belongs to user
    const { data: booking } = await sb
      .from('bookings')
      .select('id, course_id, party_size, status')
      .eq('id', body.bookingId)
      .eq('user_id', profileId)
      .single();

    if (!booking) notFound('Booking not found');
    if (booking.status === 'cancelled') badRequest('Cannot create party for cancelled booking');

    // Check no existing party for this booking
    const { data: existing } = await sb
      .from('parties')
      .select('id')
      .eq('booking_id', body.bookingId)
      .single();

    if (existing) conflict('A party already exists for this booking');

    const partyId = crypto.randomUUID();

    // Create party
    const { data: party, error: partyErr } = await sb
      .from('parties')
      .insert({
        id: partyId,
        booking_id: body.bookingId,
        course_id: booking.course_id,
        created_by_user_id: profileId,
        game_mode: body.gameMode,
        status: 'forming',
        max_size: booking.party_size || 4,
        notes: body.notes ?? null,
      })
      .select()
      .single();

    if (partyErr) badRequest(partyErr.message);

    // Add creator as first member (accepted)
    await sb.from('party_members').insert({
      id: crypto.randomUUID(),
      party_id: partyId,
      user_id: profileId,
      status: 'accepted',
      role: 'host',
    });

    // Update booking with round_mode
    await sb
      .from('bookings')
      .update({ round_mode: body.gameMode })
      .eq('id', body.bookingId);

    return c.json({ data: toCamelCase(party) }, 201);
  }
);

// ─── GET /parties — list user's parties ───────────────────────────────────────

router.get('/', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const sb = createAdminClient();
  const status = c.req.query('status'); // forming | in_progress | completed

  // Get party IDs where user is a member
  let memberQuery = sb
    .from('party_members')
    .select('party_id')
    .eq('user_id', profileId)
    .in('status', ['accepted']);

  const { data: memberRows } = await memberQuery;
  if (!memberRows || memberRows.length === 0) {
    return c.json({ data: [] });
  }

  const partyIds = memberRows.map((r: { party_id: string }) => r.party_id);

  let query = sb
    .from('parties')
    .select('*, courses(name, hole_count, par_score)')
    .in('id', partyIds)
    .order('created_at', { ascending: false })
    .limit(50);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: parties } = await query;

  return c.json({
    data: (parties ?? []).map((p: Record<string, unknown>) => toCamelCase(p)),
  });
});

// ─── GET /parties/:partyId — get party detail with members ────────────────────

router.get('/:partyId', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const partyId = c.req.param('partyId');
  const sb = createAdminClient();

  const { data: party } = await sb
    .from('parties')
    .select('*, courses(name, hole_count, par_score)')
    .eq('id', partyId)
    .single();

  if (!party) notFound('Party not found');

  // Get members with user info
  const { data: members } = await sb
    .from('party_members')
    .select('id, user_id, status, role, users(display_name, username, avatar_url, handicap)')
    .eq('party_id', partyId)
    .order('created_at', { ascending: true });

  const formattedMembers = (members ?? []).map((m: Record<string, unknown>) => {
    const u = m.users as Record<string, unknown> | null;
    return {
      id: m.id,
      odId: m.user_id,
      userId: m.user_id,
      status: m.status,
      role: m.role,
      name: u?.display_name ?? u?.username ?? 'Unknown',
      username: u?.username ?? null,
      avatarUrl: u?.avatar_url ?? null,
      handicap: u?.handicap ?? null,
    };
  });

  return c.json({
    data: {
      ...toCamelCase(party),
      members: formattedMembers,
    },
  });
});

// ─── PATCH /parties/:partyId — update party (status, game mode) ──────────────

const updatePartySchema = z.object({
  status: z.enum(['forming', 'in_progress', 'completed']).optional(),
  gameMode: z.enum(['solo', 'match_1v1', 'match_2v2', 'tournament', 'casual']).optional(),
  notes: z.string().max(500).optional(),
});

router.patch(
  '/:partyId',
  standardRateLimit,
  authMiddleware,
  zValidator('json', updatePartySchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const partyId = c.req.param('partyId');
    const body = c.req.valid('json');
    const sb = createAdminClient();

    // Verify user is party host
    const { data: party } = await sb
      .from('parties')
      .select('id, created_by_user_id, status')
      .eq('id', partyId)
      .single();

    if (!party) notFound('Party not found');
    if (party.created_by_user_id !== profileId) forbidden('Only the party host can update');

    const updates: Record<string, unknown> = {};
    if (body.status) updates.status = body.status;
    if (body.gameMode) updates.game_mode = body.gameMode;
    if (body.notes !== undefined) updates.notes = body.notes;

    if (Object.keys(updates).length === 0) badRequest('No fields to update');

    const { data: updated, error } = await sb
      .from('parties')
      .update(updates)
      .eq('id', partyId)
      .select()
      .single();

    if (error) badRequest(error.message);

    return c.json({ data: toCamelCase(updated) });
  }
);

// ─── POST /parties/:partyId/invite — invite by username ───────────────────────

const inviteSchema = z.object({
  username: z.string().min(1).max(30),
});

router.post(
  '/:partyId/invite',
  standardRateLimit,
  authMiddleware,
  zValidator('json', inviteSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const partyId = c.req.param('partyId');
    const { username } = c.req.valid('json');
    const sb = createAdminClient();

    // Verify party exists and user is host
    const { data: party } = await sb
      .from('parties')
      .select('id, created_by_user_id, max_size, status')
      .eq('id', partyId)
      .single();

    if (!party) notFound('Party not found');
    if (party.created_by_user_id !== profileId) forbidden('Only the host can invite');
    if (party.status !== 'forming') badRequest('Cannot invite — party is already in progress');

    // Check party size
    const { count } = await sb
      .from('party_members')
      .select('id', { count: 'exact', head: true })
      .eq('party_id', partyId)
      .neq('status', 'declined');

    if ((count ?? 0) >= (party.max_size || 4)) badRequest('Party is full');

    // Resolve invited user by username
    const { data: invitee } = await sb
      .from('users')
      .select('id, display_name, username')
      .eq('username', username.toLowerCase())
      .single();

    if (!invitee) notFound(`No user found with username "${username}"`);
    if (invitee.id === profileId) badRequest('Cannot invite yourself');

    // Check not already a member
    const { data: existingMember } = await sb
      .from('party_members')
      .select('id, status')
      .eq('party_id', partyId)
      .eq('user_id', invitee.id)
      .single();

    if (existingMember) {
      if (existingMember.status === 'declined') {
        // Re-invite
        await sb
          .from('party_members')
          .update({ status: 'invited' })
          .eq('id', existingMember.id);
        return c.json({ data: { message: `Re-invited ${username}` } });
      }
      conflict(`${username} is already in this party`);
    }

    await sb.from('party_members').insert({
      id: crypto.randomUUID(),
      party_id: partyId,
      user_id: invitee.id,
      status: 'invited',
      role: 'member',
    });

    // Fire-and-forget notification
    sb.from('notifications').insert({
      id: crypto.randomUUID(),
      user_id: invitee.id,
      type: 'party_invite',
      title: 'Party Invite',
      body: `You've been invited to a party!`,
      data: { partyId },
    }).then(() => {});

    return c.json({ data: { message: `Invited ${username}` } }, 201);
  }
);

// ─── POST /parties/:partyId/respond — accept/decline invite ──────────────────

const respondSchema = z.object({
  response: z.enum(['accepted', 'declined']),
});

router.post(
  '/:partyId/respond',
  standardRateLimit,
  authMiddleware,
  zValidator('json', respondSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const partyId = c.req.param('partyId');
    const { response } = c.req.valid('json');
    const sb = createAdminClient();

    const { data: member, error } = await sb
      .from('party_members')
      .update({ status: response })
      .eq('party_id', partyId)
      .eq('user_id', profileId)
      .eq('status', 'invited')
      .select()
      .single();

    if (error || !member) notFound('No pending invite found');

    return c.json({ data: { status: response } });
  }
);

// ─── POST /parties/:partyId/scores — submit enhanced hole scores ─────────────

const holeScoreSchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  strokes: z.number().int().min(1).max(20),
  par: z.number().int().min(3).max(6).optional(),
  fairwayHit: z.boolean().optional(),
  greenInRegulation: z.boolean().optional(),
  putts: z.number().int().min(0).max(10).optional(),
});

const submitScoresSchema = z.object({
  scores: z.array(holeScoreSchema).min(1).max(18),
});

router.post(
  '/:partyId/scores',
  standardRateLimit,
  authMiddleware,
  zValidator('json', submitScoresSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const partyId = c.req.param('partyId');
    const { scores } = c.req.valid('json');
    const sb = createAdminClient();

    // Verify party exists and user is a member
    const { data: party } = await sb
      .from('parties')
      .select('id, status, course_id')
      .eq('id', partyId)
      .single();

    if (!party) notFound('Party not found');
    if (party.status === 'forming') badRequest('Round has not started yet');

    const { data: membership } = await sb
      .from('party_members')
      .select('id')
      .eq('party_id', partyId)
      .eq('user_id', profileId)
      .eq('status', 'accepted')
      .single();

    if (!membership) forbidden('You are not a member of this party');

    // Upsert scores (allows saving progress and overwriting)
    for (const score of scores) {
      const { error } = await sb
        .from('hole_scores')
        .upsert(
          {
            party_id: partyId,
            user_id: profileId,
            hole_number: score.holeNumber,
            strokes: score.strokes,
            par: score.par ?? null,
            fairway_hit: score.fairwayHit ?? null,
            green_in_regulation: score.greenInRegulation ?? null,
            putts: score.putts ?? null,
          },
          { onConflict: 'party_id,user_id,hole_number' }
        );
      if (error) badRequest(`Failed to save hole ${score.holeNumber}: ${error.message}`);
    }

    // Calculate totals
    const { data: allScores } = await sb
      .from('hole_scores')
      .select('strokes, par')
      .eq('party_id', partyId)
      .eq('user_id', profileId);

    const totalStrokes = (allScores ?? []).reduce((s: number, h: { strokes: number }) => s + h.strokes, 0);
    const holesWithPar = (allScores ?? []).filter((h: { par: number | null }) => h.par != null);
    const totalPar = holesWithPar.reduce((s: number, h: { par: number }) => s + h.par, 0);
    const scoreToPar = holesWithPar.length > 0 ? totalStrokes - totalPar : null;

    return c.json({
      data: {
        holesRecorded: (allScores ?? []).length,
        totalStrokes,
        scoreToPar,
      },
    });
  }
);

// ─── GET /parties/:partyId/scores — get all party scores ─────────────────────

router.get('/:partyId/scores', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  await resolveProfileId(user.id); // verify auth
  const partyId = c.req.param('partyId');
  const sb = createAdminClient();

  const { data: scores } = await sb
    .from('hole_scores')
    .select('user_id, hole_number, strokes, par, fairway_hit, green_in_regulation, putts, users(display_name, username)')
    .eq('party_id', partyId)
    .order('hole_number', { ascending: true });

  const formatted = (scores ?? []).map((s: Record<string, unknown>) => {
    const u = s.users as Record<string, unknown> | null;
    return {
      userId: s.user_id,
      holeNumber: s.hole_number,
      strokes: s.strokes,
      par: s.par,
      fairwayHit: s.fairway_hit,
      greenInRegulation: s.green_in_regulation,
      putts: s.putts,
      name: u?.display_name ?? u?.username ?? 'Unknown',
    };
  });

  return c.json({ data: formatted });
});

// ─── POST /parties/:partyId/finish — complete round + trigger ranking ────────

router.post(
  '/:partyId/finish',
  standardRateLimit,
  authMiddleware,
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const partyId = c.req.param('partyId');
    const sb = createAdminClient();

    const { data: party } = await sb
      .from('parties')
      .select('id, created_by_user_id, course_id, game_mode, status, booking_id')
      .eq('id', partyId)
      .single();

    if (!party) notFound('Party not found');
    if (party.created_by_user_id !== profileId) forbidden('Only the host can finish the round');
    if (party.status === 'completed') badRequest('Round is already completed');

    // Mark party completed
    await sb
      .from('parties')
      .update({ status: 'completed' })
      .eq('id', partyId);

    // Get all accepted members
    const { data: members } = await sb
      .from('party_members')
      .select('user_id')
      .eq('party_id', partyId)
      .eq('status', 'accepted');

    // For each member, create a round record and calculate ranking points
    const roundResults = [];
    for (const member of members ?? []) {
      const { data: holeScores } = await sb
        .from('hole_scores')
        .select('hole_number, strokes, par, fairway_hit, green_in_regulation, putts')
        .eq('party_id', partyId)
        .eq('user_id', member.user_id)
        .order('hole_number', { ascending: true });

      if (!holeScores || holeScores.length === 0) continue;

      const totalStrokes = holeScores.reduce((s, h) => s + h.strokes, 0);
      const holesWithPar = holeScores.filter((h) => h.par != null);
      const totalPar = holesWithPar.reduce((s, h) => s + (h.par ?? 0), 0);
      const scoreToPar = holesWithPar.length > 0 ? totalStrokes - totalPar : null;
      const fairways = holeScores.filter((h) => h.fairway_hit != null);
      const fairwayPct = fairways.length > 0
        ? Math.round((fairways.filter((h) => h.fairway_hit).length / fairways.length) * 100)
        : null;
      const girs = holeScores.filter((h) => h.green_in_regulation != null);
      const girPct = girs.length > 0
        ? Math.round((girs.filter((h) => h.green_in_regulation).length / girs.length) * 100)
        : null;
      const puttsArr = holeScores.filter((h) => h.putts != null);
      const avgPutts = puttsArr.length > 0
        ? Number((puttsArr.reduce((s, h) => s + (h.putts ?? 0), 0) / puttsArr.length).toFixed(1))
        : null;

      // Create round record
      const { data: round } = await sb
        .from('rounds')
        .insert({
          id: crypto.randomUUID(),
          user_id: member.user_id,
          course_id: party.course_id,
          booking_id: party.booking_id,
          played_at: new Date().toISOString(),
          mode: party.game_mode,
          total_score: totalStrokes,
          score_differential: scoreToPar,
          holes_played: holeScores.length,
          verified: false,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      // Calculate ranking points (only for non-casual modes)
      let pointsEarned = 0;
      if (party.game_mode !== 'casual' && round) {
        // Base points: 10 per hole played
        pointsEarned = holeScores.length * 10;

        // Bonus for under par (per hole)
        if (scoreToPar != null && scoreToPar < 0) {
          pointsEarned += Math.abs(scoreToPar) * 15;
        }

        // Mode multipliers
        const modeMultipliers: Record<string, number> = {
          solo: 1.0,
          match_1v1: 1.5,
          match_2v2: 1.3,
          tournament: 2.0,
        };
        pointsEarned = Math.round(pointsEarned * (modeMultipliers[party.game_mode] ?? 1.0));

        // Full round bonus
        if (holeScores.length === 18) {
          pointsEarned += 50;
        }

        // Record ranking history
        const { data: currentRanking } = await sb
          .from('player_rankings')
          .select('points, tier')
          .eq('user_id', member.user_id)
          .single();

        const currentPoints = currentRanking?.points ?? 0;
        const newPoints = currentPoints + pointsEarned;

        // Determine new tier
        const tiers = [
          { tier: 'bronze_1', min: 0 }, { tier: 'bronze_2', min: 100 }, { tier: 'bronze_3', min: 250 },
          { tier: 'silver_1', min: 500 }, { tier: 'silver_2', min: 750 }, { tier: 'silver_3', min: 1000 },
          { tier: 'gold_1', min: 1500 }, { tier: 'gold_2', min: 2000 }, { tier: 'gold_3', min: 2750 },
          { tier: 'platinum_1', min: 3500 }, { tier: 'platinum_2', min: 4500 }, { tier: 'platinum_3', min: 5500 },
          { tier: 'diamond_1', min: 7000 }, { tier: 'diamond_2', min: 8500 }, { tier: 'diamond_3', min: 10000 },
          { tier: 'master', min: 12500 }, { tier: 'grandmaster', min: 15000 }, { tier: 'unreal', min: 20000 },
        ];
        const newTier = [...tiers].reverse().find((t) => newPoints >= t.min)?.tier ?? 'bronze_1';

        // Upsert ranking
        await sb
          .from('player_rankings')
          .upsert(
            {
              user_id: member.user_id,
              points: newPoints,
              tier: newTier,
              rounds_played: (currentRanking as Record<string, unknown> | null) ? ((currentRanking as Record<string, unknown>).rounds_played as number ?? 0) + 1 : 1,
            },
            { onConflict: 'user_id' }
          );

        // Log ranking history
        await sb.from('ranking_history').insert({
          id: crypto.randomUUID(),
          user_id: member.user_id,
          event_type: 'round_completed',
          points_change: pointsEarned,
          points_after: newPoints,
          tier_after: newTier,
          metadata: { partyId, roundId: round?.id, gameMode: party.game_mode },
        });

        // ── Auto-post: rank-up ──
        const previousTier = currentRanking?.tier ?? 'bronze_1';
        if (newTier !== previousTier) {
          const TIER_LABELS: Record<string, string> = {
            bronze_1: 'Bronze I', bronze_2: 'Bronze II', bronze_3: 'Bronze III',
            silver_1: 'Silver I', silver_2: 'Silver II', silver_3: 'Silver III',
            gold_1: 'Gold I', gold_2: 'Gold II', gold_3: 'Gold III',
            platinum_1: 'Platinum I', platinum_2: 'Platinum II', platinum_3: 'Platinum III',
            diamond_1: 'Diamond I', diamond_2: 'Diamond II', diamond_3: 'Diamond III',
            master: 'Master', grandmaster: 'Grandmaster', unreal: 'Unreal',
          };
          createAutoPost({
            authorId: member.user_id,
            body: `Ranked up to ${TIER_LABELS[newTier] ?? newTier}! 🚀 ${newPoints} total points`,
            postType: 'rank_up',
            courseId: party.course_id,
            roundId: round?.id,
          }).catch(() => {}); // fire-and-forget
        }
      }

      // ── Auto-post: round score ──
      {
        const { data: userProfile } = await sb
          .from('users')
          .select('display_name, username')
          .eq('id', member.user_id)
          .single();

        const courseName = party.course_id
          ? (await sb.from('courses').select('name').eq('id', party.course_id).single()).data?.name
          : null;

        const scoreStr = scoreToPar != null
          ? scoreToPar === 0
            ? 'Even par'
            : scoreToPar > 0
              ? `+${scoreToPar}`
              : `${scoreToPar}`
          : `${totalStrokes} strokes`;

        const modeLabels: Record<string, string> = {
          solo: 'Solo', match_1v1: '1v1 Match', match_2v2: '2v2 Scramble',
          tournament: 'Tournament', casual: 'Casual',
        };

        const body = [
          `Shot ${scoreStr}`,
          courseName ? `at ${courseName}` : null,
          `(${holeScores.length} holes, ${modeLabels[party.game_mode] ?? party.game_mode})`,
          pointsEarned > 0 ? `— earned ${pointsEarned} ranking points` : null,
        ]
          .filter(Boolean)
          .join(' ');

        createAutoPost({
          authorId: member.user_id,
          body,
          postType: 'round_score',
          courseId: party.course_id,
          roundId: round?.id,
        }).catch(() => {}); // fire-and-forget
      }

      roundResults.push({
        userId: member.user_id,
        totalStrokes,
        scoreToPar,
        holesPlayed: holeScores.length,
        fairwayPct,
        girPct,
        avgPutts,
        pointsEarned,
      });
    }

    // Mark booking as completed
    if (party.booking_id) {
      await sb
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', party.booking_id);
    }

    return c.json({
      data: {
        partyId,
        status: 'completed',
        results: roundResults,
      },
    });
  }
);

export { router as partiesRouter };
