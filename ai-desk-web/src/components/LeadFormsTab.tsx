import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Mail,
  Phone,
  Plus,
  Trash2,
  Type,
  AlignLeft,
  CheckCircle2,
} from 'lucide-react';
import { db } from '../lib/firebase';

export type FormFieldType = 'text' | 'email' | 'phone' | 'textarea';

export interface LeadFormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder: string;
  required: boolean;
}

export interface LeadForm {
  id: string;
  title: string;
  description: string;
  fields: LeadFormField[];
  thankYouMessage: string;
  submissions: number;
  active: boolean;
  createdAtMs: number;
}

const FIELD_TYPE_META: Record<FormFieldType, { badge: string; label: string; defaultPlaceholder: string }> = {
  text: { badge: 'TEXT', label: 'Short Text', defaultPlaceholder: 'e.g. John Doe' },
  email: { badge: 'EMAIL', label: 'Email Address', defaultPlaceholder: 'e.g. john@example.com' },
  phone: { badge: 'PHONE', label: 'Phone Number', defaultPlaceholder: 'e.g. +91 98765 43210' },
  textarea: { badge: 'LONG TEXT', label: 'Long Text', defaultPlaceholder: 'Write your message...' },
};

const DEFAULT_FIELDS = (): LeadFormField[] => [
  {
    id: `f_${Date.now()}_1`,
    type: 'text',
    label: 'Full Name',
    placeholder: 'e.g. John Doe',
    required: true,
  },
  {
    id: `f_${Date.now()}_2`,
    type: 'email',
    label: 'Email Address',
    placeholder: 'e.g. john@example.com',
    required: true,
  },
];

