import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import {
  db,
  bookings,
  parties,
  partyMembers,
  holeScores,
  users,
} from '@teezy/db';
import { authMiddleware } from '../middleware/auth';

export const partiesRouter = new Hono();

// --- Helpers ---

async function resolveUserId(supabaseUserId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);
  return row?.id ?? null;
}

// --- Schemas ---

const createPartySchema = z.object({
  bookingId: z.string().uuid(),
  gameMode: z.enum(['chill', 'fun', 'competitive']).default('fun'),
  challengeType: z.enum(['none', 'head_to_head', 'scramble_2v2']).default('none'),
  note: z.string().max(500).optional(),
});

const updatePartySchema = z.object({
  gameMode: z.enum(['chill', 'fun', 'competitive']).optional(),
  challengeType: z.enum(['none', 'head_to_head', 'scramble_2v2']).optional(),
  note: z.string().max(500).optional(),
  status: z.enum(['forming', 'in_progress', 'completed', 'cancelled']).optional(),
});

const inviteSchema = z.object({
  userId: z.string().uuid(),
});

const respondSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

const submitScoresSchema = z.object({
  scores: z
    .array(
      z.object({
        holeNumber: z.number().int().min(1).max(18),
        strokes: z.number().int().min(1).max(20),
      })
    )
    .min(1)
    .max(18),
});

// --- Routes ---

// POST /v1/parties — create a party for a booking
partiesRouter.post('/', authMiddleware, zValidator('json', createPartySchema), async (c) => {
  const { supabaseUserId } = c.get('user');
  const { bookingId, gameMode, challengeType, note } = c.req.valid('json');

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
  if (booking.userId !== userId)
    return c.json({ error: { code: 'FORBIDDEN', message: 'Booking does not belong to you' } }, 403);

  const [party] = await db
    .insert(parties)
    .values({ bookingId, createdByUserId: userId, gameMode, challengeType, note })
    .returning();

  // Add creator as an accepted member
  await db.insert(partyMembers).values({
    partyId: party.id,
    userId,
    status: 'accepted',
    respondedAt: new Date(),
  });

  return c.json({ data: party }, 201);
});

// GET /v1/parties/:partyId — get party details with members and scores
partiesRouter.get('/:partyId', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const { partyId } = c.req.param();

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [party] = await db.select().from(parties).where(eq(parties.id, partyId)).limit(1);
  if (!party) return c.json({ error: { code: 'NOT_FOUND', message: 'Party not found' } }, 404);

  // Must be a member or creator
  const [membership] = await db
    .select()
    .from(partyMembers)
    .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, userId)))
    .limit(1);
  if (!membership && party.createdByUserId !== userId)
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not a party member' } }, 403);

  const members = await db
    .select({
      id: partyMembers.id,
      userId: partyMembers.userId,
      status: partyMembers.status,
      invitedAt: partyMembers.invitedAt,
      respondedAt: partyMembers.respondedAt,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(partyMembers)
    .leftJoin(users, eq(partyMembers.userId, users.id))
    .where(eq(partyMembers.partyId, partyId));

  const scores = await db
    .select()
    .from(holeScores)
    .where(eq(holeScores.partyId, partyId))
    .orderBy(holeScores.holeNumber);

  return c.json({ data: { ...party, members, scores } });
});

// PATCH /v1/parties/:partyId — update game mode / status
partiesRouter.patch(
  '/:partyId',
  authMiddleware,
  zValidator('json', updatePartySchema),
  async (c) => {
    const { supabaseUserId } = c.get('user');
    const { partyId } = c.req.param();
    const updates = c.req.valid('json');

    const userId = await resolveUserId(supabaseUserId);
    if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const [party] = await db.select().from(parties).where(eq(parties.id, partyId)).limit(1);
    if (!party) return c.json({ error: { code: 'NOT_FOUND', message: 'Party not found' } }, 404);
    if (party.createdByUserId !== userId)
      return c.json({ error: { code: 'FORBIDDEN', message: 'Only the party creator can update' } }, 403);

    const [updated] = await db
      .update(parties)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(parties.id, partyId))
      .returning();

    return c.json({ data: updated });
  }
);

