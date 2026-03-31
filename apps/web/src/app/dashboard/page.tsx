import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Course Dashboard' };

export default function DashboardPage() {
  return (
    <main>
      <h1>Course Dashboard</h1>
      <p>Manage your tee times, availability, and bookings.</p>
    </main>
  );
}
