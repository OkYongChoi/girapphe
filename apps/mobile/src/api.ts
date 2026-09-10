import { getClerkInstance } from '@clerk/expo';
import type {
  KnowledgeBundleContent,
  KnowledgeBundleType,
  Locale,
  MobilePracticeMode,
  MobilePracticeRequest,
  MobilePracticeResponse,
  MobilePracticeStats as SharedMobilePracticeStats,
} from '@stem-brain/shared';
import { getActiveLocale, translate } from '@/i18n';
import {
  MobileApiConfigurationError,
  MobileApiNetworkError,
  MobileApiRequestError,
} from './mobile-api-errors';

export {
  MobileApiConfigurationError,
  MobileApiNetworkError,
  MobileApiRequestError,
  isTransientMobileApiError,
} from './mobile-api-errors';

const apiBaseUrl = (process.env.EXPO_PUBLIC_APP_BASE_URL ?? '').replace(/\/$/, '');
export const MOBILE_KNOWLEDGE_CAPABILITIES = 'expression-v1,event-chronology-v1,causal-relations-v1';

export type CardStatus = 'known' | 'saved';
export type TranslationStatus = 'source' | 'machine' | 'reviewed' | 'human' | 'failed' | 'partial' | 'fallback';
export type MobilePracticeStats = SharedMobilePracticeStats;

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
  last_seen?: string | null;
  source_locale?: Locale;
  resolved_locale?: Locale;
  translation_status?: TranslationStatus;
  knowledge_type?: KnowledgeBundleType | null;
  central_question?: string | null;
  structured_content?: KnowledgeBundleContent | null;
  bundle_schema_version?: number | null;
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
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  structured_content: KnowledgeBundleContent | null;
  bundle_schema_version: number | null;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
  purge_at: string | null;
};

export type PersonalNoteSummary = Pick<PersonalNote,
  | 'id'
  | 'title'
  | 'summary'
  | 'content'
  | 'topic'
  | 'tags'
  | 'knowledge_type'
  | 'central_question'
  | 'structured_content'
  | 'bundle_schema_version'
  | 'created_at'
  | 'updated_at'
>;
export type GraphCardSummary = Pick<MobileCard, 'id' | 'title' | 'status'>;

export type MobileTopicHubItem = PersonalNoteSummary & {
  version: number;
  observed_at: string | null;
  valid_from: string | null;
  valid_to: string | null;
  last_verified_at: string | null;
  review_at: string | null;
};

export type MobileTopicSummary = {
  topic: string;
  item_count: number;
  open_question_count: number;
  decision_count: number;
  event_count: number;
  source_count: number;
  last_updated_at: string;
  sample_titles: string[];
};

export type MobileRankingRow = {
  rank: number;
  label: string;
  participantId: string;
  isCurrentUser: boolean;
  explainable: number;
  avgScore: number;
};

export type MobileTopicHub = {
  topic: string;
  generated_at: string;
  items: MobileTopicHubItem[];
  sources: Array<{
    id: string;
    knowledge_item_id: string;
    source_type: string;
    provider: string;
    conversation_ref: string | null;
    source_url: string | null;
    source_locator: Record<string, unknown> | null;
    discussed_at: string | null;
    relation_origin: 'explicit_user' | 'extracted_from_source' | 'model_inferred';
    confirmed_at: string | null;
    created_at: string;
  }>;
  evidence_selectors: Array<{
    id: string;
    knowledge_item_id: string;
    source_id: string;
    selector_type: 'message' | 'text_position' | 'line_range' | 'external_ref';
    selector: Record<string, unknown>;
    polarity: 'supports' | 'contradicts';
    quality: 'unknown' | 'low' | 'medium' | 'high';
    relation_origin: 'explicit_user' | 'extracted_from_source' | 'model_inferred';
    confirmed_at: string | null;
    created_at: string;
  }>;
  activity: Array<{
    id: string;
    knowledge_item_id: string;
    activity_type: 'confirmed' | 'connected' | 'verified' | 'reused' | 'revised' | 'superseded' | 'archived' | 'restored';
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  relations: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    relation_origin: 'explicit_user' | 'extracted_from_source' | 'model_inferred';
    confirmed_at: string | null;
    evidence_span_ids: string[];
  }>;
};

export type MobileCandidateBatch = {
  id: string;
  source_type: 'conversation';
  provider: string;
  scope: 'current_conversation' | 'selected_export';
  conversation_ref: string | null;
  source_url: string | null;
  discussed_at: string | null;
  status: 'pending' | 'partial' | 'approved' | 'discarded';
  draft_count: number;
  pending_count: number;
  approved_count: number;
  created_at: string;
  updated_at: string;
  committed_at: string | null;
};

export type MobileKnowledgeImportJob = Pick<
  MobileCandidateBatch,
  | 'id'
  | 'provider'
  | 'scope'
  | 'status'
  | 'draft_count'
  | 'pending_count'
  | 'approved_count'
  | 'created_at'
>;

export type MobileCandidateDraft = {
  id: string;
  batch_id: string;
  title: string;
  summary: string;
  explanation: string;
  topic: string;
  tags: string[];
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  structured_content: KnowledgeBundleContent | null;
  bundle_schema_version: number | null;
  status: 'pending' | 'approved' | 'rejected';
  version: number;
  requires_detailed_review: boolean;
  detailed_review_reason: 'causal_relations' | 'provenance' | null;
  duplicate_suggestions: Array<{
    id: string;
    title: string;
    summary: string;
    topic: string;
    knowledge_type: KnowledgeBundleType | null;
    central_question: string | null;
    version: number;
    match: 'exact' | 'similar';
    score: number;
  }>;
};

