import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
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

usersRouter.get('/me', authMiddleware, (c) => {
  const user = c.get('user');
  // TODO: fetch user profile from db by supabaseUserId
  return c.json({ data: null, meta: { supabaseUserId: user.supabaseUserId } });
});

usersRouter.patch('/me', authMiddleware, zValidator('json', updateProfileSchema), (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  // TODO: update user profile in db
  return c.json({ data: null, meta: { supabaseUserId: user.supabaseUserId, updates: body } });
});
