import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql, eq, and, desc } from 'drizzle-orm';
import { db, courses, teeTimeSlots, courseStaff, courseEvents, users } from '@par-tee/db';
import { authMiddleware } from '../middleware/auth';

export const coursesRouter = new Hono();

const MOOD_VALUES = [
  'competitive',
  'relaxed',
  'beginner',
  'advanced',
  'fast-paced',
  'social',
  'scenic',
  'challenging',
] as const;

const discoverQuerySchema = z.object({
  mood: z.enum(MOOD_VALUES).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(500).default(50),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

// GET /v1/courses/discover?mood=relaxed&lat=...&lng=...
coursesRouter.get('/discover', zValidator('query', discoverQuerySchema), async (c) => {
  const { mood, lat, lng, radiusKm, page, pageSize } = c.req.valid('query');
  const offset = (page - 1) * pageSize;

  // PostGIS distance filter + optional mood tag filter
  // ST_DWithin uses geography in metres, so radiusKm * 1000
  const radiusM = radiusKm * 1000;

  const moodFilter = mood
    ? sql`mood_tags @> ${JSON.stringify([mood])}::jsonb`
    : sql`TRUE`;

  const rows = await db
    .select({
      id: courses.id,
      name: courses.name,
      description: courses.description,
      locationLat: courses.locationLat,
      locationLng: courses.locationLng,
      address: courses.address,
      moodTags: courses.moodTags,
      amenities: courses.amenities,
      photoUrls: courses.photoUrls,
      holeCount: courses.holeCount,
      parScore: courses.parScore,
      websiteUrl: courses.websiteUrl,
      phoneNumber: courses.phoneNumber,
      distanceM: sql<number>`ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      )`.as('distance_m'),
    })
    .from(courses)
    .where(
      and(
        eq(courses.isActive, true),
        sql`ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusM}
        )`,
        moodFilter
      )
    )
    .orderBy(sql`distance_m ASC`)
    .limit(pageSize)
    .offset(offset);

  // Count for pagination
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(courses)
    .where(
      and(
        eq(courses.isActive, true),
        sql`ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusM}
        )`,
        moodFilter
      )
    );

  return c.json({
    data: rows,
    pagination: {
      total: Number(count),
      page,
      pageSize,
      hasNext: offset + rows.length < Number(count),
    },
  });
});

// GET /v1/courses/:id
coursesRouter.get('/:id', async (c) => {
  const { id } = c.req.param();

  const [course] = await db
    .select({
      id: courses.id,
      name: courses.name,
      description: courses.description,
      locationLat: courses.locationLat,
      locationLng: courses.locationLng,
      address: courses.address,
      moodTags: courses.moodTags,
      amenities: courses.amenities,
      photoUrls: courses.photoUrls,
      holeCount: courses.holeCount,
      parScore: courses.parScore,
      websiteUrl: courses.websiteUrl,
      phoneNumber: courses.phoneNumber,
      isActive: courses.isActive,
      createdAt: courses.createdAt,
    })
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);

  if (!course) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Course not found' } }, 404);
  }

  // Next 10 available slots
  const slots = await db
    .select()
    .from(teeTimeSlots)
    .where(
      and(
        eq(teeTimeSlots.courseId, id),
        sql`starts_at > NOW()`,
        sql`booked_count < capacity`
      )
    )
    .orderBy(teeTimeSlots.startsAt)
    .limit(10);

  return c.json({ data: { ...course, upcomingSlots: slots } });
});

// ─── Course profile editor ─────────────────────────────────────────────────

const updateCourseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  address: z.string().max(500).optional(),
  websiteUrl: z.string().url().nullable().optional(),
  phoneNumber: z.string().max(30).nullable().optional(),
  moodTags: z.array(z.enum([
    'competitive', 'relaxed', 'beginner', 'advanced', 'fast-paced', 'social', 'scenic', 'challenging',
  ])).optional(),
  amenities: z.array(z.string().max(100)).optional(),
  photoUrls: z.array(z.string().url()).max(20).optional(),
});

