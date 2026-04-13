'use client';

/**
 * Dashboard Login — Feature 7
 *
 * Course manager sign-in page. Uses Supabase Auth.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';
const PRIMARY = '#1B6B3A';

export default function DashboardLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Sign in with Supabase Auth
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!authRes.ok) {
        const authErr = await authRes.json();
        setError(authErr.error_description ?? authErr.msg ?? 'Invalid credentials');
        setLoading(false);
        return;
      }

      const authData = await authRes.json();
      const token = authData.access_token;

      // 2. Store token
      localStorage.setItem('sb-access-token', token);

      // 3. Verify course staff membership
      const staffRes = await fetch(`${API_URL}/v1/courses/my-course`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!staffRes.ok) {
        localStorage.removeItem('sb-access-token');
        setError('This account is not linked to any course. Contact PAR-Tee support to set up your course.');
        setLoading(false);
        return;
      }

      // 4. Redirect to dashboard
      router.replace('/dashboard');
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f9fafb 0%, #dcfce7 50%, #f9fafb 100%)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#fff',
        borderRadius: 24,
        padding: 40,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: PRIMARY,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 16,
          }}>
            ⛳
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>
            PAR-Tee for Courses
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            Sign in to manage your course
          </p>
        </div>

        <form onSubmit={handleLogin}>
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: 13,
              color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{
              fontSize: 12, fontWeight: 700, color: '#6b7280',
              textTransform: 'uppercase', letterSpacing: 0.5,
              marginBottom: 6, display: 'block',
            }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@yourcourse.com"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1.5px solid #e5e7eb',
                fontSize: 15,
                color: '#111',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              fontSize: 12, fontWeight: 700, color: '#6b7280',
              textTransform: 'uppercase', letterSpacing: 0.5,
              marginBottom: 6, display: 'block',
            }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1.5px solid #e5e7eb',
                fontSize: 15,
                color: '#111',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 14,
              border: 'none',
              background: PRIMARY,
              color: '#fff',
              fontWeight: 800,
              fontSize: 16,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>
            Want to list your course on PAR-Tee?{' '}
            <a href="/courses/register" style={{ color: PRIMARY, fontWeight: 600, textDecoration: 'none' }}>
              Get started
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
