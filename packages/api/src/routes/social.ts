import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, or, sql, ne, desc } from 'drizzle-orm';
import {
  db,
  users,
  friendships,
  groups,
  groupMembers,
  chatMessages,
  rounds,
  userAvailability,
  feedPosts,
  postLikes,
  postComments,
} from '@par-tee/db';
import { authMiddleware } from '../middleware/auth';

export const socialRouter = new Hono();

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve internal user id from supabase_user_id
// ─────────────────────────────────────────────────────────────────────────────
async function resolveUserId(supabaseUserId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);
  return row?.id ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FRIENDS
// ─────────────────────────────────────────────────────────────────────────────

// POST /v1/social/friends  — send friend request
socialRouter.post(
  '/friends',
  authMiddleware,
  zValidator('json', z.object({ addresseeId: z.string().uuid() })),
  async (c) => {
    const { supabaseUserId } = c.get('user');
    const { addresseeId } = c.req.valid('json');

    const requesterId = await resolveUserId(supabaseUserId);
    if (!requesterId) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    }
    if (requesterId === addresseeId) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'Cannot friend yourself' } }, 400);
    }

    // Check for existing relationship (either direction)
    const [existing] = await db
      .select({ id: friendships.id, status: friendships.status })
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterId, requesterId), eq(friendships.addresseeId, addresseeId)),
          and(eq(friendships.requesterId, addresseeId), eq(friendships.addresseeId, requesterId))
        )
      )
      .limit(1);

    if (existing) {
      return c.json(
        { error: { code: 'CONFLICT', message: `Friendship already exists (status: ${existing.status})` } },
        409
      );
    }

    const [friendship] = await db
      .insert(friendships)
      .values({ requesterId, addresseeId, status: 'pending' })
      .returning();

    return c.json({ data: friendship }, 201);
  }
);

// GET /v1/social/friends  — list accepted friends
socialRouter.get('/friends', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const rows = await db
    .select({
      friendship: friendships,
      friend: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        handicap: users.handicap,
        moodPreferences: users.moodPreferences,
      },
    })
    .from(friendships)
    .innerJoin(
      users,
      or(
        and(eq(friendships.requesterId, userId), eq(users.id, friendships.addresseeId)),
        and(eq(friendships.addresseeId, userId), eq(users.id, friendships.requesterId))
      )
    )
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))
      )
    );

  return c.json({ data: rows.map((r) => ({ ...r.friendship, friend: r.friend })) });
});

// GET /v1/social/friends/requests  — pending incoming friend requests
socialRouter.get('/friends/requests', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const rows = await db
    .select({
      friendship: friendships,
      requester: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        handicap: users.handicap,
      },
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(and(eq(friendships.addresseeId, userId), eq(friendships.status, 'pending')));

  return c.json({ data: rows.map((r) => ({ ...r.friendship, requester: r.requester })) });
});

// PATCH /v1/social/friends/:id/accept
socialRouter.patch('/friends/:id/accept', authMiddleware, async (c) => {
  const { id } = c.req.param();
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [row] = await db
    .update(friendships)
    .set({ status: 'accepted', updatedAt: new Date() })
    .where(
      and(eq(friendships.id, id), eq(friendships.addresseeId, userId), eq(friendships.status, 'pending'))
    )
    .returning();

  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pending friend request not found' } }, 404);
  }
  return c.json({ data: row });
});

// PATCH /v1/social/friends/:id/decline
socialRouter.patch('/friends/:id/decline', authMiddleware, async (c) => {
  const { id } = c.req.param();
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [row] = await db
    .update(friendships)
    .set({ status: 'declined', updatedAt: new Date() })
    .where(
      and(eq(friendships.id, id), eq(friendships.addresseeId, userId), eq(friendships.status, 'pending'))
    )
    .returning();

  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pending friend request not found' } }, 404);
  }
  return c.json({ data: row });
});

// ─────────────────────────────────────────────────────────────────────────────
// GOLFER DISCOVERY
// ─────────────────────────────────────────────────────────────────────────────

const discoverGolfersSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(500).default(50),
  mood: z
    .enum(['competitive', 'relaxed', 'beginner', 'advanced', 'fast-paced', 'social', 'scenic', 'challenging'])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
});

