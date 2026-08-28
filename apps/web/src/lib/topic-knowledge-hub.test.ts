import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createKnowledgeDraftBatchForUser,
  createMemoryKnowledgeItemForUser,
  getKnowledgeDraftBatchForUser,
  getKnowledgeDuplicateSuggestionsForDraftsForUser,
  getKnowledgeDuplicateSuggestionsForUser,
  getMemoryKnowledgeItemsForUser,
  getMemoryKnowledgeEvidenceForUser,
  getMemoryKnowledgeSourcesForUser,
  recordKnowledgeReuseForUser,
  resolveKnowledgeDraftForUser,
  sanitizeKnowledgeEvidenceSelectors,
  softDeleteMemoryKnowledgeItemForUser,
  supersedeKnowledgeItemForUser,
  verifyKnowledgeItemForUser,
} from './knowledge-ingestion';
import {
  buildTopicKnowledgeContextPackForUser,
  getActiveKnowledgeTopicSummariesForUser,
  getTopicKnowledgeHubForUser,
  serializeTopicKnowledgeHub,
} from './topic-knowledge-hub';

const previousDatabaseUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;
test.after(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

test('topic page uses the already-decoded Next.js route parameter exactly once', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const topicPage = readFileSync(join(sourceDir, '../app/topics/[topic]/page.tsx'), 'utf8');

  assert.doesNotMatch(topicPage, /decodeURIComponent\(topicParam\)/);
  assert.match(topicPage, /getTopicKnowledgeHubForUser\(user\.id, topicParam\)/);
});

test('an empty topic hub reports the current request time instead of the Unix epoch', async () => {
  const beforeRequest = Date.now();
  const hub = await getTopicKnowledgeHubForUser(
    `user_empty_topic_${crypto.randomUUID()}`,
    'Empty topic',
  );
  const afterRequest = Date.now();
  const generatedAt = Date.parse(hub.generated_at);

  assert.deepEqual(hub.items, []);
  assert.ok(generatedAt >= beforeRequest);
  assert.ok(generatedAt <= afterRequest);
});

test('duplicate suggestions are deterministic, advisory, and owner scoped', async () => {
  const userId = `user_duplicate_owner_${crypto.randomUUID()}`;
  const otherUserId = `user_duplicate_other_${crypto.randomUUID()}`;
  const owned = createMemoryKnowledgeItemForUser(userId, {
    title: 'Daily reset effect',
    summary: 'Compounding changes multi-day results.',
    content: 'Daily reset changes the path over time.',
    topic: 'Leveraged ETFs',
  });
  createMemoryKnowledgeItemForUser(otherUserId, {
    title: 'Daily reset effect',
    content: 'This belongs to another owner.',
    topic: 'Leveraged ETFs',
  });
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'chatgpt',
    requestId: `duplicate-${crypto.randomUUID()}`,
    cards: [{ title: 'Daily reset effect', topic: 'Leveraged ETFs' }],
  });
  const loaded = await getKnowledgeDraftBatchForUser(userId, created.batchId);
  assert.ok(loaded);

  const suggestions = await getKnowledgeDuplicateSuggestionsForUser(userId, loaded.drafts[0]);
  assert.equal(suggestions[0]?.id, owned.id);
  assert.equal(suggestions[0]?.match, 'exact');
  assert.equal(suggestions[0]?.score, 1);
  assert.equal(getMemoryKnowledgeItemsForUser(userId).length, 1);
});

test('batch duplicate suggestions match the owner-scoped single-draft contract', async () => {
  const userId = `user_duplicate_batch_${crypto.randomUUID()}`;
  createMemoryKnowledgeItemForUser(userId, {
    title: 'First canonical item', content: 'First canonical content.', topic: 'Batch duplicates',
  });
  createMemoryKnowledgeItemForUser(userId, {
    title: 'Second canonical item', content: 'Second canonical content.', topic: 'Batch duplicates',
  });
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'chatgpt', requestId: `duplicate-batch-${crypto.randomUUID()}`,
    cards: [
      { title: 'First canonical item', topic: 'Batch duplicates' },
      { title: 'Second canonical item', topic: 'Batch duplicates' },
    ],
  });
  const drafts = (await getKnowledgeDraftBatchForUser(userId, created.batchId))!.drafts;
  const batched = await getKnowledgeDuplicateSuggestionsForDraftsForUser(userId, drafts);
  for (const draft of drafts) {
    assert.deepEqual(batched[draft.id], await getKnowledgeDuplicateSuggestionsForUser(userId, draft));
  }
});

