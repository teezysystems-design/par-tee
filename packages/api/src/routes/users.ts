import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, or } from 'drizzle-orm';
import { db, users, friendships } from '@par-tee/db';
import { authMiddleware } from '../middleware/auth';

export const usersRouter = new Hono();

const moodEnum = z.enum([
  'competitive',
  'relaxed',
  'beginner',
  'advanced',
  'fast-paced',
  'social',
  'scenic',
  'challenging',
]);

const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  handicap: z.number().min(0).max(54).nullable().optional(),
  moodPreferences: z.array(moodEnum).optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(300).nullable().optional(),
  isPrivate: z.boolean().optional(),
  handicap: z.number().min(0).max(54).nullable().optional(),
  moodPreferences: z.array(moodEnum).optional(),
  locationLat: z.number().min(-90).max(90).nullable().optional(),
  locationLng: z.number().min(-180).max(180).nullable().optional(),
});

// POST /v1/users — create profile on first sign-in (called from onboarding)
usersRouter.post('/', authMiddleware, zValidator('json', createProfileSchema), async (c) => {
  const { supabaseUserId, email } = c.get('user');
  const body = c.req.valid('json');

  // Upsert: if profile already exists, return it; otherwise create
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ data: existing[0] }, 200);
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      supabaseUserId,
      name: body.name,
      handicap: body.handicap != null ? String(body.handicap) : null,
      moodPreferences: body.moodPreferences ?? [],
    })
    .returning();

  return c.json({ data: created }, 201);
});

// GET /v1/users/me
usersRouter.get('/me', authMiddleware, async (c) => {
  const { supabaseUserId } = c.get('user');

  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);

  if (!profile) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User profile not found' } }, 404);
  }

  return c.json({ data: profile });
});

// PATCH /v1/users/me
usersRouter.patch('/me', authMiddleware, zValidator('json', updateProfileSchema), async (c) => {
  const { supabaseUserId } = c.get('user');
  const body = c.req.valid('json');

  const updates: Partial<typeof users.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.bio !== undefined) updates.bio = body.bio;
  if (body.isPrivate !== undefined) updates.isPrivate = body.isPrivate;
  if (body.handicap !== undefined) updates.handicap = body.handicap != null ? String(body.handicap) : null;
  if (body.moodPreferences !== undefined) updates.moodPreferences = body.moodPreferences;
  if (body.locationLat !== undefined) updates.locationLat = body.locationLat != null ? String(body.locationLat) : null;
  if (body.locationLng !== undefined) updates.locationLng = body.locationLng != null ? String(body.locationLng) : null;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'No valid fields to update' } }, 400);
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .returning();

  if (!updated) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User profile not found' } }, 404);
  }

  return c.json({ data: updated });
});

// GET /v1/users/:id — public profile (respects privacy)
usersRouter.get('/:id', authMiddleware, async (c) => {
  const { id: targetId } = c.req.param();
  const { supabaseUserId } = c.get('user');

  const [me] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);
  if (!me) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [target] = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      isPrivate: users.isPrivate,
      handicap: users.handicap,
      moodPreferences: users.moodPreferences,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (!target) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  // If private, only accepted friends (or self) can see full profile
  if (target.isPrivate && me.id !== targetId) {
    const [friendship] = await db
      .select({ id: friendships.id })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            and(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, targetId)),
            and(eq(friendships.requesterId, targetId), eq(friendships.addresseeId, me.id))
          )
        )
      )
      .limit(1);

    if (!friendship) {
      // Return limited public stub
      return c.json({
        data: {
          id: target.id,
          name: target.name,
          avatarUrl: target.avatarUrl,
          isPrivate: true,
        },
      });
    }
  }

  return c.json({ data: target });
});
