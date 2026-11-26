import React, { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, Zap } from 'lucide-react';
import { db } from '../lib/firebase';

interface AutomationItem {
  id: string;
  name: string;
  keyword: string;
  replyText: string;
  active: boolean;
}

export default function AutomationsTab() {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [automations, setAutomations] = useState<AutomationItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    return onSnapshot(collection(db, 'comment_automations'), (snap) => {
      setAutomations(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name?.toString() || 'Automation',
            keyword: data.keyword?.toString() || '',
            replyText: data.replyText?.toString() || '',
            active: data.active !== false,
          };
        })
      );
    });
  }, []);

  const filtered = automations.filter((a) => {
    if (filter === 'active') return a.active;
    if (filter === 'inactive') return !a.active;
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !keyword.trim()) return;
    const item = {
      name: name.trim(),
      keyword: keyword.trim(),
      replyText: replyText.trim() || 'Sent you a DM! Check your inbox.',
      active: true,
    };
    const localItem: AutomationItem = { id: `auto_${Date.now()}`, ...item };
    setAutomations((prev) => [localItem, ...prev]);
    try {
      await addDoc(collection(db, 'comment_automations'), item);
    } catch {
      // keep the local item when Firestore is unavailable
    }
    setName('');
    setKeyword('');
    setReplyText('');
    setCreating(false);
  };

  const toggleActive = (item: AutomationItem) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, active: !a.active } : a))
    );
    if (!item.id.startsWith('local_')) {
      void updateDoc(doc(db, 'comment_automations', item.id), { active: !item.active });
    }
  };

  const removeAutomation = (item: AutomationItem) => {
    setAutomations((prev) => prev.filter((a) => a.id !== item.id));
    if (!item.id.startsWith('local_')) {
      void deleteDoc(doc(db, 'comment_automations', item.id));
    }
  };

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Automations
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
          Manage your comment automations
        </p>
      </div>

      {/* Top Filter & Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'active', 'inactive'] as const).map((tab) => {
            const active = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: active ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border)',
                  background: active ? 'rgba(99, 102, 241, 0.14)' : 'var(--surface)',
                  color: active ? '#a5b4fc' : 'var(--text-muted)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setCreating(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 16px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--primary)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          New Automation
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 20,
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>Create Comment Automation</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Automation name (e.g. Ticket Link DM)"
              style={{
                padding: '9px 12px',
                borderRadius: 9,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Trigger keyword (e.g. PASS, LINK)"
              style={{
                padding: '9px 12px',
                borderRadius: 9,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
          </div>
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Auto-reply DM / comment message..."
            style={{
              padding: '9px 12px',
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 13,
            }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setCreating(false)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text-muted)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--primary)',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Save Automation
            </button>
          </div>
        </form>
      )}

      {/* Empty State or List */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '56px 20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--primary-soft)',
              color: '#fb7185',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Zap size={22} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>No automations yet</h3>
          <p
            style={{
              margin: '0 auto 20px',
              maxWidth: 420,
              fontSize: 13.5,
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            Create your first automation to start auto-replying to Instagram comments.
          </p>
          <button
            onClick={() => setCreating(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            Create Automation
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
                  Keyword: <strong>{item.keyword}</strong> · Reply: {item.replyText}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => toggleActive(item)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 999,
                    border: 'none',
                    background: item.active
                      ? 'rgba(16,185,129,0.14)'
                      : 'rgba(148,163,184,0.14)',
                    color: item.active ? '#34d399' : '#94a3b8',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {item.active ? 'ACTIVE' : 'INACTIVE'}
                </button>
                <button
                  onClick={() => removeAutomation(item)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.1)',
                    color: '#f87171',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