export type MobileCandidateResolutionResult = {
  resolved: boolean;
  action: 'create' | 'ignore';
  knowledgeItemId: string | null;
  version: number | null;
  skippedEdges?: number;
};

function readApiErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('code' in payload)) return null;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' && /^[A-Z0-9_]{1,80}$/.test(code) ? code : null;
}

function getBaseUrl() {
  if (!apiBaseUrl) {
    throw new MobileApiConfigurationError(translate(getActiveLocale(), 'api.missingUrl'));
  }
  return apiBaseUrl;
}

async function authenticatedFetch(path: string, init?: RequestInit): Promise<Response> {
  const locale = getActiveLocale();
  let token: string | null | undefined;
  try {
    token = await getClerkInstance().session?.getToken();
  } catch {
    throw new MobileApiNetworkError(translate(locale, 'api.networkFailed'));
  }
  if (!token) throw new Error(translate(locale, 'api.signInRequired'));

  const baseUrl = getBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': locale,
        'X-Girapphe-Locale': locale,
        'X-Girapphe-Knowledge-Capabilities': MOBILE_KNOWLEDGE_CAPABILITIES,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new MobileApiNetworkError(translate(locale, 'api.networkFailed'));
  }
  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const locale = getActiveLocale();
  const response = await authenticatedFetch(path, init);
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new MobileApiRequestError(
      translate(locale, 'api.requestFailed', { status: new Intl.NumberFormat(locale).format(response.status) }),
      readApiErrorCode(payload),
      response.status,
    );
  }
  return payload as T;
}

async function publicRequest<T>(path: string): Promise<T> {
  const locale = getActiveLocale();
  const baseUrl = getBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': locale,
        'X-Girapphe-Locale': locale,
        'X-Girapphe-Knowledge-Capabilities': MOBILE_KNOWLEDGE_CAPABILITIES,
      },
    });
  } catch {
    throw new MobileApiNetworkError(translate(locale, 'api.networkFailed'));
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
  notes: (view: 'active' | 'archive' | 'trash' = 'active') => request<{ items: PersonalNote[] }>(withLocale(`/api/mobile?resource=notes&view=${view}`)),
  topics: () => request<{ topics: MobileTopicSummary[] }>(withLocale('/api/mobile?resource=topics')),
  knowledgeDataControls: (page = 1) => {
    const boundedPage = Number.isSafeInteger(page) ? Math.max(1, Math.min(400, page)) : 1;
    return request<{ jobs: MobileKnowledgeImportJob[]; page: number; hasNextPage: boolean }>(
      withLocale(`/api/mobile?resource=knowledge-data-controls&page=${boundedPage}`),
    );
  },
  deleteKnowledgeImportBatch: (batchId: string) => request<{ deleted: boolean; approvedKnowledgePreserved: number }>('/api/mobile', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete-import-batch', batchId }),
  }),
  topicHub: (topic: string) => request<{ hub: MobileTopicHub }>(withLocale(`/api/mobile?resource=topic-hub&topic=${encodeURIComponent(topic)}`)),
  candidateInbox: () => request<{ batches: MobileCandidateBatch[] }>(withLocale('/api/mobile?resource=candidate-inbox')),
  candidateBatch: (batchId: string) => request<{ batch: MobileCandidateBatch; drafts: MobileCandidateDraft[] }>(withLocale(`/api/mobile?resource=candidate-batch&batchId=${encodeURIComponent(batchId)}`)),
  graph: () => request<{ cards: GraphCardSummary[]; personalItems: PersonalNoteSummary[] }>(withLocale('/api/mobile?resource=graph')),
  practice: (mode: MobilePracticeMode, cursor: string | null = null, cycleOnEmpty = false) => {
    const body: MobilePracticeRequest = { mode, cursor, cycleOnEmpty };
    return request<MobilePracticeResponse<MobileCard>>(withLocale('/api/mobile?resource=practice'), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  saved: () => request<{ cards: MobileCard[]; stats: MobilePracticeStats }>(withLocale('/api/mobile?resource=saved')),
  dashboard: () => request<{ stats: MobilePracticeStats; domains: Array<{ domain: string; domain_label?: string; reviewed: number; explainable: number; unclear: number }> }>(withLocale('/api/mobile?resource=dashboard')),
  ranking: () => request<{ rows: MobileRankingRow[] }>(withLocale('/api/mobile?resource=ranking')),
  adminNodes: () => request<{ nodes: Array<{ id: string; label: string; domain: string; level: number; difficulty: number; type: string }> }>(withLocale('/api/mobile?resource=admin-nodes')),
  adminEdges: () => request<{ edges: Array<{ id: number; source: string; target: string; type: string; weight: number }>; nodes: Array<{ id: string; label: string }> }>(withLocale('/api/mobile?resource=admin-edges')),
  adminUsers: () => request<{ users: Array<{ user_id: string; mastered: number; reinforcing: number; total: number; last_updated: string | null }> }>(withLocale('/api/mobile?resource=admin-users')),
  mutateKnowledge: <T>(body: Record<string, unknown>) => request<T>('/api/mobile?resource=notes', { method: 'POST', body: JSON.stringify(body) }),
  mutate: <T>(body: Record<string, unknown>) => request<T>('/api/mobile', { method: 'POST', body: JSON.stringify(body) }),
};
