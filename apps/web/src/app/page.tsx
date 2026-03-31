'use client';

import { useState } from 'react';

const COLORS = {
  green: '#1a6b2a',
  greenLight: '#2d9e44',
  greenPale: '#e8f5eb',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
};

const features = [
  {
    icon: '🎯',
    title: 'Mood-Based Matching',
    description:
      'Tell us how you want to play — competitive, relaxed, social, or solo — and we surface courses that fit your vibe.',
  },
  {
    icon: '⚡',
    title: 'Instant Booking',
    description:
      'No phone calls, no waiting. See real-time availability and book your tee time in under 60 seconds.',
  },
  {
    icon: '👥',
    title: 'Social Groups',
    description:
      'Invite friends, form groups, and coordinate tee times together. Golf is better with company.',
  },
  {
    icon: '📊',
    title: 'Score Tracking',
    description:
      'Log your scores, track your handicap progress, and see how you stack up against the course.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Pick Your Mood',
    description: 'Select how you want to play today — relaxed, competitive, scenic, fast-paced, or social.',
  },
  {
    number: '02',
    title: 'Find Courses',
    description: 'We match you with nearby courses that align with your mood and playing style.',
  },
  {
    number: '03',
    title: 'Book Instantly',
    description: 'Select a tee time, pay securely, and get a confirmation in seconds. Done.',
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleWaitlistSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        if (res.status === 409) {
          setError("You're already on the list!");
        } else {
          setError(data?.error?.message ?? 'Something went wrong. Please try again.');
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.white }}>
      {/* Nav */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${COLORS.gray200}`,
          padding: '0 1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
          }}
        >
          <span style={{ fontWeight: 800, fontSize: '1.4rem', color: COLORS.green }}>Teezy</span>
          <a
            href="#waitlist"
            style={{
              background: COLORS.green,
              color: COLORS.white,
              padding: '0.5rem 1.25rem',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            Join Waitlist
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.greenLight} 100%)`,
          color: COLORS.white,
          padding: '6rem 1.5rem 5rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-block',
              background: 'rgba(255,255,255,0.15)',
              padding: '0.3rem 1rem',
              borderRadius: 100,
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1.5rem',
              letterSpacing: '0.05em',
            }}
          >
            Coming Soon — Join the Waitlist
          </div>
          <h1
            style={{
              fontSize: 'clamp(2.5rem, 6vw, 4rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: '1.25rem',
            }}
          >
            Book Golf by Mood
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.3rem)',
              opacity: 0.9,
              maxWidth: 580,
              margin: '0 auto 2.5rem',
              lineHeight: 1.7,
            }}
          >
            Teezy matches your energy with the perfect course. Whether you&apos;re after a peaceful
            morning round or a fast-paced competitive game — we&apos;ve got your tee time.
          </p>
          <a
            href="#waitlist"
            style={{
              display: 'inline-block',
              background: COLORS.white,
              color: COLORS.green,
              padding: '0.9rem 2.5rem',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: '1.05rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            Join Waitlist — It&apos;s Free
          </a>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '5rem 1.5rem', background: COLORS.white }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, color: COLORS.gray900 }}>
              Everything you need on the course
            </h2>
            <p style={{ color: COLORS.gray600, marginTop: '0.75rem', fontSize: '1.05rem' }}>
              Built for golfers who care about experience, not just tee times.
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {features.map((f) => (
              <div
                key={f.title}
                style={{
                  background: COLORS.gray50,
                  borderRadius: 16,
                  padding: '2rem',
                  border: `1px solid ${COLORS.gray200}`,
                }}
              >
                <div style={{ fontSize: '2.25rem', marginBottom: '1rem' }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: COLORS.gray900 }}>
                  {f.title}
                </h3>
                <p style={{ color: COLORS.gray600, fontSize: '0.95rem', lineHeight: 1.65 }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ padding: '5rem 1.5rem', background: COLORS.greenPale }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, color: COLORS.gray900 }}>
              How it works
            </h2>
            <p style={{ color: COLORS.gray600, marginTop: '0.75rem', fontSize: '1.05rem' }}>
              From mood to green in three simple steps.
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '2rem',
            }}
          >
            {steps.map((step) => (
              <div key={step.number} style={{ textAlign: 'center', padding: '1.5rem' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: COLORS.green,
                    color: COLORS.white,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  {step.number}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: COLORS.gray900 }}>
                  {step.title}
                </h3>
                <p style={{ color: COLORS.gray600, fontSize: '0.95rem', lineHeight: 1.65 }}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" style={{ padding: '5rem 1.5rem', background: COLORS.white }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', fontWeight: 800, color: COLORS.gray900 }}>
            Be first on the tee
          </h2>
          <p style={{ color: COLORS.gray600, marginTop: '0.75rem', marginBottom: '2.5rem', fontSize: '1.05rem' }}>
            Join our waitlist and get early access when we launch. No spam, ever.
          </p>

          {submitted ? (
            <div
              style={{
                background: COLORS.greenPale,
                border: `2px solid ${COLORS.green}`,
                borderRadius: 16,
                padding: '2rem',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⛳</div>
              <h3 style={{ fontWeight: 700, color: COLORS.green, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                You&apos;re on the list!
              </h3>
              <p style={{ color: COLORS.gray600 }}>We&apos;ll let you know the moment Teezy launches.</p>
            </div>
          ) : (
            <form onSubmit={handleWaitlistSubmit}>
              <input
                type="text"
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 10,
                  border: `1.5px solid ${COLORS.gray200}`,
                  fontSize: '1rem',
                  marginBottom: '0.75rem',
                  outline: 'none',
                }}
              />
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 10,
                  border: `1.5px solid ${error ? '#ef4444' : COLORS.gray200}`,
                  fontSize: '1rem',
                  marginBottom: '1rem',
                  outline: 'none',
                }}
              />
              {error && (
                <p style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '0.75rem', textAlign: 'left' }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: loading ? COLORS.gray200 : COLORS.green,
                  color: loading ? COLORS.gray600 : COLORS.white,
                  padding: '0.9rem',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  border: 'none',
                }}
              >
                {loading ? 'Joining...' : 'Join Waitlist'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          background: COLORS.gray900,
          color: COLORS.gray600,
          padding: '2rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.9rem',
        }}
      >
        <p style={{ color: COLORS.white, fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>Teezy</p>
        <p>Book Golf by Mood — Coming Soon</p>
        <p style={{ marginTop: '0.5rem' }}>
          &copy; {new Date().getFullYear()} Teezy. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
