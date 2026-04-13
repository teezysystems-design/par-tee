'use client';

/**
 * Course Dashboard Layout — Feature 7
 *
 * Sidebar navigation + auth gate for course managers.
 * Checks course_staff membership on mount, redirects to /dashboard/login if unauthorized.
 */

import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1B6B3A';

// ─── Context ─────────────────────────────────────────────────────────────────

interface CourseContext {
  courseId: string;
  courseName: string;
  role: string;
  staffId: string;
  accessToken: string;
}

const DashboardContext = createContext<CourseContext | null>(null);
export const useDashboard = () => useContext(DashboardContext);

// ─── Sidebar nav items ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: '📊' },
  { href: '/dashboard/bookings', label: 'Bookings', icon: '📅' },
  { href: '/dashboard/course', label: 'Course Profile', icon: '⛳' },
  { href: '/dashboard/tournaments', label: 'Tournaments', icon: '🏆' },
  { href: '/dashboard/billing', label: 'Billing', icon: '💳' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ctx, setCtx] = useState<CourseContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Allow login page to render without auth
  const isLoginPage = pathname === '/dashboard/login';

  const checkAuth = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sb-access-token') : null;
    if (!token) {
      if (!isLoginPage) router.replace('/dashboard/login');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/v1/courses/my-course`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (!isLoginPage) router.replace('/dashboard/login');
        setLoading(false);
        return;
      }
      const json = await res.json();
      setCtx({
        courseId: json.data.courseId,
        courseName: json.data.courseName,
        role: json.data.role,
        staffId: json.data.staffId,
        accessToken: token,
      });
    } catch {
      if (!isLoginPage) router.replace('/dashboard/login');
    } finally {
      setLoading(false);
    }
  }, [isLoginPage, router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login page renders standalone
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${PRIMARY}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280', fontSize: 14 }}>Loading dashboard...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!ctx) return null;

  return (
    <DashboardContext.Provider value={ctx}>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: sidebarOpen ? 240 : 64,
            background: '#fff',
            borderRight: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.2s ease',
            flexShrink: 0,
          }}
        >
          {/* Logo / Brand */}
          <div style={{ padding: '20px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: PRIMARY,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>
              ⛳
            </div>
            {sidebarOpen && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111', lineHeight: 1.1 }}>PAR-Tee</div>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>Course Dashboard</div>
              </div>
            )}
          </div>

          {/* Course name */}
          {sidebarOpen && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ctx.courseName}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'capitalize' }}>{ctx.role}</div>
            </div>
          )}

          {/* Nav */}
          <nav style={{ flex: 1, padding: '8px 8px' }}>
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    marginBottom: 2,
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: active ? 700 : 500,
                    color: active ? PRIMARY : '#6b7280',
                    background: active ? '#dcfce7' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  {sidebarOpen && item.label}
                </a>
              );
            })}
          </nav>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e5e7eb',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: '#9ca3af',
              textAlign: 'left',
              borderTopWidth: 1,
              borderTopStyle: 'solid',
              borderTopColor: '#e5e7eb',
            }}
          >
            {sidebarOpen ? '◀ Collapse' : '▶'}
          </button>

          {/* Sign out */}
          <button
            onClick={() => {
              localStorage.removeItem('sb-access-token');
              router.replace('/dashboard/login');
            }}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: '#dc2626',
              textAlign: 'left',
              borderTop: '1px solid #f3f4f6',
            }}
          >
            {sidebarOpen ? '🚪 Sign Out' : '🚪'}
          </button>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </DashboardContext.Provider>
  );
}
