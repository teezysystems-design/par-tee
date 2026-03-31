'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

const COLORS = {
  green: '#1a7f4b',
  greenPale: '#e8f5ee',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray200: '#e5e7eb',
  gray600: '#4b5563',
  gray700: '#374151',
  gray900: '#111827',
  amber: '#f59e0b',
  amberPale: '#fffbeb',
};

type PricingTier = 'standard' | 'basic_promotion' | 'active_promotion' | 'tournament' | 'founding';

const TIERS: {
  tier: PricingTier;
  label: string;
  feeCents: number;
  description: string;
  requirement: string;
  highlight?: boolean;
}[] = [
  {
    tier: 'standard',
    label: 'Standard',
    feeCents: 275,
    description: 'Base rate per completed booking',
    requirement: 'No additional commitment',
  },
  {
    tier: 'basic_promotion',
    label: 'Basic Promotion',
    feeCents: 225,
    description: 'Teezy listed on your website and booking page',
    requirement: 'Link to teezy.app on your website or booking system',
    highlight: true,
  },
  {
    tier: 'active_promotion',
    label: 'Active Promotion',
    feeCents: 200,
    description: 'Active promotion of Teezy on-course',
    requirement: 'Signage at pro shop + staff mention to every group',
    highlight: true,
  },
  {
    tier: 'tournament',
    label: 'Tournament Partner',
    feeCents: 175,
    description: 'Run mini tournaments through Teezy',
    requirement: 'Host at least 1 mini tournament/month + social media post',
    highlight: true,
  },
  {
    tier: 'founding',
    label: 'Founding Course',
    feeCents: 150,
    description: 'Founding partner — rate locked forever',
    requirement: 'Early adopter — not available to new courses',
  },
];

interface CourseData {
  pricingTier: PricingTier;
  name: string;
}

