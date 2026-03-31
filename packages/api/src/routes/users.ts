import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, users } from '@teezy/db';
import { authMiddleware } from '../middleware/auth';

export const usersRouter = new Hono();

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  handicap: z.number().min(0).max(54).nullable().optional(),
  moodPreferences: z
    .array(
      z.enum([
        'competitive',
        'relaxed',
        'beginner',
        'advanced',
        'fast-paced',
        'social',
        'scenic',
        'challenging',
      ])
    )
    .optional(),
  locationLat: z.number().min(-90).max(90).nullable().optional(),
  locationLng: z.number().min(-180).max(180).nullable().optional(),
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
