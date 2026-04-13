'use client';

/**
 * Bookings Management — Feature 7
 *
 * Searchable, filterable table of all bookings for the course.
 */

import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from '../layout';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1B6B3A';

interface Booking {
  id: string;
  playerName: string;
  playerEmail: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
  bookingFeeCents: number;
  createdAt: string;
}

type StatusFilter = 'all' | 'confirmed' | 'pending' | 'cancelled' | 'completed';

export default function BookingsPage() {
  const ctx = useDashboard();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const fetchBookings = useCallback(async () => {
    if (!ctx) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        courseId: ctx.courseId,
        page: String(page),
        limit: String(perPage),
      });
      if (filter !== 'all') params.set('status', filter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`${API_URL}/v1/courses/${ctx.courseId}/dashboard/bookings?${params}`, {
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        setBookings(json.data?.bookings ?? []);
        setTotal(json.data?.total ?? 0);
      }
    } catch {} finally { setLoading(false); }
  }, [ctx, page, filter, search]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleCancel = async (bookingId: string) => {
    if (!ctx || !confirm('Cancel this booking?')) return;
    try {
      const res = await fetch(`${API_URL}/v1/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      });
      if (res.ok) fetchBookings();
    } catch {}
  };

  const totalPages = Math.ceil(total / perPage);

  const statusColors: Record<string, { bg: string; text: string }> = {
    confirmed: { bg: '#dcfce7', text: '#16a34a' },
    pending: { bg: '#fef3c7', text: '#d97706' },
    cancelled: { bg: '#fef2f2', text: '#dc2626' },
    completed: { bg: '#f3f4f6', text: '#6b7280' },
  };

  return (
    <div style={{ padding: 32, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111', margin: '0 0 24px' }}>Bookings</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by player name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1.5px solid #e5e7eb',
            fontSize: 14,
            width: 260,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 3 }}>
          {(['all', 'confirmed', 'pending', 'cancelled', 'completed'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: filter === f ? 700 : 500,
                color: filter === f ? '#111' : '#9ca3af',
                background: filter === f ? '#fff' : 'transparent',
                boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af' }}>
          {total} booking{total !== 1 ? 's' : ''} total
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {['Player', 'Date', 'Time', 'Party', 'Status', 'Fee', 'Actions'].map((h) => (
                <th key={h} style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No bookings found</td></tr>
            ) : (
              bookings.map((b) => {
                const sc = statusColors[b.status] ?? statusColors.pending;
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{b.playerName}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{b.playerEmail}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#374151' }}>{b.date}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#374151' }}>{b.time}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#374151' }}>{b.partySize}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: sc.text, background: sc.bg,
                        padding: '3px 8px', borderRadius: 6, textTransform: 'capitalize',
                      }}>
                        {b.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#374151' }}>
                      ${(b.bookingFeeCents / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {b.status === 'confirmed' && (
                        <button
                          onClick={() => handleCancel(b.id)}
                          style={{
                            fontSize: 12, fontWeight: 600, color: '#dc2626',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '4px 8px', borderRadius: 6,
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            padding: 16, borderTop: '1px solid #e5e7eb',
          }}>
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
                background: '#fff', cursor: page === 1 ? 'default' : 'pointer',
                opacity: page === 1 ? 0.4 : 1, fontSize: 13,
              }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
                background: '#fff', cursor: page === totalPages ? 'default' : 'pointer',
                opacity: page === totalPages ? 0.4 : 1, fontSize: 13,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
