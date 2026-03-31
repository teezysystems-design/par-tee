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

interface BookingDay {
  date: string;
  count: number;
  revenueCents: number;
}

interface AnalyticsSummary {
  totalBookings: number;
  totalRevenueCents: number;
  avgPartySize: number;
  bookingsByDay: BookingDay[];
  topSlots: { startsAt: string; bookings: number }[];
}

export default function AnalyticsPage() {
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
        if (!res.ok) throw new Error('Failed to load analytics');
        const { data } = await res.json();
        setSummary(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [courseId]);

  // Last 7 days from bookingsByDay
  const last7Days = summary?.bookingsByDay.slice(-7) ?? [];

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: COLORS.gray900 }}>Analytics</h1>
        <p style={{ color: COLORS.gray600, marginTop: '0.25rem' }}>
          Booking trends and revenue insights for your course.
        </p>
      </div>

      {!courseId ? (
        <p style={{ color: COLORS.gray600 }}>
          Set{' '}
          <code
            style={{ background: COLORS.gray50, padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.85rem' }}
          >
            NEXT_PUBLIC_COURSE_ID
          </code>{' '}
          to view analytics.
        </p>
      ) : loading ? (
        <p style={{ color: COLORS.gray600 }}>Loading analytics...</p>
      ) : error ? (
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
      ) : summary ? (
        <>
          {/* Summary stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2.5rem',
            }}
          >
            {[
              { label: 'Total Bookings', value: summary.totalBookings.toLocaleString() },
              {
                label: 'Total Revenue',
                value: `$${(summary.totalRevenueCents / 100).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}`,
              },
              { label: 'Avg Party Size', value: summary.avgPartySize.toFixed(1) },
            ].map(({ label, value }) => (
              <div
                key={label}
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
              </div>
            ))}
          </div>

          {/* Last 7 days bookings table */}
          <div
            style={{
              background: COLORS.white,
              border: `1px solid ${COLORS.gray200}`,
              borderRadius: 12,
              padding: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: COLORS.gray900, marginBottom: '1rem' }}>
              Last 7 Days
            </h2>
            {last7Days.length === 0 ? (
              <p style={{ color: COLORS.gray600, fontSize: '0.9rem' }}>No bookings in the last 7 days.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                    {['Date', 'Bookings', 'Revenue'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '0.5rem 0.75rem',
                          textAlign: h === 'Date' ? 'left' : 'right',
                          color: COLORS.gray600,
                          fontWeight: 600,
                          fontSize: '0.82rem',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {last7Days.map((day) => (
                    <tr key={day.date} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                      <td style={{ padding: '0.6rem 0.75rem', color: COLORS.gray700 }}>
                        {new Date(day.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                        {day.count}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                        ${(day.revenueCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Top Slots */}
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
                Most Booked Slots
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                    <th
                      style={{
                        padding: '0.5rem 0.75rem',
                        textAlign: 'left',
                        color: COLORS.gray600,
                        fontWeight: 600,
                        fontSize: '0.82rem',
                      }}
                    >
                      Slot
                    </th>
                    <th
                      style={{
                        padding: '0.5rem 0.75rem',
                        textAlign: 'right',
                        color: COLORS.gray600,
                        fontWeight: 600,
                        fontSize: '0.82rem',
                      }}
                    >
                      Bookings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topSlots.map((slot) => (
                    <tr key={slot.startsAt} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                      <td style={{ padding: '0.6rem 0.75rem', color: COLORS.gray700 }}>
                        {new Date(slot.startsAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
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
