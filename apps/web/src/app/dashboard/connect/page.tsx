'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Suspense } from 'react';

const COLORS = {
  green: '#1a6b2a',
  greenPale: '#e8f5eb',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray200: '#e5e7eb',
  gray600: '#4b5563',
  gray700: '#374151',
  gray900: '#111827',
  red: '#ef4444',
  yellow: '#f59e0b',
};

interface ConnectStatus {
  connected: boolean;
  detailsSubmitted: boolean;
}

function ConnectContent() {
  const courseId = process.env['NEXT_PUBLIC_COURSE_ID'];
  const searchParams = useSearchParams();
  const successParam = searchParams.get('success');
  const refreshParam = searchParams.get('refresh');

  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState('');

  async function loadStatus() {
    if (!courseId) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch(`/v1/payments/connect/status/${courseId}`);
      if (!res.ok) throw new Error('Failed to check connect status');
      const { data } = await res.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function handleConnect() {
    if (!courseId) return;
    setOnboarding(true);
    setError('');
    try {
      const res = await apiFetch('/v1/payments/connect/onboard', {
        method: 'POST',
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? 'Failed to start onboarding');
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setOnboarding(false);
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: COLORS.gray900 }}>Stripe Connect</h1>
        <p style={{ color: COLORS.gray600, marginTop: '0.25rem' }}>
          Connect your Stripe account to receive payouts from bookings.
        </p>
      </div>

      {successParam && (
        <div
          style={{
            background: COLORS.greenPale,
            border: `1.5px solid ${COLORS.green}`,
            borderRadius: 10,
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            color: COLORS.green,
            fontWeight: 600,
          }}
        >
          Stripe onboarding complete! Your account is being reviewed.
        </div>
      )}

      {refreshParam && (
        <div
          style={{
            background: '#fffbeb',
            border: `1.5px solid ${COLORS.yellow}`,
            borderRadius: 10,
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            color: '#92400e',
            fontWeight: 500,
          }}
        >
          Onboarding was interrupted. Please click &quot;Connect Stripe&quot; to continue.
        </div>
      )}

      {!courseId ? (
        <div
          style={{
            background: COLORS.white,
            border: `1px solid ${COLORS.gray200}`,
            borderRadius: 16,
            padding: '2.5rem',
            textAlign: 'center',
          }}
        >
          <p style={{ color: COLORS.gray600 }}>
            Set{' '}
            <code
              style={{ background: COLORS.gray50, padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.85rem' }}
            >
              NEXT_PUBLIC_COURSE_ID
            </code>{' '}
            to configure Stripe Connect for your course.
          </p>
        </div>
      ) : loading ? (
        <p style={{ color: COLORS.gray600 }}>Checking connection status...</p>
      ) : error ? (
        <p style={{ color: COLORS.red }}>Error: {error}</p>
      ) : (
        <div
          style={{
            background: COLORS.white,
            border: `1px solid ${COLORS.gray200}`,
            borderRadius: 16,
            padding: '2rem',
            maxWidth: 540,
          }}
        >
          {/* Status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: status?.connected ? COLORS.green : COLORS.yellow,
                flexShrink: 0,
              }}
            />
            <div>
              <p style={{ fontWeight: 700, color: COLORS.gray900, marginBottom: '0.15rem' }}>
                {status?.connected ? 'Connected' : status?.detailsSubmitted ? 'Pending Review' : 'Not Connected'}
              </p>
              <p style={{ fontSize: '0.85rem', color: COLORS.gray600 }}>
                {status?.connected
                  ? 'Your Stripe account is active and accepting payments.'
                  : status?.detailsSubmitted
                  ? 'Your account details are submitted and under review.'
                  : 'Connect your Stripe account to start receiving payouts.'}
              </p>
            </div>
          </div>

          <div
            style={{
              background: COLORS.gray50,
              borderRadius: 10,
              padding: '1rem',
              marginBottom: '1.5rem',
              fontSize: '0.88rem',
              color: COLORS.gray700,
            }}
          >
            <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>How it works</p>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.7 }}>
              <li>Golfers pay through PAR-Tee at booking time</li>
              <li>PAR-Tee collects a $1.25 platform fee per booking</li>
              <li>Your earnings are transferred to your connected Stripe account</li>
            </ul>
          </div>

          {!status?.connected && (
            <button
              onClick={handleConnect}
              disabled={onboarding}
              style={{
                background: onboarding ? COLORS.gray200 : COLORS.green,
                color: onboarding ? COLORS.gray600 : COLORS.white,
                padding: '0.75rem 1.5rem',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.95rem',
                border: 'none',
                cursor: onboarding ? 'not-allowed' : 'pointer',
                width: '100%',
              }}
            >
              {onboarding ? 'Redirecting to Stripe...' : 'Connect Stripe'}
            </button>
          )}

          {status?.connected && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: COLORS.green,
                fontWeight: 600,
                fontSize: '0.95rem',
              }}
            >
              <span>✓</span>
              <span>Stripe account active — you&apos;re ready to accept payments</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: '#4b5563' }}>Loading...</div>}>
      <ConnectContent />
    </Suspense>
  );
}
