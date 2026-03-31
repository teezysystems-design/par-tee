'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

const COLORS = {
  green: '#1a6b2a',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray200: '#e5e7eb',
  gray600: '#4b5563',
  gray700: '#374151',
  gray900: '#111827',
};

interface AnalyticsSummary {
  totalBookings: number;
  totalRevenueCents: number;
  avgPartySize: number;
  bookingsByDay: { date: string; count: number; revenueCents: number }[];
  topSlots: { startsAt: string; bookings: number }[];
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.gray200}`,
        borderRadius: 12,
        padding: '1.5rem',
      }}
    >
      <p style={{ fontSize: '0.85rem', color: COLORS.gray600, fontWeight: 500, marginBottom: '0.5rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '2rem', fontWeight: 800, color: COLORS.gray900 }}>{value}</p>
      {subtext && <p style={{ fontSize: '0.8rem', color: COLORS.gray600, marginTop: '0.25rem' }}>{subtext}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const courseId = process.env['NEXT_PUBLIC_COURSE_ID'];
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }
    apiFetch(`/v1/analytics/${courseId}/summary`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const { data } = await res.json();
        setSummary(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [courseId]);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: COLORS.gray900 }}>
          Course Dashboard
        </h1>
        <p style={{ color: COLORS.gray600, marginTop: '0.25rem' }}>
          Manage your tee times, availability, and bookings.
        </p>
      </div>

      {!courseId ? (
        <div
          style={{
            background: COLORS.white,
            border: `1px solid ${COLORS.gray200}`,
            borderRadius: 16,
            padding: '3rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⛳</div>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem', color: COLORS.gray900, marginBottom: '0.5rem' }}>
            Connect your course
          </h2>
          <p style={{ color: COLORS.gray600, marginBottom: '1.5rem' }}>
            Set{' '}
            <code
              style={{
                background: COLORS.gray50,
                padding: '0.15rem 0.4rem',
                borderRadius: 4,
                fontSize: '0.85rem',
              }}
            >
              NEXT_PUBLIC_COURSE_ID
            </code>{' '}
            in your environment to see your course analytics.
          </p>
          <a
            href="/dashboard/connect"
            style={{
              background: COLORS.green,
              color: COLORS.white,
              padding: '0.7rem 1.5rem',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            Set up Stripe Connect
          </a>
        </div>
      ) : loading ? (
        <p style={{ color: COLORS.gray600 }}>Loading analytics...</p>
      ) : error ? (
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
      ) : summary ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2.5rem',
            }}
          >
            <StatCard
              label="Total Bookings"
              value={summary.totalBookings.toLocaleString()}
              subtext="All time"
            />
            <StatCard
              label="Revenue (last 30d)"
              value={`$${(summary.totalRevenueCents / 100).toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}`}
              subtext="Net of platform fee"
            />
            <StatCard
              label="Avg Party Size"
              value={summary.avgPartySize.toFixed(1)}
              subtext="Golfers per booking"
            />
          </div>

          {summary.topSlots.length > 0 && (
            <div
              style={{
                background: COLORS.white,
                border: `1px solid ${COLORS.gray200}`,
                borderRadius: 12,
                padding: '1.5rem',
              }}
            >
              <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: COLORS.gray900, marginBottom: '1rem' }}>
                Top Tee Time Slots
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem', color: COLORS.gray600, fontWeight: 600 }}>
                      Starts At
                    </th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.gray600, fontWeight: 600 }}>
                      Bookings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topSlots.map((slot) => (
                    <tr key={slot.startsAt} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                      <td style={{ padding: '0.6rem 0.5rem', color: COLORS.gray700 }}>
                        {new Date(slot.startsAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                        {slot.bookings}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