test('merge requires both optimistic versions and writes reviewed history, provenance, and selector-only evidence', async () => {
  const userId = `user_resolution_merge_${crypto.randomUUID()}`;
  const target = createMemoryKnowledgeItemForUser(userId, {
    title: 'Original decision',
    summary: 'Initial state.',
    content: 'Initial reviewed content.',
    topic: 'Architecture',
  });
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'claude',
    requestId: `merge-${crypto.randomUUID()}`,
    conversationRef: 'opaque-current-conversation-ref',
    sourceUrl: 'https://example.com/current-conversation',
    discussedAt: '2026-08-28T01:00:00.000Z',
    cards: [{
      title: 'Updated decision',
      summary: 'Pending update.',
      topic: 'Architecture',
      proposedEvidence: [{
        selectorType: 'message',
        messageRef: 'message-7',
        polarity: 'supports',
        quality: 'high',
        relationOrigin: 'explicit_user',
      }],
    }],
  });
  const loaded = await getKnowledgeDraftBatchForUser(userId, created.batchId);
  assert.ok(loaded);
  const draft = loaded.drafts[0];

  const stale = await resolveKnowledgeDraftForUser(userId, {
    batchId: created.batchId,
    draftId: draft.id,
    expectedDraftVersion: draft.version,
    action: 'merge',
    targetKnowledgeItemId: target.id,
    expectedTargetVersion: target.version + 1,
    reviewed: {
      title: 'Final reviewed decision',
      summary: 'The final summary.',
      content: 'The user-reviewed final content, without synthesized merging.',
      topic: 'Architecture',
      tags: ['reviewed'],
      knowledgeType: null,
      centralQuestion: null,
      structuredContent: null,
      bundleSchemaVersion: null,
      evidenceSelectors: [{
        selectorType: 'message',
        messageRef: 'message-7',
        polarity: 'supports',
        quality: 'high',
        relationOrigin: 'explicit_user',
      }],
    },
  });
  assert.equal(stale.resolved, false);
  assert.equal(stale.stale, true);

  const resolved = await resolveKnowledgeDraftForUser(userId, {
    batchId: created.batchId,
    draftId: draft.id,
    expectedDraftVersion: draft.version,
    action: 'merge',
    targetKnowledgeItemId: target.id,
    expectedTargetVersion: target.version,
    reviewed: {
      title: 'Final reviewed decision',
      summary: 'The final summary.',
      content: 'The user-reviewed final content, without synthesized merging.',
      topic: 'Architecture',
      tags: ['reviewed'],
      knowledgeType: null,
      centralQuestion: null,
      structuredContent: null,
      bundleSchemaVersion: null,
      evidenceSelectors: [{
        selectorType: 'message',
        messageRef: 'message-7',
        polarity: 'supports',
        quality: 'high',
        relationOrigin: 'explicit_user',
      }],
    },
  });
  assert.deepEqual(resolved, {
    resolved: true,
    action: 'merge',
    knowledgeItemId: target.id,
    version: 2,
  });
  assert.equal(getMemoryKnowledgeItemsForUser(userId)[0]?.content, 'The user-reviewed final content, without synthesized merging.');

  const hub = await getTopicKnowledgeHubForUser(userId, 'Architecture');
  assert.deepEqual(hub.revisions.map((revision) => revision.version), [1, 2]);
  assert.equal(hub.sources[0]?.source_url, 'https://example.com/current-conversation');
  assert.equal(hub.evidence_selectors[0]?.selector_type, 'message');
  assert.deepEqual(hub.evidence_selectors[0]?.selector, { message_ref: 'message-7' });
  assert.doesNotMatch(JSON.stringify(hub.evidence_selectors), /transcript|excerpt|quote/i);
  const resolutionState = await getKnowledgeDraftBatchForUser(userId, created.batchId);
  assert.equal(resolutionState?.drafts[0]?.resolution_action, 'merge');
  assert.equal(resolutionState?.drafts[0]?.target_knowledge_item_id, target.id);

  const memorySource = getMemoryKnowledgeSourcesForUser(userId)[0];
  assert.ok(memorySource);
  memorySource.source_url = 'https://legacy.example.com/source?access_token=secret#private';
  memorySource.conversation_ref = 'HTTPS://user:password@legacy.example.com/conversation';
  let sanitizedHub = await getTopicKnowledgeHubForUser(userId, 'Architecture');
  assert.equal(sanitizedHub.sources[0]?.source_url, 'https://legacy.example.com/source');
  assert.equal(sanitizedHub.sources[0]?.conversation_ref, null);

  const memoryEvidence = getMemoryKnowledgeEvidenceForUser(userId)[0];
  assert.ok(memoryEvidence);
  memoryEvidence.selector = {
    selectorType: 'external_ref',
    sourceRef: 'https://legacy.example.com/evidence?signature=secret#private',
    polarity: 'supports',
    quality: 'high',
    relationOrigin: 'extracted_from_source',
  };
  sanitizedHub = await getTopicKnowledgeHubForUser(userId, 'Architecture');
  assert.deepEqual(sanitizedHub.evidence_selectors[0]?.selector, {
    source_ref: 'https://legacy.example.com/evidence',
  });

  memorySource.source_url = 'HTTPS://user:password@legacy.example.com/untrusted';
  memoryEvidence.selector.sourceRef = 'HTTPS://user:password@legacy.example.com/evidence';
  sanitizedHub = await getTopicKnowledgeHubForUser(userId, 'Architecture');
  assert.equal(sanitizedHub.sources[0]?.source_url, null);
  assert.deepEqual(sanitizedHub.evidence_selectors[0]?.selector, {});
});

