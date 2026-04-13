import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';

import { authRouter } from '../src/routes/auth';
import dashboardRouter from '../src/routes/dashboard';
import { coursesRouter } from '../src/routes/courses';
import dashboardRouter from '../src/routes/dashboard';
import { teeTimesRouter } from '../src/routes/tee-times';
import dashboardRouter from '../src/routes/dashboard';
import { bookingsRouter } from '../src/routes/bookings';
import dashboardRouter from '../src/routes/dashboard';
import { roundsRouter } from '../src/routes/rounds';
import dashboardRouter from '../src/routes/dashboard';
import { rankingsRouter } from '../src/routes/rankings';
import dashboardRouter from '../src/routes/dashboard';
import { socialRouter } from '../src/routes/social';
import dashboardRouter from '../src/routes/dashboard';
import { leaguesRouter } from '../src/routes/leagues';
import dashboardRouter from '../src/routes/dashboard';
import { tournamentsRouter } from '../src/routes/tournaments';
import dashboardRouter from '../src/routes/dashboard';
import { billingRouter } from '../src/routes/billing';
import dashboardRouter from '../src/routes/dashboard';
import { paymentsRouter } from '../src/routes/payments';
import dashboardRouter from '../src/routes/dashboard';
import { notificationsRouter } from '../src/routes/notifications';
import dashboardRouter from '../src/routes/dashboard';
import { aiMatchingRouter } from '../src/routes/ai-matching';
import dashboardRouter from '../src/routes/dashboard';
import { usersRouter } from '../src/routes/users';
import dashboardRouter from '../src/routes/dashboard';

const app = new Hono();

// ─── Global middleware ────────────────────────────────────────────────────────

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: [
      process.env['WEB_URL'] ?? 'http://localhost:3000',
      'capacitor://localhost',
    ],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (c) =>
  c.json({ status: 'ok', runtime: 'edge', ts: new Date().toISOString() })
);

// ─── Routes ──────────────────────────────────────────────────────────────────

app.route('/auth', authRouter);
app.route('/courses', coursesRouter);
  .route('/courses', dashboardRouter)
app.route('/tee-times', teeTimesRouter);
app.route('/bookings', bookingsRouter);
app.route('/rounds', roundsRouter);
app.route('/rankings', rankingsRouter);
app.route('/social', socialRouter);
app.route('/leagues', leaguesRouter);
app.route('/tournaments', tournamentsRouter);
app.route('/billing', billingRouter);
app.route('/payments', paymentsRouter);
app.route('/notifications', notificationsRouter);
app.route('/ai-matching', aiMatchingRouter);
app.route('/users', usersRouter);

// ─── Error handling ───────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404)
);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: 'HTTP_ERROR', message: err.message } },
      err.status
    );
  }
  console.error('[API Error]', err);
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    500
  );
});

// ─── Vercel Edge export ───────────────────────────────────────────────────────

export const config = { runtime: 'edge' };
export default app.fetch;
