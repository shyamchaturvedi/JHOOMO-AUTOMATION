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
import {
  AutopilotConfig,
  fetchAutopilotStatus,
  runAutopilotNow,
  useAutopilotConfig,
} from '../lib/autopilot';

const FEATURES: Array<{ key: Exclude<keyof AutopilotConfig, 'escalationKeywords'>; label: string; desc: string }> = [
  { key: 'supportReplies', label: 'Support auto-replies', desc: 'App tickets & omnibox threads' },
  { key: 'commentToDm', label: 'Comment → DM', desc: 'Instagram / Facebook comments' },
  { key: 'emailAutoReply', label: 'Email auto-replies', desc: 'Inbound mail via Resend' },
  { key: 'socialAutoPost', label: 'Social auto-post', desc: '10 AM & 7 PM IST' },
];

export default function DashboardTab() {
  const [igData, setIgData] = useState<InstagramOverview | null>(null);
  const { config: autopilot, setFeature } = useAutopilotConfig();
  const [lastRun, setLastRun] = useState<string>('Checking worker…');
  const [running, setRunning] = useState(false);
  const automationEnabled = autopilot.masterEnabled;

  const toggleAutomation = () => setFeature('masterEnabled', !automationEnabled);

  useEffect(() => {
    fetchInstagramOverview().then((res) => {
      if (res) setIgData(res);
    });
  }, []);

  useEffect(() => {
    fetchAutopilotStatus().then((status) => {
      if (status?.lastRun?.ranAt) {
        setLastRun(`Last run: ${String(status.lastRun.ranAt)}`);
      } else if (status?.error) {
        setLastRun(`Worker: ${status.error}`);
      } else {
        setLastRun('Worker not reachable yet');
      }
    });
  }, [automationEnabled]);

  const handleRunNow = async () => {
    setRunning(true);
    const result = await runAutopilotNow();
    setLastRun(result ? `Last run: ${String(result.ranAt || new Date().toISOString())}` : 'Run failed');
    setRunning(false);
  };

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

      {/* Master Automation ON/OFF Toggle */}
      <div
        style={{
          background: automationEnabled
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(99, 102, 241, 0.08))'
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(148, 163, 184, 0.06))',
          border: automationEnabled
            ? '1px solid rgba(16, 185, 129, 0.35)'
            : '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 16,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: automationEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.18)',
              color: automationEnabled ? '#34d399' : '#f87171',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Zap size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16.5, fontWeight: 800 }}>Automation Engine</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: automationEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: automationEnabled ? '#34d399' : '#f87171',
                }}
              >
                {automationEnabled ? 'ON · LIVE' : 'OFF · PAUSED'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {automationEnabled
                ? 'Comment-to-DM, AI auto-replies, and scheduled social posts are active.'
                : 'All automated replies and scheduled triggers are currently paused.'}
            </div>
          </div>
        </div>

        <button
          onClick={toggleAutomation}
          aria-pressed={automationEnabled}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 18px',
            borderRadius: 999,
            border: 'none',
            background: automationEnabled ? '#10b981' : '#334155',
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: automationEnabled ? '0 0 24px rgba(16, 185, 129, 0.35)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <span
            style={{
              width: 38,
              height: 22,
              borderRadius: 999,
              background: 'rgba(0,0,0,0.28)',
              position: 'relative',
              display: 'inline-block',
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: 3,
                left: automationEnabled ? 19 : 3,
                transition: 'left 0.2s ease',
              }}
            />
          </span>
          {automationEnabled ? 'TURN OFF' : 'TURN ON'}
        </button>
      </div>

      {/* Autopilot features */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Autopilot tasks</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>{lastRun}</div>
          </div>
          <button
            onClick={handleRunNow}
            disabled={running}
            style={{
              padding: '8px 14px',
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: running ? 'wait' : 'pointer',
            }}
          >
            {running ? 'Running…' : 'Run now'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {FEATURES.map((feature) => {
            const enabled = automationEnabled && autopilot[feature.key];
            return (
              <button
                key={feature.key}
                onClick={() => setFeature(feature.key, !autopilot[feature.key])}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: `1px solid ${enabled ? 'rgba(16,185,129,0.35)' : 'var(--border)'}`,
                  background: enabled ? 'rgba(16,185,129,0.08)' : 'var(--bg)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{feature.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: enabled ? '#34d399' : '#94a3b8' }}>
                    {enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{feature.desc}</div>
              </button>
            );
          })}
        </div>
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
