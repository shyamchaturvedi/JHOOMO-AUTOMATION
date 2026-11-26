export interface Env {
  GEMINI_API_KEY: string;
  META_VERIFY_TOKEN: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  FIREBASE_PROJECT_ID?: string;
  META_PAGE_TOKEN?: string;
  META_PAGE_ID?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  IG_USER_ID?: string;
  MSG91_AUTH_KEY?: string;
  MSG91_SENDER_ID?: string;
  FIREBASE_INBOUND_EMAIL_URL?: string;
  CLOUDFLARE_EMAIL_SECRET?: string;
  FORWARD_EMAIL?: string;
  ALLOWED_ORIGIN?: string;
}

const JHOOMO_SYSTEM_PROMPT = `You are JHOOMO JARVIS — an autonomous senior support, cross-channel identity, and social growth AI.
Rules:
1. Keep replies warm, concise, helpful, and in the user's language (English or natural Hinglish).
2. JHOOMO Policy: Passes are non-refundable once booked. Refunds apply ONLY if the event is cancelled or rescheduled by the organizer (processed in 5-7 business days). Platform convenience fees are non-refundable. JHOOMO acts solely as a ticketing intermediary.
3. Gate Entry: M-Ticket uses a dynamic 30-second rotating QR code inside the JHOOMO app (screenshots are invalid).
4. Cross-Channel Awareness: If cross-channel history is provided (e.g. user already messaged on WhatsApp and also on Instagram), acknowledge it smoothly so the user has zero confusion and never gets contradictory answers.
5. Never invent booking IDs, refund approvals, or promises outside policy.`;

function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data: unknown, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const models = [
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ];
  let lastError = 'Gemini request failed';

  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${JHOOMO_SYSTEM_PROMPT}\n\n${prompt}` }] }],
        }),
      }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }
    lastError = `Gemini error ${res.status}: ${await res.text()}`;
    if (res.status === 401 || res.status === 403) {
      throw new Error(lastError);
    }
  }
  throw new Error(lastError);
}

function normalizePhone(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

async function sendWhatsAppMessage(env: Env, to: string, text: string) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) {
    return { sent: false, reason: 'WHATSAPP_TOKEN or WHATSAPP_PHONE_ID not configured' };
  }
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  );
  const body = await res.json();
  return { sent: res.ok, status: res.status, body };
}

async function publishToFacebook(env: Env, message: string, imageUrl?: string) {
  if (!env.META_PAGE_TOKEN || !env.META_PAGE_ID) {
    return { published: false, reason: 'META_PAGE_TOKEN or META_PAGE_ID not configured' };
  }
  const endpoint = imageUrl
    ? `https://graph.facebook.com/v21.0/${env.META_PAGE_ID}/photos`
    : `https://graph.facebook.com/v21.0/${env.META_PAGE_ID}/feed`;
  const payload = imageUrl
    ? { url: imageUrl, caption: message, access_token: env.META_PAGE_TOKEN }
    : { message, access_token: env.META_PAGE_TOKEN };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  return { published: res.ok, status: res.status, body };
}

async function publishToInstagram(env: Env, caption: string, imageUrl?: string) {
  if (!env.META_PAGE_TOKEN || !env.IG_USER_ID) {
    return { published: false, reason: 'META_PAGE_TOKEN or IG_USER_ID not configured' };
  }
  if (!imageUrl) {
    return { published: false, reason: 'Instagram requires a public imageUrl for feed posts' };
  }
  const createRes = await fetch(
    `https://graph.facebook.com/v21.0/${env.IG_USER_ID}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: env.META_PAGE_TOKEN,
      }),
    }
  );
  const createData = (await createRes.json()) as { id?: string; error?: unknown };
  if (!createRes.ok || !createData.id) {
    return { published: false, step: 'create_container', body: createData };
  }
  const pubRes = await fetch(
    `https://graph.facebook.com/v21.0/${env.IG_USER_ID}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: createData.id,
        access_token: env.META_PAGE_TOKEN,
      }),
    }
  );
  const pubData = await pubRes.json();
  return { published: pubRes.ok, status: pubRes.status, body: pubData };
}

async function likeAndReplyMetaComment(env: Env, commentId: string, message: string) {
  if (!env.META_PAGE_TOKEN) {
    return { liked: false, replied: false, reason: 'META_PAGE_TOKEN not configured' };
  }
  const [likeRes, replyRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v21.0/${commentId}/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: env.META_PAGE_TOKEN }),
    }),
    fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: env.META_PAGE_TOKEN }),
    }),
  ]);
  return {
    liked: likeRes.ok,
    replied: replyRes.ok,
    replyBody: await replyRes.json(),
  };
}

const COMMENT_DM_KEYWORDS = ['pass', 'ticket', 'link', 'price', 'book', 'venue', 'timing'];

async function sendInstagramCommentDM(env: Env, commentId: string, text: string) {
  if (!env.META_PAGE_TOKEN || !env.IG_USER_ID) {
    return { dmSent: false, reason: 'META_PAGE_TOKEN or IG_USER_ID not configured' };
  }
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${env.IG_USER_ID}/messages?access_token=${encodeURIComponent(env.META_PAGE_TOKEN)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text },
      }),
    }
  );
  return { dmSent: res.ok, status: res.status, body: await res.json() };
}

