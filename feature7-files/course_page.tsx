'use client';

/**
 * Course Profile Editor — Feature 7
 *
 * Edit course name, description, amenities, mood tags, photos, contact info.
 */

import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from '../layout';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1B6B3A';

const ALL_MOODS = ['relaxed', 'competitive', 'social', 'scenic', 'beginner', 'fast-paced'];
const ALL_AMENITIES = [
  'driving_range', 'putting_green', 'pro_shop', 'restaurant', 'bar',
  'cart_rental', 'club_rental', 'lessons', 'locker_rooms', 'practice_bunker',
  'wedding_venue', 'corporate_events', 'junior_programs', 'night_golf',
];

interface CourseProfile {
  id: string;
  name: string;
  description: string;
  address: string;
  holeCount: number;
  parScore: number;
  websiteUrl: string;
  phoneNumber: string;
  moodTags: string[];
  amenities: string[];
  photoUrls: string[];
  pricingTier: string;
  isActive: boolean;
}

export default function CourseProfilePage() {
  const ctx = useDashboard();
  const [profile, setProfile] = useState<CourseProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!ctx) return;
    try {
      const res = await fetch(`${API_URL}/v1/courses/${ctx.courseId}`, {
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        const c = json.data;
        setProfile({
          id: c.id,
          name: c.name ?? '',
          description: c.description ?? '',
          address: c.address ?? '',
          holeCount: c.holeCount ?? c.hole_count ?? 18,
          parScore: c.parScore ?? c.par_score ?? 72,
          websiteUrl: c.websiteUrl ?? c.website_url ?? '',
          phoneNumber: c.phoneNumber ?? c.phone_number ?? '',
          moodTags: c.moodTags ?? c.mood_tags ?? [],
          amenities: c.amenities ?? [],
          photoUrls: c.photoUrls ?? c.photo_urls ?? [],
          pricingTier: c.pricingTier ?? c.pricing_tier ?? 'standard',
          isActive: c.isActive ?? c.is_active ?? true,
        });
      }
    } catch {} finally { setLoading(false); }
  }, [ctx]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSave = async () => {
    if (!ctx || !profile) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${API_URL}/v1/courses/${ctx.courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.accessToken}` },
        body: JSON.stringify({
          name: profile.name,
          description: profile.description,
          address: profile.address,
          holeCount: profile.holeCount,
          parScore: profile.parScore,
          websiteUrl: profile.websiteUrl,
          phoneNumber: profile.phoneNumber,
          moodTags: profile.moodTags,
          amenities: profile.amenities,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {} finally { setSaving(false); }
  };

  const toggleMood = (mood: string) => {
    if (!profile) return;
    const tags = profile.moodTags.includes(mood)
      ? profile.moodTags.filter(t => t !== mood)
      : [...profile.moodTags, mood];
    setProfile({ ...profile, moodTags: tags });
  };

  const toggleAmenity = (amenity: string) => {
    if (!profile) return;
    const list = profile.amenities.includes(amenity)
      ? profile.amenities.filter(a => a !== amenity)
      : [...profile.amenities, amenity];
    setProfile({ ...profile, amenities: list });
  };

  if (loading) {
    return <div style={{ padding: 32 }}><p style={{ color: '#9ca3af' }}>Loading course profile...</p></div>;
  }
  if (!profile) {
    return <div style={{ padding: 32 }}><p style={{ color: '#dc2626' }}>Could not load course profile.</p></div>;
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    fontSize: 14,
    color: '#111',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 700 as const,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
    display: 'block' as const,
  };

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111', margin: 0 }}>Course Profile</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 24px',
            borderRadius: 12,
            border: 'none',
            background: saved ? '#16a34a' : PRIMARY,
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Basic Info */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 20px' }}>Basic Information</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Course Name</label>
          <input
            style={inputStyle}
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, minHeight: 100, resize: 'vertical' as const, fontFamily: 'inherit' }}
            value={profile.description}
            onChange={(e) => setProfile({ ...profile, description: e.target.value })}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Address</label>
          <input
            style={inputStyle}
            value={profile.address}
            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Holes</label>
            <input
              style={inputStyle}
              type="number"
              value={profile.holeCount}
              onChange={(e) => setProfile({ ...profile, holeCount: Number(e.target.value) })}
            />
          </div>
          <div>
            <label style={labelStyle}>Par</label>
            <input
              style={inputStyle}
              type="number"
              value={profile.parScore}
              onChange={(e) => setProfile({ ...profile, parScore: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 20px' }}>Contact</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Website</label>
            <input
              style={inputStyle}
              type="url"
              placeholder="https://..."
              value={profile.websiteUrl}
              onChange={(e) => setProfile({ ...profile, websiteUrl: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              style={inputStyle}
              type="tel"
              placeholder="(555) 123-4567"
              value={profile.phoneNumber}
              onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Mood Tags */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>Mood Tags</h2>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>
          Select moods that match your course. Golfers search by mood to find courses.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ALL_MOODS.map((mood) => {
            const active = profile.moodTags.includes(mood);
            return (
              <button
                key={mood}
                onClick={() => toggleMood(mood)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: `2px solid ${active ? PRIMARY : '#e5e7eb'}`,
                  background: active ? '#dcfce7' : '#fff',
                  color: active ? PRIMARY : '#6b7280',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {active ? '✓ ' : ''}{mood.replace('-', ' ')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Amenities */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>Amenities</h2>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>
          Check all amenities your course offers.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {ALL_AMENITIES.map((amenity) => {
            const active = profile.amenities.includes(amenity);
            return (
              <button
                key={amenity}
                onClick={() => toggleAmenity(amenity)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: `1.5px solid ${active ? PRIMARY : '#e5e7eb'}`,
                  background: active ? '#dcfce7' : '#fff',
                  color: active ? PRIMARY : '#6b7280',
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  textAlign: 'left',
                }}
              >
                {active ? '✓ ' : ''}{amenity.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pricing Tier (read-only display) */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 12px' }}>Pricing Tier</h2>
        <div style={{
          display: 'inline-block',
          padding: '8px 16px',
          borderRadius: 10,
          background: '#fef3c7',
          fontSize: 14,
          fontWeight: 700,
          color: '#d97706',
          textTransform: 'capitalize',
        }}>
          {profile.pricingTier.replace(/_/g, ' ')}
        </div>
        <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>
          Contact PAR-Tee to change your pricing tier. Current rates apply to all bookings.
        </p>
      </div>
    </div>
  );
}
