import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { CheckCircle2, Inbox, Mail, Send } from 'lucide-react';
import { db } from '../lib/firebase';
import { sendSupportEmail } from '../lib/ai';

interface SupportEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  createdAtLabel: string;
}

const SENDERS = [
  'support@jhoomo.in',
  'tickets@jhoomo.in',
  'organizer@jhoomo.in',
  'careers@jhoomo.in',
  'admin@jhoomo.in',
];

export default function SupportMailTab() {
  const [emails, setEmails] = useState<SupportEmail[]>([]);
  const [selected, setSelected] = useState<SupportEmail | null>(null);
  const [sender, setSender] = useState('support@jhoomo.in');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'support_emails'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: SupportEmail[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            from: data.from || data.sender || 'unknown@jhoomo.in',
            to: data.to || 'support@jhoomo.in',
            subject: data.subject || '(No Subject)',
            body: data.text || data.body || '',
            createdAtLabel: data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleString('en-IN')
              : 'Recent',
          };
        });
        setEmails(list);
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const handleSelect = (mail: SupportEmail) => {
    setSelected(mail);
    setTo(mail.from);
    setSubject(mail.subject.startsWith('Re:') ? mail.subject : `Re: ${mail.subject}`);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setStatus(null);
    const res = await sendSupportEmail({
      sender,
      to: to.trim(),
      subject: subject.trim(),
      body: body.trim(),
    });
    setSending(false);
    if (res.ok) {
      setStatus('Email sent successfully via Resend!');
      setBody('');
      setTimeout(() => setStatus(null), 3000);
    } else {
      setStatus(`Error: ${res.error}`);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 60px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Support Mail
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
          Cloudflare &amp; Resend Support Inbox — view incoming mails and send branded JHOOMO replies
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 18, alignItems: 'start' }}>
        {/* Left: Inbox List */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Inbox size={16} color="#a5b4fc" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Inbox ({emails.length})</h3>
          </div>

          {emails.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '44px 16px',
                border: '1px dashed var(--border)',
                borderRadius: 12,
                background: 'var(--bg)',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              No support emails in Firestore (`support_emails`) yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
              {emails.map((mail) => (
                <button
                  key={mail.id}
                  onClick={() => handleSelect(mail)}
                  style={{
                    textAlign: 'left',
                    padding: 12,
                    borderRadius: 10,
                    border:
                      selected?.id === mail.id
                        ? '1px solid rgba(99,102,241,0.5)'
                        : '1px solid var(--border)',
                    background:
                      selected?.id === mail.id ? 'rgba(99,102,241,0.12)' : 'var(--bg)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{mail.subject}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    From: {mail.from} · {mail.createdAtLabel}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Compose / Reply */}
        <form
          onSubmit={handleSend}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Mail size={16} color="#fb7185" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Compose / Reply</h3>
          </div>

          {selected && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                fontSize: 12.5,
                color: 'var(--text-muted)',
                maxHeight: 120,
                overflowY: 'auto',
              }}
            >
              <strong style={{ color: 'var(--text)' }}>Original Message:</strong> {selected.body}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                From Sender
              </label>
              <select
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              >
                {SENDERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                To Email
              </label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="customer@example.com"
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ticket Update / Support Reply"
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>
              Message Body
            </label>
            <textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your reply..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
                resize: 'vertical',
              }}
            />
          </div>

          {status && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12.5,
                color: status.startsWith('Error') ? '#f87171' : '#34d399',
              }}
            >
              <CheckCircle2 size={14} />
              {status}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '10px 16px',
              borderRadius: 9,
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.7 : 1,
            }}
          >
            <Send size={14} />
            {sending ? 'Sending...' : 'Send Branded Email'}
          </button>
        </form>
      </div>
    </div>
  );
}