async function fetchRecentMetaInsights(env: Env) {
  if (!env.META_PAGE_TOKEN || !env.IG_USER_ID) {
    return {
      source: 'fallback',
      posts: [],
      summary: 'Meta IG_USER_ID/META_PAGE_TOKEN not connected yet; using audience demand signals.',
    };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${env.IG_USER_ID}/media?fields=id,caption,like_count,comments_count,timestamp,media_type&limit=10&access_token=${env.META_PAGE_TOKEN}`
    );
    if (!res.ok) return { source: 'error', posts: [], summary: `Meta API ${res.status}` };
    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        caption?: string;
        like_count?: number;
        comments_count?: number;
        timestamp?: string;
      }>;
    };
    return {
      source: 'instagram_live',
      posts: data.data || [],
      summary: `Analyzed ${(data.data || []).length} recent Instagram posts.`,
    };
  } catch (e) {
    return { source: 'error', posts: [], summary: (e as Error).message };
  }
}

async function fetchFirestoreContext(projectId: string) {
  try {
    const [eventsRes, ticketsRes] = await Promise.all([
      fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/events?pageSize=10`
      ),
      fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/support_tickets?pageSize=20`
      ),
    ]);

    const eventsJson = eventsRes.ok
      ? ((await eventsRes.json()) as {
          documents?: Array<{ fields?: Record<string, { stringValue?: string }> }>;
        })
      : { documents: [] };

    const ticketsJson = ticketsRes.ok
      ? ((await ticketsRes.json()) as {
          documents?: Array<{ fields?: Record<string, { stringValue?: string }> }>;
        })
      : { documents: [] };

    const events = (eventsJson.documents || []).map((d) => ({
      title: d.fields?.title?.stringValue || 'JHOOMO Live Event',
      city: d.fields?.city?.stringValue || 'India',
      date: d.fields?.date?.stringValue || 'This Weekend',
      category: d.fields?.category?.stringValue || 'Events',
      imageUrl: d.fields?.imageUrl?.stringValue || d.fields?.image_url?.stringValue || '',
    }));

    const demandQueries = (ticketsJson.documents || []).map((d) => ({
      userName: d.fields?.userName?.stringValue || '',
      userPhone: normalizePhone(d.fields?.userPhone?.stringValue),
      subject: d.fields?.subject?.stringValue || '',
      description: d.fields?.description?.stringValue || '',
    }));

    return { events, demandQueries };
  } catch {
    return { events: [], demandQueries: [] };
  }
}

interface AutopilotConfig {
  masterEnabled: boolean;
  supportReplies: boolean;
  commentToDm: boolean;
  emailAutoReply: boolean;
  socialAutoPost: boolean;
  escalationKeywords: string[];
}

const DEFAULT_AUTOPILOT: AutopilotConfig = {
  masterEnabled: true,
  supportReplies: true,
  commentToDm: true,
  emailAutoReply: true,
  socialAutoPost: true,
  escalationKeywords: ['refund', 'upi', 'payment', 'fraud', 'cancel', 'urgent', 'legal'],
};

function firestoreBase(projectId: string) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function decodeValue(value: Record<string, unknown>): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) {
    const values = (value.arrayValue as { values?: unknown[] })?.values || [];
    return values.map((item) => decodeValue(item as Record<string, unknown>));
  }
  if ('mapValue' in value) {
    const fields = (value.mapValue as { fields?: Record<string, unknown> })?.fields || {};
    return decodeFields(fields);
  }
  return undefined;
}

function decodeFields(fields: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    output[key] = decodeValue(value as Record<string, unknown>);
  }
  return output;
}

function encodeValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  return { stringValue: String(value) };
}

function encodeFields(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) fields[key] = encodeValue(value);
  return fields;
}

async function getFirestoreDoc(projectId: string, path: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${firestoreBase(projectId)}/${path}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { fields?: Record<string, unknown> };
    return decodeFields(data.fields);
  } catch {
    return null;
  }
}

async function setFirestoreDoc(
  projectId: string,
  path: string,
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    const params = new URLSearchParams();
    for (const key of Object.keys(data)) params.append('updateMask.fieldPaths', key);
    const res = await fetch(`${firestoreBase(projectId)}/${path}?${params.toString()}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: encodeFields(data) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function listFirestore(
  projectId: string,
  collectionName: string,
  pageSize = 50
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  try {
    const res = await fetch(`${firestoreBase(projectId)}/${collectionName}?pageSize=${pageSize}`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      documents?: Array<{ name?: string; fields?: Record<string, unknown> }>;
    };
    return (data.documents || []).map((doc) => ({
      id: doc.name?.split('/').pop() || '',
      data: decodeFields(doc.fields),
    }));
  } catch {
    return [];
  }
}

async function getAutopilotConfig(env: Env): Promise<AutopilotConfig> {
  const projectId = env.FIREBASE_PROJECT_ID || 'milo-da65c';
  const stored = await getFirestoreDoc(projectId, 'system_settings/autopilot');
  if (!stored) return { ...DEFAULT_AUTOPILOT };
  return {
    masterEnabled:
      typeof stored.masterEnabled === 'boolean' ? stored.masterEnabled : DEFAULT_AUTOPILOT.masterEnabled,
    supportReplies:
      typeof stored.supportReplies === 'boolean' ? stored.supportReplies : DEFAULT_AUTOPILOT.supportReplies,
    commentToDm:
      typeof stored.commentToDm === 'boolean' ? stored.commentToDm : DEFAULT_AUTOPILOT.commentToDm,
    emailAutoReply:
      typeof stored.emailAutoReply === 'boolean' ? stored.emailAutoReply : DEFAULT_AUTOPILOT.emailAutoReply,
    socialAutoPost:
      typeof stored.socialAutoPost === 'boolean' ? stored.socialAutoPost : DEFAULT_AUTOPILOT.socialAutoPost,
    escalationKeywords: Array.isArray(stored.escalationKeywords)
      ? (stored.escalationKeywords as string[])
      : DEFAULT_AUTOPILOT.escalationKeywords,
  };
}

async function eventFingerprint(input: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash))
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function istNow() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

function istDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

async function autoReplySupportTickets(env: Env, config: AutopilotConfig) {
  const projectId = env.FIREBASE_PROJECT_ID || 'milo-da65c';
  const [appTickets, socialThreads] = await Promise.all([
    listFirestore(projectId, 'support_tickets', 50),
    listFirestore(projectId, 'omnibox_threads', 50),
  ]);
  const targets = [
    ...appTickets.map((item) => ({ ...item, collectionName: 'support_tickets' })),
    ...socialThreads.map((item) => ({ ...item, collectionName: 'omnibox_threads' })),
  ];
  const actions: Array<Record<string, unknown>> = [];

  for (const target of targets) {
    const ticket = target.data;
    const status = String(ticket.status || 'open').toLowerCase();
    if (status !== 'open' && status !== 'in_progress') continue;
    if (ticket.aiAutoRepliedAt) continue;
    const messages = Array.isArray(ticket.messages)
      ? (ticket.messages as Array<Record<string, unknown>>)
      : [];
    if (messages.some((m) => m?.senderType === 'admin' || m?.senderType === 'agent')) continue;
    const lastUserMessage = [...messages].reverse().find((m) => m?.senderType !== 'admin');
    const message = String(lastUserMessage?.text || ticket.description || '').trim();
    if (!message) continue;

    const combined = `${String(ticket.subject || '')} ${message}`;
    const escalation = config.escalationKeywords.some((keyword) =>
      new RegExp(`\\b${keyword.replace(/[^a-z]/gi, '')}\\b`, 'i').test(combined)
    );

    let reply = '';
    try {
      reply = await callGemini(
        env.GEMINI_API_KEY,
        `Channel: ${String(ticket.channel || 'App Support')}\nCustomer: ${String(ticket.userName || 'Guest')}\nSubject: ${String(ticket.subject || 'General Query')}\nCustomer Message: "${message}"\nWrite the exact warm, concise reply ready to send. Do not invent booking IDs or approvals.`
      );
    } catch {
      continue;
    }
    if (!reply) continue;
    if (escalation) {
      reply += '\n\nI have also flagged this to our JHOOMO support team for a quick human check.';
    }

    const nextMessages = [
      ...messages,
      {
        senderId: 'jhoomo-ai-autopilot',
        senderType: 'admin',
        text: reply,
        createdAt: new Date().toISOString(),
      },
    ];
    const saved = await setFirestoreDoc(projectId, `${target.collectionName}/${target.id}`, {
      messages: nextMessages,
      status: 'in_progress',
      aiAutoRepliedAt: new Date().toISOString(),
      handledBy: 'jarvis-autopilot',
      needsHuman: escalation,
      updatedAt: new Date().toISOString(),
    });

    if (saved && target.collectionName === 'support_tickets') {
      await setFirestoreDoc(projectId, `supportTickets/${target.id}`, {
        messages: nextMessages,
        status: 'in_progress',
        aiAutoRepliedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    if (saved && escalation) {
      await setFirestoreDoc(projectId, `admin_alerts/${target.id}`, {
        type: 'human_review_needed',
        channel: String(ticket.channel || 'app'),
        ticketId: target.id,
        subject: String(ticket.subject || 'Support query'),
        customer: String(ticket.userName || 'Guest'),
        reason: combined.slice(0, 500),
        status: 'open',
        createdAt: new Date().toISOString(),
      });
    }
    actions.push({
      type: 'support_auto_reply',
      id: target.id,
      channel: String(ticket.channel || 'app'),
      escalation,
      sent: saved,
    });
  }
  return actions;
}

async function autoReplyInboundEmails(
  env: Env,
  config: AutopilotConfig,
  provided?: Array<{ id: string; data: Record<string, unknown> }>
) {
  const projectId = env.FIREBASE_PROJECT_ID || 'milo-da65c';
  const emails = provided || (await listFirestore(projectId, 'inbound_emails', 30));
  const actions: Array<Record<string, unknown>> = [];
  if (!env.RESEND_API_KEY) {
    return [{ type: 'email_auto_reply', sent: false, reason: 'RESEND_API_KEY not configured' }];
  }

  for (const item of emails) {
    const mail = item.data;
    if (mail.aiAutoRepliedAt || String(mail.status || 'unread') === 'replied') continue;
    if (mail.lastAttemptAt && Date.now() - Date.parse(String(mail.lastAttemptAt)) < 10 * 60 * 1000) {
      continue;
    }
    const to = String(mail.from || '').trim();
    if (!to || !to.includes('@')) continue;
    const subject = String(mail.subject || '(No Subject)');
    const body = String(mail.body || '').slice(0, 6000);

    let reply = '';
    try {
      reply = await callGemini(
        env.GEMINI_API_KEY,
        `Channel: Email\nSubject: ${subject}\nCustomer: ${to}\nMessage: "${body}"\nWrite the exact warm, concise support reply ready to send. Do not invent booking IDs or approvals.`
      );
    } catch {
      continue;
    }
    if (!reply) continue;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || 'JHOOMO <support@jhoomo.in>',
        to: [to],
        subject: `Re: ${subject}`,
        html: reply
          .split('\n\n')
          .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
          .join(''),
      }),
    });
    const sent = res.ok;
    await setFirestoreDoc(projectId, `inbound_emails/${item.id}`, {
      status: sent ? 'replied' : 'unread',
      aiAutoRepliedAt: sent ? new Date().toISOString() : '',
      aiReply: reply,
      handledBy: 'jarvis-autopilot',
      lastAttemptAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    actions.push({ type: 'email_auto_reply', id: item.id, to, sent, status: res.status });
  }
  return actions;
}

async function maybeAutoSocialPost(env: Env, config: AutopilotConfig) {
  if (!config.socialAutoPost) return null;
  const now = istNow();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const inWindow = (hour === 10 || hour === 19) && minute < 40;
  if (!inWindow) return null;

  const projectId = env.FIREBASE_PROJECT_ID || 'milo-da65c';
  const today = istDateKey(now);
  const state = await getFirestoreDoc(projectId, 'autopilot_state/daily_social_post');
  if (state?.lastDate === today) return null;

  let result: Record<string, unknown>;
  try {
    result = await runJarvisBrain(env, true);
  } catch (err) {
    return { type: 'social_auto_post', published: false, error: (err as Error).message };
  }
  const strategy = (result.strategy || {}) as Record<string, unknown>;
  const event = (result.event || {}) as Record<string, unknown>;
  const hashtags = Array.isArray(strategy.hashtags) ? (strategy.hashtags as string[]) : ['#JHOOMO'];
  const saved = await setFirestoreDoc(projectId, `social_autoposts/auto_${Date.now()}`, {
    eventTitle: String(event.title || 'JHOOMO Live Event'),
    city: String(event.city || 'India'),
    platform: 'Instagram & Facebook',
    caption: String(strategy.caption || ''),
    hashtags,
    imageUrl: String(event.imageUrl || ''),
    scheduledFor: now.toISOString(),
    status: 'published',
    likes: 0,
    comments: 0,
    views: 0,
    source: 'jarvis-autopilot',
    createdAt: new Date().toISOString(),
  });
  await setFirestoreDoc(projectId, 'autopilot_state/daily_social_post', { lastDate: today, ranAt: new Date().toISOString() });
  return {
    type: 'social_auto_post',
    published: true,
    saved,
    publishResults: result.publishResults || null,
    scheduledForIST: `${hour}:${String(minute).padStart(2, '0')} IST`,
  };
}

async function runAutopilotCycle(env: Env, allowPublish = false) {
  const projectId = env.FIREBASE_PROJECT_ID || 'milo-da65c';
  const config = await getAutopilotConfig(env);
  const ranAt = new Date().toISOString();
  if (!config.masterEnabled) {
    return { ok: true, skipped: true, reason: 'Automation Engine is OFF', actions: [], config, ranAt };
  }

  const actions: Array<unknown> = [];
  if (config.supportReplies) {
    actions.push(...(await autoReplySupportTickets(env, config)));
  }
  if (config.emailAutoReply) {
    actions.push(...(await autoReplyInboundEmails(env, config)));
  }
  if (allowPublish) {
    const social = await maybeAutoSocialPost(env, config);
    if (social) actions.push(social);
  }

  const summary = { ok: true, skipped: false, actions, count: actions.length, config, ranAt };
  await setFirestoreDoc(projectId, 'autopilot_state/last_run', {
    ranAt,
    actionCount: actions.length,
    summary: JSON.stringify(actions).slice(0, 8000),
    engine: 'jarvis-autopilot',
  });
  return summary;
}

async function runJarvisBrain(env: Env, autoPublish = false) {
  const projectId = env.FIREBASE_PROJECT_ID || 'milo-da65c';
  const [{ events, demandQueries }, insights] = await Promise.all([
    fetchFirestoreContext(projectId),
    fetchRecentMetaInsights(env),
  ]);

  const targetEvent = events[0] || {
    title: 'JHOOMO Live Shows & Weekend Passes',
    city: 'India',
    date: 'This Weekend',
    category: 'Live Events',
    imageUrl: '',
  };

  const prompt = `You are JHOOMO JARVIS Growth & Automation Brain.
Analyze:
1. Past Post Performance (${insights.source}): ${JSON.stringify(insights.posts.slice(0, 5))}
2. Recent Customer Demand / Questions: ${JSON.stringify(demandQueries.slice(0, 8))}
3. Upcoming Event to Promote: ${JSON.stringify(targetEvent)}

Decide the optimal next social post that IMPROVES upon previous posts (higher views, likes, comments, saves) and targets current audience demand.
Return ONLY valid JSON with keys:
- bestPostingHourIST (string, e.g. "7:30 PM IST")
- audienceDemandSummary (string, 1-2 sentences)
- improvementOverPrevious (string, what changed vs previous posts)
- targetInterest (string)
- caption (string, punchy Hinglish+English hook + CTA)
- hashtags (array of 6-8 strings)
- commentAutoReply (string, friendly reply when someone comments)`;

  const raw = await callGemini(env.GEMINI_API_KEY, prompt);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let strategy: Record<string, unknown> = {
    bestPostingHourIST: '7:00 PM IST',
    audienceDemandSummary: 'High interest in weekend live events & instant QR entry.',
    improvementOverPrevious: 'Stronger 1-line hook + clear city & price CTA.',
    targetInterest: targetEvent.category,
    caption: cleaned,
    hashtags: ['#JHOOMO', '#LiveEvents', '#WeekendVibes'],
    commentAutoReply: 'Passes are live on the JHOOMO app! Tap link in bio to book.',
  };

  try {
    strategy = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // keep fallback parsed structure
  }

  let publishResults: Record<string, unknown> | null = null;
  if (autoPublish) {
    const hashtags = Array.isArray(strategy.hashtags)
      ? (strategy.hashtags as string[]).join(' ')
      : '#JHOOMO';
    const fullPost = `${strategy.caption || ''}\n\n${hashtags}`;
    const [fb, ig] = await Promise.all([
      publishToFacebook(env, fullPost, targetEvent.imageUrl || undefined),
      publishToInstagram(env, fullPost, targetEvent.imageUrl || undefined),
    ]);
    publishResults = { facebook: fb, instagram: ig };
  }

  return {
    event: targetEvent,
    insightsSummary: insights.summary,
    demandSignalsAnalyzed: demandQueries.length,
    strategy,
    publishResults,
    ranAt: new Date().toISOString(),
  };
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    const rawText = await new Response(message.raw).text();
    const bodyMatch = rawText.split(/\r?\n\r?\n/).slice(1).join('\n\n').trim();
    const subject = message.headers.get('subject') || '(No Subject)';
    const projectId = env.FIREBASE_PROJECT_ID || 'milo-da65c';
    const mailId = await eventFingerprint(
      `${message.from}:${subject}:${message.headers.get('message-id') || bodyMatch.slice(0, 200)}`
    );
    const mailData: Record<string, unknown> = {
      to: message.to,
      from: message.from,
      fromName: message.from,
      subject,
      body: bodyMatch.slice(0, 12000),
      status: 'unread',
      receivedAt: new Date().toISOString(),
    };
    const storePromise = setFirestoreDoc(projectId, `inbound_emails/${mailId}`, mailData);

    ctx.waitUntil(
      (async () => {
        await storePromise;
        const config = await getAutopilotConfig(env);
        if (config.masterEnabled && config.emailAutoReply) {
          await autoReplyInboundEmails(env, config, [{ id: mailId, data: mailData }]);
        }
      })()
    );

    const forwardMap: Record<string, string> = {
      'tickets@jhoomo.in': 'info.aroventech@gmail.com',
      'admin@jhoomo.in': 'info.aroventech@gmail.com',
      'organizer@jhoomo.in': 'iammshyam@gmail.com',
      'careers@jhoomo.in': 'iammshyam@gmail.com',
      'support@jhoomo.in': 'pandaydivyanshu093@gmail.com',
    };
    const forwardTarget = env.FORWARD_EMAIL || forwardMap[message.to.toLowerCase()];
    if (forwardTarget) {
      await message.forward(forwardTarget);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runAutopilotCycle(env, true));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/health') {
      return json(
        {
          ok: true,
          service: 'jhoomo-jarvis-worker',
          cron: ['every 5 minutes', '10:00 AM IST', '07:00 PM IST'],
          channels: {
            gemini: Boolean(env.GEMINI_API_KEY),
            whatsapp: Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID),
            facebook: Boolean(env.META_PAGE_TOKEN && env.META_PAGE_ID),
            instagram: Boolean(env.META_PAGE_TOKEN && env.IG_USER_ID),
            email: Boolean(env.RESEND_API_KEY),
          },
          autopilot: await getAutopilotConfig(env),
        },
        200,
        origin
      );
    }

    if (url.pathname === '/api/autopilot/status' && request.method === 'GET') {
      try {
        const projectId = env.FIREBASE_PROJECT_ID || 'milo-da65c';
        const config = await getAutopilotConfig(env);
        const lastRun = await getFirestoreDoc(projectId, 'autopilot_state/last_run');
        return json({ ok: true, config, lastRun }, 200, origin);
      } catch (err) {
        return json({ error: (err as Error).message }, 500, origin);
      }
    }

    if (url.pathname === '/api/autopilot/config' && request.method === 'POST') {
      try {
        const body = (await request.json()) as Partial<AutopilotConfig>;
        const current = await getAutopilotConfig(env);
        const config: AutopilotConfig = {
          masterEnabled:
            typeof body.masterEnabled === 'boolean' ? body.masterEnabled : current.masterEnabled,
          supportReplies:
            typeof body.supportReplies === 'boolean' ? body.supportReplies : current.supportReplies,
          commentToDm: typeof body.commentToDm === 'boolean' ? body.commentToDm : current.commentToDm,
          emailAutoReply:
            typeof body.emailAutoReply === 'boolean' ? body.emailAutoReply : current.emailAutoReply,
          socialAutoPost:
            typeof body.socialAutoPost === 'boolean' ? body.socialAutoPost : current.socialAutoPost,
          escalationKeywords: Array.isArray(body.escalationKeywords)
            ? body.escalationKeywords
            : current.escalationKeywords,
        };
        const projectId = env.FIREBASE_PROJECT_ID || 'milo-da65c';
        const saved = await setFirestoreDoc(projectId, 'system_settings/autopilot', {
          ...config,
          updatedAt: new Date().toISOString(),
        });
        return json({ ok: saved, config }, saved ? 200 : 500, origin);
      } catch (err) {
        return json({ error: (err as Error).message }, 500, origin);
      }
    }

    if (url.pathname === '/api/autopilot/run' && request.method === 'POST') {
      try {
        const result = await runAutopilotCycle(env, true);
        return json(result, 200, origin);
      } catch (err) {
        return json({ error: (err as Error).message }, 500, origin);
      }
    }

    // 1. Cross-Channel Identity & Confusion Resolver + AI Draft
    if (url.pathname === '/api/ai/draft' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          channel?: string;
          customerName?: string;
          customerPhone?: string;
          subject?: string;
          message?: string;
          tone?: string;
          crossChannelContext?: string;
        };
        const projectId = env.FIREBASE_PROJECT_ID || 'milo-da65c';
        let crossContext = body.crossChannelContext || '';
        const normPhone = normalizePhone(body.customerPhone);
        if (!crossContext && normPhone) {
          const { demandQueries } = await fetchFirestoreContext(projectId);
          const matches = demandQueries.filter((q) => q.userPhone === normPhone);
          if (matches.length > 0) {
            crossContext = `Matched ${matches.length} existing ticket(s) for this phone: ${matches
              .map((m) => `${m.subject}: ${m.description}`)
              .join(' | ')}`;
          }
        }

        const prompt = [
          `Channel: ${body.channel || 'App Support'}`,
          `Customer: ${body.customerName || 'Guest'}`,
          `Subject: ${body.subject || 'General Query'}`,
          `Tone: ${body.tone || 'Helpful & crisp'}`,
          crossContext ? `Cross-Channel History: ${crossContext}` : '',
          `Customer Message: "${body.message || ''}"`,
          'Write the exact reply message ready to send (resolve any confusion if they messaged on multiple channels):',
        ]
          .filter(Boolean)
          .join('\n');

        const draft = await callGemini(env.GEMINI_API_KEY, prompt);
        return json({ draft, crossChannelMatched: Boolean(crossContext) }, 200, origin);
      } catch (err) {
        return json({ error: (err as Error).message }, 500, origin);
      }
    }

    // 2. JARVIS Self-Learning Strategy & Auto-Post
    if (url.pathname === '/api/jarvis/analyze-and-post' && request.method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as { autoPublish?: boolean };
        const result = await runJarvisBrain(env, Boolean(body.autoPublish));
        return json({ ok: true, result }, 200, origin);
      } catch (err) {
        return json({ error: (err as Error).message }, 500, origin);
      }
    }

    // 3. AI Social Post Generator
    if (url.pathname === '/api/ai/social-post' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          eventTitle?: string;
          city?: string;
          date?: string;
          platform?: string;
        };
        const prompt = `Create a high-converting ${body.platform || 'Instagram & Facebook'} post for JHOOMO event:
Event: ${body.eventTitle || 'Live Concert'}
City: ${body.city || 'India'}
Date: ${body.date || 'Upcoming'}

Return JSON only with keys: caption, hashtags (array of strings), commentAutoReply (friendly reply telling users to tap the link in bio / JHOOMO app to book).`;

        const raw = await callGemini(env.GEMINI_API_KEY, prompt);
        return json({ raw }, 200, origin);
      } catch (err) {
        return json({ error: (err as Error).message }, 500, origin);
      }
    }

    // 3b. Live Instagram Account & Media Overview
    if (url.pathname === '/api/instagram/overview' && request.method === 'GET') {
      if (!env.META_PAGE_TOKEN || !env.IG_USER_ID) {
        return json(
          {
            connected: false,
            reason: 'META_PAGE_TOKEN or IG_USER_ID not configured',
            profile: null,
            media: [],
          },
          200,
          origin
        );
      }
      try {
        const [profileRes, mediaRes] = await Promise.all([
          fetch(
            `https://graph.facebook.com/v21.0/${env.IG_USER_ID}?fields=username,name,profile_picture_url,followers_count,media_count&access_token=${encodeURIComponent(env.META_PAGE_TOKEN)}`
          ),
          fetch(
            `https://graph.facebook.com/v21.0/${env.IG_USER_ID}/media?fields=id,caption,like_count,comments_count,timestamp,media_type,media_url,thumbnail_url,permalink&limit=24&access_token=${encodeURIComponent(env.META_PAGE_TOKEN)}`
          ),
        ]);
        const profile = profileRes.ok ? await profileRes.json() : null;
        const mediaJson = mediaRes.ok ? ((await mediaRes.json()) as { data?: unknown[] }) : { data: [] };
        return json(
          {
            connected: Boolean(profile),
            profile,
            media: mediaJson.data || [],
          },
          200,
          origin
        );
      } catch (err) {
        return json({ connected: false, error: (err as Error).message, profile: null, media: [] }, 500, origin);
      }
    }

    // 4. Direct Publish to Facebook & Instagram
    if (url.pathname === '/api/social/publish' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          message: string;
          imageUrl?: string;
          platforms?: Array<'facebook' | 'instagram'>;
        };
        const targets = body.platforms || ['facebook', 'instagram'];
        const results: Record<string, unknown> = {};
        if (targets.includes('facebook')) {
          results.facebook = await publishToFacebook(env, body.message, body.imageUrl);
        }
        if (targets.includes('instagram')) {
          results.instagram = await publishToInstagram(env, body.message, body.imageUrl);
        }
        return json({ ok: true, results }, 200, origin);
      } catch (err) {
        return json({ error: (err as Error).message }, 500, origin);
      }
    }

    // 5. Trigger Daily Auto-Post Manually
    if (url.pathname === '/api/automation/run-now' && request.method === 'POST') {
      try {
        const result = await runJarvisBrain(env, true);
        return json({ ok: true, result }, 200, origin);
      } catch (err) {
        return json({ error: (err as Error).message }, 500, origin);
      }
    }

    // 5a. Send Support Email via Resend (JHOOMO Branded Template)
    if (url.pathname === '/api/email/send' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          sender?: string;
          to?: string;
          subject?: string;
          body?: string;
        };
        if (!body.to || !body.subject || !body.body) {
          return json({ error: 'Missing required fields: to, subject, body' }, 400, origin);
        }

        const SENDER_MAP: Record<string, { from: string; senderTitle: string }> = {
          'tickets@jhoomo.in': { from: 'JHOOMO <tickets@jhoomo.in>', senderTitle: 'JHOOMO Ticket Services' },
          'organizer@jhoomo.in': { from: 'JHOOMO Organizer Relations <organizer@jhoomo.in>', senderTitle: 'JHOOMO Organizer Services' },
          'careers@jhoomo.in': { from: 'JHOOMO Careers <careers@jhoomo.in>', senderTitle: 'JHOOMO People Team' },
          'support@jhoomo.in': { from: 'JHOOMO Helpdesk <support@jhoomo.in>', senderTitle: 'JHOOMO Customer Support' },
          'admin@jhoomo.in': { from: 'JHOOMO <admin@jhoomo.in>', senderTitle: 'JHOOMO Corporate Office' },
        };
        const currentSender = SENDER_MAP[body.sender || 'support@jhoomo.in'] || SENDER_MAP['support@jhoomo.in'];
        const formattedContent = String(body.body)
          .split('\n\n')
          .map((p) => `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">${p.replace(/\n/g, '<br/>')}</p>`)
          .join('');

        const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 10px;"><tr><td align="center"><table width="600" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:8px;border:1px solid #E5E7EB;overflow:hidden;"><tr><td height="4" style="background:#E11D48;"></td></tr><tr><td style="padding:24px 32px;border-bottom:1px solid #F3F4F6;"><strong style="font-size:20px;color:#111827;">JHOOMO</strong> <span style="float:right;font-size:13px;color:#6B7280;">${currentSender.senderTitle}</span></td></tr><tr><td style="padding:32px;">${formattedContent}</td></tr></table></td></tr></table></body></html>`;

        const resendKey = env.RESEND_API_KEY;
        if (!resendKey) {
          return json({ ok: false, error: 'RESEND_API_KEY not configured' }, 400, origin);
        }
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: currentSender.from,
            to: [body.to],
            subject: body.subject,
            html,
          }),
        });
        const data = await res.json();
        if (!res.ok) return json({ ok: false, error: data }, res.status, origin);
        return json({ ok: true, data }, 200, origin);
      } catch (err) {
        return json({ ok: false, error: (err as Error).message }, 500, origin);
      }
    }

    // 5b. Send Offer Campaign (WhatsApp + SMS)
    if (url.pathname === '/api/campaigns/send' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          channel: 'whatsapp' | 'sms' | 'both';
          recipients: string[];
          message: string;
        };
        const list = (body.recipients || []).map((r) => r.trim()).filter(Boolean);
        const results: Array<unknown> = [];

        for (const to of list.slice(0, 100)) {
          if (body.channel === 'whatsapp' || body.channel === 'both') {
            const wa = await sendWhatsAppMessage(env, to, body.message);
            results.push({ to, channel: 'whatsapp', ...wa });
          }
          if (body.channel === 'sms' || body.channel === 'both') {
            if (!env.MSG91_AUTH_KEY) {
              results.push({ to, channel: 'sms', sent: false, reason: 'MSG91_AUTH_KEY not configured' });
            } else {
              const smsRes = await fetch('https://control.msg91.com/api/v5/otp', {
                method: 'POST',
                headers: {
                  authkey: env.MSG91_AUTH_KEY,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  sender: env.MSG91_SENDER_ID || 'JHOOMO',
                  mobiles: to.replace(/\D/g, ''),
                  message: body.message,
                }),
              });
              results.push({ to, channel: 'sms', sent: smsRes.ok, status: smsRes.status });
            }
          }
        }
        return json({ ok: true, total: list.length, results }, 200, origin);
      } catch (err) {
        return json({ error: (err as Error).message }, 500, origin);
      }
    }

    // 6. Meta Webhook Verification (WhatsApp, Instagram, Facebook)
    if (url.pathname === '/api/webhooks/meta' && request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
        return new Response(challenge || 'OK', { status: 200 });
      }
      return new Response('Forbidden', { status: 403 });
    }

    // 7. Meta Webhook Autonomous Responder (WhatsApp + IG/FB Comment Like & Reply)
    if (url.pathname === '/api/webhooks/meta' && request.method === 'POST') {
      try {
        const payload = (await request.json()) as {
          object?: string;
          entry?: Array<{
            changes?: Array<{
              field?: string;
              value?: {
                messages?: Array<{ from?: string; text?: { body?: string } }>;
                comment_id?: string;
                text?: string;
              };
            }>;
          }>;
        };

        const projectId = env.FIREBASE_PROJECT_ID || 'milo-da65c';
        const config = await getAutopilotConfig(env);
        if (!config.masterEnabled) {
          return json({ received: true, skipped: true, reason: 'Automation Engine is OFF', actions: [] }, 200, origin);
        }
        const { demandQueries } = await fetchFirestoreContext(projectId);
        const customAutomations = config.commentToDm
          ? (await listFirestore(projectId, 'comment_automations', 50)).filter((a) => a.data.active !== false)
          : [];
        const actions: Array<unknown> = [];

        for (const entry of payload.entry || []) {
          for (const change of entry.changes || []) {
            for (const msg of change.value?.messages || []) {
              if (!msg.from || !msg.text?.body || !config.supportReplies) continue;
              const fingerprint = await eventFingerprint(`wa:${msg.from}:${msg.text.body}`);
              const seen = await getFirestoreDoc(projectId, `webhook_events/${fingerprint}`);
              if (seen?.processedAt) continue;
              await setFirestoreDoc(projectId, `webhook_events/${fingerprint}`, {
                type: 'whatsapp_auto_reply',
                processedAt: new Date().toISOString(),
              });

              const norm = normalizePhone(msg.from);
              const matches = demandQueries.filter((q) => q.userPhone === norm);
              const crossNote =
                matches.length > 0
                  ? `User also has open App Support ticket(s): ${matches.map((m) => m.subject).join(', ')}. Acknowledge so there is no confusion.`
                  : '';
              let aiReply = '';
              try {
                aiReply = await callGemini(
                  env.GEMINI_API_KEY,
                  `Channel: WhatsApp\n${crossNote}\nCustomer Message: "${msg.text.body}"\nReply concisely:`
                );
              } catch {
                continue;
              }
              if (!aiReply) continue;
              const sent = await sendWhatsAppMessage(env, msg.from, aiReply);
              await setFirestoreDoc(projectId, `omnibox_threads/wa_${fingerprint.slice(0, 16)}`, {
                channel: 'whatsapp',
                userName: `+${norm}`,
                userPhone: norm,
                subject: 'WhatsApp Inquiry',
                description: msg.text.body,
                status: 'in_progress',
                handledBy: 'jarvis-autopilot',
                aiAutoRepliedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                messages: [
                  { senderId: norm, senderType: 'user', text: msg.text.body, createdAt: new Date().toISOString() },
                  { senderId: 'jhoomo-ai-autopilot', senderType: 'admin', text: aiReply, createdAt: new Date().toISOString() },
                ],
              });
              actions.push({ type: 'whatsapp_auto_reply', to: msg.from, crossMatched: matches.length > 0, aiReply, sent });
            }
            if (!change.value?.comment_id || !change.value?.text || !config.commentToDm) continue;
            const fingerprint = await eventFingerprint(`cm:${change.value.comment_id}:${change.value.text}`);
            const seen = await getFirestoreDoc(projectId, `webhook_events/${fingerprint}`);
            if (seen?.processedAt) continue;
            await setFirestoreDoc(projectId, `webhook_events/${fingerprint}`, {
              type: 'comment_auto_reply',
              processedAt: new Date().toISOString(),
            });

            const lowerComment = change.value.text.toLowerCase();
            const customMatch = customAutomations.find((a) => {
              const keyword = String(a.data.keyword || '').toLowerCase();
              return keyword.length > 0 && lowerComment.includes(keyword);
            });
            const matchedKeyword = customMatch
              ? String(customMatch.data.keyword || '')
              : COMMENT_DM_KEYWORDS.find((kw) => lowerComment.includes(kw));

            if (matchedKeyword) {
              const publicReply = 'Check your DM! Humne booking link & pass details bhej di hain.';
              let dmText = customMatch ? String(customMatch.data.replyText || '') : '';
              if (!dmText) {
                try {
                  dmText = await callGemini(
                    env.GEMINI_API_KEY,
                    `User commented "${change.value.text}" on Instagram/Facebook (keyword: ${matchedKeyword}). Write a warm 2-line DM with direct booking link https://jhoomo.in and remind them M-Tickets use live QR inside the JHOOMO app.`
                  );
                } catch {
                  continue;
                }
              }
              const [commentRes, dmRes] = await Promise.all([
                likeAndReplyMetaComment(env, change.value.comment_id, publicReply),
                sendInstagramCommentDM(env, change.value.comment_id, dmText),
              ]);
              actions.push({
                type: 'comment_to_dm_triggered',
                keyword: matchedKeyword,
                commentId: change.value.comment_id,
                publicReply,
                dmText,
                ...commentRes,
                ...dmRes,
              });
            } else {
              let aiReply = '';
              try {
                aiReply = await callGemini(
                  env.GEMINI_API_KEY,
                  `Channel: ${payload.object || 'Instagram'} Comment\nComment: "${change.value.text}"\nReply warmly in 1-2 short sentences:`
                );
              } catch {
                continue;
              }
              if (!aiReply) continue;
              const res = await likeAndReplyMetaComment(env, change.value.comment_id, aiReply);
              actions.push({
                type: 'comment_like_and_reply',
                commentId: change.value.comment_id,
                aiReply,
                ...res,
              });
            }
          }
        }
        return json({ received: true, actions }, 200, origin);
      } catch (err) {
        return json({ error: (err as Error).message }, 500, origin);
      }
    }

    return json({ error: 'Not found' }, 404, origin);
  },
};
