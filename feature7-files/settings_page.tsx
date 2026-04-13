'use client';

/**
 * Settings — Feature 7
 *
 * Course dashboard settings. Manage staff, Stripe connect, notifications.
 */

import { useState } from 'react';
import { useDashboard } from '../layout';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1B6B3A';

export default function SettingsPage() {
  const ctx = useDashboard();
  const [connectLoading, setConnectLoading] = useState(false);

  const handleStripeConnect = async () => {
    if (!ctx) return;
    setConnectLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/payments/connect/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.accessToken}` },
        body: JSON.stringify({ courseId: ctx.courseId }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.url) {
          window.location.href = json.data.url;
        }
      }
    } catch {} finally { setConnectLoading(false); }
  };

  return (
    <div style={{ padding: 32, maxWidth: 700 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111', margin: '0 0 24px' }}>Settings</h1>

      {/* Account Info */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>Account</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: 14, color: '#6b7280' }}>Course</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{ctx?.courseName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: 14, color: '#6b7280' }}>Role</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111', textTransform: 'capitalize' }}>{ctx?.role}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: 14, color: '#6b7280' }}>Course ID</span>
            <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{ctx?.courseId}</span>
          </div>
        </div>
      </div>

      {/* Stripe Connect */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>Payments</h2>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>
          Connect your Stripe account to receive payouts for any direct tee time fees.
        </p>
        <button
          onClick={handleStripeConnect}
          disabled={connectLoading}
          style={{
            padding: '10px 20px',
            borderRadius: 12,
            border: 'none',
            background: '#635bff',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: connectLoading ? 'default' : 'pointer',
            opacity: connectLoading ? 0.7 : 1,
          }}
        >
          {connectLoading ? 'Loading...' : 'Connect with Stripe'}
        </button>
      </div>

      {/* Notifications */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>Notifications</h2>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>
          Email notifications for new bookings and cancellations.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'New booking notifications', defaultOn: true },
            { label: 'Cancellation alerts', defaultOn: true },
            { label: 'Weekly summary report', defaultOn: false },
            { label: 'Tournament entry notifications', defaultOn: true },
          ].map((item) => (
            <label key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '8px 0', borderBottom: '1px solid #f3f4f6',
            }}>
              <input type="checkbox" defaultChecked={item.defaultOn} style={{ width: 18, height: 18, accentColor: PRIMARY }} />
              <span style={{ fontSize: 14, color: '#374151' }}>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Support */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>Support</h2>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 4px' }}>
          Need help? Contact the PAR-Tee team.
        </p>
        <a href="mailto:support@par-tee.ca" style={{ fontSize: 14, color: PRIMARY, fontWeight: 600, textDecoration: 'none' }}>
          support@par-tee.ca
        </a>
      </div>
    </div>
  );
}
