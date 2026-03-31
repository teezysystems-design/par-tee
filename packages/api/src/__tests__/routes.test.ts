/**
 * Unit tests for Teezy API routes.
 *
 * Each test creates a minimal Hono app that mounts only the router under test,
 * so we never import index.ts (which calls serve() and loads @hono/node-server).
 *
 * The database and Supabase client are fully mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @teezy/db before any route import
// ---------------------------------------------------------------------------
vi.mock('@teezy/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(),
  },
  courses: {},
  teeTimeSlots: {},
  bookings: {},
  users: {},
  scoreCards: {},
  waitlist: {},
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'supabase-uid-1', email: 'test@example.com' } },
        error: null,
      }),
    },
  })),
}));

process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-key';

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { waitlistRouter } from '../routes/waitlist';
import { coursesRouter } from '../routes/courses';
import { bookingsRouter } from '../routes/bookings';
import { scorecardsRouter } from '../routes/scorecards';
import { availabilityRouter } from '../routes/availability';
import { healthRouter } from '../routes/health';
import { db } from '@teezy/db';

// ---------------------------------------------------------------------------
// Helper: build a test app mounting a single router
// ---------------------------------------------------------------------------
function testApp(path: string, router: Hono) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: { code: 'HTTP_ERROR', message: err.message } }, err.status);
    }
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
  });
  app.route(path, router);
  return app;
}

function req(app: Hono, method: string, url: string, opts?: { body?: unknown; auth?: string }) {
  return app.request(`http://localhost${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: opts?.auth ?? 'Bearer valid-token',
    },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  });
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
describe('GET /health', () => {
  const app = testApp('/health', healthRouter);

  it('returns 200 without auth', async () => {
    const res = await app.request('http://localhost/health');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Waitlist
// ---------------------------------------------------------------------------
describe('POST /v1/waitlist', () => {
  const app = testApp('/v1/waitlist', waitlistRouter);

  beforeEach(() => {
    vi.mocked(db.insert).mockReturnValue({
      values: () => ({
        returning: () => Promise.resolve([{ id: '1', email: 'new@example.com', createdAt: new Date() }]),
      }),
    } as never);
  });

  it('rejects missing email', async () => {
    const res = await req(app, 'POST', '/v1/waitlist', { body: { name: 'No Email' } });
    expect(res.status).toBe(400);
  });

  it('rejects invalid email format', async () => {
    const res = await req(app, 'POST', '/v1/waitlist', { body: { email: 'not-an-email' } });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Auth enforcement
// ---------------------------------------------------------------------------
describe('Auth enforcement', () => {
  const bookingsApp = testApp('/v1/bookings', bookingsRouter);

  it('GET /v1/bookings returns 401 with no auth header', async () => {
    const res = await req(bookingsApp, 'GET', '/v1/bookings', { auth: '' });
    expect(res.status).toBe(401);
  });

  it('GET /v1/bookings returns 401 with malformed Bearer token', async () => {
    const res = await req(bookingsApp, 'GET', '/v1/bookings', { auth: 'NotBearer abc' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Bookings — input validation
// ---------------------------------------------------------------------------
describe('POST /v1/bookings — Zod validation', () => {
  const app = testApp('/v1/bookings', bookingsRouter);

  it('rejects partySize > 4', async () => {
    const res = await req(app, 'POST', '/v1/bookings', {
      body: { slotId: '00000000-0000-0000-0000-000000000001', partySize: 5 },
    });
    expect(res.status).toBe(400);
  });

  it('rejects partySize < 1', async () => {
    const res = await req(app, 'POST', '/v1/bookings', {
      body: { slotId: '00000000-0000-0000-0000-000000000001', partySize: 0 },
    });
    expect(res.status).toBe(400);
  });

  it('rejects non-uuid slotId', async () => {
    const res = await req(app, 'POST', '/v1/bookings', {
      body: { slotId: 'not-a-uuid', partySize: 2 },
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Scorecards — input validation (includes QA fix for max hole score)
// ---------------------------------------------------------------------------
describe('POST /v1/scorecards — Zod validation', () => {
  const app = testApp('/v1/scorecards', scorecardsRouter);

  it('rejects empty holeScores array', async () => {
    const res = await req(app, 'POST', '/v1/scorecards', {
      body: { bookingId: '00000000-0000-0000-0000-000000000001', holeScores: [] },
    });
    expect(res.status).toBe(400);
  });

  it('rejects more than 18 holes', async () => {
    const res = await req(app, 'POST', '/v1/scorecards', {
      body: {
        bookingId: '00000000-0000-0000-0000-000000000001',
        holeScores: Array(19).fill(4),
      },
    });
    expect(res.status).toBe(400);
  });

  it('rejects hole score of 0', async () => {
    const res = await req(app, 'POST', '/v1/scorecards', {
      body: {
        bookingId: '00000000-0000-0000-0000-000000000001',
        holeScores: [0, 4, 3],
      },
    });
    expect(res.status).toBe(400);
  });

  it('rejects hole score above 15', async () => {
    const res = await req(app, 'POST', '/v1/scorecards', {
      body: {
        bookingId: '00000000-0000-0000-0000-000000000001',
        holeScores: [16, 4, 3],
      },
    });
    expect(res.status).toBe(400);
  });

  it('rejects notes exceeding 1000 chars', async () => {
    const res = await req(app, 'POST', '/v1/scorecards', {
      body: {
        bookingId: '00000000-0000-0000-0000-000000000001',
        holeScores: [4, 5, 3],
        notes: 'x'.repeat(1001),
      },
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Courses discover — query validation
// ---------------------------------------------------------------------------
describe('GET /v1/courses/discover — query validation', () => {
  const app = testApp('/v1/courses', coursesRouter);

  it('requires lat and lng', async () => {
    const res = await app.request('http://localhost/v1/courses/discover');
    expect(res.status).toBe(400);
  });

  it('rejects lat out of range', async () => {
    const res = await app.request('http://localhost/v1/courses/discover?lat=91&lng=0');
    expect(res.status).toBe(400);
  });

  it('rejects lng out of range', async () => {
    const res = await app.request('http://localhost/v1/courses/discover?lat=0&lng=200');
    expect(res.status).toBe(400);
  });

  it('rejects unknown mood value', async () => {
    const res = await app.request(
      'http://localhost/v1/courses/discover?lat=40&lng=-74&mood=power-nap'
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Availability slots — input validation
// ---------------------------------------------------------------------------
describe('POST /v1/availability/:courseId/slots — input validation', () => {
  const app = testApp('/v1/availability', availabilityRouter);

  it('rejects capacity > 8', async () => {
    const res = await req(
      app,
      'POST',
      '/v1/availability/00000000-0000-0000-0000-000000000001/slots',
      { body: { startsAt: new Date().toISOString(), capacity: 9, priceInCents: 5000 } }
    );
    expect(res.status).toBe(400);
  });

  it('rejects negative priceInCents', async () => {
    const res = await req(
      app,
      'POST',
      '/v1/availability/00000000-0000-0000-0000-000000000001/slots',
      { body: { startsAt: new Date().toISOString(), capacity: 4, priceInCents: -1 } }
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid startsAt', async () => {
    const res = await req(
      app,
      'POST',
      '/v1/availability/00000000-0000-0000-0000-000000000001/slots',
      { body: { startsAt: 'yesterday', capacity: 4, priceInCents: 5000 } }
    );
    expect(res.status).toBe(400);
  });
});
