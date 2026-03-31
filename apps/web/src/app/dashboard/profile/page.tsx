'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

const COLORS = {
  green: '#1a7f4b',
  greenPale: '#e8f5ee',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray200: '#e5e7eb',
  gray600: '#4b5563',
  gray700: '#374151',
  gray900: '#111827',
  red: '#ef4444',
};

const MOOD_TAGS = [
  'competitive', 'relaxed', 'beginner', 'advanced',
  'fast-paced', 'social', 'scenic', 'challenging',
] as const;

const AMENITIES_SUGGESTIONS = [
  'Driving Range', 'Pro Shop', 'Restaurant', 'Bar', 'Cart Rental',
  'Club Rental', 'Lessons Available', 'Putting Green', 'Chipping Area',
  'Locker Rooms', 'Caddie Service', 'GPS Carts',
];

interface CourseProfile {
  id: string;
  name: string;
  description: string | null;
  address: string;
  websiteUrl: string | null;
  phoneNumber: string | null;
  moodTags: string[];
  amenities: string[];
  photoUrls: string[];
  holeCount: number;
  parScore: number;
}

export default function CourseProfilePage() {
  const courseId = process.env['NEXT_PUBLIC_COURSE_ID'];
  const [profile, setProfile] = useState<CourseProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [moodTags, setMoodTags] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    apiFetch(`/v1/courses/${courseId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        setProfile(data);
        setName(data.name ?? '');
        setDescription(data.description ?? '');
        setAddress(data.address ?? '');
        setWebsiteUrl(data.websiteUrl ?? '');
        setPhoneNumber(data.phoneNumber ?? '');
        setMoodTags(data.moodTags ?? []);
        setAmenities(data.amenities ?? []);
        setPhotoUrls(data.photoUrls ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  const toggleMood = (mood: string) => {
    setMoodTags((prev) => prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]);
  };

  const toggleAmenity = (amenity: string) => {
    setAmenities((prev) => prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]);
  };

  const addPhoto = () => {
    const url = newPhotoUrl.trim();
    if (url && !photoUrls.includes(url)) {
      setPhotoUrls((prev) => [...prev, url]);
    }
    setNewPhotoUrl('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`/v1/courses/${courseId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          address: address.trim(),
          websiteUrl: websiteUrl.trim() || null,
          phoneNumber: phoneNumber.trim() || null,
          moodTags,
          amenities,
          photoUrls,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const { data } = await res.json();
      setProfile(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!courseId) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: COLORS.gray900, marginBottom: '1rem' }}>Course Profile</h1>
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 12, padding: '2.5rem', textAlign: 'center', color: COLORS.gray600 }}>
          Set <code style={{ background: COLORS.gray50, padding: '0.15rem 0.4rem', borderRadius: 4 }}>NEXT_PUBLIC_COURSE_ID</code> to edit your course profile.
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: '2rem', color: COLORS.gray600 }}>Loading...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: 720 }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: COLORS.gray900 }}>Course Profile</h1>
        <p style={{ color: COLORS.gray600, marginTop: '0.25rem' }}>
          Update your course details, photos, and mood tags visible to players.
        </p>
      </div>

      <form onSubmit={handleSave}>
        {/* Basic info */}
        <Section title="Basic Information">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <Field label="Course Name *">
              <input style={inp} value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Address *">
              <input style={inp} value={address} onChange={(e) => setAddress(e.target.value)} required />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              style={{ ...inp, minHeight: 90, resize: 'vertical' } as React.CSSProperties}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what makes your course unique..."
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Field label="Website URL">
              <input style={inp} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Phone Number">
              <input style={inp} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1 555 000 0000" />
            </Field>
          </div>
        </Section>

        {/* Mood tags */}
        <Section title="Mood Tags">
          <p style={{ fontSize: '0.85rem', color: COLORS.gray600, marginBottom: '0.75rem' }}>
            Select the vibes that best describe your course experience.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {MOOD_TAGS.map((mood) => {
              const selected = moodTags.includes(mood);
              return (
                <button
                  key={mood}
                  type="button"
                  onClick={() => toggleMood(mood)}
                  style={{
                    background: selected ? COLORS.greenPale : COLORS.gray50,
                    border: `1.5px solid ${selected ? COLORS.green : COLORS.gray200}`,
                    borderRadius: 20,
                    padding: '0.4rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: selected ? COLORS.green : COLORS.gray700,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {mood}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Amenities */}
        <Section title="Amenities">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {AMENITIES_SUGGESTIONS.map((a) => {
              const selected = amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  style={{
                    background: selected ? COLORS.greenPale : COLORS.gray50,
                    border: `1.5px solid ${selected ? COLORS.green : COLORS.gray200}`,
                    borderRadius: 20,
                    padding: '0.4rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: selected ? COLORS.green : COLORS.gray700,
                    cursor: 'pointer',
                  }}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Photo URLs */}
        <Section title="Photos">
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <input
              style={{ ...inp, flex: 1 }}
              value={newPhotoUrl}
              onChange={(e) => setNewPhotoUrl(e.target.value)}
              placeholder="https://... (photo URL)"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhoto())}
            />
            <button
              type="button"
              onClick={addPhoto}
              style={{
                background: COLORS.green,
                color: COLORS.white,
                border: 'none',
                borderRadius: 8,
                padding: '0 1rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
          {photoUrls.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {photoUrls.map((url, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: COLORS.gray700 }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                  <button
                    type="button"
                    onClick={() => setPhotoUrls((prev) => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontWeight: 700 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {error && <p style={{ color: COLORS.red, marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}

        <button
          type="submit"
          disabled={saving}
          style={{
            background: saved ? '#16a34a' : COLORS.green,
            color: COLORS.white,
            border: 'none',
            borderRadius: 10,
            padding: '0.8rem 2rem',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            transition: 'background 0.3s',
          }}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 14,
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}
    >
      <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', marginBottom: '1.25rem' }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: '0.35rem' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

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
