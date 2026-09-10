import { NextRequest, NextResponse } from 'next/server';
import { parseAcceptLanguage, parseStrictKnowledgeTags } from '@stem-brain/shared';
import {
  getAllCardsWithStatus,
  getCardLeaderboard,
  getNextCard,
  getNextMobilePracticeCard,
  getSavedCards,
  getUserCardDomainProgress,
  getUserStats,
  removeSavedCard,
  resetUserCardProgress,
  saveCardState,
  type CardStatus,
} from '@/actions/card-actions';
import {
  archiveKnowledgeItem,
  createKnowledgeItemWithOutcome,
  deleteKnowledgeItem,
  getArchivedKnowledgeItems,
  getDeletedKnowledgeItems,
  getUserKnowledgeItems,
  restoreKnowledgeItem,
  restoreArchivedKnowledgeItem,
  updateKnowledgeItem,
  type UserKnowledgeItem,
} from '@/actions/user-knowledge-actions';
import {
  createAdminEdge,
  createAdminNode,
  deleteAdminEdge,
  deleteAdminNode,
  getAdminEdges,
  getAdminNodes,
  getAdminUsers,
} from '@/actions/admin-actions';
import { getCurrentUser } from '@/lib/auth';
import { readBoundedJson } from '@/lib/billing/bounded-json';
import { handlePublicContentRequest } from '@/lib/public-content-api';
import { parseContentLocale } from '@/lib/content-localization';
import { parseKnowledgeBundleFields } from '@/lib/knowledge-bundle-runtime';
import {
  getActiveKnowledgeTopicSummariesForUser,
  getTopicKnowledgeHubForUser,
} from '@/lib/topic-knowledge-hub';
import {
  getKnowledgeDraftBatch,
  getKnowledgeDraftBatches,
} from '@/actions/knowledge-ingestion-actions';
import {
  getKnowledgeDraftResolutionContext,
  ignoreKnowledgeDraft,
  resolveKnowledgeDraft,
} from '@/actions/user-knowledge-actions';
import {
  getActiveKnowledgeItemVersionForUser,
  getKnowledgeDuplicateSuggestionsForDraftsForUser,
} from '@/lib/knowledge-ingestion';
import { resolveMobileNoteUpdateVersion } from '@/lib/mobile-note-update-version';
import { toMobileNoteCreateHttpResult } from '@/lib/knowledge-item-create-result';
import {
  classifyMobileCandidateMutationPreflight,
  mobileCandidateRequiresDetailedCausalReview,
  mobileKnowledgeEditRequiresCapability,
  readMobileKnowledgeCapabilities,
  withMobileKnowledgeCompatibility,
  withMobileKnowledgeListCompatibility,
  withMobileRelationCompatibility,
  type MobileKnowledgeCapabilities,
} from '@/lib/mobile-knowledge-capabilities';
import {
  parseLegacyMobilePracticeExcludeIds,
} from '@/lib/mobile-practice-contract';
import { handleMobilePracticePost } from '@/lib/mobile-practice-handler';

const MAX_JSON_BYTES = 16_384;
async function requireMobileUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user;
}

async function isMobileAdmin() {
  const user = await getCurrentUser();
  return Boolean(user && process.env.ADMIN_CLERK_USER_ID && user.id === process.env.ADMIN_CLERK_USER_ID);
}

function unauthorized() {
  return privateJson({ error: 'Sign in is required.', code: 'AUTH_REQUIRED' }, { status: 401 });
}

function invalid(message: string, code = 'INVALID_REQUEST') {
  return privateJson({ error: message, code }, { status: 400 });
}

function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store');
  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

function toMobileNote(item: UserKnowledgeItem, capabilities: MobileKnowledgeCapabilities) {
  return withMobileKnowledgeCompatibility({
    id: item.id,
    title: item.title,
    summary: item.summary,
    content: item.content,
    topic: item.topic,
    tags: item.tags,
    knowledge_type: item.knowledge_type,
    central_question: item.central_question,
    structured_content: item.structured_content,
    bundle_schema_version: item.bundle_schema_version,
    version: item.version,
    created_at: item.created_at,
    updated_at: item.updated_at,
    archived_at: item.archived_at,
    deleted_at: item.deleted_at,
    purge_at: item.purge_at,
  }, capabilities);
}

