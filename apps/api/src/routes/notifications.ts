import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createAdminClient } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { standardRateLimit } from '../middleware/rate-limit';
import { badRequest, notFound } from '../lib/errors';

const router = new Hono();

// GET /notifications — list user's notifications
router.get('/', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const { unreadOnly, limit, offset } = c.req.query();
  const supabase = createAdminClient();

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(Number(limit) || 30)
    .range(Number(offset) || 0, (Number(offset) || 0) + (Number(limit) || 30) - 1);

  if (unreadOnly === 'true') query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) badRequest(error.message);

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  return c.json({ notifications: data ?? [], unreadCount: unreadCount ?? 0 });
});

// POST /notifications/:id/read — mark single notification read
router.post('/:id/read', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id)
    .select()
    .single();

  if (error || !data) notFound('Notification not found');

  return c.json({ notification: data });
});

// POST /notifications/read-all — mark all read
router.post('/read-all', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const supabase = createAdminClient();

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  return c.json({ success: true });
});

const pushDispatchSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(1000),
  type: z.enum([
    'booking_confirmed',
    'booking_cancelled',
    'round_complete',
    'league_invite',
    'tournament_open',
    'friend_request',
    'ranking_update',
  ]),
  payload: z.record(z.unknown()),
  title: z.string().max(200),
  body: z.string().max(500),
});

// POST /notifications/dispatch — internal push dispatch (server-to-server)
// In production, this should be called by server-side jobs, not directly by clients
router.post(
  '/dispatch',
  standardRateLimit,
  authMiddleware,
  zValidator('json', pushDispatchSchema),
  async (c) => {
    const body = c.req.valid('json');
    const supabase = createAdminClient();

    // Insert notification records
    const { error } = await supabase.from('notifications').insert(
      body.userIds.map((userId) => ({
        user_id: userId,
        type: body.type,
        payload: body.payload,
        title: body.title,
        body: body.body,
        is_read: false,
      }))
    );

    if (error) badRequest(error.message);

    // TODO: Integrate with Expo Push Notifications (XER-35) or FCM
    // For now, store in DB and let mobile app poll or use Supabase Realtime

    return c.json({ dispatched: body.userIds.length });
  }
);

const preferenceSchema = z.object({
  bookingConfirmed: z.boolean().optional(),
  bookingCancelled: z.boolean().optional(),
  roundComplete: z.boolean().optional(),
  leagueInvite: z.boolean().optional(),
  rankingUpdate: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  // Extended types for Section 18
  rankUp: z.boolean().optional(),
  partyInvite: z.boolean().optional(),
  friendRequest: z.boolean().optional(),
  leagueMatch: z.boolean().optional(),
  tournamentStart: z.boolean().optional(),
  socialLike: z.boolean().optional(),
  availabilityReminder: z.boolean().optional(),
  // Array-style enabledTypes (mobile client convenience)
  enabledTypes: z.array(z.string()).optional(),
});

// GET /notifications/preferences — fetch user's notification preferences
router.get('/preferences', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('users')
    .select('notification_preferences')
    .eq('id', user.id)
    .single();

  const stored = (data?.notification_preferences ?? {}) as Record<string, unknown>;
  // Return enabledTypes if present, otherwise derive from boolean flags
  const enabledTypes: string[] = stored['enabledTypes'] as string[] ?? [
    'rank_up', 'round_submitted', 'party_invite', 'friend_request',
    'league_match', 'tournament_start', 'social_like', 'availability_reminder',
  ];

  return c.json({ data: { ...stored, enabledTypes } });
});

// PATCH /notifications/preferences
router.patch(
  '/preferences',
  standardRateLimit,
  authMiddleware,
  zValidator('json', preferenceSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('users')
      .update({ notification_preferences: body, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id, notification_preferences')
      .single();

    if (error) badRequest(error.message);

    return c.json({ preferences: data?.notification_preferences ?? body });
  }
);

// PUT /notifications/preferences — alias for PATCH (mobile client convenience)
router.put(
  '/preferences',
  standardRateLimit,
  authMiddleware,
  zValidator('json', preferenceSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('users')
      .update({ notification_preferences: body, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id, notification_preferences')
      .single();

    if (error) badRequest(error.message);

    return c.json({ preferences: data?.notification_preferences ?? body });
  }
);

export { router as notificationsRouter };
