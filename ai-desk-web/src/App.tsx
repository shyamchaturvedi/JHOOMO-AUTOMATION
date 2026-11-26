import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Timestamp,
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Bot,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Film,
  Instagram,
  LayoutDashboard,
  Link2,
  LogOut,
  MessageCircle,
  MessageSquare,
  Radio,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Zap,
} from 'lucide-react';
import { auth, db, googleProvider } from './lib/firebase';
import LeadFormsTab from './components/LeadFormsTab';
import DashboardTab from './components/DashboardTab';
import InstagramTab from './components/InstagramTab';
import PostsReelsTab from './components/PostsReelsTab';
import AutomationsTab from './components/AutomationsTab';
import LinkInBioTab from './components/LinkInBioTab';
import BillingTab from './components/BillingTab';
import SettingsTab from './components/SettingsTab';
import {
  dispatchCampaign,
  fetchWorkerHealth,
  generateAiDraft,
  generateCampaignCopy,
  generateSocialPost,
  publishToSocial,
  runJarvisStrategy,
  triggerDailyAutoPost,
} from './lib/ai';

type ChannelType = 'all' | 'app' | 'whatsapp' | 'instagram' | 'facebook';
type TicketStatus = 'open' | 'in_progress' | 'solved' | 'closed';
type ActiveTab = 'dashboard' | 'instagram' | 'posts' | 'automations' | 'link-in-bio' | 'omnibox' | 'jarvis' | 'social' | 'campaigns' | 'forms' | 'channels' | 'billing' | 'settings';

const VALID_TABS: ActiveTab[] = [
  'dashboard',
  'instagram',
  'posts',
  'automations',
  'link-in-bio',
  'omnibox',
  'jarvis',
  'social',
  'campaigns',
  'forms',
  'channels',
  'billing',
  'settings',
];

function getTabFromPath(): ActiveTab {
  const seg = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] as ActiveTab;
  return VALID_TABS.includes(seg) ? seg : 'dashboard';
}

interface TicketMessage {
  senderId?: string;
  senderType?: string;
  text?: string;
  createdAt?: unknown;
}

interface SupportTicket {
  id: string;
  channel: Exclude<ChannelType, 'all'>;
  userId?: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  category?: string;
  subject: string;
  description: string;
  bookingId?: string;
  priority?: string;
  status: TicketStatus;
  createdAtMs: number;
  createdAtLabel: string;
  messages: TicketMessage[];
}

function formatTicketNo(id: string): string {
  const upper = id.toUpperCase();
  if (upper.startsWith('TKT-')) return upper;
  return upper.length > 6 ? `#${upper.substring(0, 6)}` : `#${upper}`;
}

function formatTime(ts: unknown): { ms: number; label: string } {
  if (ts instanceof Timestamp) {
    const d = ts.toDate();
    return {
      ms: d.getTime(),
      label: d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }
  return { ms: Date.now(), label: 'Just now' };
}

function normalizeStatus(raw?: string): TicketStatus {
  const s = (raw || 'open').toLowerCase().trim();
  if (s === 'solved' || s === 'resolved') return 'solved';
  if (s === 'closed') return 'closed';
  if (s === 'in_progress' || s === 'in-progress' || s === 'pending') return 'in_progress';
  return 'open';
}

interface SocialAutoPost {
  id: string;
  eventTitle: string;
  city: string;
  platform: 'Instagram & Facebook' | 'Instagram' | 'Facebook';
  caption: string;
  hashtags: string[];
  imageUrl?: string;
  scheduledFor: string;
  status: 'scheduled' | 'published' | 'draft';
  likes: number;
  comments: number;
  views: number;
}

const STATUS_META: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'OPEN', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.14)' },
  in_progress: { label: 'IN PROGRESS', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.16)' },
  solved: { label: 'SOLVED', color: '#34d399', bg: 'rgba(16, 185, 129, 0.14)' },
  closed: { label: 'CLOSED', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.14)' },
};

