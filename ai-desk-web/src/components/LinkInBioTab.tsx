import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Instagram, Plus, Save, Trash2 } from 'lucide-react';

interface BioLink {
  id: string;
  title: string;
  url: string;
}

export default function LinkInBioTab() {
  const [mode, setMode] = useState<'content' | 'design'>('content');
  const [slug, setSlug] = useState('jhoomo.events');
  const [displayName, setDisplayName] = useState('jhoomo.events');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState<BioLink[]>([]);
  const [emailCapture, setEmailCapture] = useState(false);
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [savedToast, setSavedToast] = useState(false);

  const handleAddLink = () => {
    setLinks((prev) => [
      ...prev,
      { id: `lnk_${Date.now()}`, title: 'New Link', url: 'https://jhoomo.in' },
    ]);
  };

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 22,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Link in Bio Builder
          </h1>
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
          {savedToast ? <CheckCircle2 size={15} /> : <Save size={15} />}
          {savedToast ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Builder Grid: Left Editor + Right Live Mobile Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: 20, alignItems: 'start' }}>
        {/* Left Column */}
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
              justifyContent: 'space-between',
              marginBottom: 18,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Profile Setup</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['content', 'design'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMode(tab)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border:
                      mode === tab
                        ? '1px solid rgba(99, 102, 241, 0.4)'
                        : '1px solid var(--border)',
                    background: mode === tab ? 'rgba(99, 102, 241, 0.14)' : 'var(--bg)',
                    color: mode === tab ? '#a5b4fc' : 'var(--text-muted)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {mode === 'content' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Basic Info */}
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Basic Info</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
                      Username (URL Slug)
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        border: '1px solid var(--border)',
                        borderRadius: 9,
                        background: 'var(--bg)',
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          padding: '9px 10px',
                          fontSize: 12.5,
                          color: 'var(--text-muted)',
                          borderRight: '1px solid var(--border)',
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        autoensta.in/l/
                      </span>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="yourbrand"
                        style={{
                          flex: 1,
                          padding: '9px 10px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 9,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
                      Profile Picture URL
                    </label>
                    <input
                      type="text"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://..."
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 9,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bio</label>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{bio.length}/150</span>
                    </div>
                    <textarea
                      rows={3}
                      maxLength={150}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Your bio goes here."
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 9,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: 13,
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Your Links */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Your Links</h3>
                  <button
                    onClick={handleAddLink}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 11px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={13} />
                    Add Link
                  </button>
                </div>

                {links.length === 0 ? (
                  <div
                    style={{
                      padding: '20px',
                      border: '1px dashed var(--border)',
                      borderRadius: 10,
                      textAlign: 'center',
                      fontSize: 12.5,
                      color: 'var(--text-muted)',
                    }}
                  >
                    No links added yet. Click &quot;Add Link&quot; to start.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {links.map((lnk) => (
                      <div
                        key={lnk.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr auto',
                          gap: 8,
                          alignItems: 'center',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: 10,
                        }}
                      >
                        <input
                          type="text"
                          value={lnk.title}
                          onChange={(e) =>
                            setLinks((prev) =>
                              prev.map((l) => (l.id === lnk.id ? { ...l, title: e.target.value } : l))
                            )
                          }
                          style={{
                            padding: '7px 9px',
                            borderRadius: 7,
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            fontSize: 12.5,
                          }}
                        />
                        <input
                          type="text"
                          value={lnk.url}
                          onChange={(e) =>
                            setLinks((prev) =>
                              prev.map((l) => (l.id === lnk.id ? { ...l, url: e.target.value } : l))
                            )
                          }
                          style={{
                            padding: '7px 9px',
                            borderRadius: 7,
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            fontSize: 12.5,
                          }}
                        />
                        <button
                          onClick={() => setLinks((prev) => prev.filter((l) => l.id !== lnk.id))}
                          style={{
                            padding: '7px 8px',
                            borderRadius: 7,
                            border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.1)',
                            color: '#f87171',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Email Capture Form */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Email Capture Form</h3>
                <input
                  type="checkbox"
                  checked={emailCapture}
                  onChange={(e) => setEmailCapture(e.target.checked)}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Theme Accent Color</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {['#6366f1', '#e11d48', '#10b981', '#f59e0b', '#ec4899'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccentColor(c)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: c,
                      border: accentColor === c ? '2px solid #fff' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Mobile Preview */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 9,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--text-muted)',
              marginBottom: 16,
            }}
          >
            <span>{`http://localhost:5180/l/${slug || 'jhoomo.events'}`}</span>
            <ExternalLink size={13} />
          </div>

          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: '28px 20px',
              background: '#080a0f',
              textAlign: 'center',
              minHeight: 400,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  margin: '0 auto 12px',
                  background: 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  overflow: 'hidden',
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Instagram size={28} />
                )}
              </div>

              <h1 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>
                {displayName || 'jhoomo.events'}
              </h1>
              <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                {bio || 'Your bio goes here.'}
              </p>

              <div style={{ display: 'grid', gap: 10 }}>
                {links.map((lnk) => (
                  <a
                    key={lnk.id}
                    href={lnk.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'block',
                      padding: '11px 14px',
                      borderRadius: 10,
                      background: accentColor,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    {lnk.title}
                  </a>
                ))}
              </div>

              {emailCapture && (
                <div
                  style={{
                    marginTop: 18,
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                  }}
                >
                  <input
                    type="email"
                    placeholder="Enter your email..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: 12,
                    }}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 28,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
              }}
            >
              POWERED BY JHOOMO
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
