import Link from 'next/link';

const COLORS = {
  green: '#1a6b2a',
  greenLight: '#2d9e44',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray600: '#4b5563',
  gray700: '#374151',
  gray900: '#111827',
};

const navLinks = [
  { href: '/dashboard', label: 'Overview', icon: '📊' },
  { href: '/dashboard/availability', label: 'Availability', icon: '📅' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📈' },
  { href: '/dashboard/connect', label: 'Stripe Connect', icon: '💳' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '1.5rem 1.25rem',
            borderBottom: `1px solid ${COLORS.gray200}`,
          }}
        >
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontWeight: 800, fontSize: '1.3rem', color: COLORS.green }}>Teezy</span>
            <span
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: COLORS.gray600,
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              Course Dashboard
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem' }}>
          {navLinks.map((link) => (
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
                color: COLORS.gray700,
                fontSize: '0.9rem',
                fontWeight: 500,
                marginBottom: 2,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <span style={{ fontSize: '1rem' }}>{link.icon}</span>
              {link.label}
            </Link>
          ))}
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
