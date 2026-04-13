'use client';

/**
 * Dashboard Overview — Feature 7
 *
 * Stats cards, booking trend chart, recent bookings, and quick actions.
 */

import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from './layout';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1B6B3A';

interface DashboardStats {
  bookingsToday: number;
  bookingsThisWeek: number;
  bookingsThisMonth: number;
  revenueThisMonth: number;
  occupancyRate: number;
  upcomingTeeTimesCount: number;
  avgPartySize: number;
  topTimeSlot: string | null;
}

interface RecentBooking {
  id: string;
  playerName: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
}

interface WeeklyTrend {
  day: string;
  bookings: number;
}

export default function DashboardOverview() {
  const ctx = useDashboard();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<RecentBooking[]>([]);
  const [trend, setTrend] = useState<WeeklyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!ctx) return;
    try {
      const [statsRes, recentRes, trendRes] = await Promise.all([
        fetch(`${API_URL}/v1/courses/${ctx.courseId}/dashboard/stats`, {
          headers: { Authorization: `Bearer ${ctx.accessToken}` },
        }),
        fetch(`${API_URL}/v1/courses/${ctx.courseId}/dashboard/recent-bookings`, {
          headers: { Authorization: `Bearer ${ctx.accessToken}` },
        }),
        fetch(`${API_URL}/v1/courses/${ctx.courseId}/dashboard/weekly-trend`, {
          headers: { Authorization: `Bearer ${ctx.accessToken}` },
        }),
      ]);

      if (statsRes.ok) {
        const json = await statsRes.json();
        setStats(json.data);
      }
      if (recentRes.ok) {
        const json = await recentRes.json();
        setRecent(json.data ?? []);
      }
      if (trendRes.ok) {
        const json = await trendRes.json();
        setTrend(json.data ?? []);
      }
    } catch {} finally { setLoading(false); }
  }, [ctx]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <p style={{ color: '#9ca3af' }}>Loading overview...</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Today', value: stats?.bookingsToday ?? 0, sub: 'bookings', color: PRIMARY },
    { label: 'This Week', value: stats?.bookingsThisWeek ?? 0, sub: 'bookings', color: '#2563eb' },
    { label: 'This Month', value: stats?.bookingsThisMonth ?? 0, sub: 'bookings', color: '#7c3aed' },
    { label: 'Revenue (est.)', value: `$${((stats?.revenueThisMonth ?? 0) / 100).toFixed(2)}`, sub: 'CAD this month', color: '#d97706' },
    { label: 'Occupancy', value: `${stats?.occupancyRate ?? 0}%`, sub: 'tee time fill rate', color: '#dc2626' },
    { label: 'Avg Party Size', value: stats?.avgPartySize?.toFixed(1) ?? '—', sub: 'golfers/booking', color: '#059669' },
  ];

  const maxTrend = Math.max(...trend.map(t => t.bookings), 1);

  return (
    <div style={{ padding: 32, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111', margin: 0 }}>
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}
        </h1>
        <p style={{ fontSize: 15, color: '#6b7280', marginTop: 4 }}>
          Here&apos;s how {ctx?.courseName} is performing
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        {statCards.map((card) => (
          <div key={card.label} style={{
            background: '#fff',
            borderRadius: 16,
            padding: '20px 20px 16px',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Weekly Trend */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 20px' }}>Weekly Booking Trend</h2>
          {trend.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
              {trend.map((t) => (
                <div key={t.day} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: PRIMARY, marginBottom: 4 }}>{t.bookings}</div>
                  <div style={{
                    height: `${Math.max((t.bookings / maxTrend) * 100, 4)}px`,
                    background: `linear-gradient(to top, ${PRIMARY}, #22c55e)`,
                    borderRadius: '6px 6px 0 0',
                    minHeight: 4,
                    transition: 'height 0.3s ease',
                  }} />
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, fontWeight: 500 }}>{t.day}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Bookings */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>Recent Bookings</h2>
            <a href="/dashboard/bookings" style={{ fontSize: 13, color: PRIMARY, fontWeight: 600, textDecoration: 'none' }}>View all →</a>
          </div>
          {recent.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No recent bookings</p>
          ) : (
            <div>
              {recent.slice(0, 6).map((b) => {
                const statusColor: Record<string, string> = {
                  confirmed: '#16a34a',
                  pending: '#d97706',
                  cancelled: '#dc2626',
                  completed: '#6b7280',
                };
                return (
                  <div key={b.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid #f3f4f6',
                    gap: 12,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: PRIMARY,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0,
                    }}>
                      {(b.playerName ?? '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{b.playerName}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{b.date} · {b.time} · {b.partySize} golfer{b.partySize !== 1 ? 's' : ''}</div>
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: statusColor[b.status] ?? '#6b7280',
                      textTransform: 'capitalize',
                      background: b.status === 'confirmed' ? '#dcfce7' : b.status === 'pending' ? '#fef3c7' : '#f3f4f6',
                      padding: '3px 8px',
                      borderRadius: 6,
                    }}>
                      {b.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Manage Tee Times', href: '/dashboard/availability', icon: '🕐', desc: 'Create and manage slots' },
          { label: 'Edit Course', href: '/dashboard/course', icon: '✏️', desc: 'Update profile & photos' },
          { label: 'Create Tournament', href: '/dashboard/tournaments', icon: '🏆', desc: 'Set up a new event' },
          { label: 'View Invoices', href: '/dashboard/billing', icon: '📄', desc: 'Billing & payment history' },
        ].map((action) => (
          <a
            key={action.href}
            href={action.href}
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: '16px 20px',
              border: '1px solid #e5e7eb',
              textDecoration: 'none',
              display: 'block',
              transition: 'box-shadow 0.15s',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>{action.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{action.label}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{action.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
