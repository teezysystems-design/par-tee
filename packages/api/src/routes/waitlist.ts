import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, waitlist } from '@par-tee/db';
import { count } from 'drizzle-orm';

export const waitlistRouter = new Hono();

const joinWaitlistSchema = z.object({
  email: z.string().email({ message: 'Valid email is required' }),
  name: z.string().min(1).max(100).optional(),
});

// POST /v1/waitlist — add email to waitlist
waitlistRouter.post('/', zValidator('json', joinWaitlistSchema), async (c) => {
  const { email, name } = c.req.valid('json');

  try {
    const [entry] = await db
      .insert(waitlist)
      .values({ email: email.toLowerCase().trim(), name })
      .returning();

    return c.json({ data: entry }, 201);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === '23505') {
      return c.json(
        { error: { code: 'DUPLICATE_EMAIL', message: 'This email is already on the waitlist' } },
        409
      );
    }
    throw err;
  }
});

// GET /v1/waitlist/count — public stat
waitlistRouter.get('/count', async (c) => {
  const [{ total }] = await db
    .select({ total: count() })
    .from(waitlist);

  return c.json({ count: Number(total) });
});
