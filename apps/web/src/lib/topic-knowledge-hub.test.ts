import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import db from './db';
import {
  createKnowledgeDraftBatchForUser,
  createMemoryKnowledgeItemForUser,
  getKnowledgeDraftBatchForUser,
  getKnowledgeDuplicateSuggestionsForDraftsForUser,
  getKnowledgeDuplicateSuggestionsForUser,
  getMemoryKnowledgeItemsForUser,
  getMemoryKnowledgeSupersessionsForUser,
  getMemoryKnowledgeEvidenceForUser,
  getMemoryKnowledgeSourcesForUser,
  purgeMemoryKnowledgeItemsForUser,
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

test('cross-topic relationship views retain the reviewed evidence selector', async () => {
  const userId = `user_cross_topic_evidence_${crypto.randomUUID()}`;
  const target = createMemoryKnowledgeItemForUser(userId, {
    title: 'Effect in another topic',
    content: 'The effect belongs to a different topic.',
    topic: 'Effects',
  });
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'chatgpt',
    requestId: `cross-topic-evidence-${crypto.randomUUID()}`,
    cards: [{
      title: 'Cross-topic cause',
      topic: 'Causes',
      proposedEvidence: [{
        selectorType: 'message',
        messageRef: 'cross-topic-message',
        polarity: 'supports',
        quality: 'high',
        relationOrigin: 'explicit_user',
      }],
      relations: [{
        targetKind: 'private',
        targetId: target.id,
        type: 'causes',
        relationOrigin: 'explicit_user',
        evidenceSelectorIndexes: [0],
      }],
    }],
  });
  const draft = (await getKnowledgeDraftBatchForUser(userId, created.batchId))!.drafts[0];
  assert.equal((await resolveKnowledgeDraftForUser(userId, {
    batchId: created.batchId,
    draftId: draft.id,
    expectedDraftVersion: draft.version,
    action: 'create',
    reviewed: {
      title: draft.title,
      summary: draft.summary,
      content: draft.explanation,
      topic: draft.topic,
      tags: draft.tags,
      knowledgeType: draft.knowledge_type,
      centralQuestion: draft.central_question,
      structuredContent: draft.structured_content,
      bundleSchemaVersion: draft.bundle_schema_version,
      evidenceSelectors: draft.proposed_evidence,
      relations: draft.relations,
    },
  })).resolved, true);

  const oppositeTopicHub = await getTopicKnowledgeHubForUser(userId, 'Effects');
  assert.equal(oppositeTopicHub.relations.length, 1);
  assert.equal(oppositeTopicHub.evidence_selectors.length, 1);
  assert.equal(
    oppositeTopicHub.evidence_selectors[0]?.id,
    oppositeTopicHub.relations[0]?.evidence_span_ids[0],
  );
  assert.deepEqual(oppositeTopicHub.evidence_selectors[0]?.selector, { message_ref: 'cross-topic-message' });
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
    skippedEdges: 0,
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
    format: 'json',
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

test('expired guest knowledge stays out of topic hubs, summaries, exports, and context packs before purge cleanup', async () => {
  const userId = `user_expired_guest_topic_${crypto.randomUUID()}`;
  const expired = createMemoryKnowledgeItemForUser(userId, {
    title: 'Expired guest decision',
    content: 'Expired guest content must not remain visible.',
    topic: 'Guest retention',
  });
  const retained = createMemoryKnowledgeItemForUser(userId, {
    title: 'Retained guest decision',
    content: 'This guest item is still inside its retention window.',
    topic: 'Guest retention',
  });
  assert.deepEqual(await supersedeKnowledgeItemForUser(
    userId,
    expired.id,
    retained.id,
    expired.version,
    'The retained decision replaces the expired decision.',
  ), { superseded: true });
  expired.purge_at = new Date(Date.now() - 60_000).toISOString();
  retained.purge_at = new Date(Date.now() + 60_000).toISOString();

  const hub = await getTopicKnowledgeHubForUser(userId, 'Guest retention', {
    includeSuperseded: true,
  });
  assert.deepEqual(hub.items.map((item) => item.id), [retained.id]);
  assert.equal(hub.revisions.some((revision) => revision.knowledge_item_id === expired.id), false);
  assert.equal(hub.supersessions.some((entry) => entry.superseded_item_id === expired.id), false);
  assert.equal(getMemoryKnowledgeItemsForUser(userId).some((item) => item.id === expired.id), false);

  const summaries = await getActiveKnowledgeTopicSummariesForUser(userId);
  assert.deepEqual(summaries.map((summary) => ({
    topic: summary.topic,
    item_count: summary.item_count,
    sample_titles: summary.sample_titles,
  })), [{
    topic: 'guest-retention',
    item_count: 1,
    sample_titles: ['Retained guest decision'],
  }]);

  const context = await buildTopicKnowledgeContextPackForUser(userId, 'Guest retention', {
    format: 'json',
    itemIds: [expired.id, retained.id],
  });
  assert.deepEqual(context.items.map((item) => item.id), [retained.id]);
  const exported = serializeTopicKnowledgeHub(hub, 'json');
  const contextExport = serializeTopicKnowledgeHub(context, 'json');
  assert.doesNotMatch(exported, /Expired guest decision|Expired guest content/u);
  assert.doesNotMatch(contextExport, /Expired guest decision|Expired guest content/u);
  assert.doesNotMatch(exported, new RegExp(expired.id, 'u'));
  assert.doesNotMatch(contextExport, new RegExp(expired.id, 'u'));
});

test('PostgreSQL topic queries exclude inactive relation endpoints and retain only visible history', async () => {
  const originalQuery = db.query;
  const queries: string[] = [];
  process.env.DATABASE_URL = 'postgresql://mock.invalid/girapphe';
  db.query = (async (text: string) => {
    queries.push(text);
    return { rows: [] };
  }) as typeof db.query;
  try {
    await getTopicKnowledgeHubForUser('database-retention-user', 'Guest retention');
    await getActiveKnowledgeTopicSummariesForUser('database-retention-user');
  } finally {
    db.query = originalQuery;
    delete process.env.DATABASE_URL;
  }

  const itemQuery = queries.find((query) => query.includes('AND ($3::boolean OR i.archived_at IS NULL)'));
  assert.ok(itemQuery);
  assert.match(itemQuery, /i\.purge_at IS NULL OR i\.purge_at > NOW\(\)/u);

  const historyQuery = queries.find((query) => query.includes('WITH RECURSIVE topic_history_seed'));
  assert.ok(historyQuery);
  assert.match(historyQuery, /predecessor\.purge_at IS NULL OR predecessor\.purge_at > NOW\(\)/u);
  assert.match(historyQuery, /WHERE i\.purge_at IS NULL OR i\.purge_at > NOW\(\)/u);

  const relationQuery = queries.find((query) => query.includes('FROM user_graph_edges e'));
  assert.ok(relationQuery);
  assert.match(relationQuery, /sn\.deleted_at IS NULL/u);
  assert.match(relationQuery, /tn\.deleted_at IS NULL/u);
  assert.match(relationQuery, /si\.deleted_at IS NULL AND si\.archived_at IS NULL/u);
  assert.match(relationQuery, /ti\.deleted_at IS NULL AND ti\.archived_at IS NULL/u);
  assert.match(relationQuery, /si\.purge_at IS NULL OR si\.purge_at > NOW\(\)/u);
  assert.match(relationQuery, /ti\.purge_at IS NULL OR ti\.purge_at > NOW\(\)/u);
  assert.match(relationQuery, /source_supersession\.user_id = si\.user_id/u);
  assert.match(relationQuery, /source_supersession\.superseded_item_id = si\.id/u);
  assert.match(relationQuery, /target_supersession\.user_id = ti\.user_id/u);
  assert.match(relationQuery, /target_supersession\.superseded_item_id = ti\.id/u);
  assert.match(relationQuery, /e\.source_private_node_id IS NULL OR si\.id IS NOT NULL/u);
  assert.match(relationQuery, /e\.target_private_node_id IS NULL OR ti\.id IS NOT NULL/u);

  const supersessionQuery = queries.find((query) => query.includes('JOIN user_knowledge_items superseded_item'));
  assert.ok(supersessionQuery);
  assert.match(supersessionQuery, /superseded_item\.purge_at IS NULL OR superseded_item\.purge_at > NOW\(\)/u);

  const summaryQuery = queries.find((query) => query.includes('WITH active_items AS'));
  assert.ok(summaryQuery);
  assert.match(summaryQuery, /i\.purge_at IS NULL OR i\.purge_at > NOW\(\)/u);
});

test('PostgreSQL topic hubs load selectors referenced by cross-topic relations', async () => {
  const originalQuery = db.query;
  const now = '2026-08-29T00:00:00.000Z';
  process.env.DATABASE_URL = 'postgresql://mock.invalid/girapphe';
  db.query = (async (text: string, params?: unknown[]) => {
    if (text.includes('ORDER BY i.updated_at DESC, i.id') && text.includes('LIMIT $6')) {
      return { rows: [{
        id: 'topic-item',
        title: 'Topic item',
        summary: '',
        content: 'Topic content',
        topic: 'effects',
        tags: [],
        knowledge_type: null,
        central_question: null,
        structured_content: null,
        bundle_schema_version: null,
        version: 1,
        created_at: now,
        updated_at: now,
      }] };
    }
    if (text.includes('FROM user_graph_edges e')) {
      return { rows: [{
        id: 'cross-topic-edge',
        source: 'personal:other-topic-item',
        target: 'personal:topic-item',
        type: 'causes',
        origin: 'conversation',
        relation_origin: 'explicit_user',
        confirmed_at: now,
        evidence_span_ids: ['cross-topic-evidence'],
      }] };
    }
    if (text.includes('FROM knowledge_evidence_spans')) {
      assert.deepEqual(params, ['database-cross-topic-user', ['topic-item'], ['cross-topic-evidence']]);
      return { rows: [{
        id: 'cross-topic-evidence',
        knowledge_item_id: 'other-topic-item',
        source_id: 'other-topic-source',
        selector_type: 'message',
        selector: { message_ref: 'cross-topic-message' },
        polarity: 'supports',
        quality: 'high',
        relation_origin: 'explicit_user',
        confirmed_at: now,
        created_at: now,
      }] };
    }
    return { rows: [] };
  }) as typeof db.query;
  try {
    const hub = await getTopicKnowledgeHubForUser('database-cross-topic-user', 'Effects');
    assert.deepEqual(hub.relations[0]?.evidence_span_ids, ['cross-topic-evidence']);
    assert.equal(hub.evidence_selectors[0]?.id, 'cross-topic-evidence');
    assert.deepEqual(hub.evidence_selectors[0]?.selector, { message_ref: 'cross-topic-message' });
  } finally {
    db.query = originalQuery;
    delete process.env.DATABASE_URL;
  }
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
    format: 'json',
    itemIds: [replacement.id],
  });
  const serialized = serializeTopicKnowledgeHub(explicitContext, 'json');
  assert.doesNotMatch(serialized, new RegExp(oldItem.id, 'u'));
  assert.deepEqual(explicitContext.supersessions, []);
});