const QUICK_MACROS = [
  {
    title: 'Non-Refundable Policy',
    text: 'As per JHOOMO policy, booked passes are non-refundable unless the event is cancelled or rescheduled by the organizer. Let us know if you need any other help!',
  },
  {
    title: 'Dynamic 30s QR Entry',
    text: 'Your M-Ticket uses a live QR code that refreshes every 30 seconds inside the JHOOMO app under My Tickets. Please present the live app screen at the venue gate (screenshots are not valid).',
  },
  {
    title: 'Cancelled Event Refund',
    text: 'If the organizer cancels or reschedules the event, eligible pass refunds are processed back to your original payment method within 5–7 business days.',
  },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>(getTabFromPath);

  const navigateTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const nextPath = `/${tab}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  };

  useEffect(() => {
    const onPopState = () => setActiveTab(getTabFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Omnibox state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialAutoPost[]>([]);
  const [channelFilter, setChannelFilter] = useState<ChannelType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [aiTone, setAiTone] = useState<'Helpful Hinglish' | 'Professional English' | 'Short & Crisp'>('Helpful Hinglish');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Social Studio state
  const [socialEvent, setSocialEvent] = useState('JHOOMO Live Comedy & Music Night');
  const [socialCity, setSocialCity] = useState('Lucknow');
  const [socialDate, setSocialDate] = useState('This Saturday, 7:00 PM');
  const [socialImageUrl, setSocialImageUrl] = useState('');
  const [socialPlatform, setSocialPlatform] = useState('Instagram Reel & Facebook Post');
  const [socialLoading, setSocialLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishLog, setPublishLog] = useState<string | null>(null);
  const [workerHealth, setWorkerHealth] = useState<{
    ok: boolean;
    cron?: string[];
    channels?: Record<string, boolean>;
  } | null>(null);
  const [jarvisLoading, setJarvisLoading] = useState(false);
  const [jarvisReport, setJarvisReport] = useState<Record<string, unknown> | null>(null);
  const [campOffer, setCampOffer] = useState('Weekend Comedy & Live Show Pass');
  const [campCode, setCampCode] = useState('JHOOMO20');
  const [campDiscount, setCampDiscount] = useState('20% OFF');
  const [campChannel, setCampChannel] = useState<'whatsapp' | 'sms' | 'both'>('both');
  const [campPhones, setCampPhones] = useState('');
  const [campMessage, setCampMessage] = useState('');
  const [campLoading, setCampLoading] = useState(false);
  const [campLog, setCampLog] = useState<string | null>(null);
  const [socialResult, setSocialResult] = useState<{
    caption: string;
    hashtags: string[];
    commentAutoReply: string;
  } | null>(null);

  useEffect(() => {
    fetchWorkerHealth().then(setWorkerHealth);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let appTickets: SupportTicket[] = [];
    let socialThreads: SupportTicket[] = [];

    const mergeAndSet = () => {
      const merged = [...appTickets, ...socialThreads].sort(
        (a, b) => b.createdAtMs - a.createdAtMs
      );
      setTickets(merged);
      setSelectedId((prev) => prev || merged[0]?.id || null);
    };

    const mapDoc = (d: { id: string; data: () => Record<string, unknown> }, fallbackChannel: SupportTicket['channel']): SupportTicket => {
      const data = d.data();
      const t = formatTime(data.createdAt);
      const rawChannel = (data.channel as string) || fallbackChannel;
      const channel: SupportTicket['channel'] =
        rawChannel === 'whatsapp' || rawChannel === 'instagram' || rawChannel === 'facebook'
          ? rawChannel
          : fallbackChannel;
      const msgs = Array.isArray(data.messages) ? (data.messages as TicketMessage[]) : [];
      return {
        id: d.id,
        channel,
        userId: data.userId?.toString(),
        userName: data.userName?.toString() || 'JHOOMO Guest',
        userEmail: data.userEmail?.toString() || '',
        userPhone: data.userPhone?.toString() || '',
        category: data.category?.toString() || 'Support',
        subject: data.subject?.toString() || data.category?.toString() || 'Support Query',
        description: data.description?.toString() || '',
        bookingId: data.bookingId?.toString() || '',
        priority: data.priority?.toString() || 'normal',
        status: normalizeStatus(data.status?.toString()),
        createdAtMs: t.ms,
        createdAtLabel: t.label,
        messages: msgs,
      };
    };

    const unsubTickets = onSnapshot(
      collection(db, 'support_tickets'),
      (snap) => {
        appTickets = snap.docs.map((d) => mapDoc(d, 'app'));
        mergeAndSet();
      },
      (err) => showToast(`Firestore read notice: ${err.message}`)
    );

    const unsubOmnibox = onSnapshot(collection(db, 'omnibox_threads'), (snap) => {
      socialThreads = snap.docs.map((d) => mapDoc(d, 'whatsapp'));
      mergeAndSet();
    });

    const unsubPosts = onSnapshot(collection(db, 'social_autoposts'), (snap) => {
      const list: SocialAutoPost[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          eventTitle: data.eventTitle?.toString() || 'JHOOMO Event',
          city: data.city?.toString() || 'India',
          platform: (data.platform as SocialAutoPost['platform']) || 'Instagram & Facebook',
          caption: data.caption?.toString() || '',
          hashtags: Array.isArray(data.hashtags) ? (data.hashtags as string[]) : ['#JHOOMO'],
          imageUrl: data.imageUrl?.toString() || '',
          scheduledFor: data.scheduledFor?.toString() || 'Daily 10:00 AM / 7:00 PM IST',
          status: (data.status as SocialAutoPost['status']) || 'scheduled',
          likes: Number(data.likes || 0),
          comments: Number(data.comments || 0),
          views: Number(data.views || 0),
        };
      });
      setSocialPosts(list);
    });

    return () => {
      unsubTickets();
      unsubOmnibox();
      unsubPosts();
    };
  }, [user]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (channelFilter !== 'all' && t.channel !== channelFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${t.id} ${t.userName} ${t.subject} ${t.description} ${t.bookingId || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, channelFilter, statusFilter, search]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedId) || filteredTickets[0] || null,
    [tickets, filteredTickets, selectedId]
  );

  async function handleStatusChange(ticket: SupportTicket, nextStatus: TicketStatus) {
    try {
      const payload = { status: nextStatus, updatedAt: serverTimestamp() };
      const targetCol = ticket.channel === 'app' ? 'support_tickets' : 'omnibox_threads';
      await updateDoc(doc(db, targetCol, ticket.id), payload);
      if (ticket.channel === 'app') {
        await setDoc(doc(db, 'supportTickets', ticket.id), payload, { merge: true });
      }
      showToast(`Ticket ${formatTicketNo(ticket.id)} marked ${STATUS_META[nextStatus].label}`);
    } catch (e) {
      showToast(`Status update failed: ${(e as Error).message}`);
    }
  }

  async function handleAiDraft() {
    if (!selectedTicket) return;
    setIsDrafting(true);
    try {
      const lastUserMsg =
        [...selectedTicket.messages].reverse().find((m) => m.senderType !== 'admin')?.text ||
        selectedTicket.description;
      const draft = await generateAiDraft({
        channel: selectedTicket.channel.toUpperCase(),
        customerName: selectedTicket.userName,
        subject: selectedTicket.subject,
        message: lastUserMsg,
        tone: aiTone,
      });
      setReplyText(draft);
    } catch (e) {
      showToast(`AI Draft error: ${(e as Error).message}`);
    } finally {
      setIsDrafting(false);
    }
  }

  async function handleSendReply() {
    if (!selectedTicket || !replyText.trim() || !user) return;
    setIsSending(true);
    try {
      const newMsg = {
        senderId: user.uid,
        senderType: 'admin',
        text: replyText.trim(),
        createdAt: Timestamp.now(),
      };
      const nextStatus: TicketStatus =
        selectedTicket.status === 'open' ? 'in_progress' : selectedTicket.status;
      const updatePayload = {
        messages: arrayUnion(newMsg),
        status: nextStatus,
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
      };
      const targetCol = selectedTicket.channel === 'app' ? 'support_tickets' : 'omnibox_threads';
      await updateDoc(doc(db, targetCol, selectedTicket.id), updatePayload);
      if (selectedTicket.channel === 'app') {
        await setDoc(doc(db, 'supportTickets', selectedTicket.id), updatePayload, { merge: true });
      }
      setReplyText('');
      showToast('Reply sent & synced live to customer app!');
    } catch (e) {
      showToast(`Send failed: ${(e as Error).message}`);
    } finally {
      setIsSending(false);
    }
  }

  async function handleGenerateSocial() {
    setSocialLoading(true);
    try {
      const res = await generateSocialPost({
        eventTitle: socialEvent,
        city: socialCity,
        date: socialDate,
        platform: socialPlatform,
      });
      setSocialResult(res);
    } catch (e) {
      showToast(`AI Social error: ${(e as Error).message}`);
    } finally {
      setSocialLoading(false);
    }
  }

  async function handlePublishNow() {
    if (!socialResult) return;
    setPublishing(true);
    try {
      const fullMessage = `${socialResult.caption}\n\n${socialResult.hashtags.join(' ')}`;
      const res = await publishToSocial({
        message: fullMessage,
        imageUrl: socialImageUrl.trim() || undefined,
        platforms: ['facebook', 'instagram'],
      });
      setPublishLog(JSON.stringify(res, null, 2));
      showToast('Publish request dispatched to Facebook & Instagram!');
    } catch (e) {
      showToast(`Publish error: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  }

  async function handleLoadCustomerPhones() {
    const phones = Array.from(
      new Set(
        tickets
          .map((t) => (t.userPhone || '').trim())
          .filter((p) => p.length >= 10)
      )
    );
    setCampPhones(phones.join(', '));
    showToast(`Loaded ${phones.length} customer phone(s) from live tickets!`);
  }

  async function handleGenerateCampaignCopy() {
    setCampLoading(true);
    try {
      const copy = await generateCampaignCopy({
        offerTitle: campOffer,
        promoCode: campCode,
        discount: campDiscount,
        channel: campChannel.toUpperCase(),
      });
      setCampMessage(copy);
    } catch (e) {
      showToast(`AI Copy error: ${(e as Error).message}`);
    } finally {
      setCampLoading(false);
    }
  }

  async function handleLaunchCampaign() {
    const list = campPhones
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (list.length === 0 || !campMessage.trim()) {
      showToast('Add at least 1 phone number and message.');
      return;
    }
    setCampLoading(true);
    try {
      const res = await dispatchCampaign({
        channel: campChannel,
        recipients: list,
        message: campMessage.trim(),
      });
      await addDoc(collection(db, 'ai_campaigns'), {
        offer: campOffer,
        promoCode: campCode,
        channel: campChannel,
        recipientCount: list.length,
        message: campMessage.trim(),
        createdAt: serverTimestamp(),
      });
      setCampLog(JSON.stringify(res, null, 2));
      showToast(`Campaign dispatched to ${list.length} recipient(s)!`);
    } catch (e) {
      showToast(`Campaign error: ${(e as Error).message}`);
    } finally {
      setCampLoading(false);
    }
  }

  async function handleRunJarvis(autoPublish = false) {
    setJarvisLoading(true);
    try {
      const res = await runJarvisStrategy(autoPublish);
      setJarvisReport(res);
      showToast(autoPublish ? 'JARVIS analyzed & triggered auto-post!' : 'JARVIS strategy analysis complete!');
    } catch (e) {
      showToast(`JARVIS error: ${(e as Error).message}`);
    } finally {
      setJarvisLoading(false);
    }
  }

  async function handleGenerateFromLiveEvents() {
    setSocialLoading(true);
    try {
      const evSnap = await getDocs(query(collection(db, 'events'), limit(3)));
      if (evSnap.empty) {
        showToast('No events found in Firestore yet.');
        return;
      }
      for (const evDoc of evSnap.docs) {
        const d = evDoc.data();
        const title = d.title?.toString() || 'JHOOMO Live Event';
        const city = d.city?.toString() || 'India';
        const date = d.date?.toString() || 'This Weekend';
        const imageUrl = d.imageUrl?.toString() || d.image_url?.toString() || '';
        const generated = await generateSocialPost({
          eventTitle: title,
          city,
          date,
          platform: 'Instagram & Facebook',
        });
        await addDoc(collection(db, 'social_autoposts'), {
          eventTitle: title,
          city,
          platform: 'Instagram & Facebook',
          caption: generated.caption,
          hashtags: generated.hashtags,
          imageUrl,
          scheduledFor: 'Daily 10:00 AM & 7:00 PM IST',
          status: 'scheduled',
          likes: 0,
          comments: 0,
          views: 0,
          createdAt: serverTimestamp(),
        });
      }
      showToast(`Auto-generated ${evSnap.size} IG + FB posts from live events!`);
    } catch (e) {
      showToast(`Auto-generate error: ${(e as Error).message}`);
    } finally {
      setSocialLoading(false);
    }
  }

  async function handleSimulateSocialThread(channel: 'whatsapp' | 'instagram' | 'facebook') {
    const samples = {
      whatsapp: {
        userName: 'Rohan Sharma (WhatsApp)',
        userPhone: '+919876543210',
        subject: 'Pass & Gate Entry Query',
        description: 'Hi, maine Avengers ka pass book kiya hai, QR screenshot chalega kya gate par?',
      },
      instagram: {
        userName: '@ananya_events (IG DM)',
        userPhone: '+919876543210',
        subject: 'Reel Comment: PASS',
        description: 'PASS — Lucknow weekend show ka price aur booking link bhejo please!',
      },
      facebook: {
        userName: 'Vikram Verma (FB Page)',
        userPhone: '',
        subject: 'Event Timing Question',
        description: 'Gates kitne baje open honge aur parking available hai kya?',
      },
    };
    const s = samples[channel];
    await addDoc(collection(db, 'omnibox_threads'), {
      channel,
      userName: s.userName,
      userPhone: s.userPhone,
      subject: s.subject,
      description: s.description,
      status: 'open',
      priority: 'high',
      createdAt: serverTimestamp(),
      messages: [{ senderType: 'user', text: s.description, createdAt: Timestamp.now() }],
    });
    showToast(`Added live ${channel.toUpperCase()} thread to Omnibox!`);
  }

  async function handleRunDailyNow() {
    setPublishing(true);
    try {
      const res = await triggerDailyAutoPost();
      setPublishLog(JSON.stringify(res, null, 2));
      showToast('Daily Auto-Post job executed!');
    } catch (e) {
      showToast(`Auto-Post error: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  }

  if (!authReady) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Loading JHOOMO AI Command Center...
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          height: '100%',
          background: 'radial-gradient(circle at top, rgba(225,29,72,0.16), transparent 55%), var(--bg)',
          padding: 24,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--primary-soft)',
                border: '1px solid rgba(225,29,72,0.35)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Sparkles size={22} color="#fb7185" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>JHOOMO AI Command Center</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Support • WhatsApp • Instagram • Facebook
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 22 }}>
            Sign in with your authorized JHOOMO Admin Google account to manage live customer tickets and AI social automation.
          </p>
          <button
            onClick={() => signInWithPopup(auth, googleProvider)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#090b0f' }}>
      {/* Left Sidebar (AutoEnsta Style) */}
      <aside
        style={{
          width: 232,
          flexShrink: 0,
          background: '#0c0e14',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '16px 12px',
        }}
      >
        <div>
          {/* Brand Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 8px 18px',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #e11d48, #9333ea)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={15} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', color: '#fff' }}>
              JHOOMO <span style={{ color: '#fb7185' }}>AI</span>
            </span>
          </div>

          {/* Vertical Navigation */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(
              [
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'instagram', label: 'Instagram', icon: Instagram },
                { id: 'posts', label: 'Posts & Reels', icon: Film },
                { id: 'automations', label: 'Automations', icon: Zap },
                { id: 'link-in-bio', label: 'Link in Bio', icon: Link2 },
                { id: 'omnibox', label: 'Unified Omnibox', icon: MessageSquare },
                { id: 'jarvis', label: 'JARVIS Brain', icon: Bot },
                { id: 'social', label: 'AI Social Auto-Pilot', icon: Share2 },
                { id: 'campaigns', label: 'SMS & WA Campaigns', icon: Send },
                { id: 'forms', label: 'Lead Forms', icon: FileText },
                { id: 'channels', label: 'Channels & Webhooks', icon: Radio },
                { id: 'billing', label: 'Billing', icon: CreditCard },
                { id: 'settings', label: 'Settings', icon: Settings },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigateTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: active ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                    background: active ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
                    color: active ? '#a5b4fc' : 'var(--text-muted)',
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile Footer */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.07)',
            paddingTop: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                fontWeight: 800,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {(user.displayName || user.email || 'A')[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.displayName || user.email?.split('@')[0] || 'Admin'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Admin</div>
            </div>
          </div>

          <button
            onClick={() => signOut(auth)}
            title="Sign Out"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              color: 'var(--text-muted)',
              padding: '6px 7px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Right Side: Top Banner + Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Top Status / Trial Banner */}
        <div
          style={{
            height: 38,
            padding: '0 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: '#0d1018',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
            <span>You have <strong style={{ color: '#fff' }}>7 days</strong> left in your free trial.</span>
            <span style={{ color: '#818cf8', fontWeight: 600 }}>Upgrade to Premium →</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: 11,
              fontWeight: 700,
              color: '#34d399',
            }}
          >
            <Zap size={11} /> Gemini Flash Live
          </div>
        </div>

        {/* Main Content */}
        <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {activeTab === 'dashboard' && <DashboardTab />}

      {activeTab === 'instagram' && <InstagramTab />}

      {activeTab === 'posts' && <PostsReelsTab />}

      {activeTab === 'automations' && <AutomationsTab />}

      {activeTab === 'link-in-bio' && <LinkInBioTab />}

      {activeTab === 'omnibox' && (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr 300px', flex: 1, minHeight: 0 }}>
          {/* LEFT PANE: Ticket & Channel Queue */}
          <aside
            style={{
              borderRight: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  marginBottom: 10,
                }}
              >
                <Search size={14} color="#64748b" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ticket #, name, booking..."
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#fff',
                    fontSize: 12.5,
                    width: '100%',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'app', label: 'App' },
                    { id: 'whatsapp', label: 'WhatsApp' },
                    { id: 'instagram', label: 'IG' },
                    { id: 'facebook', label: 'FB' },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setChannelFilter(c.id)}
                    style={{
                      padding: '4px 9px',
                      borderRadius: 7,
                      border: '1px solid var(--border)',
                      background: channelFilter === c.id ? '#fff' : 'transparent',
                      color: channelFilter === c.id ? '#090b10' : 'var(--text-muted)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(['all', 'open', 'in_progress', 'solved', 'closed'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: statusFilter === st ? 'var(--primary-soft)' : 'transparent',
                      color: statusFilter === st ? '#fb7185' : 'var(--text-dim)',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                {(['whatsapp', 'instagram', 'facebook'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => handleSimulateSocialThread(ch)}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      borderRadius: 7,
                      border: '1px dashed var(--border-strong)',
                      background: 'var(--bg)',
                      color: '#94a3b8',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + Test {ch === 'whatsapp' ? 'WA' : ch === 'instagram' ? 'IG' : 'FB'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {filteredTickets.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12.5 }}>
                  No tickets match this filter.
                </div>
              ) : (
                filteredTickets.map((t) => {
                  const active = selectedTicket?.id === t.id;
                  const meta = STATUS_META[t.status];
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 6,
                        cursor: 'pointer',
                        background: active ? 'var(--surface-2)' : 'transparent',
                        border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
                          {formatTicketNo(t.id)}
                        </span>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: 999,
                            color: meta.color,
                            background: meta.bg,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{t.subject}</div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {t.userName} • {t.description}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 6 }}>
                        {t.createdAtLabel}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* CENTER PANE: Thread & Gemini AI Reply */}
          <main style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg)' }}>
            {!selectedTicket ? (
              <div style={{ display: 'grid', placeItems: 'center', flex: 1, color: 'var(--text-dim)', fontSize: 13 }}>
                Select a ticket or social thread to inspect & reply with AI.
              </div>
            ) : (
              <>
                <div
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 12, color: '#fb7185', fontWeight: 700 }}>
                        {formatTicketNo(selectedTicket.id)}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>{selectedTicket.subject}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {selectedTicket.userName} • Channel: {selectedTicket.channel.toUpperCase()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['open', 'in_progress', 'solved', 'closed'] as const).map((st) => {
                      const active = selectedTicket.status === st;
                      const m = STATUS_META[st];
                      return (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(selectedTicket, st)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: active ? `1px solid ${m.color}` : '1px solid var(--border)',
                            background: active ? m.bg : 'var(--surface)',
                            color: active ? m.color : 'var(--text-muted)',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(selectedTicket.messages.length > 0
                    ? selectedTicket.messages
                    : [{ senderType: 'user', text: selectedTicket.description }]
                  ).map((m, idx) => {
                    const isAdmin = m.senderType === 'admin';
                    return (
                      <div
                        key={idx}
                        style={{
                          alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                          maxWidth: '72%',
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: isAdmin ? 'rgba(225, 29, 72, 0.14)' : 'var(--surface)',
                          border: isAdmin ? '1px solid rgba(225, 29, 72, 0.35)' : '1px solid var(--border)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            color: isAdmin ? '#fb7185' : 'var(--text-muted)',
                            marginBottom: 4,
                          }}
                        >
                          {isAdmin ? 'JHOOMO Support Desk' : selectedTicket.userName}
                        </div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {m.text || ''}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI Reply Composer */}
                <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={handleAiDraft}
                        disabled={isDrafting}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid rgba(99, 102, 241, 0.45)',
                          background: 'rgba(99, 102, 241, 0.16)',
                          color: '#c7d2fe',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Bot size={14} />
                        {isDrafting ? 'Drafting with Gemini...' : 'AI Draft Reply'}
                      </button>

                      <select
                        value={aiTone}
                        onChange={(e) => setAiTone(e.target.value as typeof aiTone)}
                        style={{
                          background: 'var(--bg)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '5px 8px',
                          fontSize: 11.5,
                        }}
                      >
                        <option value="Helpful Hinglish">Helpful Hinglish</option>
                        <option value="Professional English">Professional English</option>
                        <option value="Short & Crisp">Short & Crisp</option>
                      </select>
                    </div>

                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      Syncs live to customer&apos;s Help &amp; Support screen
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="Write a reply or click 'AI Draft Reply'..."
                      style={{
                        flex: 1,
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        color: '#fff',
                        padding: 12,
                        fontSize: 13,
                        resize: 'none',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={isSending || !replyText.trim()}
                      style={{
                        padding: '0 18px',
                        borderRadius: 12,
                        border: 'none',
                        background: replyText.trim() ? 'var(--primary)' : 'var(--surface-2)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Send size={14} />
                      {isSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>

          {/* RIGHT PANE: Customer Context & Policy Macros */}
          <aside
            style={{
              borderLeft: '1px solid var(--border)',
              background: 'var(--surface)',
              padding: 16,
              overflowY: 'auto',
            }}
          >
            {selectedTicket ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 12 }}>
                  CUSTOMER CONTEXT
                </div>
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 18,
                    fontSize: 12.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Name:</span> <strong>{selectedTicket.userName}</strong>
                  </div>
                  {selectedTicket.userPhone && (
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Phone:</span> {selectedTicket.userPhone}
                    </div>
                  )}
                  {selectedTicket.userEmail && (
                    <div style={{ wordBreak: 'break-all' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Email:</span> {selectedTicket.userEmail}
                    </div>
                  )}
                  {selectedTicket.bookingId && (
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Booking ID:</span>{' '}
                      <span className="mono">{selectedTicket.bookingId}</span>
                    </div>
                  )}
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Priority:</span>{' '}
                    <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{selectedTicket.priority}</span>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 10 }}>
                  POLICY-SAFE QUICK MACROS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {QUICK_MACROS.map((m) => (
                    <button
                      key={m.title}
                      onClick={() => setReplyText(m.text)}
                      style={{
                        textAlign: 'left',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: 10,
                        color: 'var(--text)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{m.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{m.text}</div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>No ticket selected.</div>
            )}
          </aside>
        </div>
      )}

      {activeTab === 'jarvis' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 28, maxWidth: 960, width: '100%', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>JHOOMO JARVIS Brain</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                Learns from post views/likes/comments, matches duplicate users across WhatsApp/IG/App, and optimizes posting time &amp; demand.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleRunJarvis(false)}
                disabled={jarvisLoading}
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(99,102,241,0.45)',
                  background: 'rgba(99,102,241,0.18)',
                  color: '#c7d2fe',
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                {jarvisLoading ? 'Analyzing...' : 'Analyze Demand & Best Time'}
              </button>
              <button
                onClick={() => handleRunJarvis(true)}
                disabled={jarvisLoading}
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                Optimize &amp; Auto-Post Now
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700 }}>LIVE TICKETS ANALYZED</div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{tickets.length}</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700 }}>COMMENT-TO-DM KEYWORDS</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8, color: '#34d399' }}>
                PASS • TICKET • LINK • PRICE
              </div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700 }}>DAILY CRON SCHEDULE</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>10 AM &amp; 7 PM IST</div>
            </div>
          </div>

          {jarvisReport && (
            <pre
              className="mono"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 14,
                padding: 18,
                fontSize: 12,
                color: '#e2e8f0',
                overflowX: 'auto',
              }}
            >
              {JSON.stringify(jarvisReport, null, 2)}
            </pre>
          )}
        </div>
      )}

      {activeTab === 'social' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 28, maxWidth: 920, width: '100%', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>AI Social Auto-Pilot</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                Daily Cron: <strong style={{ color: '#34d399' }}>10:00 AM IST &amp; 7:00 PM IST</strong> • Auto-generates &amp; publishes to Facebook &amp; Instagram.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleGenerateFromLiveEvents}
                disabled={socialLoading}
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(99,102,241,0.45)',
                  background: 'rgba(99,102,241,0.18)',
                  color: '#c7d2fe',
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                {socialLoading ? 'Generating...' : 'Auto-Generate from Live Events'}
              </button>
              <button
                onClick={handleRunDailyNow}
                disabled={publishing}
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(16,185,129,0.4)',
                  background: 'rgba(16,185,129,0.14)',
                  color: '#34d399',
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                {publishing ? 'Running...' : 'Run Daily Auto-Post Now'}
              </button>
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 20,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              marginBottom: 20,
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>Event Name</label>
              <input
                value={socialEvent}
                onChange={(e) => setSocialEvent(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: '#fff',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>City</label>
              <input
                value={socialCity}
                onChange={(e) => setSocialCity(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: '#fff',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>Date &amp; Time</label>
              <input
                value={socialDate}
                onChange={(e) => setSocialDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: '#fff',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>Platform</label>
              <select
                value={socialPlatform}
                onChange={(e) => setSocialPlatform(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: '#fff',
                }}
              >
                <option>Instagram Reel &amp; Facebook Post</option>
                <option>Instagram Story</option>
                <option>WhatsApp Broadcast</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                Poster Image URL (required for Instagram Feed auto-publish)
              </label>
              <input
                value={socialImageUrl}
                onChange={(e) => setSocialImageUrl(e.target.value)}
                placeholder="https://..."
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: '#fff',
                }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={handleGenerateSocial}
                disabled={socialLoading}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Sparkles size={15} />
                {socialLoading ? 'Generating...' : 'Generate Post + Comment Auto-Reply'}
              </button>
              {socialResult && (
                <button
                  onClick={handlePublishNow}
                  disabled={publishing}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    border: '1px solid rgba(99,102,241,0.45)',
                    background: 'rgba(99,102,241,0.18)',
                    color: '#c7d2fe',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {publishing ? 'Publishing...' : 'Publish to IG + FB Now'}
                </button>
              )}
            </div>
          </div>

          {publishLog && (
            <pre
              className="mono"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 14,
                fontSize: 11.5,
                color: '#cbd5e1',
                overflowX: 'auto',
                marginBottom: 18,
              }}
            >
              {publishLog}
            </pre>
          )}

          {socialResult && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 16,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>Post Caption</strong>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${socialResult.caption}\n\n${socialResult.hashtags.join(' ')}`);
                      showToast('Caption + hashtags copied!');
                    }}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: '#fff',
                      borderRadius: 8,
                      padding: '4px 10px',
                      fontSize: 11.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{socialResult.caption}</p>
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {socialResult.hashtags.map((h, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 11.5,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: 'var(--primary-soft)',
                        color: '#fb7185',
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>AI Comment Auto-Reply Template</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{socialResult.commentAutoReply}</div>
              </div>
            </div>
          )}

          {/* Scheduled & Published Instagram + Facebook Posts Queue */}
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>Instagram &amp; Facebook Auto-Post Queue ({socialPosts.length})</strong>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Auto-publishes daily at 10:00 AM &amp; 7:00 PM IST once Meta tokens are added
              </span>
            </div>

            {socialPosts.length === 0 ? (
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px dashed var(--border-strong)',
                  borderRadius: 14,
                  padding: 20,
                  color: 'var(--text-muted)',
                  fontSize: 13,
                }}
              >
                No queued posts yet. Click <strong>Auto-Generate from Live Events</strong> above to populate today&apos;s IG &amp; FB posts!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {socialPosts.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#fb7185' }}>{p.platform}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: p.status === 'published' ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)',
                          color: p.status === 'published' ? '#34d399' : '#fbbf24',
                          textTransform: 'uppercase',
                        }}
                      >
                        {p.status}
                      </span>
                    </div>
                    <strong style={{ fontSize: 14 }}>{p.eventTitle} ({p.city})</strong>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{p.caption}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      Schedule: {p.scheduledFor} • Views: {p.views} • Likes: {p.likes} • Comments: {p.comments}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 28, maxWidth: 920, width: '100%', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>SMS &amp; WhatsApp Offer Campaigns</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                AI-generated offer copy + bulk dispatch to JHOOMO customers over SMS &amp; WhatsApp.
              </p>
            </div>
            <button
              onClick={handleLoadCustomerPhones}
              style={{
                padding: '9px 14px',
                borderRadius: 10,
                border: '1px solid rgba(16,185,129,0.4)',
                background: 'rgba(16,185,129,0.14)',
                color: '#34d399',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              Load Customer Phones
            </button>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 20,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 14,
              marginBottom: 18,
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>Offer / Event</label>
              <input
                value={campOffer}
                onChange={(e) => setCampOffer(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>Promo Code</label>
              <input
                value={campCode}
                onChange={(e) => setCampCode(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>Channel</label>
              <select
                value={campChannel}
                onChange={(e) => setCampChannel(e.target.value as typeof campChannel)}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: '#fff' }}
              >
                <option value="both">WhatsApp + SMS</option>
                <option value="whatsapp">WhatsApp Only</option>
                <option value="sms">Bulk SMS Only</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                Recipient Phone Numbers (comma-separated, e.g. +919876543210, +919999999999)
              </label>
              <input
                value={campPhones}
                onChange={(e) => setCampPhones(e.target.value)}
                placeholder="+919876543210"
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: '#fff' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                Campaign Message ({campDiscount})
              </label>
              <textarea
                rows={3}
                value={campMessage}
                onChange={(e) => setCampMessage(e.target.value)}
                placeholder="Click 'AI Write Offer Copy' or type your offer..."
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: '#fff' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={handleGenerateCampaignCopy}
                disabled={campLoading}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(99,102,241,0.45)',
                  background: 'rgba(99,102,241,0.18)',
                  color: '#c7d2fe',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                AI Write Offer Copy
              </button>
              <button
                onClick={handleLaunchCampaign}
                disabled={campLoading}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {campLoading ? 'Sending...' : 'Launch Campaign'}
              </button>
            </div>
          </div>

          {campLog && (
            <pre
              className="mono"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 14,
                fontSize: 11.5,
                color: '#cbd5e1',
                overflowX: 'auto',
              }}
            >
              {campLog}
            </pre>
          )}
        </div>
      )}

      {activeTab === 'forms' && <LeadFormsTab />}

      {activeTab === 'billing' && <BillingTab />}

      {activeTab === 'settings' && <SettingsTab />}

      {activeTab === 'channels' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 28, maxWidth: 920, width: '100%', margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Channels &amp; Webhooks</h2>
          <p style={{ margin: '0 0 22px', color: 'var(--text-muted)', fontSize: 13 }}>
            Zero-load Cloudflare Worker architecture — Vercel &amp; Firebase stay completely isolated.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              {
                name: 'JHOOMO App Support',
                desc: 'Live Firestore sync with mobile Help & Support tickets.',
                status: 'Connected Live',
                ok: true,
                icon: Ticket,
              },
              {
                name: 'Gemini Flash AI Engine',
                desc: 'Free-tier AI drafts, Hinglish replies & daily social captions.',
                status: workerHealth?.channels?.gemini ? 'Worker + Direct Live' : 'Direct Key Live',
                ok: true,
                icon: Bot,
              },
              {
                name: 'WhatsApp Cloud API',
                desc: 'Auto-replies to incoming WhatsApp messages via /api/webhooks/meta.',
                status: workerHealth?.channels?.whatsapp ? 'Connected Live' : 'Needs WHATSAPP_TOKEN',
                ok: Boolean(workerHealth?.channels?.whatsapp),
                icon: MessageCircle,
              },
              {
                name: 'Instagram & Facebook Graph API',
                desc: 'Daily Cron auto-poster (10 AM & 7 PM IST) + comment auto-reply.',
                status:
                  workerHealth?.channels?.facebook || workerHealth?.channels?.instagram
                    ? 'Connected Live'
                    : 'Needs META_PAGE_TOKEN',
                ok: Boolean(workerHealth?.channels?.facebook || workerHealth?.channels?.instagram),
                icon: Instagram,
              },
            ].map((ch) => {
              const Icon = ch.icon;
              return (
                <div
                  key={ch.name}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 18,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon size={18} color={ch.ok ? '#34d399' : '#fbbf24'} />
                      <strong style={{ fontSize: 14 }}>{ch.name}</strong>
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: ch.ok ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)',
                        color: ch.ok ? '#34d399' : '#fbbf24',
                      }}
                    >
                      {ch.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{ch.desc}</div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 20,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <ShieldCheck size={20} color="#34d399" />
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Meta Webhook Verify Token: <span className="mono" style={{ color: '#fff' }}>jhoomo_meta_verify_2026</span> • Endpoint:{' '}
              <span className="mono" style={{ color: '#fff' }}>/api/webhooks/meta</span>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            background: 'var(--surface-2)',
            border: '1px solid var(--border-strong)',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 12.5,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
          }}
        >
          <CheckCircle2 size={15} color="#34d399" />
          {toast}
        </div>
      )}
        </main>
      </div>
    </div>
  );
}
