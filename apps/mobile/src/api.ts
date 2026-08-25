import { getClerkInstance } from '@clerk/expo';
import type { Locale } from '@stem-brain/shared';
import { getActiveLocale, translate } from '@/i18n';

const apiBaseUrl = (process.env.EXPO_PUBLIC_APP_BASE_URL ?? '').replace(/\/$/, '');

export type CardStatus = 'known' | 'saved';
export type TranslationStatus = 'source' | 'machine' | 'reviewed' | 'human' | 'failed' | 'partial' | 'fallback';

export type MobileCard = {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  domain: string;
  domain_label?: string;
  type?: string;
  type_label?: string;
  aliases?: string[];
  domains?: string[];
  level: string;
  status: CardStatus | null;
  related_concepts?: string[];
  prerequisites?: Array<{ id: string; label: string; status: CardStatus | null }>;
  last_seen?: string;
  source_locale?: Locale;
  resolved_locale?: Locale;
  translation_status?: TranslationStatus;
};

export type LocalizedContent = {
  id: string;
  card_id?: string | null;
  label?: string;
  title?: string;
  summary?: string;
  explanation?: string;
  domain?: string;
  domain_label?: string;
  type?: string;
  type_label?: string;
  aliases?: string[];
  related_concepts?: string[];
  related_nodes?: Array<{ id: string; label: string }>;
  source_locale?: Locale;
  resolved_locale?: Locale;
  translation_status?: TranslationStatus;
};

export type ContentResponse = {
  requested_locale: Locale;
  source_locale: 'en';
  generation_mode: 'detail' | 'cache-only';
  items: LocalizedContent[];
};

export type PersonalNote = {
  id: string;
  title: string;
  summary: string;
  content: string;
  topic: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  purge_at: string | null;
};

export type PersonalNoteSummary = Pick<PersonalNote, 'id' | 'title' | 'summary' | 'content' | 'topic' | 'tags' | 'created_at' | 'updated_at'>;
export type GraphCardSummary = Pick<MobileCard, 'id' | 'title' | 'status'>;

function getBaseUrl() {
  if (!apiBaseUrl) throw new Error(translate(getActiveLocale(), 'api.missingUrl'));
  return apiBaseUrl;
}

async function authenticatedFetch(path: string, init?: RequestInit): Promise<Response> {
  const locale = getActiveLocale();
  let token: string | null | undefined;
  try {
    token = await getClerkInstance().session?.getToken();
  } catch {
    throw new Error(translate(locale, 'api.networkFailed'));
  }
  if (!token) throw new Error(translate(locale, 'api.signInRequired'));

  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': locale,
        'X-Girapphe-Locale': locale,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error(translate(locale, 'api.networkFailed'));
  }
  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const locale = getActiveLocale();
  const response = await authenticatedFetch(path, init);
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(translate(locale, 'api.requestFailed', { status: new Intl.NumberFormat(locale).format(response.status) }));
  return payload;
}

async function publicRequest<T>(path: string): Promise<T> {
  const locale = getActiveLocale();
  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}${path}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': locale,
        'X-Girapphe-Locale': locale,
      },
    });
  } catch {
    throw new Error(translate(locale, 'api.networkFailed'));
  }
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(translate(locale, 'api.requestFailed', { status: new Intl.NumberFormat(locale).format(response.status) }));
  return payload;
}

function withLocale(path: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}locale=${encodeURIComponent(getActiveLocale())}`;
}

export const mobileApi = {
  deleteAccount: () => authenticatedFetch('/api/account', { method: 'DELETE' }),
  content: (ids: string[]) => {
    const boundedIds = [...new Set(ids)].slice(0, 12);
    const query = boundedIds.map((id) => encodeURIComponent(id)).join(',');
    return publicRequest<ContentResponse>(withLocale(`/api/mobile?resource=content&ids=${query}`));
  },
  notes: (view: 'active' | 'trash' = 'active') => request<{ items: PersonalNote[] }>(withLocale(`/api/mobile?resource=notes&view=${view}`)),
  graph: () => request<{ cards: GraphCardSummary[]; personalItems: PersonalNoteSummary[] }>(withLocale('/api/mobile?resource=graph')),
  practice: (mode: 'new' | 'review', exclude: string[] = []) => request<{ card: MobileCard | null; stats: { explainable: number; unclear: number } }>(withLocale(`/api/mobile?resource=practice&mode=${mode}${exclude.map((id) => `&exclude=${encodeURIComponent(id)}`).join('')}`)),
  saved: () => request<{ cards: MobileCard[] }>(withLocale('/api/mobile?resource=saved')),
  dashboard: () => request<{ stats: { explainable: number; unclear: number }; domains: Array<{ domain: string; domain_label?: string; reviewed: number; explainable: number; unclear: number }> }>(withLocale('/api/mobile?resource=dashboard')),
  ranking: () => request<{ rows: Array<{ rank: number; label: string; explainable: number; avgScore: number }> }>(withLocale('/api/mobile?resource=ranking')),
  adminNodes: () => request<{ nodes: Array<{ id: string; label: string; domain: string; level: number; difficulty: number; type: string }> }>(withLocale('/api/mobile?resource=admin-nodes')),
  adminEdges: () => request<{ edges: Array<{ id: number; source: string; target: string; type: string; weight: number }>; nodes: Array<{ id: string; label: string }> }>(withLocale('/api/mobile?resource=admin-edges')),
  adminUsers: () => request<{ users: Array<{ user_id: string; mastered: number; reinforcing: number; total: number; last_updated: string | null }> }>(withLocale('/api/mobile?resource=admin-users')),
  mutate: <T>(body: Record<string, unknown>) => request<T>('/api/mobile', { method: 'POST', body: JSON.stringify(body) }),
};