function toMobileConcept(item: UserKnowledgeItem, capabilities: MobileKnowledgeCapabilities) {
  return withMobileKnowledgeCompatibility({
    id: item.id,
    title: item.title,
    summary: item.summary,
    content: item.content,
    topic: item.topic,
    tags: item.tags,
    knowledge_type: item.knowledge_type,
    central_question: item.central_question,
    structured_content: item.structured_content,
    bundle_schema_version: item.bundle_schema_version,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }, capabilities);
}

function stringField(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.length <= maxLength ? value : null;
}

function parseMobileBundle(body: Record<string, unknown>, capabilities: MobileKnowledgeCapabilities) {
  const knowledgeType = stringField(body.knowledge_type, 32) ?? '';
  if (!knowledgeType) return { knowledgeType: '', centralQuestion: '', structuredContent: '' };
  if (knowledgeType === 'expression' && !capabilities.expression) return null;
  const parsed = parseKnowledgeBundleFields({
    knowledge_type: knowledgeType,
    central_question: stringField(body.central_question, 500) ?? '',
    structured_content: body.structured_content,
    bundle_schema_version: body.bundle_schema_version ?? 1,
  });
  if (!parsed) return null;
  return {
    knowledgeType: parsed.knowledge_type,
    centralQuestion: parsed.central_question,
    structuredContent: JSON.stringify(parsed.structured_content),
  };
}

function parseMobileTags(value: unknown): string[] | null {
  if (value === undefined) return [];
  return parseStrictKnowledgeTags(value);
}

async function readBody(request: NextRequest) {
  const result = await readBoundedJson(request, MAX_JSON_BYTES);
  if (!result.ok) return result;
  const value = result.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false as const, reason: 'invalid_json' as const };
  }
  return { ok: true as const, value: value as Record<string, unknown> };
}