export default function BillingPage() {
  const courseId = process.env['NEXT_PUBLIC_COURSE_ID'];
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PricingTier>('standard');

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    apiFetch(`/v1/courses/${courseId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        setCourse(data);
        setSelectedTier(data.pricingTier ?? 'standard');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  const handleUpdateTier = async () => {
    if (!courseId || !selectedTier) return;
    setUpdating(true);
    try {
      const res = await apiFetch(`/v1/courses/${courseId}/pricing-tier`, {
        method: 'PATCH',
        body: JSON.stringify({ pricingTier: selectedTier }),
      });
      if (!res.ok) throw new Error();
      setCourse((prev) => prev ? { ...prev, pricingTier: selectedTier } : null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Failed to update pricing tier.');
    } finally {
      setUpdating(false);
    }
  };

  const currentTierInfo = TIERS.find((t) => t.tier === (course?.pricingTier ?? 'standard'));
  const selectedTierInfo = TIERS.find((t) => t.tier === selectedTier);

  return (
    <div style={{ padding: '2rem', maxWidth: 760 }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: COLORS.gray900 }}>Billing & Pricing</h1>
        <p style={{ color: COLORS.gray600, marginTop: '0.25rem' }}>
          Monthly invoicing via Stripe. Lower your per-booking fee by promoting Teezy.
        </p>
      </div>

      {!courseId ? (
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 12, padding: '2.5rem', textAlign: 'center', color: COLORS.gray600 }}>
          Set <code style={{ background: COLORS.gray50, padding: '0.15rem 0.4rem', borderRadius: 4 }}>NEXT_PUBLIC_COURSE_ID</code> to view billing.
        </div>
      ) : loading ? (
        <p style={{ color: COLORS.gray600 }}>Loading...</p>
      ) : (
        <>
          {/* Current plan banner */}
          <div
            style={{
              background: COLORS.greenPale,
              border: `1.5px solid ${COLORS.green}`,
              borderRadius: 14,
              padding: '1.25rem 1.5rem',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <span style={{ fontSize: '2rem' }}>💰</span>
            <div>
              <p style={{ fontWeight: 700, color: COLORS.green, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Current Plan
              </p>
              <p style={{ fontWeight: 800, fontSize: '1.2rem', color: COLORS.gray900 }}>
                {currentTierInfo?.label} — ${((currentTierInfo?.feeCents ?? 275) / 100).toFixed(2)} per booking
              </p>
              <p style={{ fontSize: '0.85rem', color: COLORS.gray600 }}>{currentTierInfo?.description}</p>
            </div>
          </div>

          {/* Tier selector */}
          <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: COLORS.gray900, marginBottom: '1.25rem' }}>
              Change Pricing Tier
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {TIERS.map((tier) => {
                const isCurrent = tier.tier === course?.pricingTier;
                const isSelected = tier.tier === selectedTier;
                const isLocked = tier.tier === 'founding' && !isCurrent;

                return (
                  <div
                    key={tier.tier}
                    onClick={() => !isLocked && setSelectedTier(tier.tier)}
                    style={{
                      border: `2px solid ${isSelected ? COLORS.green : COLORS.gray200}`,
                      borderRadius: 12,
                      padding: '1rem 1.25rem',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      opacity: isLocked ? 0.5 : 1,
                      background: isSelected ? COLORS.greenPale : COLORS.white,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1rem',
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? COLORS.green : COLORS.gray200}`,
                        background: isSelected ? COLORS.green : 'transparent',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: COLORS.gray900 }}>{tier.label}</span>
                        <span style={{ fontWeight: 800, color: COLORS.green, fontSize: '1.05rem' }}>
                          ${(tier.feeCents / 100).toFixed(2)}/booking
                        </span>
                        {isCurrent && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, background: COLORS.greenPale, color: COLORS.green, padding: '0.15rem 0.5rem', borderRadius: 10 }}>
                            Current
                          </span>
                        )}
                        {tier.highlight && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, background: COLORS.amberPale, color: COLORS.amber, padding: '0.15rem 0.5rem', borderRadius: 10 }}>
                            Save ${((275 - tier.feeCents) / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.85rem', color: COLORS.gray600, marginTop: '0.25rem' }}>{tier.description}</p>
                      <p style={{ fontSize: '0.8rem', color: COLORS.gray700, marginTop: '0.25rem' }}>
                        <strong>Requires:</strong> {tier.requirement}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={handleUpdateTier}
                disabled={updating || selectedTier === course?.pricingTier}
                style={{
                  background: saved ? '#16a34a' : COLORS.green,
                  color: COLORS.white,
                  border: 'none',
                  borderRadius: 10,
                  padding: '0.75rem 1.75rem',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: updating || selectedTier === course?.pricingTier ? 'not-allowed' : 'pointer',
                  opacity: selectedTier === course?.pricingTier ? 0.5 : 1,
                  transition: 'background 0.3s',
                }}
              >
                {updating ? 'Updating...' : saved ? '✓ Updated!' : 'Update Pricing Tier'}
              </button>
              {selectedTierInfo && selectedTier !== course?.pricingTier && (
                <p style={{ fontSize: '0.85rem', color: COLORS.gray600 }}>
                  New rate: <strong>${(selectedTierInfo.feeCents / 100).toFixed(2)}/booking</strong> starting next billing cycle
                </p>
              )}
            </div>
          </div>

          {/* Billing info */}
          <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 14, padding: '1.5rem' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: COLORS.gray900, marginBottom: '1rem' }}>
              Billing Schedule
            </h2>
            <ul style={{ fontSize: '0.9rem', color: COLORS.gray700, lineHeight: 1.8, paddingLeft: '1.25rem' }}>
              <li>Invoices are generated on the 1st of each month for the prior month's completed bookings.</li>
              <li>Payment is charged automatically via the connected Stripe account.</li>
              <li>Only <em>completed</em> bookings are billed — cancellations are excluded.</li>
              <li>Tier changes take effect at the start of the next billing cycle.</li>
            </ul>
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: COLORS.gray600 }}>
              Questions? Email <strong>billing@teezy.app</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
