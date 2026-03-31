'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

const G = '#1a7f4b';
const COLORS = {
  green: G,
  greenPale: '#e8f5ee',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray200: '#e5e7eb',
  gray600: '#4b5563',
  gray700: '#374151',
  gray900: '#111827',
  red: '#ef4444',
};

interface CourseEvent {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  eventDate: string;
  isPublished: boolean;
  createdAt: string;
}

const EVENT_SUGGESTIONS = [
  'Ladies Night',
  'Couples Night',
  'Happy Hour Golf',
  'Junior Clinic',
  'Twilight Special',
  'Member-Guest Tournament',
  'Charity Scramble',
  'Senior Day',
];

export default function EventsPage() {
  const courseId = process.env['NEXT_PUBLIC_COURSE_ID'];
  const [events, setEvents] = useState<CourseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchEvents = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/v1/courses/${courseId}/events`);
      if (!res.ok) throw new Error('Failed to fetch');
      const { data } = await res.json();
      setEvents(data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [courseId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !title.trim() || !eventDate) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiFetch(`/v1/courses/${courseId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          eventDate: new Date(eventDate).toISOString(),
          isPublished,
        }),
      });
      if (!res.ok) throw new Error('Failed to create event');
      setTitle('');
      setDescription('');
      setEventDate('');
      setImageUrl('');
      setIsPublished(true);
      setShowForm(false);
      fetchEvents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (event: CourseEvent) => {
    if (!courseId) return;
    try {
      await apiFetch(`/v1/courses/${courseId}/events/${event.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: !event.isPublished }),
      });
      fetchEvents();
    } catch {
      // silent
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!courseId || !confirm('Delete this event?')) return;
    try {
      await apiFetch(`/v1/courses/${courseId}/events/${eventId}`, { method: 'DELETE' });
      fetchEvents();
    } catch {
      // silent
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: COLORS.gray900 }}>Events & Promotions</h1>
          <p style={{ color: COLORS.gray600, marginTop: '0.25rem' }}>
            Create events that appear in the player discovery feed and social feed.
          </p>
        </div>
        {courseId && (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: COLORS.green,
              color: COLORS.white,
              border: 'none',
              borderRadius: 10,
              padding: '0.7rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            {showForm ? '✕ Cancel' : '+ New Event'}
          </button>
        )}
      </div>

      {!courseId && (
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 12, padding: '2.5rem', textAlign: 'center', color: COLORS.gray600 }}>
          Set <code style={{ background: COLORS.gray50, padding: '0.15rem 0.4rem', borderRadius: 4 }}>NEXT_PUBLIC_COURSE_ID</code> to manage events.
        </div>
      )}

      {/* Create form */}
      {showForm && courseId && (
        <form
          onSubmit={handleCreate}
          style={{
            background: COLORS.white,
            border: `1px solid ${COLORS.gray200}`,
            borderRadius: 14,
            padding: '1.75rem',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem', color: COLORS.gray900 }}>
            Create Event
          </h2>

          {/* Quick suggestions */}
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.8rem', color: COLORS.gray600, marginBottom: '0.5rem' }}>Quick pick:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {EVENT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTitle(s)}
                  style={{
                    background: title === s ? COLORS.greenPale : COLORS.gray50,
                    border: `1px solid ${title === s ? COLORS.green : COLORS.gray200}`,
                    borderRadius: 20,
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: title === s ? COLORS.green : COLORS.gray700,
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={lbl}>Event Title *</label>
              <input
                style={inp}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ladies Night"
                required
              />
            </div>
            <div>
              <label style={lbl}>Date & Time *</label>
              <input
                style={inp}
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Description (optional)</label>
            <textarea
              style={{ ...inp, minHeight: 80, resize: 'vertical' } as React.CSSProperties}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell players what to expect..."
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Image URL (optional)</label>
            <input
              style={inp}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <input
              type="checkbox"
              id="published"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="published" style={{ fontSize: '0.9rem', color: COLORS.gray700, cursor: 'pointer' }}>
              Publish immediately (visible in player feed)
            </label>
          </div>

          {error && <p style={{ color: COLORS.red, fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              background: COLORS.green,
              color: COLORS.white,
              border: 'none',
              borderRadius: 10,
              padding: '0.75rem 1.75rem',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      )}

      {/* Events list */}
      {loading ? (
        <p style={{ color: COLORS.gray600 }}>Loading events...</p>
      ) : events.length === 0 ? (
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <p style={{ color: COLORS.gray600 }}>No events yet. Create your first event to attract players.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {events.map((event) => (
            <div
              key={event.id}
              style={{
                background: COLORS.white,
                border: `1px solid ${COLORS.gray200}`,
                borderRadius: 14,
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <h3 style={{ fontWeight: 700, fontSize: '1.05rem', color: COLORS.gray900 }}>{event.title}</h3>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.6rem',
                      borderRadius: 20,
                      background: event.isPublished ? COLORS.greenPale : COLORS.gray50,
                      color: event.isPublished ? COLORS.green : COLORS.gray600,
                    }}
                  >
                    {event.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: COLORS.gray600 }}>
                  📅 {new Date(event.eventDate).toLocaleString()}
                </p>
                {event.description && (
                  <p style={{ fontSize: '0.85rem', color: COLORS.gray700, marginTop: '0.4rem' }}>{event.description}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  onClick={() => handleTogglePublish(event)}
                  style={outlineBtn}
                >
                  {event.isPublished ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  onClick={() => handleDelete(event.id)}
                  style={{ ...outlineBtn, borderColor: '#fca5a5', color: COLORS.red }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 700,
  color: '#374151',
  marginBottom: '0.35rem',
};

const inp: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.6rem 0.75rem',
  borderRadius: 8,
  border: '1.5px solid #e5e7eb',
  fontSize: '0.9rem',
  color: '#111827',
  background: '#f9fafb',
  outline: 'none',
};

const outlineBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1.5px solid #e5e7eb',
  borderRadius: 8,
  padding: '0.45rem 0.9rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#374151',
  cursor: 'pointer',
};
