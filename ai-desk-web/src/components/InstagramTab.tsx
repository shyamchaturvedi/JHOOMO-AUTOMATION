import React, { useState } from 'react';
import {
  CheckCircle2,
  Instagram,
  KeyRound,
  RefreshCw,
  Unplug,
} from 'lucide-react';

export default function InstagramTab() {
  const [connected, setConnected] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const handleRefreshToken = () => {
    setRefreshing(true);
    setStatusNote(null);
    setTimeout(() => {
      setRefreshing(false);
      setStatusNote('Access token refreshed successfully.');
      setTimeout(() => setStatusNote(null), 2500);
    }, 600);
  };

  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Instagram
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
          Manage your connected Instagram account
        </p>
      </div>

      {/* Connected Account Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '20px 22px',
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
              borderRadius: '50%',
              background: connected
                ? 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)'
                : 'var(--bg)',
              border: connected ? 'none' : '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: connected ? '#fff' : 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <Instagram size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15.5, fontWeight: 700 }}>
                {connected ? '@jhoomo.events' : 'No Account Connected'}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 9px',
                  borderRadius: 999,
                  background: connected ? 'rgba(16, 185, 129, 0.14)' : 'rgba(148, 163, 184, 0.14)',
                  color: connected ? '#34d399' : '#94a3b8',
                }}
              >
                <CheckCircle2 size={12} />
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              {connected
                ? 'Connected on November 26, 2026'
                : 'Connect your Instagram Business account to enable automations.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {connected ? (
            <>
              <button
                onClick={handleRefreshToken}
                disabled={refreshing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 14px',
                  borderRadius: 9,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: refreshing ? 'not-allowed' : 'pointer',
                  opacity: refreshing ? 0.7 : 1,
                }}
              >
                <RefreshCw size={14} />
                {refreshing ? 'Refreshing...' : 'Refresh Token'}
              </button>
              <button
                onClick={() => setConnected(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 14px',
                  borderRadius: 9,
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Unplug size={14} />
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => setConnected(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 16px',
                borderRadius: 9,
                border: 'none',
                background: 'var(--primary)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Instagram size={14} />
              Connect Instagram
            </button>
          )}
        </div>
      </div>

      {statusNote && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {statusNote}
        </div>
      )}

      {/* Token Status Card */}
      {connected && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <KeyRound size={16} color="#fb7185" />
            <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Token Status</h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            <div
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px 18px',
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  marginBottom: 6,
                }}
              >
                TOKEN EXPIRES
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>January 25, 2027</div>
            </div>

            <div
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px 18px',
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  marginBottom: 6,
                }}
              >
                DAYS UNTIL EXPIRY
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>60 days</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
