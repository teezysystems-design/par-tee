import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { template: '%s | Teezy', default: 'Teezy — Book Golf by Mood' },
  description: 'Discover and book golf tee times based on how you feel.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
