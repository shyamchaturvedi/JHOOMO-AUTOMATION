import React, { useState } from 'react';
import { Check, CreditCard, Sparkles } from 'lucide-react';

export default function BillingTab() {
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro' | 'enterprise'>('free');

  const plans = [
    {
      id: 'free' as const,
      name: 'Free Trial',
      price: '₹0',
      period: '/ 7 days',
      desc: 'Test comment automations and lead forms.',
      features: ['3 Lead Forms', '100 Auto-DM / month', '1 Instagram Account', 'Link in Bio Builder'],
    },
    {
      id: 'pro' as const,
      name: 'Pro Growth',
      price: '₹999',
      period: '/ month',
      desc: 'For creators & event brands scaling engagement.',
      popular: true,
      features: [
        'Unlimited Lead Forms',
        'Unlimited Auto-DMs & Comment Replies',
        'JARVIS AI Strategy & Auto-Pilot',
        'Priority Support & Webhooks',
      ],
    },
    {
      id: 'enterprise' as const,
      name: 'Agency / Enterprise',
      price: '₹2,999',
      period: '/ month',
      desc: 'Multi-brand automation & dedicated support.',
      features: [
        'Up to 10 Instagram Accounts',
        'WhatsApp + SMS Bulk Campaigns',
        'Custom API & CRM Sync',
        'Dedicated Account Manager',
      ],
    },
  ];

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 60px' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Billing &amp; Plans
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
          Manage your subscription and usage limits
        </p>
      </div>

      {/* Current Plan Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(225,29,72,0.08))',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 14,
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'rgba(99,102,241,0.2)',
              color: '#a5b4fc',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <CreditCard size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Current Plan: {selectedPlan === 'free' ? 'Free Trial (7 days left)' : selectedPlan.toUpperCase()}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
              Upgrade anytime to unlock unlimited automations and AI campaigns.
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        {plans.map((plan) => {
          const isCurrent = selectedPlan === plan.id;
          return (
            <div
              key={plan.id}
              style={{
                background: 'var(--surface)',
                border: plan.popular
                  ? '1px solid rgba(99,102,241,0.55)'
                  : '1px solid var(--border)',
                borderRadius: 14,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 18,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{plan.name}</span>
                  {plan.popular && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'rgba(99,102,241,0.18)',
                        color: '#a5b4fc',
                      }}
                    >
                      <Sparkles size={10} /> POPULAR
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 28, fontWeight: 800 }}>{plan.price}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{plan.period}</span>
                </div>
                <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {plan.desc}
                </p>
                <div style={{ display: 'grid', gap: 8 }}>
                  {plan.features.map((f) => (
                    <div
                      key={f}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12.5,
                        color: 'var(--text)',
                      }}
                    >
                      <Check size={14} color="#34d399" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSelectedPlan(plan.id)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: isCurrent ? '1px solid var(--border)' : 'none',
                  background: isCurrent ? 'var(--bg)' : 'var(--primary)',
                  color: isCurrent ? 'var(--text-muted)' : '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isCurrent ? 'Current Plan' : `Switch to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