// PATCH /v1/courses/:id — update course profile (requires manager/owner staff role)
coursesRouter.patch('/:id', authMiddleware, zValidator('json', updateCourseSchema), async (c) => {
  const { id } = c.req.param();
  const { supabaseUserId } = c.get('user');
  const body = c.req.valid('json');

  // Resolve user
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);
  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  // Must be manager or owner
  const [staff] = await db
    .select({ role: courseStaff.role })
    .from(courseStaff)
    .where(and(eq(courseStaff.courseId, id), eq(courseStaff.userId, user.id)))
    .limit(1);
  if (!staff || staff.role === 'pro_shop') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Manager or owner access required' } }, 403);
  }

  const updates: Partial<typeof courses.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.address !== undefined) updates.address = body.address;
  if (body.websiteUrl !== undefined) updates.websiteUrl = body.websiteUrl;
  if (body.phoneNumber !== undefined) updates.phoneNumber = body.phoneNumber;
  if (body.moodTags !== undefined) updates.moodTags = body.moodTags;
  if (body.amenities !== undefined) updates.amenities = body.amenities;
  if (body.photoUrls !== undefined) updates.photoUrls = body.photoUrls;

  const [updated] = await db
    .update(courses)
    .set(updates)
    .where(eq(courses.id, id))
    .returning();

  if (!updated) return c.json({ error: { code: 'NOT_FOUND', message: 'Course not found' } }, 404);
  return c.json({ data: updated });
});

// ─── Pricing tier ─────────────────────────────────────────────────────────────

const pricingTierSchema = z.object({
  pricingTier: z.enum(['standard', 'basic_promotion', 'active_promotion', 'tournament', 'founding']),
});

// PATCH /v1/courses/:id/pricing-tier — update pricing tier (manager/owner only)
coursesRouter.patch('/:id/pricing-tier', authMiddleware, zValidator('json', pricingTierSchema), async (c) => {
  const { id } = c.req.param();
  const { supabaseUserId } = c.get('user');
  const { pricingTier } = c.req.valid('json');

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);
  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [staff] = await db
    .select({ role: courseStaff.role })
    .from(courseStaff)
    .where(and(eq(courseStaff.courseId, id), eq(courseStaff.userId, user.id)))
    .limit(1);
  if (!staff || staff.role === 'pro_shop') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Manager or owner access required' } }, 403);
  }

  const [updated] = await db
    .update(courses)
    .set({ pricingTier, updatedAt: new Date() })
    .where(eq(courses.id, id))
    .returning({ id: courses.id, pricingTier: courses.pricingTier });

  if (!updated) return c.json({ error: { code: 'NOT_FOUND', message: 'Course not found' } }, 404);
  return c.json({ data: updated });
});

// ─── Staff management ─────────────────────────────────────────────────────────

// GET /v1/courses/:id/staff
coursesRouter.get('/:id/staff', authMiddleware, async (c) => {
  const { id: courseId } = c.req.param();
  const { supabaseUserId } = c.get('user');

  const [actingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);
  if (!actingUser) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [myStaff] = await db
    .select()
    .from(courseStaff)
    .where(and(eq(courseStaff.courseId, courseId), eq(courseStaff.userId, actingUser.id)))
    .limit(1);
  if (!myStaff) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not a course staff member' } }, 403);
  }

  const staffList = await db
    .select({
      id: courseStaff.id,
      userId: courseStaff.userId,
      role: courseStaff.role,
      createdAt: courseStaff.createdAt,
      user: { id: users.id, name: users.name, email: users.email },
    })
    .from(courseStaff)
    .innerJoin(users, eq(users.id, courseStaff.userId))
    .where(eq(courseStaff.courseId, courseId));

  return c.json({ data: staffList });
});

// POST /v1/courses/:id/staff — add staff member (owner only)
coursesRouter.post(
  '/:id/staff',
  authMiddleware,
  zValidator('json', z.object({
    userId: z.string().uuid(),
    role: z.enum(['pro_shop', 'manager', 'owner']),
  })),
  async (c) => {
    const { id: courseId } = c.req.param();
    const { supabaseUserId } = c.get('user');
    const { userId: targetUserId, role } = c.req.valid('json');

    const [actingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.supabaseUserId, supabaseUserId))
      .limit(1);
    if (!actingUser) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const [myStaff] = await db
      .select({ role: courseStaff.role })
      .from(courseStaff)
      .where(and(eq(courseStaff.courseId, courseId), eq(courseStaff.userId, actingUser.id)))
      .limit(1);
    if (!myStaff || myStaff.role !== 'owner') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Owner access required' } }, 403);
    }

    const [member] = await db
      .insert(courseStaff)
      .values({ courseId, userId: targetUserId, role })
      .onConflictDoUpdate({ target: [courseStaff.courseId, courseStaff.userId], set: { role } })
      .returning();

    return c.json({ data: member }, 201);
  }
);

