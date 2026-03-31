'use client';

import { useState } from 'react';

const COLORS = {
  green: '#1a7f4b',
  greenDark: '#155f38',
  greenLight: '#2db870',
  greenPale: '#e8f5ee',
  greenPale2: '#f0faf4',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
};

const MOODS = [
  { key: 'relaxed', emoji: '😌', label: 'Relaxed', desc: 'Leisurely pace, no pressure' },
  { key: 'competitive', emoji: '🏆', label: 'Competitive', desc: 'Match play, keep score' },
  { key: 'social', emoji: '👥', label: 'Social', desc: 'Great for groups & friends' },
  { key: 'scenic', emoji: '🌅', label: 'Scenic', desc: 'Beautiful views, take it in' },
  { key: 'beginner', emoji: '🌱', label: 'Beginner', desc: 'Learning-friendly courses' },
  { key: 'fast-paced', emoji: '⚡', label: 'Fast-paced', desc: 'Quick rounds, efficient play' },
];

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

const testimonials = [
  {
    quote: "Finally an app that gets it. I don't always want to play seriously — sometimes I just want a relaxed Sunday morning.",
    name: 'Marcus T.',
    hcp: 'HCP 14',
  },
  {
    quote: "Booked a competitive round with my buddy in 30 seconds. The mood filter found us a course we'd never tried before.",
    name: 'Priya K.',
    hcp: 'HCP 8',
  },
  {
    quote: "Used the beginner mood for my daughter's first round. Perfect pace, friendly staff. Will use every time.",
    name: 'David R.',
    hcp: 'HCP 22',
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeMood, setActiveMood] = useState('relaxed');

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

  const activeMoodData = MOODS.find((m) => m.key === activeMood) ?? MOODS[0];

  return (
    <div style={{ minHeight: '100vh', background: COLORS.white }}>
      {/* Nav */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(10px)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem' }}>⛳</span>
            <span style={{ fontWeight: 800, fontSize: '1.4rem', color: COLORS.green }}>Teezy</span>
          </div>
          <a
            href="#waitlist"
            style={{
              background: COLORS.green,
              color: COLORS.white,
              padding: '0.5rem 1.4rem',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'background 0.15s',
            }}
          >
            Join Waitlist
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          background: `linear-gradient(150deg, ${COLORS.greenDark} 0%, ${COLORS.green} 55%, ${COLORS.greenLight} 100%)`,
          color: COLORS.white,
          padding: '5.5rem 1.5rem 5rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle background pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 50%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(255,255,255,0.18)',
              padding: '0.35rem 1rem',
              borderRadius: 100,
              fontSize: '0.82rem',
              fontWeight: 600,
              marginBottom: '1.5rem',
              letterSpacing: '0.03em',
              backdropFilter: 'blur(4px)',
            }}
          >
            <span>🚀</span>
            <span>Early Access — Join the Waitlist</span>
          </div>
          <h1
            style={{
              fontSize: 'clamp(2.6rem, 6vw, 4.2rem)',
              fontWeight: 800,
              lineHeight: 1.12,
              marginBottom: '1.25rem',
              letterSpacing: '-0.02em',
            }}
          >
            Book Golf by Mood
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              opacity: 0.88,
              maxWidth: 560,
              margin: '0 auto 2.5rem',
              lineHeight: 1.7,
            }}
          >
            Teezy matches your energy with the perfect tee time. Whether you&apos;re after a
            peaceful morning round or a fast-paced competitive game — we&apos;ve got your vibe.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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
                boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
              }}
            >
              Join Waitlist — It&apos;s Free
            </a>
            <a
              href="#how-it-works"
              style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.15)',
                color: COLORS.white,
                padding: '0.9rem 2rem',
                borderRadius: 12,
                fontWeight: 600,
                fontSize: '1.05rem',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
            >
              See how it works →
            </a>
          </div>
        </div>
      </section>

      {/* Mood Picker Preview */}
      <section style={{ padding: '5rem 1.5rem', background: COLORS.white }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span
              style={{
                display: 'inline-block',
                background: COLORS.greenPale,
                color: COLORS.green,
                padding: '0.25rem 0.85rem',
                borderRadius: 100,
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '0.85rem',
                letterSpacing: '0.04em',
              }}
            >
              MOOD-FIRST DISCOVERY
            </span>
            <h2
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                fontWeight: 800,
                color: COLORS.gray900,
                letterSpacing: '-0.02em',
              }}
            >
              Pick your mood, find your round
            </h2>
            <p style={{ color: COLORS.gray600, marginTop: '0.75rem', fontSize: '1.05rem' }}>
              Every course tagged with the vibe you&apos;re after — no more guessing.
            </p>
          </div>

          {/* Interactive mood selector preview */}
          <div
            style={{
              background: COLORS.gray50,
              borderRadius: 24,
              padding: '2.5rem',
              border: `1px solid ${COLORS.gray200}`,
            }}
          >
            <p style={{ fontSize: '0.88rem', fontWeight: 600, color: COLORS.gray600, marginBottom: '1rem', letterSpacing: '0.04em' }}>
              HOW ARE YOU PLAYING TODAY?
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.6rem',
                marginBottom: '2rem',
              }}
            >
              {MOODS.map((mood) => (
                <button
                  key={mood.key}
                  onClick={() => setActiveMood(mood.key)}
                  style={{
                    padding: '0.6rem 1.1rem',
                    borderRadius: 100,
                    border: `2px solid ${activeMood === mood.key ? COLORS.green : COLORS.gray200}`,
                    background: activeMood === mood.key ? COLORS.green : COLORS.white,
                    color: activeMood === mood.key ? COLORS.white : COLORS.gray700,
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>{mood.emoji}</span>
                  <span>{mood.label}</span>
                </button>
              ))}
            </div>

            {/* Active mood preview card */}
            <div
              style={{
                background: COLORS.white,
                border: `1px solid ${COLORS.gray200}`,
                borderRadius: 16,
                padding: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '1.75rem' }}>{activeMoodData.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: COLORS.gray900 }}>
                    {activeMoodData.label} mode
                  </span>
                </div>
                <p style={{ color: COLORS.gray600, fontSize: '0.95rem' }}>{activeMoodData.desc}</p>
              </div>
              <div
                style={{
                  background: COLORS.greenPale,
                  color: COLORS.green,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  padding: '0.5rem 1.25rem',
                  borderRadius: 8,
                  whiteSpace: 'nowrap',
                }}
              >
                Showing matching courses →
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '5rem 1.5rem', background: COLORS.greenPale2 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span
              style={{
                display: 'inline-block',
                background: COLORS.greenPale,
                color: COLORS.green,
                padding: '0.25rem 0.85rem',
                borderRadius: 100,
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '0.85rem',
                letterSpacing: '0.04em',
              }}
            >
              FEATURES
            </span>
            <h2
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                fontWeight: 800,
                color: COLORS.gray900,
                letterSpacing: '-0.02em',
              }}
            >
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
                  background: COLORS.white,
                  borderRadius: 20,
                  padding: '2rem',
                  border: `1px solid ${COLORS.gray200}`,
                  transition: 'box-shadow 0.2s',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: COLORS.greenPale,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.6rem',
                    marginBottom: '1rem',
                  }}
                >
                  {f.icon}
                </div>
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    marginBottom: '0.5rem',
                    color: COLORS.gray900,
                  }}
                >
                  {f.title}
                </h3>
                <p style={{ color: COLORS.gray600, fontSize: '0.93rem', lineHeight: 1.65 }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" style={{ padding: '5rem 1.5rem', background: COLORS.white }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span
              style={{
                display: 'inline-block',
                background: COLORS.greenPale,
                color: COLORS.green,
                padding: '0.25rem 0.85rem',
                borderRadius: 100,
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '0.85rem',
                letterSpacing: '0.04em',
              }}
            >
              HOW IT WORKS
            </span>
            <h2
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                fontWeight: 800,
                color: COLORS.gray900,
                letterSpacing: '-0.02em',
              }}
            >
              From mood to green in three steps
            </h2>
            <p style={{ color: COLORS.gray600, marginTop: '0.75rem', fontSize: '1.05rem' }}>
              No friction. No guesswork. Just golf.
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '2rem',
            }}
          >
            {steps.map((step, i) => (
              <div key={step.number} style={{ textAlign: 'center', padding: '1.5rem' }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: i === 0 ? COLORS.green : i === 1 ? COLORS.greenLight : COLORS.gray800,
                    color: COLORS.white,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    margin: '0 auto 1.25rem',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                  }}
                >
                  {step.number}
                </div>
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    marginBottom: '0.5rem',
                    color: COLORS.gray900,
                  }}
                >
                  {step.title}
                </h3>
                <p style={{ color: COLORS.gray600, fontSize: '0.95rem', lineHeight: 1.65 }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section style={{ padding: '5rem 1.5rem', background: COLORS.gray50 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2
              style={{
                fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
                fontWeight: 800,
                color: COLORS.gray900,
                letterSpacing: '-0.02em',
              }}
            >
              Golfers love it
            </h2>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {testimonials.map((t) => (
              <div
                key={t.name}
                style={{
                  background: COLORS.white,
                  borderRadius: 20,
                  padding: '1.75rem',
                  border: `1px solid ${COLORS.gray200}`,
                }}
              >
                <div style={{ color: COLORS.green, fontSize: '1.5rem', marginBottom: '0.75rem' }}>
                  ★★★★★
                </div>
                <p
                  style={{
                    color: COLORS.gray700,
                    fontSize: '0.95rem',
                    lineHeight: 1.7,
                    marginBottom: '1.25rem',
                    fontStyle: 'italic',
                  }}
                >
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: COLORS.greenPale,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: COLORS.green,
                      fontSize: '0.9rem',
                    }}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', color: COLORS.gray900 }}>{t.name}</p>
                    <p style={{ fontSize: '0.8rem', color: COLORS.gray600 }}>{t.hcp}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section
        id="waitlist"
        style={{
          padding: '6rem 1.5rem',
          background: `linear-gradient(150deg, ${COLORS.greenDark} 0%, ${COLORS.green} 100%)`,
          color: COLORS.white,
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⛳</div>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 800,
              marginBottom: '1rem',
              letterSpacing: '-0.02em',
            }}
          >
            Be first on the tee
          </h2>
          <p
            style={{
              opacity: 0.88,
              marginBottom: '2.5rem',
              fontSize: '1.05rem',
              lineHeight: 1.7,
            }}
          >
            Join our waitlist and get early access when we launch. No spam, ever. Just golf.
          </p>

          {submitted ? (
            <div
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '2px solid rgba(255,255,255,0.4)',
                borderRadius: 20,
                padding: '2.5rem',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎉</div>
              <h3 style={{ fontWeight: 700, fontSize: '1.35rem', marginBottom: '0.5rem' }}>
                You&apos;re on the list!
              </h3>
              <p style={{ opacity: 0.88 }}>We&apos;ll reach out the moment Teezy launches.</p>
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
                  padding: '0.9rem 1.25rem',
                  borderRadius: 12,
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  fontSize: '1rem',
                  marginBottom: '0.75rem',
                  outline: 'none',
                  background: 'rgba(255,255,255,0.15)',
                  color: COLORS.white,
                  backdropFilter: 'blur(4px)',
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
                  padding: '0.9rem 1.25rem',
                  borderRadius: 12,
                  border: `1.5px solid ${error ? '#fca5a5' : 'rgba(255,255,255,0.3)'}`,
                  fontSize: '1rem',
                  marginBottom: '1rem',
                  outline: 'none',
                  background: 'rgba(255,255,255,0.15)',
                  color: COLORS.white,
                  backdropFilter: 'blur(4px)',
                }}
              />
              {error && (
                <p
                  style={{
                    color: '#fca5a5',
                    fontSize: '0.9rem',
                    marginBottom: '0.75rem',
                    textAlign: 'left',
                  }}
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: loading ? 'rgba(255,255,255,0.3)' : COLORS.white,
                  color: loading ? 'rgba(255,255,255,0.6)' : COLORS.green,
                  padding: '0.95rem',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  border: 'none',
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(0,0,0,0.15)',
                  transition: 'all 0.15s',
                }}
              >
                {loading ? 'Joining...' : 'Join Waitlist — It\'s Free'}
              </button>
              <p style={{ marginTop: '1rem', opacity: 0.7, fontSize: '0.85rem' }}>
                No spam. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          background: COLORS.gray900,
          color: COLORS.gray600,
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem' }}>⛳</span>
            <p style={{ color: COLORS.white, fontWeight: 800, fontSize: '1.2rem' }}>Teezy</p>
          </div>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>Book Golf by Mood — Coming Soon</p>
          <p style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>
            &copy; {new Date().getFullYear()} Teezy. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
