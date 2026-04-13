import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createAdminClient } from '../lib/supabase';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { standardRateLimit } from '../middleware/rate-limit';
import { badRequest, notFound, forbidden } from '../lib/errors';

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

/** Get list of friend user IDs for a given profile */
async function getFriendIds(profileId: string): Promise<string[]> {
  const sb = createAdminClient();
  const { data: friendships } = await sb
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${profileId},friend_id.eq.${profileId}`)
    .eq('status', 'accepted');

  if (!friendships || friendships.length === 0) return [];

  return friendships.map((f: { user_id: string; friend_id: string }) =>
    f.user_id === profileId ? f.friend_id : f.user_id
  );
}

const MODE_LABELS: Record<string, string> = {
  solo: '🏌️ Solo',
  match_1v1: '⚔️ 1v1 Match',
  match_2v2: '🤝 2v2 Scramble',
  tournament: '🏆 Tournament',
  casual: '😎 Casual',
};

// ─── GET /social/feed — friends feed ─────────────────────────────────────────

router.get('/feed', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const { limit, offset } = c.req.query();
  const sb = createAdminClient();

  const limitNum = Math.min(Number(limit) || 20, 50);
  const offsetNum = Number(offset) || 0;

  // Get friend IDs
  const friendIds = await getFriendIds(profileId);
  // Include self in feed
  const feedUserIds = [profileId, ...friendIds];

  // Fetch posts from friends + self
  const { data: posts, error } = await sb
    .from('feed_posts')
    .select(`
      id, author_id, body, media_urls, course_id, round_id,
      visibility, post_type, created_at,
      users!feed_posts_author_id_fkey(display_name, username, avatar_url),
      courses(name)
    `)
    .in('author_id', feedUserIds)
    .in('visibility', ['public', 'friends'])
    .order('created_at', { ascending: false })
    .range(offsetNum, offsetNum + limitNum - 1);

  if (error) badRequest(error.message);

  // Get like counts and user's likes in one pass
  const postIds = (posts ?? []).map((p: { id: string }) => p.id);

  let likeCounts: Record<string, number> = {};
  let userLikes: Set<string> = new Set();
  let commentCounts: Record<string, number> = {};

  if (postIds.length > 0) {
    // Like counts
    const { data: likes } = await sb
      .from('post_likes')
      .select('post_id')
      .in('post_id', postIds);

    for (const like of likes ?? []) {
      likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1;
    }

    // User's own likes
    const { data: myLikes } = await sb
      .from('post_likes')
      .select('post_id')
      .in('post_id', postIds)
      .eq('user_id', profileId);

    for (const like of myLikes ?? []) {
      userLikes.add(like.post_id);
    }

    // Comment counts
    const { data: comments } = await sb
      .from('post_comments')
      .select('post_id')
      .in('post_id', postIds);

    for (const comment of comments ?? []) {
      commentCounts[comment.post_id] = (commentCounts[comment.post_id] || 0) + 1;
    }
  }

  const formatted = (posts ?? []).map((p: Record<string, unknown>) => {
    const author = p.users as Record<string, unknown> | null;
    const course = p.courses as Record<string, unknown> | null;
    return {
      id: p.id,
      authorId: p.author_id,
      authorName: author?.display_name ?? author?.username ?? 'Unknown',
      authorUsername: author?.username ?? null,
      authorAvatar: author?.avatar_url ?? null,
      body: p.body,
      mediaUrls: p.media_urls,
      courseId: p.course_id,
      courseName: course?.name ?? null,
      roundId: p.round_id,
      visibility: p.visibility,
      postType: p.post_type,
      createdAt: p.created_at,
      likeCount: likeCounts[(p.id as string)] || 0,
      commentCount: commentCounts[(p.id as string)] || 0,
      liked: userLikes.has(p.id as string),
    };
  });

  // Sort by spec priority: rank_up > challenge > round_score (competitive) > others
  const typePriority: Record<string, number> = {
    rank_up: 1,
    challenge: 2,
    round_score: 3,
    tournament_result: 4,
    course_promotion: 5,
    swing_video: 6,
    general: 7,
  };

  formatted.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const pa = typePriority[(a.postType as string)] || 99;
    const pb = typePriority[(b.postType as string)] || 99;
    if (pa !== pb) return pa - pb;
    // Same priority — sort by recency
    return new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime();
  });

  return c.json({ data: formatted });
});

// ─── GET /social/posts/:id — single post ────────────────────────────────────

router.get('/posts/:id', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  await resolveProfileId(user.id);
  const postId = c.req.param('id');
  const sb = createAdminClient();

  const { data: post } = await sb
    .from('feed_posts')
    .select(`
      id, author_id, body, media_urls, course_id, round_id,
      visibility, post_type, created_at,
      users!feed_posts_author_id_fkey(display_name, username, avatar_url),
      courses(name)
    `)
    .eq('id', postId)
    .single();

  if (!post) notFound('Post not found');

  const author = post.users as Record<string, unknown> | null;
  const course = post.courses as Record<string, unknown> | null;

  return c.json({
    data: {
      id: post.id,
      authorId: post.author_id,
      authorName: author?.display_name ?? author?.username ?? 'Unknown',
      authorUsername: author?.username ?? null,
      authorAvatar: author?.avatar_url ?? null,
      body: post.body,
      mediaUrls: post.media_urls,
      courseId: post.course_id,
      courseName: course?.name ?? null,
      roundId: post.round_id,
      visibility: post.visibility,
      postType: post.post_type,
      createdAt: post.created_at,
    },
  });
});

// ─── POST /social/posts — create a post ─────────────────────────────────────

const createPostSchema = z.object({
  body: z.string().min(1).max(2000),
  mediaUrls: z.array(z.string().url()).max(4).optional(),
  courseId: z.string().uuid().optional(),
  roundId: z.string().uuid().optional(),
  visibility: z.enum(['public', 'friends', 'private']).default('friends'),
  postType: z.enum(['round_score', 'swing_video', 'general', 'challenge']).default('general'),
});

router.post(
  '/posts',
  standardRateLimit,
  authMiddleware,
  zValidator('json', createPostSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const body = c.req.valid('json');
    const sb = createAdminClient();

    const { data: post, error } = await sb
      .from('feed_posts')
      .insert({
        id: crypto.randomUUID(),
        author_id: profileId,
        body: body.body,
        media_urls: body.mediaUrls ?? [],
        course_id: body.courseId ?? null,
        round_id: body.roundId ?? null,
        visibility: body.visibility,
        post_type: body.postType,
      })
      .select()
      .single();

    if (error) badRequest(error.message);

    return c.json({ data: post }, 201);
  }
);

// ─── DELETE /social/posts/:id — delete own post ─────────────────────────────

router.delete('/posts/:id', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const postId = c.req.param('id');
  const sb = createAdminClient();

  const { data: post } = await sb
    .from('feed_posts')
    .select('id, author_id')
    .eq('id', postId)
    .single();

  if (!post) notFound('Post not found');
  if (post.author_id !== profileId) forbidden('You can only delete your own posts');

  // Delete associated likes and comments first
  await sb.from('post_likes').delete().eq('post_id', postId);
  await sb.from('post_comments').delete().eq('post_id', postId);
  await sb.from('feed_posts').delete().eq('id', postId);

  return c.json({ data: { deleted: true } });
});

// ─── POST /social/posts/:id/like — toggle like ─────────────────────────────

router.post('/posts/:id/like', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const postId = c.req.param('id');
  const sb = createAdminClient();

  // Check post exists
  const { data: post } = await sb
    .from('feed_posts')
    .select('id')
    .eq('id', postId)
    .single();

  if (!post) notFound('Post not found');

  // Check if already liked
  const { data: existing } = await sb
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', profileId)
    .single();

  if (existing) {
    // Unlike
    await sb.from('post_likes').delete().eq('id', existing.id);
    return c.json({ data: { liked: false } });
  }

  // Like
  await sb.from('post_likes').insert({
    id: crypto.randomUUID(),
    post_id: postId,
    user_id: profileId,
  });

  return c.json({ data: { liked: true } });
});

// ─── GET /social/posts/:id/comments — list comments ────────────────────────

router.get('/posts/:id/comments', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  await resolveProfileId(user.id);
  const postId = c.req.param('id');
  const sb = createAdminClient();

  const { data: comments } = await sb
    .from('post_comments')
    .select(`
      id, post_id, user_id, body, created_at,
      users(display_name, username, avatar_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  const formatted = (comments ?? []).map((cm: Record<string, unknown>) => {
    const u = cm.users as Record<string, unknown> | null;
    return {
      id: cm.id,
      postId: cm.post_id,
      userId: cm.user_id,
      authorName: u?.display_name ?? u?.username ?? 'Unknown',
      authorUsername: u?.username ?? null,
      authorAvatar: u?.avatar_url ?? null,
      body: cm.body,
      createdAt: cm.created_at,
    };
  });

  return c.json({ data: formatted });
});

