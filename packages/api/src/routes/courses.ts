import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql, eq, and } from 'drizzle-orm';
import { db, courses, teeTimeSlots } from '@teezy/db';

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