test('ignore resolves a draft without creating canonical knowledge', async () => {
  const userId = `user_resolution_ignore_${crypto.randomUUID()}`;
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'gemini',
    requestId: `ignore-${crypto.randomUUID()}`,
    cards: [{ title: 'Do not save this', topic: 'Inbox' }],
  });
  const loaded = await getKnowledgeDraftBatchForUser(userId, created.batchId);
  assert.ok(loaded);
  const draft = loaded.drafts[0];
  const result = await resolveKnowledgeDraftForUser(userId, {
    batchId: created.batchId,
    draftId: draft.id,
    expectedDraftVersion: draft.version,
    action: 'ignore',
  });
  assert.equal(result.resolved, true);
  assert.equal(getMemoryKnowledgeItemsForUser(userId).length, 0);
  const resolved = await getKnowledgeDraftBatchForUser(userId, created.batchId);
  assert.equal(resolved?.batch.status, 'discarded');
  assert.equal(resolved?.drafts[0]?.resolution_action, 'ignore');
});

test('verification, supersession, bounded context, and reuse activity preserve active-only defaults', async () => {
  const userId = `user_lifecycle_hub_${crypto.randomUUID()}`;
  const oldItem = createMemoryKnowledgeItemForUser(userId, {
    title: 'Old runbook',
    content: 'Old content.',
    topic: 'Release',
  });
  const replacement = createMemoryKnowledgeItemForUser(userId, {
    title: 'Current runbook',
    content: 'Current content.',
    topic: 'Release',
  });
  const verified = await verifyKnowledgeItemForUser(
    userId,
    replacement.id,
    replacement.version,
    '2026-09-28T00:00:00.000Z',
  );
  assert.deepEqual(verified, { verified: true, version: 2 });
  const superseded = await supersedeKnowledgeItemForUser(
    userId,
    oldItem.id,
    replacement.id,
    oldItem.version,
    'The new runbook replaces the old process.',
  );
  assert.deepEqual(superseded, { superseded: true });

  const hub = await getTopicKnowledgeHubForUser(userId, 'Release');
  assert.deepEqual(hub.items.map((item) => item.id), [replacement.id]);
  assert.equal(hub.supersessions[0]?.superseded_item_id, oldItem.id);
  assert.ok(hub.activity.some((entry) => entry.activity_type === 'verified'));
  const withSuperseded = await getTopicKnowledgeHubForUser(userId, 'Release', { includeSuperseded: true });
  assert.deepEqual(new Set(withSuperseded.items.map((item) => item.id)), new Set([oldItem.id, replacement.id]));

  const context = await buildTopicKnowledgeContextPackForUser(userId, 'Release', {
    itemIds: [replacement.id, oldItem.id],
    maxItems: 10,
  });
  assert.deepEqual(context.items.map((item) => item.id), [replacement.id]);
  const recorded = await recordKnowledgeReuseForUser(userId, context.items.map((item) => item.id), {
    topic: context.topic,
    format: 'json',
    count: context.items.length,
  });
  assert.equal(recorded, 1);
  const afterReuse = await getTopicKnowledgeHubForUser(userId, 'Release');
  const reuse = afterReuse.activity.find((entry) => entry.activity_type === 'reused');
  assert.deepEqual(reuse?.metadata, { topic: 'release', format: 'json', count: 1 });
  assert.equal(serializeTopicKnowledgeHub(afterReuse, 'json'), serializeTopicKnowledgeHub(afterReuse, 'json'));
});

