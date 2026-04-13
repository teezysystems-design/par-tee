/**
 * Course Dashboard API — Feature 7
 *
 * Endpoints consumed by the web-based course dashboard.
 * All endpoints scoped to a course via course_staff membership check.
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['SUPABASE_URL'] ?? '';
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

function supabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

const app = new Hono();

// ─── Helper: resolve course staff membership ────────────────────────────────

async function resolveCourseStaff(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const sb = supabase();

  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;

  // Get profile ID from supabase_user_id
  const { data: profile } = await sb
    .from('users')
    .select('id')
    .eq('supabase_user_id', user.id)
    .single();
  if (!profile) return null;

  // Get course_staff record
  const { data: staff } = await sb
    .from('course_staff')
    .select('id, course_id, role')
    .eq('user_id', profile.id)
    .in('role', ['owner', 'manager'])
    .single();
  if (!staff) return null;

  return {
    userId: profile.id,
    staffId: staff.id,
    courseId: staff.course_id,
    role: staff.role,
  };
}

// ─── GET /my-course — check staff membership ────────────────────────────────

app.get('/my-course', async (c) => {
  const staff = await resolveCourseStaff(c.req.header('authorization'));
  if (!staff) return c.json({ error: { message: 'Not a course manager' } }, 403);

  const sb = supabase();
  const { data: course } = await sb
    .from('courses')
    .select('id, name')
    .eq('id', staff.courseId)
    .single();

  return c.json({
    data: {
      courseId: staff.courseId,
      courseName: course?.name ?? 'Unknown Course',
      role: staff.role,
      staffId: staff.staffId,
    },
  });
});

// ─── GET /:courseId/dashboard/stats ──────────────────────────────────────────

app.get('/:courseId/dashboard/stats', async (c) => {
  const staff = await resolveCourseStaff(c.req.header('authorization'));
  if (!staff || staff.courseId !== c.req.param('courseId')) {
    return c.json({ error: { message: 'Unauthorized' } }, 403);
  }

  const sb = supabase();
  const courseId = staff.courseId;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Bookings today
  const { count: bookingsToday } = await sb
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .gte('created_at', todayStart)
    .neq('status', 'cancelled');

  // Bookings this week
  const { count: bookingsThisWeek } = await sb
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .gte('created_at', weekStart)
    .neq('status', 'cancelled');

  // Bookings this month
  const { count: bookingsThisMonth } = await sb
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .gte('created_at', monthStart)
    .neq('status', 'cancelled');

  // Revenue this month (sum of booking_fee_cents)
  const { data: revenueRows } = await sb
    .from('bookings')
    .select('booking_fee_cents')
    .eq('course_id', courseId)
    .gte('created_at', monthStart)
    .neq('status', 'cancelled');

  const revenueThisMonth = (revenueRows ?? []).reduce((sum, r) => sum + (r.booking_fee_cents ?? 0), 0);

  // Upcoming tee time slots
  const { count: upcomingTeeTimesCount } = await sb
    .from('tee_time_slots')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .gte('starts_at', now.toISOString());

  // Average party size
  const { data: partySizes } = await sb
    .from('bookings')
    .select('party_size')
    .eq('course_id', courseId)
    .gte('created_at', monthStart)
    .neq('status', 'cancelled');

  const avgPartySize = partySizes && partySizes.length > 0
    ? partySizes.reduce((sum, r) => sum + (r.party_size ?? 1), 0) / partySizes.length
    : 0;

  // Occupancy rate (booked_count vs capacity for upcoming slots)
  const { data: slots } = await sb
    .from('tee_time_slots')
    .select('capacity, booked_count')
    .eq('course_id', courseId)
    .gte('starts_at', monthStart)
    .lte('starts_at', now.toISOString());

  let occupancyRate = 0;
  if (slots && slots.length > 0) {
    const totalCapacity = slots.reduce((s, r) => s + (r.capacity ?? 4), 0);
    const totalBooked = slots.reduce((s, r) => s + (r.booked_count ?? 0), 0);
    occupancyRate = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;
  }

  return c.json({
    data: {
      bookingsToday: bookingsToday ?? 0,
      bookingsThisWeek: bookingsThisWeek ?? 0,
      bookingsThisMonth: bookingsThisMonth ?? 0,
      revenueThisMonth,
      occupancyRate,
      upcomingTeeTimesCount: upcomingTeeTimesCount ?? 0,
      avgPartySize: Math.round(avgPartySize * 10) / 10,
      topTimeSlot: null, // TODO: calculate most popular time slot
    },
  });
});

// ─── GET /:courseId/dashboard/recent-bookings ────────────────────────────────

app.get('/:courseId/dashboard/recent-bookings', async (c) => {
  const staff = await resolveCourseStaff(c.req.header('authorization'));
  if (!staff || staff.courseId !== c.req.param('courseId')) {
    return c.json({ error: { message: 'Unauthorized' } }, 403);
  }

  const sb = supabase();

  const { data: bookings } = await sb
    .from('bookings')
    .select(`
      id, party_size, status, created_at,
      users!bookings_user_id_fkey ( name, email ),
      tee_time_slots!bookings_slot_id_fkey ( starts_at )
    `)
    .eq('course_id', staff.courseId)
    .order('created_at', { ascending: false })
    .limit(10);

  const recent = (bookings ?? []).map((b: any) => {
    const startsAt = b.tee_time_slots?.starts_at ? new Date(b.tee_time_slots.starts_at) : null;
    return {
      id: b.id,
      playerName: b.users?.name ?? 'Unknown',
      playerEmail: b.users?.email ?? '',
      date: startsAt ? startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
      time: startsAt ? startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—',
      partySize: b.party_size ?? 1,
      status: b.status ?? 'pending',
    };
  });

  return c.json({ data: recent });
});

// ─── GET /:courseId/dashboard/weekly-trend ────────────────────────────────────

app.get('/:courseId/dashboard/weekly-trend', async (c) => {
  const staff = await resolveCourseStaff(c.req.header('authorization'));
  if (!staff || staff.courseId !== c.req.param('courseId')) {
    return c.json({ error: { message: 'Unauthorized' } }, 403);
  }

  const sb = supabase();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const trend = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();

    const { count } = await sb
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', staff.courseId)
      .gte('created_at', dayStart)
      .lt('created_at', dayEnd)
      .neq('status', 'cancelled');

    trend.push({ day: days[d.getDay()], bookings: count ?? 0 });
  }

  return c.json({ data: trend });
});

// ─── GET /:courseId/dashboard/bookings ────────────────────────────────────────

app.get('/:courseId/dashboard/bookings', async (c) => {
  const staff = await resolveCourseStaff(c.req.header('authorization'));
  if (!staff || staff.courseId !== c.req.param('courseId')) {
    return c.json({ error: { message: 'Unauthorized' } }, 403);
  }

  const sb = supabase();
  const page = Number(c.req.query('page')) || 1;
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
  const status = c.req.query('status');
  const search = c.req.query('search');
  const offset = (page - 1) * limit;

  let query = sb
    .from('bookings')
    .select(`
      id, party_size, status, booking_fee_cents, created_at,
      users!bookings_user_id_fkey ( name, email ),
      tee_time_slots!bookings_slot_id_fkey ( starts_at )
    `, { count: 'exact' })
    .eq('course_id', staff.courseId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data: bookings, count } = await query;

  let filtered = (bookings ?? []).map((b: any) => {
    const startsAt = b.tee_time_slots?.starts_at ? new Date(b.tee_time_slots.starts_at) : null;
    return {
      id: b.id,
      playerName: b.users?.name ?? 'Unknown',
      playerEmail: b.users?.email ?? '',
      date: startsAt ? startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
      time: startsAt ? startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—',
      partySize: b.party_size ?? 1,
      status: b.status ?? 'pending',
      bookingFeeCents: b.booking_fee_cents ?? 0,
      createdAt: b.created_at,
    };
  });

  // Client-side search filter (name matching)
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(b => b.playerName.toLowerCase().includes(s));
  }

  return c.json({ data: { bookings: filtered, total: count ?? 0 } });
});

// ─── GET /:courseId/dashboard/invoices ────────────────────────────────────────

app.get('/:courseId/dashboard/invoices', async (c) => {
  const staff = await resolveCourseStaff(c.req.header('authorization'));
  if (!staff || staff.courseId !== c.req.param('courseId')) {
    return c.json({ error: { message: 'Unauthorized' } }, 403);
  }

  const sb = supabase();

  const { data: invoices } = await sb
    .from('invoices')
    .select('*')
    .eq('course_id', staff.courseId)
    .order('billing_period_start', { ascending: false })
    .limit(24);

  const formatted = (invoices ?? []).map((inv: any) => ({
    id: inv.id,
    billingPeriodStart: inv.billing_period_start,
    billingPeriodEnd: inv.billing_period_end,
    bookingCount: inv.booking_count ?? 0,
    subtotalCents: inv.subtotal ?? 0,
    taxCents: inv.tax ?? 0,
    totalCents: inv.total ?? 0,
    status: inv.status ?? 'draft',
    paidAt: inv.paid_at,
    createdAt: inv.created_at,
  }));

  return c.json({ data: formatted });
});

// ─── GET /:courseId/dashboard/billing-summary ────────────────────────────────

app.get('/:courseId/dashboard/billing-summary', async (c) => {
  const staff = await resolveCourseStaff(c.req.header('authorization'));
  if (!staff || staff.courseId !== c.req.param('courseId')) {
    return c.json({ error: { message: 'Unauthorized' } }, 403);
  }

  const sb = supabase();

  // Get course pricing tier
  const { data: course } = await sb
    .from('courses')
    .select('pricing_tier')
    .eq('id', staff.courseId)
    .single();

  const tier = course?.pricing_tier ?? 'standard';
  const tierRates: Record<string, number> = {
    standard: 275,
    basic_promotion: 225,
    active_promotion: 200,
    tournament: 175,
    founding: 150,
  };
  const rate = tierRates[tier] ?? 275;

  // Current month bookings
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count: currentMonthBookings } = await sb
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', staff.courseId)
    .gte('created_at', monthStart)
    .neq('status', 'cancelled');

  const bkCount = currentMonthBookings ?? 0;

  // Total paid and outstanding from invoices
  const { data: invoices } = await sb
    .from('invoices')
    .select('total, status')
    .eq('course_id', staff.courseId);

  let totalPaid = 0;
  let totalOutstanding = 0;
  (invoices ?? []).forEach((inv: any) => {
    if (inv.status === 'paid') totalPaid += (inv.total ?? 0);
    else if (inv.status === 'pending' || inv.status === 'overdue') totalOutstanding += (inv.total ?? 0);
  });

  return c.json({
    data: {
      pricingTier: tier,
      ratePerBooking: rate,
      currentMonthBookings: bkCount,
      currentMonthEstimate: bkCount * rate,
      totalPaid,
      totalOutstanding,
    },
  });
});

export default app;
