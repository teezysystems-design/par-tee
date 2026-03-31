'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const COLORS = {
  green: '#1a7f4b',
  greenPale: '#e8f5ee',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray600: '#4b5563',
  gray700: '#374151',
  gray900: '#111827',
};

const navLinks = [
  { href: '/dashboard', label: 'Overview', icon: '📊', exact: true },
  { href: '/dashboard/availability', label: 'Availability', icon: '📅', exact: false },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📈', exact: false },
  { href: '/dashboard/connect', label: 'Stripe Connect', icon: '💳', exact: false },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️', exact: false },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.gray50 }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          background: COLORS.white,
          borderRight: `1px solid ${COLORS.gray200}`,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '1.25rem 1.25rem',
            borderBottom: `1px solid ${COLORS.gray200}`,
          }}
        >
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>⛳</span>
            <div>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: COLORS.green, display: 'block' }}>
                Teezy
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.72rem',
                  color: COLORS.gray600,
                  fontWeight: 500,
                  marginTop: 1,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}
              >
                Course Dashboard
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.75rem 0.75rem' }}>
          <p
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: COLORS.gray600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '0.75rem 0.75rem 0.4rem',
            }}
          >
            Menu
          </p>
          {navLinks.map((link) => {
            const isActive = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: isActive ? COLORS.green : COLORS.gray700,
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 700 : 500,
                  marginBottom: 2,
                  background: isActive ? COLORS.greenPale : 'transparent',
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                <span
                  style={{
                    fontSize: '1rem',
                    width: 22,
                    textAlign: 'center',
                    opacity: isActive ? 1 : 0.7,
                  }}
                >
                  {link.icon}
                </span>
                {link.label}
                {isActive && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: COLORS.green,
                      flexShrink: 0,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: `1px solid ${COLORS.gray200}`,
            fontSize: '0.78rem',
            color: COLORS.gray600,
          }}
        >
          Teezy &copy; {new Date().getFullYear()}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
    </div>
  );
}
