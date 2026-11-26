import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

export interface AutopilotConfig {
  masterEnabled: boolean;
  supportReplies: boolean;
  commentToDm: boolean;
  emailAutoReply: boolean;
  socialAutoPost: boolean;
  escalationKeywords: string[];
}

export const DEFAULT_AUTOPILOT: AutopilotConfig = {
  masterEnabled: true,
  supportReplies: true,
  commentToDm: true,
  emailAutoReply: true,
  socialAutoPost: true,
  escalationKeywords: ['refund', 'upi', 'payment', 'fraud', 'cancel', 'urgent', 'legal'],
};

function normalizeConfig(raw?: Partial<AutopilotConfig> | null): AutopilotConfig {
  return {
    masterEnabled:
      typeof raw?.masterEnabled === 'boolean' ? raw.masterEnabled : DEFAULT_AUTOPILOT.masterEnabled,
    supportReplies:
      typeof raw?.supportReplies === 'boolean' ? raw.supportReplies : DEFAULT_AUTOPILOT.supportReplies,
    commentToDm: typeof raw?.commentToDm === 'boolean' ? raw.commentToDm : DEFAULT_AUTOPILOT.commentToDm,
    emailAutoReply:
      typeof raw?.emailAutoReply === 'boolean' ? raw.emailAutoReply : DEFAULT_AUTOPILOT.emailAutoReply,
    socialAutoPost:
      typeof raw?.socialAutoPost === 'boolean' ? raw.socialAutoPost : DEFAULT_AUTOPILOT.socialAutoPost,
    escalationKeywords: Array.isArray(raw?.escalationKeywords)
      ? raw.escalationKeywords
      : DEFAULT_AUTOPILOT.escalationKeywords,
  };
}

export async function updateAutopilotConfig(patch: Partial<AutopilotConfig>) {
  await setDoc(doc(db, 'system_settings', 'autopilot'), patch, { merge: true });
}

export function useAutopilotConfig() {
  const [config, setConfig] = useState<AutopilotConfig>(DEFAULT_AUTOPILOT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'system_settings', 'autopilot'),
      (snap) => {
        setConfig(normalizeConfig(snap.data() as Partial<AutopilotConfig> | undefined));
        setReady(true);
      },
      () => setReady(true)
    );
  }, []);

  const setFeature = (key: Exclude<keyof AutopilotConfig, 'escalationKeywords'>, value: boolean) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    void updateAutopilotConfig({ [key]: value });
    return next;
  };

  return { config, ready, setFeature };
}

export interface AutopilotStatus {
  ok?: boolean;
  error?: string;
  config?: Partial<AutopilotConfig>;
  lastRun?: Record<string, unknown> | null;
}

export async function fetchAutopilotStatus(): Promise<AutopilotStatus | null> {
  if (!WORKER_URL) return null;
  try {
    const res = await fetch(`${WORKER_URL}/api/autopilot/status`);
    if (!res.ok) return null;
    return (await res.json()) as AutopilotStatus;
  } catch {
    return null;
  }
}

export async function runAutopilotNow(): Promise<Record<string, unknown> | null> {
  if (!WORKER_URL) return null;
  try {
    const res = await fetch(`${WORKER_URL}/api/autopilot/run`, { method: 'POST' });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