// GET /v1/social/discover/golfers
socialRouter.get(
  '/discover/golfers',
  authMiddleware,
  zValidator('query', discoverGolfersSchema),
  async (c) => {
    const { supabaseUserId } = c.get('user');
    const { lat, lng, radiusKm, mood, page, pageSize } = c.req.valid('query');
    const userId = await resolveUserId(supabaseUserId);
    if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const offset = (page - 1) * pageSize;
    const radiusDeg = radiusKm / 111; // rough degree approximation

    const moodFilter = mood
      ? sql`mood_preferences @> ${JSON.stringify([mood])}::jsonb`
      : sql`TRUE`;

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        handicap: users.handicap,
        moodPreferences: users.moodPreferences,
        locationLat: users.locationLat,
        locationLng: users.locationLng,
      })
      .from(users)
      .where(
        and(
          ne(users.id, userId),
          sql`location_lat IS NOT NULL`,
          sql`location_lng IS NOT NULL`,
          sql`ABS(location_lat::numeric - ${lat}) < ${radiusDeg}`,
          sql`ABS(location_lng::numeric - ${lng}) < ${radiusDeg}`,
          moodFilter
        )
      )
      .orderBy(sql`ABS(location_lat::numeric - ${lat}) + ABS(location_lng::numeric - ${lng}) ASC`)
      .limit(pageSize)
      .offset(offset);

    return c.json({ data: rows, pagination: { page, pageSize } });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUPS
// ─────────────────────────────────────────────────────────────────────────────

// POST /v1/social/groups  — create a group
socialRouter.post(
  '/groups',
  authMiddleware,
  zValidator('json', z.object({ name: z.string().min(1).max(100), description: z.string().optional() })),
  async (c) => {
    const { supabaseUserId } = c.get('user');
    const { name, description } = c.req.valid('json');
    const userId = await resolveUserId(supabaseUserId);
    if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const [group, member] = await db.transaction(async (tx) => {
      const [g] = await tx
        .insert(groups)
        .values({ name, description, createdByUserId: userId })
        .returning();
      const [m] = await tx
        .insert(groupMembers)
        .values({ groupId: g.id, userId })
        .returning();
      return [g, m];
    });

    return c.json({ data: { ...group, membership: member } }, 201);
  }
);

// GET /v1/social/groups  — list my groups
socialRouter.get('/groups', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      createdByUserId: groups.createdByUserId,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
      memberCount: sql<number>`(SELECT COUNT(*) FROM group_members WHERE group_id = ${groups.id})`,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId));

  return c.json({ data: rows });
});

// GET /v1/social/groups/:id  — group detail with members
socialRouter.get('/groups/:id', authMiddleware, async (c) => {
  const { id } = c.req.param();
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Check membership
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!membership) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not a group member' } }, 403);
  }

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      handicap: users.handicap,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, id));

  return c.json({ data: { ...group, members } });
});

// POST /v1/social/groups/:id/members  — add a member (invite by userId)
socialRouter.post(
  '/groups/:id/members',
  authMiddleware,
  zValidator('json', z.object({ userId: z.string().uuid() })),
  async (c) => {
    const { id: groupId } = c.req.param();
    const { supabaseUserId } = c.get('user');
    const { userId: inviteeId } = c.req.valid('json');
    const actorId = await resolveUserId(supabaseUserId);
    if (!actorId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    // Actor must be in the group
    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actorId)))
      .limit(1);
    if (!membership) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Not a group member' } }, 403);
    }

    const [existing] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, inviteeId)))
      .limit(1);
    if (existing) {
      return c.json({ error: { code: 'CONFLICT', message: 'User already a member' } }, 409);
    }

    const [member] = await db
      .insert(groupMembers)
      .values({ groupId, userId: inviteeId })
      .returning();

    return c.json({ data: member }, 201);
  }
);

// DELETE /v1/social/groups/:id/members/:userId  — remove a member (or leave)
socialRouter.delete('/groups/:id/members/:memberId', authMiddleware, async (c) => {
  const { id: groupId, memberId } = c.req.param();
  const { supabaseUserId } = c.get('user');
  const actorId = await resolveUserId(supabaseUserId);
  if (!actorId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  // Actor must be removing themselves OR be the group creator
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);

  if (memberId !== actorId && group.createdByUserId !== actorId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the group creator can remove others' } }, 403);
  }

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));

  return c.json({ data: { removed: true } });
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP CHAT
// ─────────────────────────────────────────────────────────────────────────────

const chatQuerySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// GET /v1/social/groups/:id/messages
socialRouter.get(
  '/groups/:id/messages',
  authMiddleware,
  zValidator('query', chatQuerySchema),
  async (c) => {
    const { id: groupId } = c.req.param();
    const { before, limit } = c.req.valid('query');
    const { supabaseUserId } = c.get('user');
    const userId = await resolveUserId(supabaseUserId);
    if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    // Must be a member
    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);
    if (!membership) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Not a group member' } }, 403);
    }

    const cursorFilter = before
      ? sql`${chatMessages.createdAt} < (SELECT created_at FROM chat_messages WHERE id = ${before})`
      : sql`TRUE`;

    const messages = await db
      .select({
        id: chatMessages.id,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        author: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(chatMessages)
      .innerJoin(users, eq(users.id, chatMessages.userId))
      .where(and(eq(chatMessages.groupId, groupId), cursorFilter))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    return c.json({ data: messages.reverse() });
  }
);

// POST /v1/social/groups/:id/messages
socialRouter.post(
  '/groups/:id/messages',
  authMiddleware,
  zValidator('json', z.object({ body: z.string().min(1).max(2000) })),
  async (c) => {
    const { id: groupId } = c.req.param();
    const { body } = c.req.valid('json');
    const { supabaseUserId } = c.get('user');
    const userId = await resolveUserId(supabaseUserId);
    if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    // Must be a member
    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);
    if (!membership) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Not a group member' } }, 403);
    }

    const [message] = await db
      .insert(chatMessages)
      .values({ groupId, userId, body })
      .returning();

    return c.json({ data: message }, 201);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY FEED (legacy — shared rounds from friends)
// ─────────────────────────────────────────────────────────────────────────────