test('a moved replacement preserves the old topic audit trail without exposing it in an explicit context pack', async () => {
  const userId = `user_moved_topic_history_${crypto.randomUUID()}`;
  const oldItem = createMemoryKnowledgeItemForUser(userId, {
    title: 'Old release checklist',
    content: 'The previous release steps.',
    topic: 'Release',
  });
  const replacement = createMemoryKnowledgeItemForUser(userId, {
    title: 'Architecture-owned release automation',
    content: 'The replacement moved to an architecture topic.',
    topic: 'Architecture',
  });
  assert.deepEqual(await supersedeKnowledgeItemForUser(
    userId,
    oldItem.id,
    replacement.id,
    oldItem.version,
    'The automation replaces the old checklist.',
  ), { superseded: true });

  const oldTopicHub = await getTopicKnowledgeHubForUser(userId, 'Release');
  assert.deepEqual(oldTopicHub.items, []);
  assert.equal(oldTopicHub.supersessions[0]?.superseded_item_id, oldItem.id);
  assert.equal(oldTopicHub.supersessions[0]?.replacement_item_id, replacement.id);
  assert.ok(oldTopicHub.revisions.length >= 1);
  assert.ok(oldTopicHub.revisions.every((revision) => revision.knowledge_item_id === oldItem.id));
  assert.notEqual(oldTopicHub.generated_at, '1970-01-01T00:00:00.000Z');
  assert.equal(
    serializeTopicKnowledgeHub(oldTopicHub, 'json'),
    serializeTopicKnowledgeHub(await getTopicKnowledgeHubForUser(userId, 'Release'), 'json'),
  );

  const explicitContext = await buildTopicKnowledgeContextPackForUser(userId, 'Architecture', {
    itemIds: [replacement.id],
  });
  const serialized = serializeTopicKnowledgeHub(explicitContext, 'json');
  assert.doesNotMatch(serialized, new RegExp(oldItem.id, 'u'));
  assert.deepEqual(explicitContext.supersessions, []);
});

test('explicit context selection queries an item older than the newest two-hundred-item hub window', async () => {
  const userId = `user_explicit_old_item_${crypto.randomUUID()}`;
  const oldItem = createMemoryKnowledgeItemForUser(userId, {
    title: 'Explicitly selected old item',
    content: 'This item must survive pre-filter fetching.',
    topic: 'Large topic',
  });
  oldItem.updated_at = '2020-01-01T00:00:00.000Z';
  const newerItems: ReturnType<typeof createMemoryKnowledgeItemForUser>[] = [];
  for (let index = 0; index < 210; index += 1) {
    newerItems.push(createMemoryKnowledgeItemForUser(userId, {
      title: `Newer item ${String(index).padStart(2, '0')}`,
      content: `Newer content ${index}.`,
      topic: 'Large topic',
    }));
  }

  const defaultWindow = await getTopicKnowledgeHubForUser(userId, 'Large topic', { maxItems: 200 });
  assert.equal(defaultWindow.items.length, 200);
  assert.equal(defaultWindow.items.some((item) => item.id === oldItem.id), false);
  const context = await buildTopicKnowledgeContextPackForUser(userId, 'Large topic', {
    itemIds: [oldItem.id],
  });
  assert.deepEqual(context.items.map((item) => item.id), [oldItem.id]);

  const sixtyItemContext = await buildTopicKnowledgeContextPackForUser(userId, 'Large topic', {
    itemIds: newerItems.slice(0, 60).map((item) => item.id),
  });
  assert.equal(sixtyItemContext.items.length, 60);
  assert.deepEqual(
    new Set(sixtyItemContext.items.map((item) => item.id)),
    new Set(newerItems.slice(0, 60).map((item) => item.id)),
  );
});

