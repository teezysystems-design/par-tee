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
  red: '#ef4444',
};

interface TeeTimeSlot {
  id: string;
  startsAt: string;
  capacity: number;
  bookedCount: number;
  priceInCents: number;
  createdAt: string;
}

interface SlotFormData {
  startsAt: string;
  capacity: number;
  priceInCents: number;
}

export default function AvailabilityPage() {
  const courseId = process.env['NEXT_PUBLIC_COURSE_ID'];
  const [slots, setSlots] = useState<TeeTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<SlotFormData>({
    startsAt: '',
    capacity: 4,
    priceInCents: 5000,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function loadSlots() {
    if (!courseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/v1/availability/${courseId}/slots?pageSize=50`);
      if (!res.ok) throw new Error('Failed to load slots');
      const { data } = await res.json();
      setSlots(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function handleCreateSlot(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const res = await apiFetch(`/v1/availability/${courseId}/slots`, {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          startsAt: new Date(formData.startsAt).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? 'Failed to create slot');
      }
      setShowForm(false);
      setFormData({ startsAt: '', capacity: 4, priceInCents: 5000 });
      await loadSlots();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSlot(slotId: string) {
    if (!confirm('Delete this tee time slot?')) return;
    try {
      const res = await apiFetch(`/v1/availability/slots/${slotId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data?.error?.message ?? 'Failed to delete slot');
        return;
      }
      await loadSlots();
    } catch {
      alert('Network error');
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: COLORS.gray900 }}>Availability</h1>
          <p style={{ color: COLORS.gray600, marginTop: '0.25rem' }}>
            Manage your upcoming tee time slots.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: COLORS.green,
            color: COLORS.white,
            padding: '0.65rem 1.25rem',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '0.9rem',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : 'Add Slot'}
        </button>
      </div>

      {/* Add Slot Form */}
      {showForm && (
        <div
          style={{
            background: COLORS.white,
            border: `1px solid ${COLORS.gray200}`,
            borderRadius: 12,
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: COLORS.gray900, marginBottom: '1.25rem' }}>
            New Tee Time Slot
          </h2>
          <form onSubmit={handleCreateSlot}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: COLORS.gray700, marginBottom: '0.35rem' }}
                >
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.startsAt}
                  onChange={(e) => setFormData((d) => ({ ...d, startsAt: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 8,
                    border: `1.5px solid ${COLORS.gray200}`,
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: COLORS.gray700, marginBottom: '0.35rem' }}
                >
                  Capacity (golfers)
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  required
                  value={formData.capacity}
                  onChange={(e) => setFormData((d) => ({ ...d, capacity: Number(e.target.value) }))}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 8,
                    border: `1.5px solid ${COLORS.gray200}`,
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: COLORS.gray700, marginBottom: '0.35rem' }}
                >
                  Price per person ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  value={(formData.priceInCents / 100).toFixed(2)}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, priceInCents: Math.round(Number(e.target.value) * 100) }))
                  }
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 8,
                    border: `1.5px solid ${COLORS.gray200}`,
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
            {formError && (
              <p style={{ color: COLORS.red, fontSize: '0.85rem', marginBottom: '0.75rem' }}>{formError}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              style={{
                background: saving ? COLORS.gray200 : COLORS.green,
                color: saving ? COLORS.gray600 : COLORS.white,
                padding: '0.65rem 1.5rem',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: '0.9rem',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Create Slot'}
            </button>
          </form>
        </div>
      )}

      {/* Slots Table */}
      {!courseId ? (
        <p style={{ color: COLORS.gray600 }}>
          Set{' '}
          <code
            style={{ background: COLORS.gray50, padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.85rem' }}
          >
            NEXT_PUBLIC_COURSE_ID
          </code>{' '}
          to manage availability.
        </p>
      ) : loading ? (
        <p style={{ color: COLORS.gray600 }}>Loading slots...</p>
      ) : slots.length === 0 ? (
        <div
          style={{
            background: COLORS.white,
            border: `1px solid ${COLORS.gray200}`,
            borderRadius: 12,
            padding: '3rem',
            textAlign: 'center',
            color: COLORS.gray600,
          }}
        >
          No tee time slots yet. Click &quot;Add Slot&quot; to create your first one.
        </div>
      ) : (
        <div
          style={{
            background: COLORS.white,
            border: `1px solid ${COLORS.gray200}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead style={{ background: COLORS.gray50 }}>
              <tr>
                {['Date', 'Time', 'Capacity', 'Booked', 'Available', 'Price', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: h === 'Actions' ? 'right' : 'left',
                      color: COLORS.gray600,
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      borderBottom: `1px solid ${COLORS.gray200}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const startsAt = new Date(slot.startsAt);
                return (
                  <tr key={slot.id} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                    <td style={{ padding: '0.75rem 1rem', color: COLORS.gray700 }}>
                      {startsAt.toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: COLORS.gray700 }}>
                      {startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{slot.capacity}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{slot.bookedCount}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          color: slot.capacity - slot.bookedCount === 0 ? COLORS.red : COLORS.green,
                          fontWeight: 600,
                        }}
                      >
                        {slot.capacity - slot.bookedCount}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      ${(slot.priceInCents / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        disabled={slot.bookedCount > 0}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${COLORS.gray200}`,
                          color: slot.bookedCount > 0 ? COLORS.gray600 : COLORS.red,
                          padding: '0.35rem 0.75rem',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          cursor: slot.bookedCount > 0 ? 'not-allowed' : 'pointer',
                          opacity: slot.bookedCount > 0 ? 0.5 : 1,
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