test('purging a replacement retains a tombstone that keeps the prior item superseded', async () => {
  const userId = `user_purged_replacement_${crypto.randomUUID()}`;
  const prior = createMemoryKnowledgeItemForUser(userId, {
    title: 'Prior canonical answer',
    content: 'This answer was replaced.',
    topic: 'Retention',
  });
  const replacement = createMemoryKnowledgeItemForUser(userId, {
    title: 'Replacement answer',
    content: 'This became canonical.',
    topic: 'Retention',
  });
  assert.deepEqual(await supersedeKnowledgeItemForUser(
    userId,
    prior.id,
    replacement.id,
    prior.version,
    'The replacement became canonical.',
  ), { superseded: true });

  softDeleteMemoryKnowledgeItemForUser(userId, replacement.id, 0, { syncGraph: false });
  purgeMemoryKnowledgeItemsForUser(userId);

  assert.equal(getMemoryKnowledgeItemsForUser(userId).some((item) => item.id === replacement.id), false);
  const activeHub = await getTopicKnowledgeHubForUser(userId, 'Retention');
  assert.deepEqual(activeHub.items, []);
  const historyHub = await getTopicKnowledgeHubForUser(userId, 'Retention', { includeSuperseded: true });
  assert.equal(historyHub.items[0]?.id, prior.id);
  assert.equal(historyHub.supersessions[0]?.superseded_item_id, prior.id);
  assert.equal(historyHub.supersessions[0]?.replacement_item_id, replacement.id);
  assert.ok(historyHub.activity.some((entry) => entry.metadata.replacement_item_id === replacement.id));

  softDeleteMemoryKnowledgeItemForUser(userId, prior.id, 0, { syncGraph: false });
  purgeMemoryKnowledgeItemsForUser(userId);
  assert.deepEqual(getMemoryKnowledgeSupersessionsForUser(userId), []);
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
    format: 'json',
    itemIds: [oldItem.id],
  });
  assert.deepEqual(context.items.map((item) => item.id), [oldItem.id]);

  const sixtyItemContext = await buildTopicKnowledgeContextPackForUser(userId, 'Large topic', {
    format: 'json',
    itemIds: newerItems.slice(0, 60).map((item) => item.id),
  });
  assert.equal(sixtyItemContext.items.length, 60);
  assert.deepEqual(
    new Set(sixtyItemContext.items.map((item) => item.id)),
    new Set(newerItems.slice(0, 60).map((item) => item.id)),
  );
});