// ─── POST /social/posts/:id/comments — add comment ─────────────────────────

const commentSchema = z.object({
  body: z.string().min(1).max(1000),
});

router.post(
  '/posts/:id/comments',
  standardRateLimit,
  authMiddleware,
  zValidator('json', commentSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const postId = c.req.param('id');
    const { body } = c.req.valid('json');
    const sb = createAdminClient();

    // Verify post exists
    const { data: post } = await sb
      .from('feed_posts')
      .select('id')
      .eq('id', postId)
      .single();

    if (!post) notFound('Post not found');

    const { data: comment, error } = await sb
      .from('post_comments')
      .insert({
        id: crypto.randomUUID(),
        post_id: postId,
        user_id: profileId,
        body,
      })
      .select()
      .single();

    if (error) badRequest(error.message);

    return c.json({ data: comment }, 201);
  }
);

// ─── DELETE /social/posts/:postId/comments/:commentId ───────────────────────

router.delete(
  '/posts/:postId/comments/:commentId',
  standardRateLimit,
  authMiddleware,
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const commentId = c.req.param('commentId');
    const sb = createAdminClient();

    const { data: comment } = await sb
      .from('post_comments')
      .select('id, user_id')
      .eq('id', commentId)
      .single();

    if (!comment) notFound('Comment not found');
    if (comment.user_id !== profileId) forbidden('You can only delete your own comments');

    await sb.from('post_comments').delete().eq('id', commentId);

    return c.json({ data: { deleted: true } });
  }
);

