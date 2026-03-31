import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const coursesRouter = new Hono();

const discoverQuerySchema = z.object({
  mood: z
    .enum([
      'competitive',
      'relaxed',
      'beginner',
      'advanced',
      'fast-paced',
      'social',
      'scenic',
      'challenging',
    ])
    .optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(500).default(50),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

coursesRouter.get('/discover', zValidator('query', discoverQuerySchema), (c) => {
  const query = c.req.valid('query');
  // TODO: implement mood-based discovery engine with PostGIS + scoring algorithm
  return c.json({
    data: [],
    meta: { query, message: 'Discovery engine coming soon' },
    pagination: { total: 0, page: query.page, pageSize: query.pageSize, hasNext: false },
  });
});

coursesRouter.get('/:id', (c) => {
  const { id } = c.req.param();
  // TODO: fetch course by id from db
  return c.json({ data: null, meta: { id, message: 'Course detail coming soon' } });
});