// POST /v1/parties/:partyId/invite — invite a friend
partiesRouter.post(
  '/:partyId/invite',
  authMiddleware,
  zValidator('json', inviteSchema),
  async (c) => {
    const { supabaseUserId } = c.get('user');
    const { partyId } = c.req.param();
    const { userId: inviteeId } = c.req.valid('json');

    const callerId = await resolveUserId(supabaseUserId);
    if (!callerId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const [party] = await db.select().from(parties).where(eq(parties.id, partyId)).limit(1);
    if (!party) return c.json({ error: { code: 'NOT_FOUND', message: 'Party not found' } }, 404);
    if (party.createdByUserId !== callerId)
      return c.json({ error: { code: 'FORBIDDEN', message: 'Only the party creator can invite' } }, 403);

    // Check party size limit (max 4 members total)
    const memberCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(partyMembers)
      .where(and(eq(partyMembers.partyId, partyId), sql`status != 'declined'`));
    if (Number(memberCount[0]?.count ?? 0) >= 4)
      return c.json({ error: { code: 'PARTY_FULL', message: 'Party is full (max 4 players)' } }, 422);

    // Upsert invite
    const [invite] = await db
      .insert(partyMembers)
      .values({ partyId, userId: inviteeId, status: 'invited' })
      .onConflictDoUpdate({
        target: [partyMembers.partyId, partyMembers.userId],
        set: { status: 'invited', respondedAt: null },
      })
      .returning();

    return c.json({ data: invite }, 201);
  }
);

// POST /v1/parties/:partyId/respond — accept or decline an invite
partiesRouter.post(
  '/:partyId/respond',
  authMiddleware,
  zValidator('json', respondSchema),
  async (c) => {
    const { supabaseUserId } = c.get('user');
    const { partyId } = c.req.param();
    const { status } = c.req.valid('json');

    const userId = await resolveUserId(supabaseUserId);
    if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const [member] = await db
      .select()
      .from(partyMembers)
      .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, userId)))
      .limit(1);
    if (!member)
      return c.json({ error: { code: 'NOT_FOUND', message: 'No invite found for you in this party' } }, 404);

    const [updated] = await db
      .update(partyMembers)
      .set({ status, respondedAt: new Date() })
      .where(eq(partyMembers.id, member.id))
      .returning();

    return c.json({ data: updated });
  }
);

// POST /v1/parties/:partyId/scores — submit/update hole-by-hole scores for current user
partiesRouter.post(
  '/:partyId/scores',
  authMiddleware,
  zValidator('json', submitScoresSchema),
  async (c) => {
    const { supabaseUserId } = c.get('user');
    const { partyId } = c.req.param();
    const { scores } = c.req.valid('json');

    const userId = await resolveUserId(supabaseUserId);
    if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const [party] = await db.select().from(parties).where(eq(parties.id, partyId)).limit(1);
    if (!party) return c.json({ error: { code: 'NOT_FOUND', message: 'Party not found' } }, 404);

    const [membership] = await db
      .select()
      .from(partyMembers)
      .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, userId)))
      .limit(1);
    if (!membership || membership.status !== 'accepted')
      return c.json({ error: { code: 'FORBIDDEN', message: 'You must be an accepted party member to submit scores' } }, 403);

    // Upsert each hole score
    const rows = scores.map((s) => ({
      partyId,
      userId,
      holeNumber: s.holeNumber,
      strokes: s.strokes,
    }));

    const saved = await db
      .insert(holeScores)
      .values(rows)
      .onConflictDoUpdate({
        target: [holeScores.partyId, holeScores.userId, holeScores.holeNumber],
        set: { strokes: sql`excluded.strokes`, updatedAt: new Date() },
      })
      .returning();

    return c.json({ data: saved }, 201);
  }
);

// GET /v1/parties/:partyId/scores — get all scores for the party
partiesRouter.get('/:partyId/scores', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const { partyId } = c.req.param();

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [party] = await db.select().from(parties).where(eq(parties.id, partyId)).limit(1);
  if (!party) return c.json({ error: { code: 'NOT_FOUND', message: 'Party not found' } }, 404);

  const [membership] = await db
    .select()
    .from(partyMembers)
    .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, userId)))
    .limit(1);
  if (!membership && party.createdByUserId !== userId)
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not a party member' } }, 403);

  const allScores = await db
    .select({
      id: holeScores.id,
      userId: holeScores.userId,
      holeNumber: holeScores.holeNumber,
      strokes: holeScores.strokes,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(holeScores)
    .leftJoin(users, eq(holeScores.userId, users.id))
    .where(eq(holeScores.partyId, partyId))
    .orderBy(holeScores.holeNumber);

  return c.json({ data: allScores });
});

// GET /v1/parties — list my parties
partiesRouter.get('/', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');

  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const myParties = await db
    .select({ partyId: partyMembers.partyId })
    .from(partyMembers)
    .where(and(eq(partyMembers.userId, userId), eq(partyMembers.status, 'accepted')));

  const partyIds = myParties.map((r) => r.partyId);
  if (partyIds.length === 0) return c.json({ data: [] });

  const result = await db
    .select()
    .from(parties)
    .where(sql`${parties.id} = ANY(${partyIds})`)
    .orderBy(sql`${parties.createdAt} DESC`);

  return c.json({ data: result });
});