// ─── Friends ────────────────────────────────────────────────────────────────

// GET /social/friends — list friends
router.get('/friends', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const sb = createAdminClient();

  const { data: friendships } = await sb
    .from('friendships')
    .select('user_id, friend_id, created_at')
    .or(`user_id.eq.${profileId},friend_id.eq.${profileId}`)
    .eq('status', 'accepted');

  if (!friendships || friendships.length === 0) {
    return c.json({ data: [] });
  }

  // Collect all friend profile IDs
  const friendProfileIds = friendships.map(
    (f: { user_id: string; friend_id: string }) =>
      f.user_id === profileId ? f.friend_id : f.user_id
  );

  // Fetch profiles
  const { data: profiles } = await sb
    .from('users')
    .select('id, display_name, username, avatar_url, handicap')
    .in('id', friendProfileIds);

  // Fetch rankings for each friend
  const { data: rankings } = await sb
    .from('player_rankings')
    .select('user_id, points, tier, rounds_played')
    .in('user_id', friendProfileIds);

  const rankMap = new Map(
    (rankings ?? []).map((r: Record<string, unknown>) => [r.user_id, r])
  );

  const formatted = (profiles ?? []).map((p: Record<string, unknown>) => {
    const rank = rankMap.get(p.id as string) as Record<string, unknown> | undefined;
    return {
      id: p.id,
      displayName: p.display_name,
      username: p.username,
      avatarUrl: p.avatar_url,
      handicap: p.handicap,
      tier: rank?.tier ?? 'bronze_1',
      points: rank?.points ?? 0,
      roundsPlayed: rank?.rounds_played ?? 0,
    };
  });

  return c.json({ data: formatted });
});

// POST /social/friends/add — send friend request by username
const addFriendSchema = z.object({
  username: z.string().min(1).max(30),
});

router.post(
  '/friends/add',
  standardRateLimit,
  authMiddleware,
  zValidator('json', addFriendSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const { username } = c.req.valid('json');
    const sb = createAdminClient();

    // Find target user by username
    const { data: target } = await sb
      .from('users')
      .select('id, username')
      .eq('username', username.toLowerCase())
      .single();

    if (!target) notFound(`No user found with username "${username}"`);
    if (target.id === profileId) badRequest('Cannot add yourself');

    // Check existing friendship
    const { data: existing } = await sb
      .from('friendships')
      .select('id, status')
      .or(
        `and(user_id.eq.${profileId},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${profileId})`
      )
      .single();

    if (existing) {
      if (existing.status === 'accepted') {
        return c.json({ data: { message: `Already friends with @${username}` } });
      }
      if (existing.status === 'pending') {
        return c.json({ data: { message: `Friend request already pending with @${username}` } });
      }
    }

    // Create friendship request
    await sb.from('friendships').insert({
      id: crypto.randomUUID(),
      user_id: profileId,
      friend_id: target.id,
      status: 'pending',
    });

    // Fire-and-forget notification
    sb.from('notifications')
      .insert({
        id: crypto.randomUUID(),
        user_id: target.id,
        type: 'friend_request',
        title: 'Friend Request',
        body: `Someone wants to be your golf buddy!`,
        data: { fromUserId: profileId },
      })
      .then(() => {});

    return c.json({ data: { message: `Friend request sent to @${username}` } }, 201);
  }
);