// ─── Course events ─────────────────────────────────────────────────────────────

// GET /v1/courses/:id/events — list published events (public) or all (staff)
coursesRouter.get('/:id/events', async (c) => {
  const { id: courseId } = c.req.param();

  const events = await db
    .select()
    .from(courseEvents)
    .where(and(eq(courseEvents.courseId, courseId), eq(courseEvents.isPublished, true)))
    .orderBy(courseEvents.eventDate);

  return c.json({ data: events });
});

// POST /v1/courses/:id/events — create event (manager/owner)
coursesRouter.post(
  '/:id/events',
  authMiddleware,
  zValidator('json', z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    imageUrl: z.string().url().optional(),
    eventDate: z.string().datetime(),
    isPublished: z.boolean().default(true),
  })),
  async (c) => {
    const { id: courseId } = c.req.param();
    const { supabaseUserId } = c.get('user');
    const body = c.req.valid('json');

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.supabaseUserId, supabaseUserId))
      .limit(1);
    if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const [staff] = await db
      .select({ role: courseStaff.role })
      .from(courseStaff)
      .where(and(eq(courseStaff.courseId, courseId), eq(courseStaff.userId, user.id)))
      .limit(1);
    if (!staff || staff.role === 'pro_shop') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Manager or owner access required' } }, 403);
    }

    const [event] = await db
      .insert(courseEvents)
      .values({
        courseId,
        title: body.title,
        description: body.description,
        imageUrl: body.imageUrl,
        eventDate: new Date(body.eventDate),
        isPublished: body.isPublished,
      })
      .returning();

    return c.json({ data: event }, 201);
  }
);

// PATCH /v1/courses/:id/events/:eventId
coursesRouter.patch(
  '/:id/events/:eventId',
  authMiddleware,
  zValidator('json', z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    eventDate: z.string().datetime().optional(),
    isPublished: z.boolean().optional(),
  })),
  async (c) => {
    const { id: courseId, eventId } = c.req.param();
    const { supabaseUserId } = c.get('user');
    const body = c.req.valid('json');

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.supabaseUserId, supabaseUserId))
      .limit(1);
    if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const [staff] = await db
      .select({ role: courseStaff.role })
      .from(courseStaff)
      .where(and(eq(courseStaff.courseId, courseId), eq(courseStaff.userId, user.id)))
      .limit(1);
    if (!staff || staff.role === 'pro_shop') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Manager or owner access required' } }, 403);
    }

    const updates: Partial<typeof courseEvents.$inferInsert> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
    if (body.eventDate !== undefined) updates.eventDate = new Date(body.eventDate);
    if (body.isPublished !== undefined) updates.isPublished = body.isPublished;

    const [updated] = await db
      .update(courseEvents)
      .set(updates)
      .where(and(eq(courseEvents.id, eventId), eq(courseEvents.courseId, courseId)))
      .returning();

    if (!updated) return c.json({ error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    return c.json({ data: updated });
  }
);

// DELETE /v1/courses/:id/events/:eventId
coursesRouter.delete('/:id/events/:eventId', authMiddleware, async (c) => {
  const { id: courseId, eventId } = c.req.param();
  const { supabaseUserId } = c.get('user');

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);
  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  const [staff] = await db
    .select({ role: courseStaff.role })
    .from(courseStaff)
    .where(and(eq(courseStaff.courseId, courseId), eq(courseStaff.userId, user.id)))
    .limit(1);
  if (!staff || staff.role === 'pro_shop') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Manager or owner access required' } }, 403);
  }

  await db
    .delete(courseEvents)
    .where(and(eq(courseEvents.id, eventId), eq(courseEvents.courseId, courseId)));

  return c.json({ data: { deleted: true } });
});
