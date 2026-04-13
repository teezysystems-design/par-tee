'use client';

/**
 * Billing & Invoicing — Feature 7
 *
 * Shows pricing tier, monthly invoices, booking counts, and payment status.
 */

import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from '../layout';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1B6B3A';

const TIER_RATES: Record<string, number> = {
  standard: 275,
  basic_promotion: 225,
  active_promotion: 200,
  tournament: 175,
  founding: 150,
};

const TIER_LABELS: Record<string, string> = {
  standard: 'Standard',
  basic_promotion: 'Basic Promotion',
  active_promotion: 'Active Promotion',
  tournament: 'Tournament',
  founding: 'Founding Partner',
};

interface Invoice {
  id: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  bookingCount: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

interface BillingSummary {
  pricingTier: string;
  ratePerBooking: number;
  currentMonthBookings: number;
  currentMonthEstimate: number;
  totalPaid: number;
  totalOutstanding: number;
}

export default function BillingPage() {
  const ctx = useDashboard();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!ctx) return;
    try {
      const [invRes, sumRes] = await Promise.all([
        fetch(`${API_URL}/v1/courses/${ctx.courseId}/dashboard/invoices`, {
          headers: { Authorization: `Bearer ${ctx.accessToken}` },
        }),
        fetch(`${API_URL}/v1/courses/${ctx.courseId}/dashboard/billing-summary`, {
          headers: { Authorization: `Bearer ${ctx.accessToken}` },
        }),
      ]);

      if (invRes.ok) {
        const json = await invRes.json();
        setInvoices(json.data ?? []);
      }
      if (sumRes.ok) {
        const json = await sumRes.json();
        setSummary(json.data);
      }
    } catch {} finally { setLoading(false); }
  }, [ctx]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div style={{ padding: 32 }}><p style={{ color: '#9ca3af' }}>Loading billing...</p></div>;
  }

  const tierRate = summary?.ratePerBooking ?? TIER_RATES[summary?.pricingTier ?? 'standard'] ?? 275;
  const tierLabel = TIER_LABELS[summary?.pricingTier ?? 'standard'] ?? 'Standard';

  const statusColors: Record<string, { bg: string; text: string }> = {
    paid: { bg: '#dcfce7', text: '#16a34a' },
    pending: { bg: '#fef3c7', text: '#d97706' },
    overdue: { bg: '#fef2f2', text: '#dc2626' },
    draft: { bg: '#f3f4f6', text: '#6b7280' },
  };

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111', margin: '0 0 24px' }}>Billing</h1>

      {/* Pricing Tier Card */}
      <div style={{
        background: 'linear-gradient(135deg, #1B6B3A, #22c55e)',
        borderRadius: 20,
        padding: 28,
        marginBottom: 24,
        color: '#fff',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8, marginBottom: 4 }}>YOUR PLAN</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>{tierLabel}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>Rate per booking</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>${(tierRate / 100).toFixed(2)}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>CAD</div>
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>This month</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{summary?.currentMonthBookings ?? 0}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>bookings</div>
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>Estimated bill</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>${((summary?.currentMonthEstimate ?? 0) / 100).toFixed(2)}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>CAD</div>
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>Outstanding</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>${((summary?.totalOutstanding ?? 0) / 100).toFixed(2)}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>CAD</div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{
        background: '#eff6ff',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 24,
        border: '1px solid #bfdbfe',
      }}>
        <p style={{ fontSize: 13, color: '#1e40af', margin: 0, lineHeight: 1.6 }}>
          <strong>How billing works:</strong> Golfers book tee times for free through PAR-Tee. Your course is invoiced monthly at ${(tierRate / 100).toFixed(2)} CAD per booking. Invoices are generated at the start of each month for the prior period.
        </p>
      </div>

      {/* Invoices */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '2px solid #e5e7eb' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>Invoice History</h2>
        </div>

        {invoices.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>No invoices yet. Your first invoice will appear after your first month with bookings.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Period', 'Bookings', 'Subtotal', 'Tax', 'Total', 'Status'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: '#9ca3af',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const sc = statusColors[inv.status] ?? statusColors.draft;
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#374151' }}>
                      {new Date(inv.billingPeriodStart).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#374151', fontWeight: 600 }}>
                      {inv.bookingCount}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#374151' }}>
                      ${(inv.subtotalCents / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#9ca3af' }}>
                      ${(inv.taxCents / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#111', fontWeight: 700 }}>
                      ${(inv.totalCents / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: sc.text, background: sc.bg,
                        padding: '3px 8px', borderRadius: 6, textTransform: 'capitalize',
                      }}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