export default function LeadFormsTab() {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Builder state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<LeadFormField[]>(DEFAULT_FIELDS);
  const [thankYouMessage, setThankYouMessage] = useState(
    'Thanks for reaching out! We will get back to you soon.'
  );

  useEffect(() => {
    const q = query(collection(db, 'lead_forms'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: LeadForm[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || 'Untitled Form',
            description: data.description || '',
            fields: Array.isArray(data.fields) ? data.fields : [],
            thankYouMessage:
              data.thankYouMessage || 'Thanks for reaching out! We will get back to you soon.',
            submissions: typeof data.submissions === 'number' ? data.submissions : 0,
            active: data.active !== false,
            createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          };
        });
        setForms(list);
      },
      () => {
        // Keep local state if Firestore rules or connection block reads
      }
    );
    return () => unsub();
  }, []);

  const resetBuilder = () => {
    setTitle('');
    setDescription('');
    setFields(DEFAULT_FIELDS());
    setThankYouMessage('Thanks for reaching out! We will get back to you soon.');
  };

  const openCreate = () => {
    resetBuilder();
    setView('create');
  };

  const addField = (type: FormFieldType) => {
    const meta = FIELD_TYPE_META[type];
    setFields((prev) => [
      ...prev,
      {
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        label: meta.label,
        placeholder: meta.defaultPlaceholder,
        required: false,
      },
    ]);
  };

  const updateField = (id: string, patch: Partial<LeadFormField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleCreateForm = async () => {
    if (!title.trim()) {
      alert('Please enter a Form Title.');
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      fields,
      thankYouMessage:
        thankYouMessage.trim() || 'Thanks for reaching out! We will get back to you soon.',
      submissions: 0,
      active: true,
    };

    try {
      await addDoc(collection(db, 'lead_forms'), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Fallback to local state if Firestore write fails
      setForms((prev) => [
        {
          id: `local_${Date.now()}`,
          ...payload,
          createdAtMs: Date.now(),
        },
        ...prev,
      ]);
    } finally {
      setSaving(false);
      setView('list');
    }
  };

  const handleDeleteForm = async (id: string) => {
    try {
      if (!id.startsWith('local_')) {
        await deleteDoc(doc(db, 'lead_forms', id));
      } else {
        setForms((prev) => prev.filter((f) => f.id !== id));
      }
    } catch {
      setForms((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}/?form=${id}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const activeCount = forms.filter((f) => f.active).length;
  const totalSubmissions = forms.reduce((acc, f) => acc + f.submissions, 0);

  if (view === 'create') {
    return (
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 20px 60px' }}>
        {/* Top Action Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <button
            onClick={() => setView('list')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={15} />
            Back to Forms
          </button>

          <button
            onClick={handleCreateForm}
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            <CheckCircle2 size={15} />
            {saving ? 'Creating...' : 'Create Form'}
          </button>
        </div>

        {/* Section 1: Form Details */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Form Details</h3>

          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}
            >
              Form Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Free Consultation Request"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 9,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13.5,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}
            >
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly explain what this form is for..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 9,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13.5,
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        {/* Section 2: Form Fields */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Form Fields</h3>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(
                [
                  { type: 'text', label: 'Short Text', icon: Type },
                  { type: 'email', label: 'Email Address', icon: Mail },
                  { type: 'phone', label: 'Phone Number', icon: Phone },
                  { type: 'textarea', label: 'Long Text', icon: AlignLeft },
                ] as const
              ).map((btn) => {
                const Icon = btn.icon;
                return (
                  <button
                    key={btn.type}
                    onClick={() => addField(btn.type)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
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
                    <Icon size={13} />
                    {btn.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fields.map((field, idx) => (
              <div
                key={field.id}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'var(--primary-soft)',
                        color: '#fb7185',
                      }}
                    >
                      {FIELD_TYPE_META[field.type].badge}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {field.label || 'Untitled Field'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => moveField(idx, -1)}
                      disabled={idx === 0}
                      title="Move Up"
                      style={{
                        padding: '4px 6px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: idx === 0 ? 'var(--text-muted)' : 'var(--text)',
                        opacity: idx === 0 ? 0.4 : 1,
                        cursor: idx === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveField(idx, 1)}
                      disabled={idx === fields.length - 1}
                      title="Move Down"
                      style={{
                        padding: '4px 6px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: idx === fields.length - 1 ? 'var(--text-muted)' : 'var(--text)',
                        opacity: idx === fields.length - 1 ? 0.4 : 1,
                        cursor: idx === fields.length - 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={() => removeField(field.id)}
                      title="Remove Field"
                      style={{
                        padding: '4px 6px',
                        borderRadius: 6,
                        border: '1px solid rgba(239,68,68,0.3)',
                        background: 'rgba(239,68,68,0.1)',
                        color: '#f87171',
                        cursor: 'pointer',
                        marginLeft: 4,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11.5,
                        color: 'var(--text-muted)',
                        marginBottom: 4,
                      }}
                    >
                      Field Label
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11.5,
                        color: 'var(--text-muted)',
                        marginBottom: 4,
                      }}
                    >
                      Placeholder
                    </label>
                    <input
                      type="text"
                      value={field.placeholder}
                      onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 12.5,
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                  />
                  Required Field
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: After Submission */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>After Submission</h3>
          <label
            style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: 6,
            }}
          >
            Thank You Message
          </label>
          <input
            type="text"
            value={thankYouMessage}
            onChange={(e) => setThankYouMessage(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 13.5,
              outline: 'none',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          { label: 'Active Forms', value: String(activeCount) },
          { label: 'Total Submissions', value: String(totalSubmissions) },
          { label: 'Plan Limit', value: `${forms.length} / 3 Forms` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '18px 20px',
            }}
          >
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Your Forms Section */}
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
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Your Forms</h2>
          <button
            onClick={openCreate}
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
            Create Form
          </button>
        </div>

        {forms.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '56px 20px',
              border: '1px dashed var(--border)',
              borderRadius: 12,
              background: 'var(--bg)',
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
              <FileText size={22} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>
              No Forms Created Yet
            </h3>
            <p
              style={{
                margin: '0 auto 20px',
                maxWidth: 440,
                fontSize: 13.5,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              Create a form to capture leads from your Instagram bio. Responses will automatically
              be added to your Mini CRM.
            </p>
            <button
              onClick={openCreate}
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
              Create Your First Form
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 14,
            }}
          >
            {forms.map((form) => (
              <div
                key={form.id}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{form.title}</div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'rgba(16,185,129,0.14)',
                        color: '#34d399',
                      }}
                    >
                      {form.active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>
                  {form.description && (
                    <p
                      style={{
                        margin: '0 0 10px',
                        fontSize: 12.5,
                        color: 'var(--text-muted)',
                        lineHeight: 1.4,
                      }}
                    >
                      {form.description}
                    </p>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {form.fields.length} fields · {form.submissions} submissions
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleCopyLink(form.id)}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Copy size={13} />
                    {copiedId === form.id ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => handleDeleteForm(form.id)}
                    title="Delete Form"
                    style={{
                      padding: '7px 10px',
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
    </div>
  );
}