function toFormData(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

function mutationResponse(result: { success?: boolean; error?: string }) {
  if (result.success === false) {
    return privateJson(
      { error: result.error === 'guest_card_not_available' ? 'This card is not available.' : 'The change could not be saved.' },
      { status: result.error === 'guest_card_not_available' ? 400 : 500 },
    );
  }
  return privateJson(result);
}

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get('resource');
  if (resource === 'content') return handlePublicContentRequest(request);
  const mobileUser = await requireMobileUser();
  if (!mobileUser) return unauthorized();
  const explicitLocale = request.nextUrl.searchParams.get('locale');
  const localeInput = explicitLocale
    ?? request.headers.get('x-girapphe-locale')
    ?? parseAcceptLanguage(request.headers.get('accept-language'));
  const parsedLocale = parseContentLocale(localeInput);
  if (!parsedLocale) return invalid('The requested locale is not supported.', 'UNSUPPORTED_LOCALE');
  const locale = parsedLocale;
  const capabilities = readMobileKnowledgeCapabilities(request.headers.get('x-girapphe-knowledge-capabilities'));

  switch (resource) {
    case 'admin-nodes':
      if (!await isMobileAdmin()) return privateJson({ error: 'Administrator access is required.' }, { status: 403 });
      return privateJson({ nodes: await getAdminNodes() });
    case 'admin-edges':
      if (!await isMobileAdmin()) return privateJson({ error: 'Administrator access is required.' }, { status: 403 });
      return privateJson({ edges: await getAdminEdges(), nodes: await getAdminNodes() });
    case 'admin-users':
      if (!await isMobileAdmin()) return privateJson({ error: 'Administrator access is required.' }, { status: 403 });
      return privateJson({ users: await getAdminUsers() });
    case 'notes': {
      const view = request.nextUrl.searchParams.get('view');
      const items = view === 'trash'
        ? await getDeletedKnowledgeItems()
        : view === 'archive'
          ? await getArchivedKnowledgeItems()
          : await getUserKnowledgeItems();
      return privateJson({ items: items.map((item) => toMobileNote(item, capabilities)) });
    }
    case 'topic-hub': {
      const topic = request.nextUrl.searchParams.get('topic')?.trim() ?? '';
      if (!topic || topic.length > 120) return invalid('A bounded topic is required.', 'INVALID_TOPIC');
      const hub = await getTopicKnowledgeHubForUser(mobileUser.id, topic);
      return privateJson({ hub: {
        ...hub,
        items: hub.items.map((item) => withMobileKnowledgeCompatibility(item, capabilities)),
        relations: withMobileRelationCompatibility(hub.relations, capabilities),
      } });
    }
    case 'topics':
      return privateJson({ topics: await getActiveKnowledgeTopicSummariesForUser(mobileUser.id) });
    case 'candidate-inbox':
      return privateJson({ batches: await getKnowledgeDraftBatches() });
    case 'candidate-batch': {
      const batchId = request.nextUrl.searchParams.get('batchId')?.trim() ?? '';
      if (!batchId || batchId.length > 240 || !/^[A-Za-z0-9._:-]+$/.test(batchId)) return invalid('A valid batch id is required.', 'INVALID_BATCH');
      const result = await getKnowledgeDraftBatch(batchId);
      if (!result) return privateJson({ error: 'The candidate batch was not found.', code: 'BATCH_NOT_FOUND' }, { status: 404 });
      const pending = result.drafts.filter((draft) => draft.status === 'pending');
      const duplicateSuggestions = await getKnowledgeDuplicateSuggestionsForDraftsForUser(mobileUser.id, pending);
      return privateJson({
        batch: result.batch,
        drafts: pending.map((draft) => {
          const compatibleDraft = withMobileKnowledgeCompatibility({
            ...draft,
            duplicate_suggestions: (duplicateSuggestions[draft.id] ?? []).map((suggestion) => (
              withMobileKnowledgeCompatibility(suggestion, capabilities)
            )),
          }, capabilities);
          return {
            ...compatibleDraft,
            relations: withMobileRelationCompatibility(compatibleDraft.relations, capabilities),
            requires_detailed_review: mobileCandidateRequiresDetailedCausalReview(draft),
          };
        }),
      });
    }
    case 'graph': {
      const [cards, personalItems] = await Promise.all([
        getAllCardsWithStatus({ locale }),
        getUserKnowledgeItems(),
      ]);
      return privateJson({
        cards: cards.map((card) => ({ id: card.id, title: card.title, status: card.status })),
        personalItems: personalItems.map((item) => toMobileConcept(item, capabilities)),
      });
    }
    case 'practice': {
      const mode = request.nextUrl.searchParams.get('mode') === 'review' ? 'review' : 'new';
      const legacyExcludeIds = request.nextUrl.searchParams.getAll('exclude');
      const parsed = parseLegacyMobilePracticeExcludeIds(legacyExcludeIds);
      if (!parsed.ok && parsed.reason === 'too_many') {
        return invalid('Use the mobile Practice POST resource for larger rounds.', 'PRACTICE_EXCLUSIONS_TOO_LARGE');
      }
      if (!parsed.ok) {
        return invalid('Every excluded card id must be valid.', 'INVALID_PRACTICE_EXCLUSIONS');
      }
      const [card, stats] = await Promise.all([
        getNextCard(mode, parsed.excludeIds, locale),
        getUserStats(),
      ]);
      return privateJson({
        card: card ? withMobileKnowledgeCompatibility(card, capabilities) : null,
        stats,
        cycled: false,
      });
    }
    case 'saved': {
      const [cards, stats] = await Promise.all([
        getSavedCards(locale),
        getUserStats(),
      ]);
      return privateJson({ cards: withMobileKnowledgeListCompatibility(cards, capabilities), stats });
    }
    case 'dashboard': {
      const [stats, domains] = await Promise.all([getUserStats(), getUserCardDomainProgress(locale)]);
      return privateJson({ stats, domains });
    }
    case 'ranking': {
      const rows = await getCardLeaderboard();
      return privateJson({
        rows: rows.map((row) => ({
          rank: row.rank,
          label: `Learner ${row.rank}`,
          participantId: row.participantId,
          isCurrentUser: row.isCurrentUser,
          explainable: row.explainable,
          avgScore: row.avgScore,
        })),
      });
    }
    default:
      return invalid('Unknown mobile resource.', 'UNKNOWN_MOBILE_RESOURCE');
  }
}