test('context pack size validation measures the requested serialization format', async () => {
  const userId = `user_context_format_size_${crypto.randomUUID()}`;
  const item = createMemoryKnowledgeItemForUser(userId, {
    title: 'Compact Markdown context',
    content: 'The readable projection is intentionally compact.',
    topic: 'Format-aware context',
    knowledgeType: 'concept',
    centralQuestion: 'Which serialization should define the response limit?',
    structuredContent: {
      type: 'concept',
      definition: 'x'.repeat(3_000),
      key_points: [],
      examples: [],
      non_examples: [],
      misconceptions: [],
    },
    bundleSchemaVersion: 1,
  });
  const markdownPack = await buildTopicKnowledgeContextPackForUser(userId, 'Format-aware context', {
    format: 'markdown',
    itemIds: [item.id],
  });
  const encoder = new TextEncoder();
  const markdownBytes = encoder.encode(serializeTopicKnowledgeHub(markdownPack, 'markdown')).byteLength;
  const jsonBytes = encoder.encode(serializeTopicKnowledgeHub(markdownPack, 'json')).byteLength;
  assert.ok(jsonBytes > markdownBytes);

  const limitedMarkdown = await buildTopicKnowledgeContextPackForUser(userId, 'Format-aware context', {
    format: 'markdown',
    itemIds: [item.id],
    maxBytes: markdownBytes,
  });
  assert.deepEqual(limitedMarkdown.items.map((entry) => entry.id), [item.id]);
  await assert.rejects(
    buildTopicKnowledgeContextPackForUser(userId, 'Format-aware context', {
      format: 'json',
      itemIds: [item.id],
      maxBytes: markdownBytes,
    }),
    /configured size limit/,
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
