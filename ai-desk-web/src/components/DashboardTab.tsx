import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Eye,
  Instagram,
  Link2,
  MousePointerClick,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { fetchInstagramOverview, InstagramOverview } from '../lib/ai';

export default function DashboardTab() {
  const [igData, setIgData] = useState<InstagramOverview | null>(null);

  useEffect(() => {
    fetchInstagramOverview().then((res) => {
      if (res) setIgData(res);
    });
  }, []);

  const username = igData?.profile?.username || 'jhoomo.events';
  const avatarUrl = igData?.profile?.profile_picture_url;
  const followersCount = igData?.profile?.followers_count;
  const mediaCount = igData?.profile?.media_count;
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Dashboard
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
          Welcome back! Here&apos;s your overview.
        </p>
      </div>

      {/* Instagram Connection Status Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          marginBottom: 26,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={username}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <Instagram size={20} />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>@{username}</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 9px',
                  borderRadius: 999,
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#34d399',
                }}
              >
                <CheckCircle2 size={12} />
                Connected
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Connected 11/26/2026
              {typeof followersCount === 'number' && ` · ${followersCount.toLocaleString()} followers`}
              {typeof mediaCount === 'number' && ` · ${mediaCount.toLocaleString()} posts`}
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: INSTAGRAM AUTOMATIONS */}
      <div style={{ marginBottom: 26 }}>
        <h3
          style={{
            margin: '0 0 12px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
          }}
        >
          INSTAGRAM AUTOMATIONS
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 14,
          }}
        >
          {[
            {
              label: 'TOTAL AUTOMATIONS',
              value: '0',
              badge: '+15%',
              badgeColor: '#34d399',
              badgeBg: 'rgba(16, 185, 129, 0.14)',
              icon: Zap,
            },
            {
              label: 'ACTIVE AUTOMATIONS',
              value: '0',
              badge: 'Live',
              badgeColor: '#fb7185',
              badgeBg: 'var(--primary-soft)',
              icon: Activity,
            },
            {
              label: 'TOTAL EXECUTIONS',
              value: '0',
              badge: '+12%',
              badgeColor: '#34d399',
              badgeBg: 'rgba(16, 185, 129, 0.14)',
              icon: TrendingUp,
            },
            {
              label: 'SUCCESS RATE',
              value: '—',
              badge: null,
              badgeColor: '',
              badgeBg: '',
              icon: CheckCircle2,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '16px 18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                    {card.label}
                  </span>
                  <Icon size={15} color="var(--text-muted)" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 26, fontWeight: 800 }}>{card.value}</span>
                  {card.badge && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 999,
                        color: card.badgeColor,
                        background: card.badgeBg,
                      }}
                    >
                      {card.badge}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: LINK IN BIO PERFORMANCE */}
      <div style={{ marginBottom: 26 }}>
        <h3
          style={{
            margin: '0 0 12px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
          }}
        >
          LINK IN BIO PERFORMANCE
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 14,
          }}
        >
          {[
            { label: 'PAGE VIEWS', value: '0', icon: Eye },
            { label: 'LINK CLICKS', value: '0', icon: MousePointerClick },
            { label: 'SUBSCRIBERS', value: '0', icon: Users },
            { label: 'ACTIVE LINKS', value: '0', icon: Link2 },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '16px 18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                    {card.label}
                  </span>
                  <Icon size={15} color="var(--text-muted)" />
                </div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{card.value}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Recent Activity */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 20,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Recent Activity</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
            Latest automation executions
          </p>
        </div>

        <div
          style={{
            textAlign: 'center',
            padding: '44px 20px',
            border: '1px dashed var(--border)',
            borderRadius: 12,
            background: 'var(--bg)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--primary-soft)',
              color: '#fb7185',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Activity size={20} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No activity yet</div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              maxWidth: 420,
              margin: '0 auto',
              lineHeight: 1.5,
            }}
          >
            Activity will appear here once your automations start processing comments.
          </div>
        </div>
      </div>
    </div>
  );
}
