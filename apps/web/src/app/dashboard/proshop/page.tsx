'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

const COLORS = {
  green: '#1a7f4b',
  greenPale: '#e8f5ee',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray600: '#4b5563',
  gray700: '#374151',
  gray900: '#111827',
  amber: '#f59e0b',
  amberPale: '#fffbeb',
  blue: '#3b82f6',
  bluePale: '#eff6ff',
};

interface TeeTimeSlot {
  id: string;
  startsAt: string;
  capacity: number;
  bookedCount: number;
  priceInCents: number;
}

interface Booking {
  id: string;
  status: string;
  partySize: number;
  totalPriceInCents: number;
  slotId: string;
  createdAt: string;
}

export default function ProShopPage() {
  const courseId = process.env['NEXT_PUBLIC_COURSE_ID'];
  const [todaySlots, setTodaySlots] = useState<TeeTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    const dateParam = today.toISOString().split('T')[0];
    apiFetch(`/v1/availability/${courseId}/slots?date=${dateParam}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        setTodaySlots(data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  const totalSlots = todaySlots.length;
  const bookedSlots = todaySlots.filter((s) => s.bookedCount > 0).length;
  const totalCheckIns = todaySlots.reduce((sum, s) => sum + s.bookedCount, 0);
  const availableSlots = todaySlots.filter((s) => s.bookedCount < s.capacity).length;

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: COLORS.gray900 }}>Pro Shop — Today</h1>
        <p style={{ color: COLORS.gray600, marginTop: '0.25rem' }}>{todayStr}</p>
      </div>

      {!courseId ? (
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 12, padding: '2.5rem', textAlign: 'center', color: COLORS.gray600 }}>
          Set <code style={{ background: COLORS.gray50, padding: '0.15rem 0.4rem', borderRadius: 4 }}>NEXT_PUBLIC_COURSE_ID</code> to view today's tee sheet.
        </div>
      ) : loading ? (
        <p style={{ color: COLORS.gray600 }}>Loading today's tee sheet...</p>
      ) : (
        <>
          {/* Summary stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            <StatCard label="Total Tee Times" value={String(totalSlots)} color={COLORS.gray900} />
            <StatCard label="Booked" value={String(bookedSlots)} color={COLORS.green} bg={COLORS.greenPale} />
            <StatCard label="Available" value={String(availableSlots)} color={COLORS.blue} bg={COLORS.bluePale} />
            <StatCard label="Expected Check-ins" value={String(totalCheckIns)} color={COLORS.amber} bg={COLORS.amberPale} />
          </div>

          {/* Tee sheet */}
          <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: `1px solid ${COLORS.gray200}` }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: COLORS.gray900 }}>Tee Sheet</h2>
            </div>

            {todaySlots.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: COLORS.gray600 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                No tee times scheduled for today.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: COLORS.gray50 }}>
                    {['Time', 'Status', 'Booked / Cap', 'Price', 'Action'].map((h) => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: COLORS.gray600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todaySlots.map((slot) => {
                    const isFull = slot.bookedCount >= slot.capacity;
                    const hasBookings = slot.bookedCount > 0;
                    const time = new Date(slot.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr key={slot.id} style={{ borderTop: `1px solid ${COLORS.gray200}` }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: COLORS.gray900 }}>{time}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.6rem',
                              borderRadius: 12,
                              background: isFull ? '#fef2f2' : hasBookings ? COLORS.greenPale : COLORS.gray100,
                              color: isFull ? '#ef4444' : hasBookings ? COLORS.green : COLORS.gray600,
                            }}
                          >
                            {isFull ? 'Full' : hasBookings ? 'Booked' : 'Open'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: COLORS.gray700 }}>
                          <strong>{slot.bookedCount}</strong>/{slot.capacity} golfers
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: COLORS.gray700 }}>
                          ${(slot.priceInCents / 100).toFixed(0)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {hasBookings && (
                            <button
                              style={{
                                background: COLORS.greenPale,
                                border: `1px solid ${COLORS.green}`,
                                color: COLORS.green,
                                borderRadius: 8,
                                padding: '0.3rem 0.75rem',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Check In
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pro shop notes */}
          <div
            style={{
              marginTop: '1.5rem',
              background: COLORS.amberPale,
              border: `1px solid #fcd34d`,
              borderRadius: 12,
              padding: '1rem 1.25rem',
              fontSize: '0.88rem',
              color: COLORS.gray700,
            }}
          >
            <strong>Pro Shop Only:</strong> This view shows today's tee sheet and check-ins.
            For revenue analytics, course profile, and event management, switch to{' '}
            <a href="/dashboard" style={{ color: COLORS.green, fontWeight: 700 }}>Manager View</a>.
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string;
  color: string;
  bg?: string;
}) {
  return (
    <div
      style={{
        background: bg ?? COLORS.white,
        border: `1px solid ${COLORS.gray200}`,
        borderRadius: 12,
        padding: '1.25rem',
      }}
    >
      <p style={{ fontSize: '0.82rem', color: COLORS.gray600, fontWeight: 500, marginBottom: '0.4rem' }}>{label}</p>
      <p style={{ fontSize: '2rem', fontWeight: 800, color }}>{value}</p>
    </div>
  );
}
