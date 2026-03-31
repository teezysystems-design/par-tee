import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { HTTPException } from 'hono/http-exception';
import { healthRouter } from './routes/health';
import { coursesRouter } from './routes/courses';
import { usersRouter } from './routes/users';
import { bookingsRouter } from './routes/bookings';
import { socialRouter } from './routes/social';
import { waitlistRouter } from './routes/waitlist';
import { availabilityRouter } from './routes/availability';
import { analyticsRouter } from './routes/analytics';
import { paymentsRouter } from './routes/payments';
import { scorecardsRouter } from './routes/scorecards';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use(
  '*',
  cors({
    origin: [
      process.env['WEB_URL'] ?? 'http://localhost:3000',
      'capacitor://localhost',
      'ionic://localhost',
    ],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// Routes
app.route('/health', healthRouter);
app.route('/v1/courses', coursesRouter);
app.route('/v1/users', usersRouter);
app.route('/v1/bookings', bookingsRouter);
app.route('/v1/social', socialRouter);
app.route('/v1/waitlist', waitlistRouter);
app.route('/v1/availability', availabilityRouter);
app.route('/v1/analytics', analyticsRouter);
app.route('/v1/payments', paymentsRouter);
app.route('/v1/scorecards', scorecardsRouter);

// 404
app.notFound((c) => {
  return c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404);
});

// Error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: { code: 'HTTP_ERROR', message: err.message } }, err.status);
  }
  console.error(err);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
});

const port = Number(process.env['PORT'] ?? 4000);
console.log(`Teezy API running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

export default app;
