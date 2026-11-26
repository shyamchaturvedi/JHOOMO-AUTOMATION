const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const JHOOMO_SYSTEM_PROMPT = `You are JHOOMO's senior AI support & social media assistant.
Rules:
1. Keep replies warm, concise, helpful, and in the user's language (English or natural Hinglish).
2. JHOOMO Policy: Passes are non-refundable once booked. Refunds apply ONLY if the event is cancelled or rescheduled by the organizer (processed in 5-7 business days). Platform convenience fees are non-refundable. JHOOMO acts solely as a ticketing intermediary.
3. Gate Entry: M-Ticket uses a dynamic 30-second rotating QR code inside the JHOOMO app (screenshots are invalid).
4. Never invent booking IDs, refund approvals, or promises outside policy.`;

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-latest',
];

async function callDirectGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('No Worker URL reachable and VITE_GEMINI_API_KEY is missing.');
  }
  let lastError = 'Gemini request failed';
  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY,
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
    lastError = `Gemini error ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      throw new Error(lastError);
    }
  }
  throw new Error(lastError);
}

export async function generateAiDraft(params: {
  channel: string;
  customerName: string;
  subject: string;
  message: string;
  tone: string;
}): Promise<string> {
  if (WORKER_URL) {
    try {
      const res = await fetch(`${WORKER_URL}/api/ai/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const data = (await res.json()) as { draft?: string };
        if (data.draft) return data.draft;
      }
    } catch {
      // Fallback to direct Gemini in local dev
    }
  }

  return callDirectGemini(
    `Channel: ${params.channel}\nCustomer: ${params.customerName}\nSubject: ${params.subject}\nTone: ${params.tone}\nMessage: "${params.message}"\nWrite the exact reply message ready to send:`
  );
}

export async function generateSocialPost(params: {
  eventTitle: string;
  city: string;
  date: string;
  platform: string;
}): Promise<{ caption: string; hashtags: string[]; commentAutoReply: string }> {
  const prompt = `Create a high-converting ${params.platform} post for JHOOMO event:
Event: ${params.eventTitle}
City: ${params.city}
Date: ${params.date}
Return valid JSON only with keys: caption (string), hashtags (array of strings), commentAutoReply (string).`;

  let raw = '';
  if (WORKER_URL) {
    try {
      const res = await fetch(`${WORKER_URL}/api/ai/social-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const data = (await res.json()) as { raw?: string };
        raw = data.raw || '';
      }
    } catch {
      // Fallback to direct Gemini
    }
  }
  if (!raw) {
    raw = await callDirectGemini(prompt);
  }

  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      caption?: string;
      hashtags?: string[];
      commentAutoReply?: string;
    };
    return {
      caption: parsed.caption || cleaned,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : ['#JHOOMO', '#LiveEvents'],
      commentAutoReply:
        parsed.commentAutoReply || 'Passes are live on the JHOOMO app! Tap the link in bio to book.',
    };
  } catch {
    return {
      caption: cleaned,
      hashtags: ['#JHOOMO', '#LiveEvents'],
      commentAutoReply: 'Passes are live on the JHOOMO app! Tap the link in bio to book.',
    };
  }
}

export async function publishToSocial(params: {
  message: string;
  imageUrl?: string;
  platforms: Array<'facebook' | 'instagram'>;
}): Promise<Record<string, unknown>> {
  if (!WORKER_URL) throw new Error('VITE_WORKER_URL not configured');
  const res = await fetch(`${WORKER_URL}/api/social/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return (await res.json()) as Record<string, unknown>;
}

export async function triggerDailyAutoPost(): Promise<Record<string, unknown>> {
  if (!WORKER_URL) throw new Error('VITE_WORKER_URL not configured');
  const res = await fetch(`${WORKER_URL}/api/automation/run-now`, { method: 'POST' });
  return (await res.json()) as Record<string, unknown>;
}

export async function runJarvisStrategy(autoPublish = false): Promise<Record<string, unknown>> {
  if (WORKER_URL) {
    try {
      const res = await fetch(`${WORKER_URL}/api/jarvis/analyze-and-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoPublish }),
      });
      if (res.ok) return (await res.json()) as Record<string, unknown>;
    } catch {
      // fallback to direct Gemini below
    }
  }
  const raw = await callDirectGemini(
    `Analyze JHOOMO live events & audience demand and return JSON with keys: bestPostingHourIST, audienceDemandSummary, improvementOverPrevious, targetInterest, caption, hashtags (array), commentAutoReply.`
  );
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return { ok: true, result: { strategy: JSON.parse(cleaned), insightsSummary: 'Direct Gemini Analysis' } };
  } catch {
    return { ok: true, result: { strategy: { caption: cleaned }, insightsSummary: 'Direct Gemini Analysis' } };
  }
}

export async function generateCampaignCopy(params: {
  offerTitle: string;
  promoCode: string;
  discount: string;
  channel: string;
}): Promise<string> {
  return callDirectGemini(
    `Write a high-converting ${params.channel} offer message for JHOOMO:
Offer: ${params.offerTitle}
Promo Code: ${params.promoCode}
Discount: ${params.discount}
Link: https://jhoomo.in
Keep it under 155 characters if SMS, or punchy 3 lines if WhatsApp. Return only the message text.`
  );
}

export async function dispatchCampaign(params: {
  channel: 'whatsapp' | 'sms' | 'both';
  recipients: string[];
  message: string;
}): Promise<Record<string, unknown>> {
  if (!WORKER_URL) throw new Error('VITE_WORKER_URL not configured');
  const res = await fetch(`${WORKER_URL}/api/campaigns/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return (await res.json()) as Record<string, unknown>;
}

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  timestamp?: string;
  media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
}

export interface InstagramOverview {
  connected: boolean;
  reason?: string;
  profile: {
    username?: string;
    name?: string;
    profile_picture_url?: string;
    followers_count?: number;
    media_count?: number;
  } | null;
  media: InstagramMediaItem[];
}

export async function sendSupportEmail(params: {
  sender: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!WORKER_URL) return { ok: false, error: 'VITE_WORKER_URL not configured' };
  try {
    const res = await fetch(`${WORKER_URL}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as { ok?: boolean; error?: unknown };
    if (!res.ok || !data.ok) {
      return { ok: false, error: typeof data.error === 'string' ? data.error : 'Failed to send email' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function fetchInstagramOverview(): Promise<InstagramOverview | null> {
  if (!WORKER_URL) return null;
  try {
    const res = await fetch(`${WORKER_URL}/api/instagram/overview`);
    if (!res.ok) return null;
    return (await res.json()) as InstagramOverview;
  } catch {
    return null;
  }
}

export async function fetchWorkerHealth(): Promise<{
  ok: boolean;
  cron?: string[];
  channels?: Record<string, boolean>;
} | null> {
  if (!WORKER_URL) return null;
  try {
    const res = await fetch(`${WORKER_URL}/health`);
    if (!res.ok) return null;
    return (await res.json()) as {
      ok: boolean;
      cron?: string[];
      channels?: Record<string, boolean>;
    };
  } catch {
    return null;
  }
}