// GET /social/friends/requests — pending friend requests
router.get('/friends/requests', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const sb = createAdminClient();

  const { data: requests } = await sb
    .from('friendships')
    .select('id, user_id, created_at, users!friendships_user_id_fkey(display_name, username, avatar_url)')
    .eq('friend_id', profileId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const formatted = (requests ?? []).map((r: Record<string, unknown>) => {
    const u = r.users as Record<string, unknown> | null;
    return {
      id: r.id,
      fromUserId: r.user_id,
      fromName: u?.display_name ?? u?.username ?? 'Unknown',
      fromUsername: u?.username ?? null,
      fromAvatar: u?.avatar_url ?? null,
      createdAt: r.created_at,
    };
  });

  return c.json({ data: formatted });
});

// POST /social/friends/respond — accept/decline friend request
const respondFriendSchema = z.object({
  friendshipId: z.string().uuid(),
  response: z.enum(['accepted', 'declined']),
});

router.post(
  '/friends/respond',
  standardRateLimit,
  authMiddleware,
  zValidator('json', respondFriendSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const { friendshipId, response } = c.req.valid('json');
    const sb = createAdminClient();

    const { data: friendship, error } = await sb
      .from('friendships')
      .update({ status: response })
      .eq('id', friendshipId)
      .eq('friend_id', profileId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !friendship) notFound('No pending friend request found');

    return c.json({ data: { status: response } });
  }
);

// POST /social/friends/contact-sync — find friends from phone contacts
const contactSyncSchema = z.object({
  phones: z.array(z.string()).max(500).default([]),
  emails: z.array(z.string()).max(500).default([]),
});

router.post(
  '/friends/contact-sync',
  standardRateLimit,
  authMiddleware,
  zValidator('json', contactSyncSchema),
  async (c) => {
    const user = c.get('user');
    const profileId = await resolveProfileId(user.id);
    const { phones, emails } = c.req.valid('json');
    const sb = createAdminClient();

    if (phones.length === 0 && emails.length === 0) {
      return c.json({ data: [] });
    }

    // Normalize phone numbers (strip non-digits)
    const normalizedPhones = phones.map((p) => p.replace(/\D/g, ''));

    // Search users by phone or email
    let matchQuery = sb
      .from('users')
      .select('id, display_name, username, avatar_url, handicap')
      .neq('id', profileId);

    // Build OR conditions for phone and email
    const conditions: string[] = [];
    if (normalizedPhones.length > 0) {
      conditions.push(`phone.in.(${normalizedPhones.join(',')})`);
    }
    if (emails.length > 0) {
      conditions.push(`email.in.(${emails.join(',')})`);
    }

    if (conditions.length > 0) {
      matchQuery = matchQuery.or(conditions.join(','));
    }

    const { data: matches } = await matchQuery.limit(50);

    // Get rankings for matched users
    const matchIds = (matches ?? []).map((m: { id: string }) => m.id);
    const { data: rankings } = matchIds.length > 0
      ? await sb.from('player_rankings').select('user_id, points, tier, rounds_played').in('user_id', matchIds)
      : { data: [] };

    const rankMap = new Map(
      (rankings ?? []).map((r: Record<string, unknown>) => [r.user_id, r])
    );

    const formatted = (matches ?? []).map((p: Record<string, unknown>) => {
      const rank = rankMap.get(p.id as string) as Record<string, unknown> | undefined;
      return {
        id: p.id,
        displayName: p.display_name,
        username: p.username,
        avatarUrl: p.avatar_url,
        handicap: p.handicap,
        tier: rank?.tier ?? 'bronze_1',
        points: rank?.points ?? 0,
        roundsPlayed: rank?.rounds_played ?? 0,
      };
    });

    return c.json({ data: formatted });
  }
);

// DELETE /social/friends/:friendId — remove friend
router.delete('/friends/:friendId', standardRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const profileId = await resolveProfileId(user.id);
  const friendId = c.req.param('friendId');
  const sb = createAdminClient();

  const { error } = await sb
    .from('friendships')
    .delete()
    .or(
      `and(user_id.eq.${profileId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${profileId})`
    );

  if (error) badRequest(error.message);

  return c.json({ data: { removed: true } });
});

// ─── Auto-post helper (used by parties finish and other routes) ─────────────

/**
 * Create an auto-generated feed post.
 * Used internally for round_score and rank_up auto-posts.
 */
export async function createAutoPost(opts: {
  authorId: string;
  body: string;
  postType: 'round_score' | 'rank_up' | 'tournament_result' | 'challenge';
  courseId?: string;
  roundId?: string;
  visibility?: 'public' | 'friends' | 'private';
}) {
  const sb = createAdminClient();
  await sb.from('feed_posts').insert({
    id: crypto.randomUUID(),
    author_id: opts.authorId,
    body: opts.body,
    media_urls: [],
    course_id: opts.courseId ?? null,
    round_id: opts.roundId ?? null,
    visibility: opts.visibility ?? 'friends',
    post_type: opts.postType,
  });
}

export { router as socialRouter };
