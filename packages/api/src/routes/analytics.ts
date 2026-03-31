import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db, bookings, teeTimeSlots } from '@teezy/db';
import { authMiddleware } from '../middleware/auth';

export const analyticsRouter = new Hono();

// GET /v1/analytics/:courseId/summary
analyticsRouter.get('/:courseId/summary', authMiddleware, async (c) => {
  const { courseId } = c.req.param();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Total bookings and revenue (all time) for this course
  const [totals] = await db.execute<{
    total_bookings: string;
    total_revenue_cents: string;
    avg_party_size: string;
  }>(
    sql`
      SELECT
        COUNT(*)::int                        AS total_bookings,
        COALESCE(SUM(total_price_in_cents), 0)::bigint AS total_revenue_cents,
        COALESCE(AVG(party_size), 0)::numeric(5,2)     AS avg_party_size
      FROM bookings
      WHERE course_id = ${courseId}
        AND status != 'cancelled'
    `
  );

  // Bookings by day for last 30 days
  const bookingsByDay = await db.execute<{
    date: string;
    count: string;
    revenue_cents: string;
  }>(
    sql`
      SELECT
        DATE(created_at AT TIME ZONE 'UTC')::text AS date,
        COUNT(*)::int                             AS count,
        COALESCE(SUM(total_price_in_cents), 0)::bigint AS revenue_cents
      FROM bookings
      WHERE course_id = ${courseId}
        AND status != 'cancelled'
        AND created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY date ASC
    `
  );

  // Top slots by booking count
  const topSlots = await db.execute<{
    starts_at: string;
    bookings: string;
  }>(
    sql`
      SELECT
        ts.starts_at::text AS starts_at,
        COUNT(b.id)::int   AS bookings
      FROM tee_time_slots ts
      LEFT JOIN bookings b ON b.slot_id = ts.id AND b.status != 'cancelled'
      WHERE ts.course_id = ${courseId}
      GROUP BY ts.id, ts.starts_at
      ORDER BY bookings DESC
      LIMIT 5
    `
  );

  return c.json({
    data: {
      totalBookings: Number(totals.total_bookings ?? 0),
      totalRevenueCents: Number(totals.total_revenue_cents ?? 0),
      avgPartySize: Number(totals.avg_party_size ?? 0),
      bookingsByDay: bookingsByDay.map((row) => ({
        date: row.date,
        count: Number(row.count),
        revenueCents: Number(row.revenue_cents),
      })),
      topSlots: topSlots.map((row) => ({
        startsAt: row.starts_at,
        bookings: Number(row.bookings),
      })),
    },
  });
});
