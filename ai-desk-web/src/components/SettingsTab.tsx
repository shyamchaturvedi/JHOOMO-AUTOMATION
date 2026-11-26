import React, { useState } from 'react';
import { Bell, CheckCircle2, Save, Shield } from 'lucide-react';

export default function SettingsTab() {
  const [workspaceName, setWorkspaceName] = useState('JHOOMO Events');
  const [supportEmail, setSupportEmail] = useState('admin@jhoomo.in');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [dmAlerts, setDmAlerts] = useState(true);
  const [leadAlerts, setLeadAlerts] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 20px 60px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 22,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Settings
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
            Configure your workspace and notification preferences
          </p>
        </div>

        <button
          onClick={handleSave}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 18px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--primary)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Workspace Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 20,
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Shield size={16} color="#a5b4fc" />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Workspace Profile</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              Workspace Name
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 9,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              Admin Email
            </label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 9,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
          </div>
        </div>
      </div>

      {/* Notifications Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Bell size={16} color="#fb7185" />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Notifications</h3>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {[
            { label: 'Email alerts for new support tickets', checked: emailAlerts, set: setEmailAlerts },
            { label: 'Instant alert when Comment-to-DM triggers', checked: dmAlerts, set: setDmAlerts },
            { label: 'Lead Form submission notifications', checked: leadAlerts, set: setLeadAlerts },
          ].map((item) => (
            <label
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <span>{item.label}</span>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.set(e.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
