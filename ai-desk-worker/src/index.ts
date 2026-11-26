export interface Env {
  GEMINI_API_KEY: string;
  META_VERIFY_TOKEN: string;
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
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
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
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
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
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inbound_emails`;

    ctx.waitUntil(
      fetch(firestoreUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            to: { stringValue: message.to },
            from: { stringValue: message.from },
            fromName: { stringValue: message.from },
            subject: { stringValue: subject },
            body: { stringValue: bodyMatch.slice(0, 12000) },
            status: { stringValue: 'unread' },
            receivedAt: { timestampValue: new Date().toISOString() },
          },
        }),
      }).catch(() => undefined)
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
    ctx.waitUntil(runJarvisBrain(env, true));
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
          cron: ['10:00 AM IST', '07:00 PM IST'],
          channels: {
            gemini: Boolean(env.GEMINI_API_KEY),
            whatsapp: Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID),
            facebook: Boolean(env.META_PAGE_TOKEN && env.META_PAGE_ID),
            instagram: Boolean(env.META_PAGE_TOKEN && env.IG_USER_ID),
          },
        },
        200,
        origin
      );
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
        const { demandQueries } = await fetchFirestoreContext(projectId);
        const actions: Array<unknown> = [];

        for (const entry of payload.entry || []) {
          for (const change of entry.changes || []) {
            for (const msg of change.value?.messages || []) {
              if (msg.from && msg.text?.body) {
                const norm = normalizePhone(msg.from);
                const matches = demandQueries.filter((q) => q.userPhone === norm);
                const crossNote =
                  matches.length > 0
                    ? `User also has open App Support ticket(s): ${matches.map((m) => m.subject).join(', ')}. Acknowledge so there is no confusion.`
                    : '';
                const aiReply = await callGemini(
                  env.GEMINI_API_KEY,
                  `Channel: WhatsApp\n${crossNote}\nCustomer Message: "${msg.text.body}"\nReply concisely:`
                );
                const sent = await sendWhatsAppMessage(env, msg.from, aiReply);
                actions.push({ type: 'whatsapp_auto_reply', to: msg.from, crossMatched: matches.length > 0, aiReply, sent });
              }
            }
            if (change.value?.comment_id && change.value?.text) {
              const lowerComment = change.value.text.toLowerCase();
              const matchedKeyword = COMMENT_DM_KEYWORDS.find((kw) => lowerComment.includes(kw));

              if (matchedKeyword) {
                const publicReply = 'Check your DM! Humne booking link & pass details bhej di hain.';
                const dmText = await callGemini(
                  env.GEMINI_API_KEY,
                  `User commented "${change.value.text}" on Instagram/Facebook (keyword: ${matchedKeyword}). Write a warm 2-line DM with direct booking link https://jhoomo.in and remind them M-Tickets use live QR inside the JHOOMO app.`
                );
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
                const aiReply = await callGemini(
                  env.GEMINI_API_KEY,
                  `Channel: ${payload.object || 'Instagram'} Comment\nComment: "${change.value.text}"\nReply warmly in 1-2 short sentences:`
                );
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
        }
        return json({ received: true, actions }, 200, origin);
      } catch (err) {
        return json({ error: (err as Error).message }, 500, origin);
      }
    }

    return json({ error: 'Not found' }, 404, origin);
  },
};