// GET /v1/social/activity  — shared rounds from friends
socialRouter.get('/activity', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  // Get friend IDs
  const friendRows = await db
    .select({
      friendId: sql<string>`CASE WHEN requester_id = ${userId} THEN addressee_id ELSE requester_id END`,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))
      )
    );

  const friendIds = friendRows.map((r) => r.friendId);

  if (friendIds.length === 0) {
    return c.json({ data: [] });
  }

  const feed = await db
    .select({
      round: rounds,
      user: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(rounds)
    .innerJoin(users, eq(users.id, rounds.userId))
    .where(
      and(
        eq(rounds.isShared, true),
        sql`${rounds.userId} = ANY(${friendIds}::uuid[])`
      )
    )
    .orderBy(desc(rounds.playedAt))
    .limit(50);

  return c.json({ data: feed.map((r) => ({ ...r.round, user: r.user })) });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUNDS
// ─────────────────────────────────────────────────────────────────────────────

const createRoundSchema = z.object({
  courseId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  playedAt: z.string().datetime(),
  scoreCard: z
    .array(z.object({ hole: z.number(), par: z.number(), strokes: z.number().nullable() }))
    .optional(),
  totalScore: z.number().int().optional(),
  moodRating: z.number().int().min(1).max(5).optional(),
  isShared: z.boolean().default(false),
});

// POST /v1/social/rounds
socialRouter.post('/rounds', authMiddleware, zValidator('json', createRoundSchema), async (c) => {
  const { supabaseUserId } = c.get('user');
  const body = c.req.valid('json');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [round] = await db
    .insert(rounds)
    .values({
      userId,
      courseId: body.courseId,
      bookingId: body.bookingId,
      playedAt: new Date(body.playedAt),
      scoreCard: body.scoreCard ?? [],
      totalScore: body.totalScore,
      moodRating: body.moodRating,
      isShared: body.isShared,
    })
    .returning();

  return c.json({ data: round }, 201);
});

// PATCH /v1/social/rounds/:id  — share/update a round
socialRouter.patch(
  '/rounds/:id',
  authMiddleware,
  zValidator(
    'json',
    z.object({
      isShared: z.boolean().optional(),
      moodRating: z.number().int().min(1).max(5).optional(),
      totalScore: z.number().int().optional(),
      scoreCard: z
        .array(z.object({ hole: z.number(), par: z.number(), strokes: z.number().nullable() }))
        .optional(),
    })
  ),
  async (c) => {
    const { id } = c.req.param();
    const { supabaseUserId } = c.get('user');
    const body = c.req.valid('json');
    const userId = await resolveUserId(supabaseUserId);
    if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const updates: Partial<typeof rounds.$inferInsert> = {};
    if (body.isShared !== undefined) updates.isShared = body.isShared;
    if (body.moodRating !== undefined) updates.moodRating = body.moodRating;
    if (body.totalScore !== undefined) updates.totalScore = body.totalScore;
    if (body.scoreCard !== undefined) updates.scoreCard = body.scoreCard;

    const [updated] = await db
      .update(rounds)
      .set(updates)
      .where(and(eq(rounds.id, id), eq(rounds.userId, userId)))
      .returning();

    if (!updated) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Round not found' } }, 404);
    }
    return c.json({ data: updated });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY CALENDAR
// ─────────────────────────────────────────────────────────────────────────────

// GET /v1/social/availability/me  — my availability
socialRouter.get('/availability/me', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [row] = await db
    .select()
    .from(userAvailability)
    .where(eq(userAvailability.userId, userId))
    .limit(1);

  return c.json({ data: row ?? { userId, availableDays: [], updatedAt: null } });
});

// PUT /v1/social/availability/me  — set my weekly available days
socialRouter.put(
  '/availability/me',
  authMiddleware,
  zValidator(
    'json',
    z.object({
      availableDays: z.array(z.number().int().min(0).max(6)),
    })
  ),
  async (c) => {
    const { supabaseUserId } = c.get('user');
    const { availableDays } = c.req.valid('json');
    const userId = await resolveUserId(supabaseUserId);
    if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const [row] = await db
      .insert(userAvailability)
      .values({ userId, availableDays, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userAvailability.userId,
        set: { availableDays, updatedAt: new Date() },
      })
      .returning();

    return c.json({ data: row });
  }
);

// GET /v1/social/availability/:userId  — view a friend's availability
socialRouter.get('/availability/:userId', authMiddleware, async (c) => {
  const { userId: targetUserId } = c.req.param();
  const { supabaseUserId } = c.get('user');
  const actorId = await resolveUserId(supabaseUserId);
  if (!actorId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  // Must be accepted friends
  const [friendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(
          and(eq(friendships.requesterId, actorId), eq(friendships.addresseeId, targetUserId)),
          and(eq(friendships.requesterId, targetUserId), eq(friendships.addresseeId, actorId))
        )
      )
    )
    .limit(1);

  if (!friendship) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Can only view friends availability' } }, 403);
  }

  const [row] = await db
    .select()
    .from(userAvailability)
    .where(eq(userAvailability.userId, targetUserId))
    .limit(1);

  return c.json({ data: row ?? { userId: targetUserId, availableDays: [], updatedAt: null } });
});

// GET /v1/social/availability/suggest  — days all invitees are free (for party creation)
socialRouter.get(
  '/availability/suggest',
  authMiddleware,
  zValidator('query', z.object({ userIds: z.string() })),
  async (c) => {
    const { supabaseUserId } = c.get('user');
    const { userIds } = c.req.valid('query');
    const actorId = await resolveUserId(supabaseUserId);
    if (!actorId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const ids = userIds.split(',').filter(Boolean);
    if (ids.length === 0) {
      return c.json({ data: { suggestedDays: [] } });
    }

    const allIds = [actorId, ...ids];
    const rows = await db
      .select({ userId: userAvailability.userId, availableDays: userAvailability.availableDays })
      .from(userAvailability)
      .where(sql`${userAvailability.userId} = ANY(${allIds}::uuid[])`);

    if (rows.length === 0) return c.json({ data: { suggestedDays: [] } });

    // Intersect all availableDays arrays
    const sets = rows.map((r) => new Set(r.availableDays));
    const intersection = [...sets[0]].filter((day) => sets.every((s) => s.has(day)));

    return c.json({ data: { suggestedDays: intersection.sort() } });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FEED POSTS
// ─────────────────────────────────────────────────────────────────────────────

const createPostSchema = z.object({
  type: z.enum(['round_score', 'swing_video', 'rank_up', 'tournament_result', 'league_result']),
  payload: z.record(z.unknown()),
});

// GET /v1/social/feed  — posts from friends (all types)
socialRouter.get('/feed', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const friendRows = await db
    .select({
      friendId: sql<string>`CASE WHEN requester_id = ${userId} THEN addressee_id ELSE requester_id END`,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))
      )
    );

  const friendIds = [userId, ...friendRows.map((r) => r.friendId)];

  const posts = await db
    .select({
      post: feedPosts,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(feedPosts)
    .innerJoin(users, eq(users.id, feedPosts.userId))
    .where(sql`${feedPosts.userId} = ANY(${friendIds}::uuid[])`)
    .orderBy(desc(feedPosts.createdAt))
    .limit(50);

  // Determine which posts the current user has liked
  const postIds = posts.map((p) => p.post.id);
  let likedSet = new Set<string>();
  if (postIds.length > 0) {
    const likeRows = await db
      .select({ postId: postLikes.postId })
      .from(postLikes)
      .where(
        and(
          eq(postLikes.userId, userId),
          sql`${postLikes.postId} = ANY(${postIds}::uuid[])`
        )
      );
    likedSet = new Set(likeRows.map((r) => r.postId));
  }

  return c.json({
    data: posts.map((p) => ({
      ...p.post,
      author: p.author,
      likedByMe: likedSet.has(p.post.id),
    })),
  });
});

// POST /v1/social/feed  — create a post
socialRouter.post('/feed', authMiddleware, zValidator('json', createPostSchema), async (c) => {
  const { supabaseUserId } = c.get('user');
  const { type, payload } = c.req.valid('json');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [post] = await db
    .insert(feedPosts)
    .values({ userId, type, payload })
    .returning();

  return c.json({ data: post }, 201);
});

// POST /v1/social/feed/:id/like  — like a post
socialRouter.post('/feed/:id/like', authMiddleware, async (c) => {
  const { id: postId } = c.req.param();
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [existing] = await db
    .select({ id: postLikes.id })
    .from(postLikes)
    .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
    .limit(1);

  if (existing) {
    return c.json({ error: { code: 'CONFLICT', message: 'Already liked' } }, 409);
  }

  await db.transaction(async (tx) => {
    await tx.insert(postLikes).values({ postId, userId });
    await tx
      .update(feedPosts)
      .set({ likeCount: sql`like_count + 1` })
      .where(eq(feedPosts.id, postId));
  });

  return c.json({ data: { liked: true } }, 201);
});

// DELETE /v1/social/feed/:id/like  — unlike a post
socialRouter.delete('/feed/:id/like', authMiddleware, async (c) => {
  const { id: postId } = c.req.param();
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const deleted = await db
    .delete(postLikes)
    .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Like not found' } }, 404);
  }

  await db
    .update(feedPosts)
    .set({ likeCount: sql`GREATEST(like_count - 1, 0)` })
    .where(eq(feedPosts.id, postId));

  return c.json({ data: { liked: false } });
});

// GET /v1/social/feed/:id/comments  — list comments on a post
socialRouter.get('/feed/:id/comments', authMiddleware, async (c) => {
  const { id: postId } = c.req.param();
  const { supabaseUserId } = c.get('user');
  const userId = await resolveUserId(supabaseUserId);
  if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const comments = await db
    .select({
      id: postComments.id,
      postId: postComments.postId,
      body: postComments.body,
      createdAt: postComments.createdAt,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(postComments)
    .innerJoin(users, eq(users.id, postComments.userId))
    .where(eq(postComments.postId, postId))
    .orderBy(postComments.createdAt);

  return c.json({ data: comments });
});

// POST /v1/social/feed/:id/comments  — add a comment
socialRouter.post(
  '/feed/:id/comments',
  authMiddleware,
  zValidator('json', z.object({ body: z.string().min(1).max(500) })),
  async (c) => {
    const { id: postId } = c.req.param();
    const { body } = c.req.valid('json');
    const { supabaseUserId } = c.get('user');
    const userId = await resolveUserId(supabaseUserId);
    if (!userId) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const [comment] = await db.transaction(async (tx) => {
      const [c] = await tx
        .insert(postComments)
        .values({ postId, userId, body })
        .returning();
      await tx
        .update(feedPosts)
        .set({ commentCount: sql`comment_count + 1` })
        .where(eq(feedPosts.id, postId));
      return [c];
    });

    return c.json({ data: comment }, 201);
  }
);