test('active topic summaries are owner scoped, deterministic, and exclude archived, deleted, and superseded items', async () => {
  const userId = `user_topic_summaries_${crypto.randomUUID()}`;
  const otherUserId = `user_topic_summaries_other_${crypto.randomUUID()}`;
  const activeQuestion = createMemoryKnowledgeItemForUser(userId, {
    title: 'Open deployment question',
    content: 'What remains unresolved?',
    topic: 'Planning',
    knowledgeType: 'question',
    centralQuestion: 'What remains unresolved?',
    structuredContent: {
      type: 'question',
      question: 'What remains unresolved?',
      context: 'Deployment planning.',
      known_facts: [],
      hypotheses: [],
      next_steps: ['Review the release gate.'],
      answer_summary: '',
      status: 'open',
    },
    bundleSchemaVersion: 1,
  });
  const answeredQuestion = createMemoryKnowledgeItemForUser(userId, {
    title: 'Answered deployment question',
    content: 'The release path is known.',
    topic: 'Planning',
    knowledgeType: 'question',
    centralQuestion: 'Which release path should we use?',
    structuredContent: {
      type: 'question',
      question: 'Which release path should we use?',
      context: 'Deployment planning.',
      known_facts: ['The protected path is required.'],
      hypotheses: [],
      next_steps: [],
      answer_summary: 'Use the protected release path.',
      status: 'answered',
    },
    bundleSchemaVersion: 1,
  });
  const decision = createMemoryKnowledgeItemForUser(userId, {
    title: 'Deployment decision',
    content: 'Use the protected release path.',
    topic: 'Planning',
    knowledgeType: 'decision',
  });
  const event = createMemoryKnowledgeItemForUser(userId, {
    title: 'Deployment event',
    content: 'The preview was deployed.',
    topic: 'Planning',
    knowledgeType: 'event',
  });
  const concept = createMemoryKnowledgeItemForUser(userId, {
    title: 'Release concept',
    content: 'A supporting concept.',
    topic: 'Planning',
    knowledgeType: 'concept',
  });
  const oldQuestion = createMemoryKnowledgeItemForUser(userId, {
    title: 'Superseded question',
    content: 'This no longer counts as open.',
    topic: 'Planning',
    knowledgeType: 'question',
  });
  const movedReplacement = createMemoryKnowledgeItemForUser(userId, {
    title: 'Moved replacement',
    content: 'This belongs to another topic.',
    topic: 'Architecture',
  });
  assert.deepEqual(await supersedeKnowledgeItemForUser(
    userId,
    oldQuestion.id,
    movedReplacement.id,
    oldQuestion.version,
    'Resolved elsewhere.',
  ), { superseded: true });
  const archived = createMemoryKnowledgeItemForUser(userId, {
    title: 'Archived planning item',
    content: 'Archived.',
    topic: 'Planning',
  });
  archived.archived_at = '2026-08-28T00:00:00.000Z';
  const deleted = createMemoryKnowledgeItemForUser(userId, {
    title: 'Deleted planning item',
    content: 'Deleted.',
    topic: 'Planning',
  });
  softDeleteMemoryKnowledgeItemForUser(userId, deleted.id, 30);
  createMemoryKnowledgeItemForUser(otherUserId, {
    title: 'Another owner planning item',
    content: 'Private to another owner.',
    topic: 'Planning',
  });

  activeQuestion.updated_at = '2026-08-28T04:00:00.000Z';
  decision.updated_at = '2026-08-28T03:00:00.000Z';
  event.updated_at = '2026-08-28T02:00:00.000Z';
  concept.updated_at = '2026-08-28T01:00:00.000Z';
  answeredQuestion.updated_at = '2026-08-28T00:30:00.000Z';
  const summaries = await getActiveKnowledgeTopicSummariesForUser(userId);
  const planning = summaries.find((summary) => summary.topic === 'planning');
  assert.deepEqual(planning, {
    topic: 'planning',
    item_count: 5,
    open_question_count: 1,
    decision_count: 1,
    event_count: 1,
    source_count: 0,
    last_updated_at: activeQuestion.updated_at,
    sample_titles: ['Open deployment question', 'Deployment decision', 'Deployment event'],
  });
  assert.equal((planning?.sample_titles.length ?? 0) <= 3, true);
  assert.deepEqual(summaries, await getActiveKnowledgeTopicSummariesForUser(userId));
});

test('evidence sanitizer rejects transcript-like payloads instead of storing excerpts', () => {
  assert.deepEqual(sanitizeKnowledgeEvidenceSelectors([{
    selectorType: 'message',
    messageRef: 'message-1',
    excerpt: 'raw conversation text',
    polarity: 'supports',
    quality: 'high',
    relationOrigin: 'explicit_user',
  }]), []);
  assert.deepEqual(sanitizeKnowledgeEvidenceSelectors([{
    selectorType: 'text_position',
    start: 5,
    end: 12,
    polarity: 'contradicts',
    quality: 'medium',
    relationOrigin: 'extracted_from_source',
  }]), [{
    selectorType: 'text_position',
    start: 5,
    end: 12,
    polarity: 'contradicts',
    quality: 'medium',
    relationOrigin: 'extracted_from_source',
  }]);
});