export async function POST(request: NextRequest) {
  const mobileUser = await requireMobileUser();
  if (!mobileUser) return unauthorized();

  if (request.nextUrl.searchParams.get('resource') === 'practice') {
    const explicitLocale = request.nextUrl.searchParams.get('locale');
    const localeInput = explicitLocale
      ?? request.headers.get('x-girapphe-locale')
      ?? parseAcceptLanguage(request.headers.get('accept-language'));
    const locale = parseContentLocale(localeInput);
    if (!locale) return invalid('The requested locale is not supported.', 'UNSUPPORTED_LOCALE');

    const capabilities = readMobileKnowledgeCapabilities(request.headers.get('x-girapphe-knowledge-capabilities'));
    return handleMobilePracticePost(request, {
      loadCard: (mode, cursor) => getNextMobilePracticeCard(mode, cursor, locale),
      loadStats: getUserStats,
      mapCard: (card) => withMobileKnowledgeCompatibility(card, capabilities),
    });
  }

  const parsedBody = await readBody(request);
  if (!parsedBody.ok) {
    return privateJson(
      { error: parsedBody.reason === 'too_large' ? 'The request body is too large.' : 'A small JSON object is required.' },
      { status: parsedBody.reason === 'too_large' ? 413 : 400 },
    );
  }
  const body = parsedBody.value;
  const capabilities = readMobileKnowledgeCapabilities(request.headers.get('x-girapphe-knowledge-capabilities'));

  const action = stringField(body.action, 64);
  if (!action) return invalid('An action is required.');

  if (action.startsWith('admin-')) {
    if (!await isMobileAdmin()) return privateJson({ error: 'Administrator access is required.' }, { status: 403 });
    if (action === 'admin-delete-node') {
      const id = stringField(body.id, 100); if (!id) return invalid('A node id is required.');
      await deleteAdminNode(id); return privateJson({ success: true });
    }
    if (action === 'admin-delete-edge') {
      const id = body.id; if (!Number.isInteger(id) || (id as number) < 1) return invalid('A valid edge id is required.');
      await deleteAdminEdge(id as number); return privateJson({ success: true });
    }
    if (action === 'admin-create-node') {
      const id = stringField(body.id, 100); const label = stringField(body.label, 200); const domain = stringField(body.domain, 50); const type = stringField(body.type, 50);
      if (!id || !label || !domain || !type || typeof body.level !== 'number' || typeof body.difficulty !== 'number') return invalid('Complete node fields are required.');
      await createAdminNode({ id, label, domain, type, level: body.level, difficulty: body.difficulty }); return privateJson({ success: true }, { status: 201 });
    }
    if (action === 'admin-create-edge') {
      const source = stringField(body.source, 100); const target = stringField(body.target, 100); const type = stringField(body.type, 50);
      if (!source || !target || !type || typeof body.weight !== 'number') return invalid('Complete edge fields are required.');
      await createAdminEdge({ source, target, type, weight: body.weight }); return privateJson({ success: true }, { status: 201 });
    }
    return invalid('Unknown administrator action.');
  }

  if (action === 'rate-card') {
    const cardId = stringField(body.cardId, 160);
    const status = body.status;
    if (!cardId || (status !== 'known' && status !== 'saved')) return invalid('A valid card and status are required.');
    return mutationResponse(await saveCardState(cardId, status as CardStatus));
  }

  if (action === 'remove-saved') {
    const cardId = stringField(body.cardId, 160);
    if (!cardId) return invalid('A card is required.');
    return mutationResponse(await removeSavedCard(cardId));
  }

  if (action === 'reset-progress') return mutationResponse(await resetUserCardProgress());

  if (action === 'approve-candidate' || action === 'ignore-candidate') {
    const batchId = stringField(body.batchId, 240);
    const draftId = stringField(body.draftId, 240);
    const draftVersion = body.draftVersion;
    if (!batchId || !draftId || typeof draftVersion !== 'number' || !Number.isSafeInteger(draftVersion) || draftVersion <= 0) return invalid('A valid candidate and version are required.');
    const context = await getKnowledgeDraftResolutionContext(draftId);
    if (!context || context.draft.batch_id !== batchId || context.draft.status !== 'pending') {
      return privateJson({ error: 'The candidate is no longer pending.', code: 'CANDIDATE_STALE' }, { status: 409 });
    }
    const preflight = classifyMobileCandidateMutationPreflight({
      action,
      draft: context.draft,
      draftVersion,
      capabilities,
    });
    if (preflight === 'stale') {
      return privateJson({ error: 'The candidate changed before review.', code: 'CANDIDATE_STALE' }, { status: 409 });
    }
    const candidateForm = toFormData({
      batch_id: batchId,
      draft_id: draftId,
      draft_version: String(draftVersion),
    });
    if (action === 'ignore-candidate') {
      const result = await ignoreKnowledgeDraft(candidateForm);
      return result.resolved
        ? privateJson(result)
        : privateJson({
          ...result,
          error: 'The candidate changed before it was ignored.',
          code: 'CANDIDATE_STALE',
        }, { status: 409 });
    }
    const draft = context.draft;
    if (preflight === 'knowledge-capability-required') {
      return privateJson({
        error: 'Update the app before approving knowledge features that are unavailable in this version.',
        code: 'KNOWLEDGE_CAPABILITY_REQUIRED',
      }, { status: 409 });
    }
    if (preflight === 'causal-review-required') {
      return privateJson({
        error: 'Review causal relationship targets, directions, and evidence in the detailed web review before approval.',
        code: 'CAUSAL_REVIEW_REQUIRED',
      }, { status: 409 });
    }
    candidateForm.set('resolution_action', 'create');
    candidateForm.set('title', draft.title);
    candidateForm.set('summary', draft.summary);
    candidateForm.set('content', draft.explanation);
    candidateForm.set('topic', draft.topic);
    candidateForm.set('tags', draft.tags.join(','));
    candidateForm.set('knowledge_type', draft.knowledge_type ?? '');
    candidateForm.set('central_question', draft.central_question ?? '');
    candidateForm.set('structured_content', draft.structured_content ? JSON.stringify(draft.structured_content) : '');
    candidateForm.set('bundle_schema_version', draft.bundle_schema_version ? String(draft.bundle_schema_version) : '');
    candidateForm.set('evidence_selectors_json', '[]');
    candidateForm.set('relations_json', '[]');
    candidateForm.set('lifecycle_patch_semantics', 'tri_state_v1');
    if (draft.structured_content?.type === 'event') {
      const occurredAt = new Date(draft.structured_content.occurred_at);
      if (!Number.isNaN(occurredAt.getTime())) {
        candidateForm.set('observed_at', occurredAt.toISOString());
      }
    }
    const result = await resolveKnowledgeDraft(candidateForm);
    if (result.resolved) return privateJson(result);
    if (result.pendingDependency) {
      return privateJson({
        ...result,
        error: 'A related candidate must be approved first.',
        code: 'CANDIDATE_DEPENDENCY_PENDING',
      }, { status: 409 });
    }
    return privateJson({
      ...result,
      error: 'The candidate changed before it was saved.',
      code: 'CANDIDATE_STALE',
    }, { status: 409 });
  }

  const id = stringField(body.id, 160);
  if (action === 'create-note') {
    const title = stringField(body.title, 240);
    const content = stringField(body.content, 8_000) ?? '';
    const topic = stringField(body.topic, 120) ?? '';
    const requestId = stringField(body.requestId, 160) ?? '';
    if (!title?.trim()) return invalid('A note title is required.');
    const summary = stringField(body.summary, 500) ?? '';
    const bundle = parseMobileBundle(body, capabilities);
    if (!bundle) return invalid('The structured knowledge bundle is invalid.', 'INVALID_KNOWLEDGE_BUNDLE');
    const tags = parseMobileTags(body.tags);
    if (!tags) return invalid('Tags must contain at most 12 valid values of 48 Unicode code points each.', 'INVALID_TAGS');
    const result = await createKnowledgeItemWithOutcome(toFormData({ title, summary, content, topic, tags: tags.join(','), request_id: requestId,
      knowledge_type: bundle.knowledgeType, central_question: bundle.centralQuestion, structured_content: bundle.structuredContent,
      bundle_schema_version: bundle.knowledgeType ? '1' : '' }));
    const response = toMobileNoteCreateHttpResult(result);
    return privateJson(response.body, { status: response.status });
  }

  if (!id) return invalid('A note id is required.');
  if (action === 'update-note') {
    const title = stringField(body.title, 240);
    const content = stringField(body.content, 8_000) ?? '';
    const topic = stringField(body.topic, 120) ?? '';
    if (!title?.trim()) return invalid('A note title is required.');
    const summary = stringField(body.summary, 500) ?? '';
    const bundle = parseMobileBundle(body, capabilities);
    if (!bundle) return invalid('The structured knowledge bundle is invalid.', 'INVALID_KNOWLEDGE_BUNDLE');
    const tags = parseMobileTags(body.tags);
    if (!tags) return invalid('Tags must contain at most 12 valid values of 48 Unicode code points each.', 'INVALID_TAGS');
    const resolvedVersion = await resolveMobileNoteUpdateVersion(
      body.version,
      () => getActiveKnowledgeItemVersionForUser(mobileUser.id, id),
    );
    if (!resolvedVersion.ok && resolvedVersion.reason === 'invalid') {
      return invalid('A valid note version is required.', 'INVALID_NOTE_VERSION');
    }
    if (!resolvedVersion.ok) {
      return privateJson({ error: 'The note was not found.', code: 'NOTE_NOT_FOUND' }, { status: 404 });
    }
    if (!capabilities.expression || !capabilities.eventChronology) {
      const currentItem = (await getUserKnowledgeItems()).find((item) => item.id === id);
      if (mobileKnowledgeEditRequiresCapability(currentItem, capabilities)) {
        return privateJson({
          error: 'Update the app before editing this structured note.',
          code: 'KNOWLEDGE_CAPABILITY_REQUIRED',
        }, { status: 409 });
      }
    }
    const version = resolvedVersion.version;
    const result = await updateKnowledgeItem(toFormData({ id, version: String(version), title, summary, content, topic, tags: tags.join(','), bundle_mode_present: '1',
      knowledge_type: bundle.knowledgeType, central_question: bundle.centralQuestion, structured_content: bundle.structuredContent,
      bundle_schema_version: bundle.knowledgeType ? '1' : '' }));
    if (!result.updated && 'stale' in result) {
      return privateJson({ ...result, error: 'The note changed before this edit was saved.', code: 'NOTE_STALE' }, { status: 409 });
    }
    if (!result.updated) {
      return privateJson({ ...result, error: 'The note was not found.', code: 'NOTE_NOT_FOUND' }, { status: 404 });
    }
    return privateJson({ success: true, version: result.version });
  }
  if (action === 'delete-note') {
    await deleteKnowledgeItem(toFormData({ id }));
    return privateJson({ success: true });
  }
  if (action === 'archive-note' || action === 'restore-archived-note') {
    const version = body.version;
    if (!Number.isSafeInteger(version) || (version as number) <= 0) {
      return invalid('A valid note version is required.', 'INVALID_NOTE_VERSION');
    }
    const result = action === 'archive-note'
      ? await archiveKnowledgeItem(toFormData({ id, version: String(version) }))
      : await restoreArchivedKnowledgeItem(toFormData({ id, version: String(version) }));
    if (result.stale || result.version === null) {
      return privateJson(
        { ...result, error: 'The note changed before its archive state was updated.', code: 'NOTE_STALE' },
        { status: 409 },
      );
    }
    return privateJson({ success: true, archived: result.archived, version: result.version });
  }
  if (action === 'restore-note') {
    await restoreKnowledgeItem(toFormData({ id }));
    return privateJson({ success: true });
  }

  return invalid('Unknown mobile action.', 'UNKNOWN_MOBILE_ACTION');
}
