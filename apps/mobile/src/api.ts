import { getClerkInstance } from '@clerk/expo';

const apiBaseUrl = (process.env.EXPO_PUBLIC_APP_BASE_URL ?? '').replace(/\/$/, '');

export type CardStatus = 'known' | 'saved';

export type MobileCard = {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  domain: string;
  domains?: string[];
  level: string;
  status: CardStatus | null;
  related_concepts?: string[];
  prerequisites?: Array<{ id: string; label: string; status: CardStatus | null }>;
  last_seen?: string;
};

export type PersonalNote = {
  id: string;
  title: string;
  content: string;
  topic: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  purge_at: string | null;
};

export type PersonalNoteSummary = Pick<PersonalNote, 'id' | 'title' | 'topic'>;

function getBaseUrl() {
  if (!apiBaseUrl) throw new Error('EXPO_PUBLIC_APP_BASE_URL is not configured.');
  return apiBaseUrl;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getClerkInstance().session?.getToken();
  if (!token) throw new Error('Sign in is required.');

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status}).`);
  return payload;
}

export const mobileApi = {
  notes: (view: 'active' | 'trash' = 'active') => request<{ items: PersonalNote[] }>(`/api/mobile?resource=notes&view=${view}`),
  graph: () => request<{ cards: Array<Pick<MobileCard, 'id' | 'title' | 'status'>>; personalItems: PersonalNoteSummary[] }>('/api/mobile?resource=graph'),
  practice: (mode: 'new' | 'review', exclude: string[] = []) => request<{ card: MobileCard | null; stats: { explainable: number; unclear: number } }>(`/api/mobile?resource=practice&mode=${mode}${exclude.map((id) => `&exclude=${encodeURIComponent(id)}`).join('')}`),
  saved: () => request<{ cards: MobileCard[] }>('/api/mobile?resource=saved'),
  dashboard: () => request<{ stats: { explainable: number; unclear: number }; domains: Array<{ domain: string; reviewed: number; explainable: number; unclear: number }> }>('/api/mobile?resource=dashboard'),
  ranking: () => request<{ rows: Array<{ rank: number; label: string; explainable: number; avgScore: number }> }>('/api/mobile?resource=ranking'),
  adminNodes: () => request<{ nodes: Array<{ id: string; label: string; domain: string; level: number; difficulty: number; type: string }> }>('/api/mobile?resource=admin-nodes'),
  adminEdges: () => request<{ edges: Array<{ id: number; source: string; target: string; type: string; weight: number }>; nodes: Array<{ id: string; label: string }> }>('/api/mobile?resource=admin-edges'),
  adminUsers: () => request<{ users: Array<{ user_id: string; mastered: number; reinforcing: number; total: number; last_updated: string | null }> }>('/api/mobile?resource=admin-users'),
  mutate: <T>(body: Record<string, unknown>) => request<T>('/api/mobile', { method: 'POST', body: JSON.stringify(body) }),
};
