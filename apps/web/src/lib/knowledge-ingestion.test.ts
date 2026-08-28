import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import db from './db';
import {
  approveKnowledgeDraftsForUser,
  archiveKnowledgeItemForUser,
  authenticateMcpAccessToken,
  createKnowledgeDraftBatchForUser,
  createMcpAccessTokenForUser,
  createMemoryKnowledgeItemForUser,
  createPrivateKnowledgeEdgeForUser,
  getKnowledgeDraftBatchForUser,
  getKnowledgeDraftResolutionContextForUser,
  getKnowledgeLinkTargetsForUser,
  getMemoryMcpCredentialRateLimitRecordCountForTesting,
  getMemoryKnowledgeEvidenceForUser,
  getMemoryKnowledgeActivityForUser,
  getMemoryPrivateKnowledgeEdgesForTesting,
  getMemoryKnowledgeSourcesForUser,
  getMemoryKnowledgeItemsForUser,
  getPrivateKnowledgeGraphForUser,
  MCP_CONTEXT_READ_SCOPE,
  MCP_CREDENTIAL_RATE_LIMIT_CLEANUP_BATCH_SIZE,
  MCP_CREDENTIAL_RATE_LIMIT_RETENTION_MS,
  MCP_DRAFT_CREATE_SCOPE,
  MCP_REQUESTS_PER_TOKEN_PER_MINUTE,
  McpDeletedAccountError,
  McpRequestRateLimitError,
  normalizeKnowledgeTopic,
  rateLimitMcpOAuthPrincipal,
  recordKnowledgeReuseForUser,
  resolveKnowledgeDraftForUser,
  restoreMemoryKnowledgeItemForUser,
  restoreArchivedKnowledgeItemForUser,
  sanitizeKnowledgeEvidenceSelectors,
  setKnowledgeTransactionSqlForTesting,
  softDeleteMemoryKnowledgeItemForUser,
  supersedeKnowledgeItemForUser,
  updateMemoryKnowledgeItemForUser,
  verifyKnowledgeItemForUser,
} from './knowledge-ingestion';
import { deriveMcpDeletedAccountScopeKey } from './mcp-account-lifecycle';
import { getTopicKnowledgeHubForUser } from './topic-knowledge-hub';

test('normalizes Korean topics without collapsing them to general', () => {
  assert.equal(normalizeKnowledgeTopic('  머신 러닝 / 기초  '), '머신-러닝-기초');
  assert.equal(normalizeKnowledgeTopic('확률과_통계!'), '확률과_통계');
});

test('reuse activity is all-or-nothing when one selected item becomes ineligible', async () => {
  const userId = `user_atomic_reuse_${crypto.randomUUID()}`;
  const active = createMemoryKnowledgeItemForUser(userId, {
    title: 'Still active',
    content: 'This item remains eligible.',
    topic: 'atomic reuse',
  });
  const archived = createMemoryKnowledgeItemForUser(userId, {
    title: 'Archived before recording',
    content: 'This item changed after the context pack was built.',
    topic: 'atomic reuse',
  });
  assert.deepEqual(
    await archiveKnowledgeItemForUser(userId, archived.id, archived.version),
    { archived: true, version: archived.version + 1 },
  );

  assert.equal(await recordKnowledgeReuseForUser(userId, [active.id, archived.id]), 0);
  assert.equal(
    getMemoryKnowledgeActivityForUser(userId, new Set([active.id]))
      .filter((entry) => entry.activity_type === 'reused').length,
    0,
  );
});

test('creates an idempotent memory draft batch and preserves normalized tags', async () => {
  const userId = `user_ingestion_idempotency_${crypto.randomUUID()}`;
  const input = {
    provider: 'chatgpt' as const,
    requestId: 'same-current-conversation-request',
    cards: [{ title: '베이즈 정리', topic: '확률 이론', tags: ['확률 이론', 'Bayes'] }],
  };
  const first = await createKnowledgeDraftBatchForUser(userId, input);
  const retry = await createKnowledgeDraftBatchForUser(userId, input);
  assert.equal(first.created, true);
  assert.equal(retry.created, false);
  assert.equal(retry.batchId, first.batchId);
  const loaded = await getKnowledgeDraftBatchForUser(userId, first.batchId);
  assert.deepEqual(loaded?.drafts[0].tags, ['확률-이론', 'bayes']);
});

test('loads an owner-scoped batch by its exact id outside the 100-row list window', async (context) => {
  const originalQuery = db.query;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const userId = 'user_exact_batch_owner';
  const batchId = 'batch_older_than_list_window';
  const now = '2030-01-01T00:00:00.000Z';

  context.after(() => {
    db.query = originalQuery;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  process.env.DATABASE_URL = 'postgresql://mock.invalid/girapphe';
  db.query = (async (text: string, params?: unknown[]) => {
    if (/^\s*(?:ALTER TABLE|CREATE TABLE|CREATE(?: UNIQUE)? INDEX)/.test(text)) return { rows: [] };
    if (text.includes('WHERE b.id = $1 AND b.user_id = $2')) {
      assert.doesNotMatch(text, /LIMIT 100/);
      assert.deepEqual(params, [batchId, userId]);
      return {
        rows: [{
          id: batchId,
          provider: 'chatgpt',
          status: 'pending',
          conversation_ref: null,
          draft_count: 1,
          pending_count: 1,
          approved_count: 0,
          created_at: now,
          updated_at: now,
          committed_at: null,
        }],
      };
    }
    if (text.includes('FROM knowledge_card_drafts WHERE batch_id = $1 AND user_id = $2')) {
      assert.deepEqual(params, [batchId, userId]);
      return {
        rows: [{
          id: 'draft_oldest',
          batch_id: batchId,
          client_card_id: 'oldest-card',
          title: 'Oldest pending draft',
          summary: '',
          explanation: '',
          topic: 'general',
          tags: [],
          proposed_relations: [],
          status: 'pending',
          version: 1,
          knowledge_item_id: null,
          created_at: now,
          updated_at: now,
        }],
      };
    }

    // This is the former implementation's capped list query. Returning 100
    // newer batches makes the regression fail unless the exact lookup is used.
    if (text.includes('FROM knowledge_ingestion_batches b')) {
      return {
        rows: Array.from({ length: 100 }, (_, index) => ({
          id: `newer_${index}`,
          provider: 'chatgpt',
          status: 'pending',
          conversation_ref: null,
          draft_count: 1,
          pending_count: 1,
          approved_count: 0,
          created_at: now,
          updated_at: now,
          committed_at: null,
        })),
      };
    }
    throw new Error(`Unexpected query: ${text}`);
  }) as typeof db.query;

  const loaded = await getKnowledgeDraftBatchForUser(userId, batchId);
  assert.equal(loaded?.batch.id, batchId);
  assert.equal(loaded?.drafts[0]?.id, 'draft_oldest');
});

test('keeps pending drafts out of active private cards and the graph until approval', async () => {
  const userId = `user_pending_boundary_${crypto.randomUUID()}`;
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'claude',
    requestId: 'pending-boundary-request',
    conversationRef: 'current-conversation-opaque-ref',
    cards: [{ title: 'Pending concept', summary: 'Must remain a review draft.' }],
  });

  const loaded = await getKnowledgeDraftBatchForUser(userId, created.batchId);
  assert.equal(loaded?.batch.status, 'pending');
  assert.equal(loaded?.drafts[0]?.status, 'pending');
  assert.equal(getMemoryKnowledgeItemsForUser(userId).length, 0);
  assert.deepEqual(await getPrivateKnowledgeGraphForUser(userId), { nodes: [], edges: [] });
});

test('reviewed create stores edited canonical content, a null target, and an explicitly cleared evidence set', async () => {
  const userId = `user_reviewed_create_${crypto.randomUUID()}`;
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'chatgpt',
    requestId: `reviewed-create-${crypto.randomUUID()}`,
    conversationRef: 'conversation-reviewed-create',
    cards: [{
      title: 'Proposed title',
      summary: 'Proposed summary',
      proposedEvidence: [{
        selectorType: 'message',
        messageRef: 'message-proposed',
        polarity: 'supports',
        quality: 'medium',
        relationOrigin: 'model_inferred',
      }],
    }],
  });
  const pending = await getKnowledgeDraftBatchForUser(userId, created.batchId);
  assert.ok(pending);
  const draft = pending.drafts[0];
  const result = await resolveKnowledgeDraftForUser(userId, {
    batchId: created.batchId,
    draftId: draft.id,
    expectedDraftVersion: draft.version,
    action: 'create',
    reviewed: {
      title: 'Reviewed title',
      summary: 'Reviewed summary',
      content: 'Reviewed canonical content.',
      topic: 'Reviewed Topic',
      tags: ['reviewed'],
      knowledgeType: null,
      centralQuestion: null,
      structuredContent: null,
      bundleSchemaVersion: null,
      evidenceSelectors: [],
    },
  });
  assert.equal(result.resolved, true);
  const item = getMemoryKnowledgeItemsForUser(userId)[0];
  assert.equal(item?.title, 'Reviewed title');
  assert.equal(item?.content, 'Reviewed canonical content.');
  const resolved = await getKnowledgeDraftBatchForUser(userId, created.batchId);
  assert.equal(resolved?.drafts[0]?.resolution_action, 'create');
  assert.equal(resolved?.drafts[0]?.target_knowledge_item_id, null);
  assert.deepEqual(getMemoryKnowledgeEvidenceForUser(userId), []);
});

for (const action of ['merge', 'update'] as const) {
  test(`${action} preserves omitted target lifecycle timestamps at full precision`, async () => {
    const userId = `user_lifecycle_preserve_${action}_${crypto.randomUUID()}`;
    const target = createMemoryKnowledgeItemForUser(userId, {
      title: 'Lifecycle target',
      content: 'Original lifecycle content.',
      topic: 'Lifecycle',
      observedAt: '2026-08-01T01:02:03.456Z',
      validFrom: '2026-08-02T02:03:04.567Z',
      validTo: '2026-08-30T03:04:05.678Z',
      reviewAt: '2026-09-01T04:05:06.789Z',
    });
    const created = await createKnowledgeDraftBatchForUser(userId, {
      provider: 'chatgpt',
      requestId: `lifecycle-preserve-${action}-${crypto.randomUUID()}`,
      cards: [{ title: 'Lifecycle candidate', topic: 'Lifecycle' }],
    });
    const draft = (await getKnowledgeDraftBatchForUser(userId, created.batchId))!.drafts[0];
    const context = await getKnowledgeDraftResolutionContextForUser(userId, draft.id, target.id);
    assert.deepEqual(context?.target && {
      observedAt: context.target.observed_at,
      validFrom: context.target.valid_from,
      validTo: context.target.valid_to,
      reviewAt: context.target.review_at,
    }, {
      observedAt: '2026-08-01T01:02:03.456Z',
      validFrom: '2026-08-02T02:03:04.567Z',
      validTo: '2026-08-30T03:04:05.678Z',
      reviewAt: '2026-09-01T04:05:06.789Z',
    });

    const result = await resolveKnowledgeDraftForUser(userId, {
      batchId: created.batchId,
      draftId: draft.id,
      expectedDraftVersion: draft.version,
      action,
      targetKnowledgeItemId: target.id,
      expectedTargetVersion: target.version,
      reviewed: {
        title: 'Reviewed lifecycle target',
        summary: '',
        content: 'Reviewed without changing lifecycle dates.',
        topic: 'Lifecycle',
        tags: [],
        knowledgeType: null,
        centralQuestion: null,
        structuredContent: null,
        bundleSchemaVersion: null,
      },
    });
    assert.equal(result.resolved, true);
    const item = getMemoryKnowledgeItemsForUser(userId).find((candidate) => candidate.id === target.id);
    assert.deepEqual(item && {
      observedAt: item.observed_at,
      validFrom: item.valid_from,
      validTo: item.valid_to,
      reviewAt: item.review_at,
    }, {
      observedAt: '2026-08-01T01:02:03.456Z',
      validFrom: '2026-08-02T02:03:04.567Z',
      validTo: '2026-08-30T03:04:05.678Z',
      reviewAt: '2026-09-01T04:05:06.789Z',
    });
  });
}

test('lifecycle patches distinguish explicit clears and reject invalid inherited ranges before mutation', async () => {
  const clearUserId = `user_lifecycle_clear_${crypto.randomUUID()}`;
  const clearTarget = createMemoryKnowledgeItemForUser(clearUserId, {
    title: 'Clearable lifecycle', content: 'Original.', topic: 'Lifecycle',
    observedAt: '2026-08-01T01:02:03.456Z',
    validFrom: '2026-08-02T02:03:04.567Z',
    validTo: '2026-08-30T03:04:05.678Z',
    reviewAt: '2026-09-01T04:05:06.789Z',
  });
  const clearBatch = await createKnowledgeDraftBatchForUser(clearUserId, {
    provider: 'claude', requestId: `lifecycle-clear-${crypto.randomUUID()}`,
    cards: [{ title: 'Clear lifecycle candidate', topic: 'Lifecycle' }],
  });
  const clearDraft = (await getKnowledgeDraftBatchForUser(clearUserId, clearBatch.batchId))!.drafts[0];
  const clearResult = await resolveKnowledgeDraftForUser(clearUserId, {
    batchId: clearBatch.batchId,
    draftId: clearDraft.id,
    expectedDraftVersion: clearDraft.version,
    action: 'update',
    targetKnowledgeItemId: clearTarget.id,
    expectedTargetVersion: clearTarget.version,
    reviewed: {
      title: clearTarget.title, summary: '', content: 'Cleared selected dates.', topic: 'Lifecycle', tags: [],
      knowledgeType: null, centralQuestion: null, structuredContent: null, bundleSchemaVersion: null,
      observedAt: null,
      validFrom: null,
      reviewAt: null,
    },
  });
  assert.equal(clearResult.resolved, true);
  const cleared = getMemoryKnowledgeItemsForUser(clearUserId)[0];
  assert.equal(cleared.observed_at, null);
  assert.equal(cleared.valid_from, null);
  assert.equal(cleared.valid_to, '2026-08-30T03:04:05.678Z');
  assert.equal(cleared.review_at, null);

  const invalidUserId = `user_lifecycle_invalid_${crypto.randomUUID()}`;
  const invalidTarget = createMemoryKnowledgeItemForUser(invalidUserId, {
    title: 'Guarded lifecycle', content: 'Must remain unchanged.', topic: 'Lifecycle',
    validFrom: '2026-09-01T00:00:00.000Z',
    validTo: '2026-09-30T00:00:00.000Z',
  });
  const invalidBatch = await createKnowledgeDraftBatchForUser(invalidUserId, {
    provider: 'gemini', requestId: `lifecycle-invalid-${crypto.randomUUID()}`,
    cards: [{ title: 'Invalid range candidate', topic: 'Lifecycle' }],
  });
  const invalidDraft = (await getKnowledgeDraftBatchForUser(invalidUserId, invalidBatch.batchId))!.drafts[0];
  const before = {
    version: invalidTarget.version,
    sources: getMemoryKnowledgeSourcesForUser(invalidUserId).length,
    evidence: getMemoryKnowledgeEvidenceForUser(invalidUserId).length,
    activity: getMemoryKnowledgeActivityForUser(invalidUserId).length,
  };
  await assert.rejects(resolveKnowledgeDraftForUser(invalidUserId, {
    batchId: invalidBatch.batchId,
    draftId: invalidDraft.id,
    expectedDraftVersion: invalidDraft.version,
    action: 'merge',
    targetKnowledgeItemId: invalidTarget.id,
    expectedTargetVersion: invalidTarget.version,
    reviewed: {
      title: invalidTarget.title, summary: '', content: 'Invalid inherited interval.', topic: 'Lifecycle', tags: [],
      knowledgeType: null, centralQuestion: null, structuredContent: null, bundleSchemaVersion: null,
      validTo: '2026-08-31T23:59:59.999Z',
    },
  }), /validTo must not be earlier than validFrom/);
  assert.equal(getMemoryKnowledgeItemsForUser(invalidUserId)[0]?.version, before.version);
  assert.equal(getMemoryKnowledgeSourcesForUser(invalidUserId).length, before.sources);
  assert.equal(getMemoryKnowledgeEvidenceForUser(invalidUserId).length, before.evidence);
  assert.equal(getMemoryKnowledgeActivityForUser(invalidUserId).length, before.activity);
  assert.equal((await getKnowledgeDraftBatchForUser(invalidUserId, invalidBatch.batchId))!.drafts[0].status, 'pending');
});

test('database resolution context retains milliseconds from native timestamp values', async (context) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const originalQuery = db.query;
  const userId = 'owner-resolution-native-dates';
  const draftId = 'draft-resolution-native-dates';
  const targetId = 'target-resolution-native-dates';
  const now = new Date('2030-01-01T00:00:00.000Z');

  context.after(() => {
    db.query = originalQuery;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });
  process.env.DATABASE_URL = 'postgresql://mock.invalid/girapphe';
  db.query = (async (text: string, params: unknown[] = []) => {
    if (/^\s*(?:ALTER TABLE|CREATE TABLE|CREATE(?: UNIQUE)? INDEX)/.test(text)) return { rows: [] };
    if (text.includes('FROM knowledge_card_drafts d') && text.includes('WHERE d.id = $1')) {
      assert.deepEqual(params, [draftId, userId]);
      return { rows: [{
        id: draftId,
        batch_id: 'batch-resolution-native-dates',
        client_card_id: 'native-dates',
        title: 'Native date draft',
        summary: '',
        explanation: '',
        topic: 'dates',
        tags: [],
        proposed_relations: [],
        knowledge_type: null,
        central_question: null,
        structured_content: null,
        bundle_schema_version: null,
        dedupe_key: 'native-dates',
        proposed_evidence: [],
        resolution_action: null,
        target_knowledge_item_id: null,
        resolved_at: null,
        status: 'pending',
        version: 1,
        knowledge_item_id: null,
        created_at: now,
        updated_at: now,
      }] };
    }
    if (text.includes('FROM user_knowledge_items i') && text.includes('i.dedupe_key = $2')) {
      return { rows: [] };
    }
    if (text.includes('FROM user_knowledge_items') && text.includes('WHERE id = $1')) {
      assert.deepEqual(params, [targetId, userId]);
      return { rows: [{
        id: targetId,
        title: 'Native target',
        summary: '',
        content: '',
        topic: 'dates',
        tags: [],
        knowledge_type: null,
        central_question: null,
        structured_content: null,
        bundle_schema_version: null,
        observed_at: new Date('2026-08-01T01:02:03.456Z'),
        valid_from: new Date('2026-08-02T02:03:04.567Z'),
        valid_to: new Date('2026-08-30T03:04:05.678Z'),
        review_at: new Date('2026-09-01T04:05:06.789Z'),
        version: 1,
      }] };
    }
    throw new Error(`Unexpected database query in native-date regression: ${text}`);
  }) as typeof db.query;

  const resolution = await getKnowledgeDraftResolutionContextForUser(userId, draftId, targetId);
  assert.deepEqual(resolution?.target && {
    observedAt: resolution.target.observed_at,
    validFrom: resolution.target.valid_from,
    validTo: resolution.target.valid_to,
    reviewAt: resolution.target.review_at,
  }, {
    observedAt: '2026-08-01T01:02:03.456Z',
    validFrom: '2026-08-02T02:03:04.567Z',
    validTo: '2026-08-30T03:04:05.678Z',
    reviewAt: '2026-09-01T04:05:06.789Z',
  });
});

test('reviewed evidence permits removal and reorder but rejects added or tampered selectors', async () => {
  const allowedUserId = `user_evidence_subset_${crypto.randomUUID()}`;
  const allowedBatch = await createKnowledgeDraftBatchForUser(allowedUserId, {
    provider: 'chatgpt',
    requestId: `evidence-subset-${crypto.randomUUID()}`,
    cards: [{
      title: 'Evidence subset',
      proposedEvidence: [
        {
          selectorType: 'message', messageRef: 'message-a', polarity: 'supports',
          quality: 'high', relationOrigin: 'explicit_user',
        },
        {
          selectorType: 'message', messageRef: 'message-b', polarity: 'contradicts',
          quality: 'medium', relationOrigin: 'model_inferred',
        },
        {
          selectorType: 'external_ref', sourceRef: 'https://example.com/evidence', polarity: 'supports',
          quality: 'high', relationOrigin: 'extracted_from_source',
        },
      ],
    }],
  });
  const allowedDraft = (await getKnowledgeDraftBatchForUser(allowedUserId, allowedBatch.batchId))!.drafts[0];
  const allowed = await resolveKnowledgeDraftForUser(allowedUserId, {
    batchId: allowedBatch.batchId,
    draftId: allowedDraft.id,
    expectedDraftVersion: allowedDraft.version,
    action: 'create',
    reviewed: {
      title: allowedDraft.title, summary: allowedDraft.summary, content: allowedDraft.explanation,
      topic: allowedDraft.topic, tags: allowedDraft.tags,
      knowledgeType: null, centralQuestion: null, structuredContent: null, bundleSchemaVersion: null,
      evidenceSelectors: [allowedDraft.proposed_evidence[2], allowedDraft.proposed_evidence[0]],
    },
  });
  assert.equal(allowed.resolved, true);
  assert.deepEqual(
    getMemoryKnowledgeEvidenceForUser(allowedUserId).map((entry) => entry.selector.messageRef ?? entry.selector.sourceRef),
    ['https://example.com/evidence', 'message-a'],
  );

  const rejectedUserId = `user_evidence_tamper_${crypto.randomUUID()}`;
  const rejectedBatch = await createKnowledgeDraftBatchForUser(rejectedUserId, {
    provider: 'claude',
    requestId: `evidence-tamper-${crypto.randomUUID()}`,
    cards: [{
      title: 'Evidence tamper',
      proposedEvidence: [{
        selectorType: 'message', messageRef: 'message-original', polarity: 'supports',
        quality: 'high', relationOrigin: 'explicit_user',
      }],
    }],
  });
  const rejectedDraft = (await getKnowledgeDraftBatchForUser(rejectedUserId, rejectedBatch.batchId))!.drafts[0];
  const reviewedBase = {
    title: rejectedDraft.title, summary: rejectedDraft.summary, content: rejectedDraft.explanation,
    topic: rejectedDraft.topic, tags: rejectedDraft.tags,
    knowledgeType: null, centralQuestion: null, structuredContent: null, bundleSchemaVersion: null,
  };
  await assert.rejects(resolveKnowledgeDraftForUser(rejectedUserId, {
    batchId: rejectedBatch.batchId,
    draftId: rejectedDraft.id,
    expectedDraftVersion: rejectedDraft.version,
    action: 'create',
    reviewed: {
      ...reviewedBase,
      evidenceSelectors: [{ ...rejectedDraft.proposed_evidence[0], quality: 'medium' }],
    },
  }), /exact subset/i);
  await assert.rejects(resolveKnowledgeDraftForUser(rejectedUserId, {
    batchId: rejectedBatch.batchId,
    draftId: rejectedDraft.id,
    expectedDraftVersion: rejectedDraft.version,
    action: 'create',
    reviewed: {
      ...reviewedBase,
      evidenceSelectors: [...rejectedDraft.proposed_evidence, {
        selectorType: 'message', messageRef: 'message-added', polarity: 'supports',
        quality: 'high', relationOrigin: 'explicit_user',
      }],
    },
  }), /exact subset/i);
  assert.equal((await getKnowledgeDraftBatchForUser(rejectedUserId, rejectedBatch.batchId))!.drafts[0].status, 'pending');
  assert.equal(getMemoryKnowledgeItemsForUser(rejectedUserId).length, 0);
});

test('manual memory updates consume the client version and return typed stale or not-found results', () => {
  const userId = `user_manual_update_version_${crypto.randomUUID()}`;
  const item = createMemoryKnowledgeItemForUser(userId, {
    title: 'Concurrent note', content: 'Version one.', topic: 'Concurrency',
  });
  assert.deepEqual(updateMemoryKnowledgeItemForUser(userId, item.id, {
    title: 'First editor', content: 'First edit wins.', topic: 'Concurrency',
  }, { expectedVersion: item.version }), { updated: true, version: 2 });
  assert.deepEqual(updateMemoryKnowledgeItemForUser(userId, item.id, {
    title: 'Second editor', content: 'Stale edit must fail.', topic: 'Concurrency',
  }, { expectedVersion: item.version }), { updated: false, version: null, stale: true });
  assert.deepEqual(updateMemoryKnowledgeItemForUser(userId, 'missing-item', {
    title: 'Missing', content: '', topic: 'Concurrency',
  }, { expectedVersion: 1 }), { updated: false, version: null, notFound: true });
  assert.equal(getMemoryKnowledgeItemsForUser(userId)[0]?.title, 'First editor');
});

test('conversation and evidence references accept only opaque ids or bounded HTTPS URLs', async () => {
  await assert.rejects(
    createKnowledgeDraftBatchForUser(`user_bad_reference_${crypto.randomUUID()}`, {
      provider: 'chatgpt',
      requestId: `bad-ref-${crypto.randomUUID()}`,
      conversationRef: 'this is raw conversation text',
      cards: [{ title: 'Unsafe reference' }],
    }),
    /opaque reference/i,
  );
  await assert.rejects(
    createKnowledgeDraftBatchForUser(`user_credential_conversation_${crypto.randomUUID()}`, {
      provider: 'chatgpt',
      requestId: `credential-conversation-${crypto.randomUUID()}`,
      conversationRef: 'HTTPS://user:password@example.com/conversation',
      cards: [{ title: 'Unsafe conversation reference' }],
    }),
    /opaque reference/i,
  );
  await assert.rejects(
    createKnowledgeDraftBatchForUser(`user_credential_source_${crypto.randomUUID()}`, {
      provider: 'chatgpt',
      requestId: `credential-source-${crypto.randomUUID()}`,
      conversationRef: 'safe-conversation-ref',
      sourceUrl: 'HTTPS://user:password@example.com/conversation',
      cards: [{ title: 'Unsafe source URL' }],
    }),
    /bounded HTTPS URL/i,
  );
  assert.deepEqual(sanitizeKnowledgeEvidenceSelectors([{
    selectorType: 'message',
    messageRef: 'raw quoted message text',
    polarity: 'supports',
    quality: 'high',
    relationOrigin: 'explicit_user',
  }]), []);
  assert.deepEqual(sanitizeKnowledgeEvidenceSelectors([{
    selectorType: 'external_ref',
    sourceRef: 'raw source sentence',
    polarity: 'supports',
    quality: 'high',
    relationOrigin: 'extracted_from_source',
  }]), []);
  const normalizedEvidence = sanitizeKnowledgeEvidenceSelectors([{
    selectorType: 'external_ref',
    sourceRef: 'https://example.com/source?access_token=secret#private-fragment',
    polarity: 'supports',
    quality: 'high',
    relationOrigin: 'extracted_from_source',
  }]);
  assert.equal(normalizedEvidence[0]?.sourceRef, 'https://example.com/source');
  for (const sourceRef of [
    'https://user:password@example.com/source',
    'HTTPS://user:password@example.com/source',
    'FTP://user:password@example.com/source',
  ]) {
    assert.deepEqual(sanitizeKnowledgeEvidenceSelectors([{
      selectorType: 'external_ref', sourceRef, polarity: 'supports', quality: 'high',
      relationOrigin: 'extracted_from_source',
    }]), []);
  }

  const normalizedUserId = `user_normalized_source_${crypto.randomUUID()}`;
  const normalizedBatch = await createKnowledgeDraftBatchForUser(normalizedUserId, {
    provider: 'chatgpt',
    requestId: `normalized-source-${crypto.randomUUID()}`,
    conversationRef: 'safe-conversation-ref',
    sourceUrl: 'https://example.com/current/path?access_token=secret#private-fragment',
    cards: [{ title: 'Normalized source URL' }],
  });
  assert.equal(
    (await getKnowledgeDraftBatchForUser(normalizedUserId, normalizedBatch.batchId))?.batch.source_url,
    'https://example.com/current/path',
  );
});

test('canonical revision clears verification and supersession consumes its optimistic version once', async () => {
  const userId = `user_lifecycle_version_${crypto.randomUUID()}`;
  const oldItem = createMemoryKnowledgeItemForUser(userId, {
    title: 'Verified note',
    content: 'Version one.',
    topic: 'Lifecycle',
  });
  assert.deepEqual(await verifyKnowledgeItemForUser(userId, oldItem.id, 1), {
    verified: true,
    version: 2,
  });
  let currentOldItem = getMemoryKnowledgeItemsForUser(userId)
    .find((item) => item.id === oldItem.id)!;
  assert.ok(currentOldItem.last_verified_at);
  updateMemoryKnowledgeItemForUser(userId, oldItem.id, {
    title: 'Revised note',
    content: 'Version two content.',
    topic: 'Lifecycle',
  });
  currentOldItem = getMemoryKnowledgeItemsForUser(userId)
    .find((item) => item.id === oldItem.id)!;
  assert.equal(currentOldItem.version, 3);
  assert.equal(currentOldItem.last_verified_at, null);

  const replacement = createMemoryKnowledgeItemForUser(userId, {
    title: 'Replacement',
    content: 'Current content.',
    topic: 'Lifecycle',
  });
  const alternative = createMemoryKnowledgeItemForUser(userId, {
    title: 'Alternative',
    content: 'Alternative content.',
    topic: 'Lifecycle',
  });
  assert.deepEqual(await supersedeKnowledgeItemForUser(
    userId,
    oldItem.id,
    replacement.id,
    currentOldItem.version,
    'Replacement selected.',
  ), { superseded: true });
  const supersedesEdge = getMemoryPrivateKnowledgeEdgesForTesting(userId)
    .find((edge) => edge.type === 'supersedes');
  assert.equal(supersedesEdge?.source, `personal:${replacement.id}`);
  assert.equal(supersedesEdge?.target, `personal:${oldItem.id}`);
  currentOldItem = getMemoryKnowledgeItemsForUser(userId)
    .find((item) => item.id === oldItem.id)!;
  assert.equal(currentOldItem.version, 4);
  assert.deepEqual(updateMemoryKnowledgeItemForUser(userId, oldItem.id, {
    title: 'Superseded history must stay immutable',
    content: 'A stale manual action cannot revise it.',
    topic: 'Lifecycle',
  }, { expectedVersion: currentOldItem.version }), {
    updated: false,
    version: null,
    notFound: true,
  });
  assert.equal(getMemoryKnowledgeItemsForUser(userId)
    .find((item) => item.id === oldItem.id)?.title, 'Revised note');
  assert.equal((await supersedeKnowledgeItemForUser(
    userId,
    oldItem.id,
    alternative.id,
    3,
    'A second replacement is not allowed.',
  )).superseded, false);
  assert.equal((await supersedeKnowledgeItemForUser(
    userId,
    replacement.id,
    oldItem.id,
    replacement.version,
    'A cycle is not allowed.',
  )).superseded, false);
});

test('memory private-node endpoints reject archived and superseded knowledge', async () => {
  const userId = `user_memory_private_endpoint_${crypto.randomUUID()}`;
  const prior = createMemoryKnowledgeItemForUser(userId, {
    graphNodeId: 'superseded-memory-node',
    title: 'Prior answer',
    content: 'This answer is historical.',
    topic: 'Lifecycle',
  });
  const replacement = createMemoryKnowledgeItemForUser(userId, {
    title: 'Replacement answer',
    content: 'This answer is canonical.',
    topic: 'Lifecycle',
  });
  assert.deepEqual(await supersedeKnowledgeItemForUser(
    userId, prior.id, replacement.id, prior.version, 'Replacement selected.',
  ), { superseded: true });

  const archived = createMemoryKnowledgeItemForUser(userId, {
    graphNodeId: 'archived-memory-node',
    title: 'Archived answer',
    content: 'This answer is no longer active.',
    topic: 'Lifecycle',
  });
  assert.deepEqual(await archiveKnowledgeItemForUser(userId, archived.id, archived.version), {
    archived: true,
    version: archived.version + 1,
  });

  assert.deepEqual(await createPrivateKnowledgeEdgeForUser(
    userId, 'private:superseded-memory-node', 'graph_linear_algebra', 'related',
  ), { created: false, reason: 'invalid' });
  assert.deepEqual(await createPrivateKnowledgeEdgeForUser(
    userId, 'private:archived-memory-node', 'graph_linear_algebra', 'related',
  ), { created: false, reason: 'invalid' });
});

test('database supersession preserves old-to-replacement table semantics but writes replacement-to-old graph direction', async (context) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const originalQuery = db.query;
  const originalAccountTransaction = db.accountTransaction;
  const calls: Array<{ text: string; params: unknown[] }> = [];
  const fakeTransactionSql = {
    transaction: async (callback: (tx: { query: (text: string, params?: unknown[]) => Promise<unknown[]> }) => Array<Promise<unknown[]>>) => {
      const queries = callback({
        query: (text, params = []) => {
          calls.push({ text, params });
          return Promise.resolve([]);
        },
      });
      await Promise.all(queries);
      return queries.map(() => []);
    },
  };
  context.after(() => {
    db.query = originalQuery;
    db.accountTransaction = originalAccountTransaction;
    setKnowledgeTransactionSqlForTesting(null);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });
  process.env.DATABASE_URL = 'postgresql://mock.invalid/girapphe';
  db.query = (async () => ({ rows: [] })) as typeof db.query;
  setKnowledgeTransactionSqlForTesting(
    fakeTransactionSql as unknown as NonNullable<Parameters<typeof setKnowledgeTransactionSqlForTesting>[0]>,
  );

  const oldItemId = 'old-item';
  const replacementItemId = 'replacement-item';
  assert.deepEqual(await supersedeKnowledgeItemForUser(
    'owner-id', oldItemId, replacementItemId, 7, 'Replacement selected.',
  ), { superseded: true });

  const tableInsert = calls.find((call) => call.text.includes('INSERT INTO knowledge_item_supersessions'));
  assert.deepEqual(tableInsert?.params.slice(2, 4), [oldItemId, replacementItemId]);
  assert.match(tableInsert?.text ?? '', /replacement_live_item_id, replacement_live_user_id/);
  assert.match(tableInsert?.text ?? '', /VALUES \(\$1, \$2, \$3, \$4, \$4, \$2, \$5\)/);
  const edgeInsert = calls.find((call) => call.text.includes('INSERT INTO user_graph_edges'));
  assert.deepEqual(edgeInsert?.params.slice(2, 4), [replacementItemId, oldItemId]);
});

test('database graph surfaces and manual endpoints require active owner-scoped knowledge', async (context) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const originalQuery = db.query;
  const userId = 'owner-active-graph';
  let manualEdgeInsertCount = 0;

  const assertActiveItemGuard = (text: string, alias = 'i') => {
    assert.match(text, new RegExp(`${alias}\\.deleted_at IS NULL`));
    assert.match(text, new RegExp(`${alias}\\.archived_at IS NULL`));
    assert.match(text, /knowledge_item_supersessions/);
    assert.match(text, new RegExp(`s\\.user_id = ${alias}\\.user_id`));
    assert.match(text, new RegExp(`s\\.superseded_item_id = ${alias}\\.id`));
  };

  context.after(() => {
    db.query = originalQuery;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  process.env.DATABASE_URL = 'postgresql://mock.invalid/girapphe';
  db.query = (async (text: string, params: unknown[] = []) => {
    if (/^\s*(?:ALTER TABLE|CREATE TABLE|CREATE(?: UNIQUE)? INDEX)/.test(text)) return { rows: [] };

    if (text.includes('SELECT n.id AS graph_node_id')) {
      assertActiveItemGuard(text);
      return { rows: [] };
    }
    if (text.includes('FROM user_graph_edges e') && !text.includes('INSERT INTO user_graph_edges')) {
      assert.match(text, /si\.deleted_at IS NULL AND si\.archived_at IS NULL/);
      assert.match(text, /source_supersession\.user_id = si\.user_id/);
      assert.match(text, /source_supersession\.superseded_item_id = si\.id/);
      assert.match(text, /ti\.deleted_at IS NULL AND ti\.archived_at IS NULL/);
      assert.match(text, /target_supersession\.user_id = ti\.user_id/);
      assert.match(text, /target_supersession\.superseded_item_id = ti\.id/);
      assert.match(text, /e\.source_private_node_id IS NULL OR si\.id IS NOT NULL/);
      assert.match(text, /e\.target_private_node_id IS NULL OR ti\.id IS NOT NULL/);
      return { rows: [] };
    }
    if (text.includes('SELECT id, label, scope, topic FROM (')) {
      assertActiveItemGuard(text);
      return { rows: [] };
    }
    if (text.includes('INSERT INTO user_graph_nodes')) {
      assertActiveItemGuard(text);
      const itemId = String(params[0]);
      return itemId === 'active-then-archived'
        ? { rows: [{ id: 'race-node', knowledge_item_id: itemId }] }
        : { rows: [] };
    }
    if (text.includes('SELECT n.id, n.knowledge_item_id FROM user_graph_nodes n')) {
      assertActiveItemGuard(text);
      return { rows: [] };
    }
    if (text.includes('SELECT id FROM graph_nodes')) {
      return { rows: [{ id: String(params[0]) }] };
    }
    if (text.includes('INSERT INTO user_graph_edges')) {
      manualEdgeInsertCount += 1;
      assert.equal(text.match(/i\.archived_at IS NULL/g)?.length, 2);
      assert.equal(text.match(/s\.user_id = i\.user_id AND s\.superseded_item_id = i\.id/g)?.length, 2);
      return { rows: [] };
    }
    throw new Error(`Unexpected database query in active graph regression: ${text}`);
  }) as typeof db.query;
  db.accountTransaction = (async (
    _userId: string,
    queries: Parameters<typeof db.accountTransaction>[1],
  ) => Promise.all(queries.map(({ text, params }) => db.query(text, params))) as never) as typeof db.accountTransaction;

  assert.deepEqual(await getPrivateKnowledgeGraphForUser(userId), { nodes: [], edges: [] });
  assert.deepEqual(await getKnowledgeLinkTargetsForUser(userId), []);
  assert.deepEqual(await createPrivateKnowledgeEdgeForUser(
    userId, 'personal:archived-item', 'graph_public-node', 'related',
  ), { created: false, reason: 'invalid' });
  assert.deepEqual(await createPrivateKnowledgeEdgeForUser(
    userId, 'private:superseded-node', 'graph_public-node', 'related',
  ), { created: false, reason: 'invalid' });
  assert.deepEqual(await createPrivateKnowledgeEdgeForUser(
    userId, 'personal:active-then-archived', 'graph_public-node', 'related',
  ), { created: false, reason: 'cycle_or_duplicate' });
  assert.equal(manualEdgeInsertCount, 1);
});

test('database draft approval partitions dynamically queued edge and update results', async (context) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const originalQuery = db.query;
  const userId = 'owner-approval-result-offsets';
  const batchId = 'batch-approval-result-offsets';
  const draftId = 'draft-approval-result-offsets';
  const publicNodeId = 'public-approval-target';
  const now = '2030-01-01T00:00:00.000Z';
  const transactionCalls: Array<{ text: string; params: unknown[]; rows: unknown[] }> = [];
  const fakeTransactionSql = {
    transaction: async (callback: (tx: { query: (text: string, params?: unknown[]) => Promise<unknown[]> }) => Array<Promise<unknown[]>>) => {
      const queries = callback({
        query: (text, params = []) => {
          const queryNumber = transactionCalls.length;
          const rows = text.includes('INSERT INTO user_graph_edges')
            ? []
            : text.includes("UPDATE knowledge_card_drafts SET status = 'approved'")
              ? [{ id: draftId }]
              : [{ marker: queryNumber }];
          transactionCalls.push({ text, params, rows });
          return Promise.resolve(rows);
        },
      });
      return Promise.all(queries);
    },
  };

  context.after(() => {
    db.query = originalQuery;
    setKnowledgeTransactionSqlForTesting(null);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  process.env.DATABASE_URL = 'postgresql://mock.invalid/girapphe';
  db.query = (async (text: string, params: unknown[] = []) => {
    if (/^\s*(?:ALTER TABLE|CREATE TABLE|CREATE(?: UNIQUE)? INDEX)/.test(text)) return { rows: [] };
    if (text.includes('WHERE b.id = $1 AND b.user_id = $2')) {
      assert.deepEqual(params, [batchId, userId]);
      return { rows: [{
        id: batchId,
        provider: 'chatgpt',
        status: 'pending',
        conversation_ref: null,
        source_url: null,
        discussed_at: null,
        draft_count: 1,
        pending_count: 1,
        approved_count: 0,
        created_at: now,
        updated_at: now,
        committed_at: null,
      }] };
    }
    if (text.includes('FROM knowledge_card_drafts WHERE batch_id = $1 AND user_id = $2')) {
      assert.deepEqual(params, [batchId, userId]);
      return { rows: [{
        id: draftId,
        batch_id: batchId,
        client_card_id: 'approval-result-card',
        title: 'Approval result partition',
        summary: 'Distinct transaction results.',
        explanation: 'Distinct transaction results.',
        topic: 'testing',
        tags: [],
        proposed_relations: [{
          targetKind: 'public',
          targetId: `graph_${publicNodeId}`,
          type: 'related',
          direction: 'outgoing',
          weight: 1,
          relationOrigin: 'model_inferred',
        }],
        knowledge_type: null,
        central_question: null,
        structured_content: null,
        bundle_schema_version: null,
        dedupe_key: 'approval-result-partition',
        proposed_evidence: [{
          selectorType: 'message',
          messageRef: 'selected-message',
          polarity: 'supports',
          quality: 'high',
          relationOrigin: 'explicit_user',
        }],
        resolution_action: null,
        target_knowledge_item_id: null,
        resolved_at: null,
        status: 'pending',
        version: 1,
        knowledge_item_id: null,
        created_at: now,
        updated_at: now,
      }] };
    }
    if (text.includes('SELECT id FROM graph_nodes')) {
      assert.deepEqual(params, [publicNodeId]);
      return { rows: [{ id: publicNodeId }] };
    }
    throw new Error(`Unexpected database query in approval result regression: ${text}`);
  }) as typeof db.query;
  setKnowledgeTransactionSqlForTesting(
    fakeTransactionSql as unknown as NonNullable<Parameters<typeof setKnowledgeTransactionSqlForTesting>[0]>,
  );

  assert.deepEqual(await approveKnowledgeDraftsForUser(
    userId, batchId, [draftId], { [draftId]: 1 },
  ), { approved: 1, skippedEdges: 1 });

  const edgeIndex = transactionCalls.findIndex((call) => call.text.includes('INSERT INTO user_graph_edges'));
  const updateIndex = transactionCalls.findIndex((call) => call.text.includes("UPDATE knowledge_card_drafts SET status = 'approved'"));
  const evidenceIndex = transactionCalls.findIndex((call) => call.text.includes('INSERT INTO knowledge_evidence_spans'));
  assert.ok(evidenceIndex >= 0 && edgeIndex > evidenceIndex);
  assert.equal(updateIndex, edgeIndex + 1);
  assert.deepEqual(transactionCalls[edgeIndex]?.rows, []);
  assert.deepEqual(transactionCalls[updateIndex]?.rows, [{ id: draftId }]);
  assert.equal(transactionCalls[edgeIndex]?.text.match(/i\.archived_at IS NULL/g)?.length, 2);
  assert.equal(
    transactionCalls[edgeIndex]?.text.match(/s\.user_id = i\.user_id AND s\.superseded_item_id = i\.id/g)?.length,
    2,
  );
});

test('database per-draft resolution locks, resolves the actual node, inserts edges, then approves', async (context) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const originalQuery = db.query;
  const userId = 'owner-single-resolution-edge';
  const batchId = 'batch-single-resolution-edge';
  const draftId = 'draft-single-resolution-edge';
  const publicNodeId = 'mathematics';
  const now = '2030-01-01T00:00:00.000Z';
  const transactionCalls: Array<{ text: string; params: unknown[]; rows: unknown[] }> = [];
  const fakeTransactionSql = {
    transaction: async (callback: (tx: { query: (text: string, params?: unknown[]) => Promise<unknown[]> }) => Array<Promise<unknown[]>>) => {
      const queries = callback({
        query: (text, params = []) => {
          const rows = text.includes('INSERT INTO user_graph_edges')
            ? [{ id: 'persisted-edge' }]
            : text.includes('AS approval_guard')
              ? [{ approval_guard: 1 }]
              : [{ marker: transactionCalls.length }];
          transactionCalls.push({ text, params, rows });
          return Promise.resolve(rows);
        },
      });
      return Promise.all(queries);
    },
  };

  const draftRow = {
    id: draftId,
    batch_id: batchId,
    client_card_id: 'single-resolution-card',
    title: 'Single resolution edge',
    summary: 'Persist this relation.',
    explanation: 'Persist this relation in the same transaction.',
    topic: 'relations',
    tags: [],
    proposed_relations: [{
      targetKind: 'public',
      targetId: `graph_${publicNodeId}`,
      type: 'supports',
      direction: 'outgoing',
      weight: 0.65,
      relationOrigin: 'explicit_user',
    }],
    knowledge_type: null,
    central_question: null,
    structured_content: null,
    bundle_schema_version: null,
    dedupe_key: 'single-resolution-edge',
    proposed_evidence: [],
    resolution_action: null,
    target_knowledge_item_id: null,
    resolved_at: null,
    status: 'pending',
    version: 1,
    knowledge_item_id: null,
    created_at: now,
    updated_at: now,
  };

  context.after(() => {
    db.query = originalQuery;
    setKnowledgeTransactionSqlForTesting(null);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  process.env.DATABASE_URL = 'postgresql://mock.invalid/girapphe';
  db.query = (async (text: string, params: unknown[] = []) => {
    if (/^\s*(?:ALTER TABLE|CREATE TABLE|CREATE(?: UNIQUE)? INDEX)/.test(text)) return { rows: [] };
    if (text.includes('FROM knowledge_card_drafts d') && text.includes('WHERE d.id = $1')) {
      assert.deepEqual(params, [draftId, userId]);
      return { rows: [draftRow] };
    }
    if (text.includes('FROM user_knowledge_items i') && text.includes('i.dedupe_key = $2')) {
      return { rows: [] };
    }
    if (text.includes('WHERE b.id = $1 AND b.user_id = $2')) {
      assert.deepEqual(params, [batchId, userId]);
      return { rows: [{
        id: batchId,
        provider: 'chatgpt',
        status: 'pending',
        conversation_ref: null,
        source_url: null,
        discussed_at: null,
        draft_count: 1,
        pending_count: 1,
        approved_count: 0,
        created_at: now,
        updated_at: now,
        committed_at: null,
      }] };
    }
    if (text.includes('FROM knowledge_card_drafts WHERE batch_id = $1 AND user_id = $2')) {
      assert.deepEqual(params, [batchId, userId]);
      return { rows: [draftRow] };
    }
    if (text.includes('SELECT id FROM graph_nodes')) {
      assert.deepEqual(params, [publicNodeId]);
      return { rows: [{ id: publicNodeId }] };
    }
    throw new Error(`Unexpected database query in single-resolution edge regression: ${text}`);
  }) as typeof db.query;
  setKnowledgeTransactionSqlForTesting(
    fakeTransactionSql as unknown as NonNullable<Parameters<typeof setKnowledgeTransactionSqlForTesting>[0]>,
  );

  const result = await resolveKnowledgeDraftForUser(userId, {
    batchId,
    draftId,
    expectedDraftVersion: 1,
    action: 'create',
  });
  assert.equal(result.resolved, true);
  assert.equal(result.skippedEdges, 0);

  const accountLockIndex = transactionCalls.findIndex((call) => call.text.includes('pg_advisory_xact_lock')
    && String(call.params[0] ?? '').startsWith('mcp-account-lifecycle:'));
  const draftLockIndex = transactionCalls.findIndex((call) => call.params[0] === `knowledge-draft:${userId}:${batchId}`);
  const graphLockIndex = transactionCalls.findIndex((call) => call.params[0] === `knowledge-graph:${userId}`);
  const draftGuardIndex = transactionCalls.findIndex((call) => call.text.includes('AS draft_version_guard'));
  const nodeIndex = transactionCalls.findIndex((call) => call.text.includes('INSERT INTO user_graph_nodes'));
  const edgeIndex = transactionCalls.findIndex((call) => call.text.includes('INSERT INTO user_graph_edges'));
  const approvalIndex = transactionCalls.findIndex((call) => call.text.includes('AS approval_guard'));
  assert.ok(accountLockIndex >= 0 && draftLockIndex > accountLockIndex);
  assert.ok(graphLockIndex > draftLockIndex && draftGuardIndex > graphLockIndex);
  assert.ok(nodeIndex > draftGuardIndex && edgeIndex > nodeIndex && approvalIndex > edgeIndex);
  assert.match(transactionCalls[draftGuardIndex]!.text, /FOR UPDATE OF d/);
  assert.match(transactionCalls[edgeIndex]!.text, /n\.user_id = \$2 AND i\.id = \$3/);
  assert.match(transactionCalls[edgeIndex]!.text, /i\.deleted_at IS NULL AND i\.archived_at IS NULL/);
  assert.match(transactionCalls[edgeIndex]!.text, /knowledge_item_supersessions/);
  assert.match(transactionCalls[edgeIndex]!.text, /source_batch_id, relation_origin/);
  assert.match(transactionCalls[edgeIndex]!.text, /'conversation'/);
  assert.match(transactionCalls[edgeIndex]!.text, /WITH RECURSIVE all_edges/);
  assert.equal(transactionCalls[edgeIndex]!.params[2], result.knowledgeItemId);
  assert.equal(transactionCalls[edgeIndex]!.params[5], publicNodeId);
  assert.equal(transactionCalls[edgeIndex]!.params[7], 0.65);
  assert.equal(transactionCalls[edgeIndex]!.params[8], batchId);
  assert.equal(transactionCalls[edgeIndex]!.params[9], 'explicit_user');
  assert.match(transactionCalls[approvalIndex]!.text, /WITH approved AS MATERIALIZED/);
  assert.match(transactionCalls[approvalIndex]!.text, /THEN 1 ELSE 0 END AS approval_guard/);
});

test('archive and unarchive are optimistic versioned transitions with restored active history', async () => {
  const userId = `user_archive_lifecycle_${crypto.randomUUID()}`;
  const item = createMemoryKnowledgeItemForUser(userId, {
    title: 'Archivable runbook',
    content: 'Current instructions.',
    topic: 'Operations',
  });
  assert.deepEqual(await verifyKnowledgeItemForUser(userId, item.id, 1), {
    verified: true,
    version: 2,
  });
  assert.deepEqual(await archiveKnowledgeItemForUser(userId, item.id, 2), {
    archived: true,
    version: 3,
  });
  const archived = getMemoryKnowledgeItemsForUser(userId).find((candidate) => candidate.id === item.id)!;
  assert.ok(archived.archived_at);
  assert.equal(archived.last_verified_at, null);
  assert.equal((await getPrivateKnowledgeGraphForUser(userId)).nodes.length, 0);
  assert.equal((await getTopicKnowledgeHubForUser(userId, 'Operations')).items.length, 0);
  assert.equal((await archiveKnowledgeItemForUser(userId, item.id, 2)).stale, true);

  assert.deepEqual(await restoreArchivedKnowledgeItemForUser(userId, item.id, 3), {
    archived: false,
    version: 4,
  });
  assert.equal((await getPrivateKnowledgeGraphForUser(userId)).nodes.length, 1);
  const restoredHub = await getTopicKnowledgeHubForUser(userId, 'Operations');
  assert.deepEqual(restoredHub.items.map((entry) => entry.id), [item.id]);
  assert.deepEqual(restoredHub.revisions.map((revision) => revision.version), [1, 2, 3, 4]);
  assert.ok(restoredHub.activity.some((entry) => entry.activity_type === 'archived'));
  assert.ok(restoredHub.activity.some((entry) => entry.activity_type === 'restored'));
});

test('verification preserves a scheduled review unless a replacement value is supplied', async () => {
  const userId = `user_verify_review_schedule_${crypto.randomUUID()}`;
  const reviewAt = '2026-09-28T04:05:06.789Z';
  const item = createMemoryKnowledgeItemForUser(userId, {
    title: 'Scheduled runbook',
    content: 'Review this runbook on schedule.',
    topic: 'Operations',
    reviewAt,
  });

  assert.deepEqual(await verifyKnowledgeItemForUser(userId, item.id, 1), {
    verified: true,
    version: 2,
  });
  assert.equal(
    getMemoryKnowledgeItemsForUser(userId).find((candidate) => candidate.id === item.id)?.review_at,
    reviewAt,
  );

  const replacementReviewAt = '2026-10-05T00:00:00.000Z';
  assert.deepEqual(await verifyKnowledgeItemForUser(userId, item.id, 2, replacementReviewAt), {
    verified: true,
    version: 3,
  });
  assert.equal(
    getMemoryKnowledgeItemsForUser(userId).find((candidate) => candidate.id === item.id)?.review_at,
    replacementReviewAt,
  );

  assert.deepEqual(await verifyKnowledgeItemForUser(userId, item.id, 3, null), {
    verified: true,
    version: 4,
  });
  assert.equal(
    getMemoryKnowledgeItemsForUser(userId).find((candidate) => candidate.id === item.id)?.review_at,
    null,
  );
});

test('approves a typed bundle atomically as one private item and one graph node', async () => {
  const userId = `user_typed_bundle_approval_${crypto.randomUUID()}`;
  const structuredContent = {
    type: 'procedure' as const,
    goal: 'Ship safely.',
    prerequisites: ['Passing checks'],
    steps: [{ title: 'Deploy', detail: 'Use the protected release.' }],
    branches: [], failure_modes: [], done_when: ['Production smoke passes'],
  };
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'chatgpt', requestId: 'typed-bundle-approval', conversationRef: 'current-conversation-ref',
    cards: [{
      title: 'Safe release', summary: 'A verified release process.', knowledgeType: 'procedure',
      centralQuestion: 'How do I release safely?', structuredContent, bundleSchemaVersion: 1,
    }],
  });
  const pending = await getKnowledgeDraftBatchForUser(userId, created.batchId);
  assert.ok(pending);
  assert.equal(getMemoryKnowledgeItemsForUser(userId).length, 0);
  assert.equal(pending.drafts[0]?.knowledge_type, 'procedure');

  const approved = await approveKnowledgeDraftsForUser(
    userId, created.batchId, [pending.drafts[0].id], { [pending.drafts[0].id]: pending.drafts[0].version },
  );
  assert.deepEqual(approved, { approved: 1, skippedEdges: 0 });
  const items = getMemoryKnowledgeItemsForUser(userId);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.central_question, 'How do I release safely?');
  assert.deepEqual(items[0]?.structured_content, structuredContent);
  assert.match(items[0]?.content ?? '', /Steps/);
  const graph = await getPrivateKnowledgeGraphForUser(userId);
  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.nodes[0]?.knowledge_type, 'procedure');
  assert.deepEqual(graph.nodes[0]?.structured_content, structuredContent);

  softDeleteMemoryKnowledgeItemForUser(userId, items[0].id, 14);
  const trashedItems = getMemoryKnowledgeItemsForUser(userId);
  assert.equal(trashedItems.length, 1);
  assert.ok(trashedItems[0]?.deleted_at);
  assert.deepEqual(trashedItems[0]?.structured_content, structuredContent);
  assert.equal((await getPrivateKnowledgeGraphForUser(userId)).nodes.length, 0);
  restoreMemoryKnowledgeItemForUser(userId, items[0].id);
  const restoredItems = getMemoryKnowledgeItemsForUser(userId);
  assert.equal(restoredItems.length, 1);
  assert.equal(restoredItems[0]?.deleted_at, null);
  assert.equal(restoredItems[0]?.knowledge_type, 'procedure');
  assert.deepEqual(restoredItems[0]?.structured_content, structuredContent);
  assert.equal((await getPrivateKnowledgeGraphForUser(userId)).nodes.length, 1);
  const trashActivity = getMemoryKnowledgeActivityForUser(userId, new Set([items[0].id]));
  assert.equal(trashActivity.some((entry) => entry.activity_type === 'archived' || entry.activity_type === 'restored'), false);
  assert.deepEqual(
    trashActivity.filter((entry) => entry.metadata.lifecycle === 'trash').map((entry) => entry.metadata.state),
    ['deleted', 'restored'],
  );
});

test('issues only explicitly requested MCP knowledge scopes', async () => {
  const contextUserId = `user_context_scope_${crypto.randomUUID()}`;
  const contextToken = await createMcpAccessTokenForUser(
    contextUserId,
    'Confirmed context only',
    [MCP_CONTEXT_READ_SCOPE],
  );
  assert.deepEqual(contextToken.record.scopes, [MCP_CONTEXT_READ_SCOPE]);
  assert.equal(
    await authenticateMcpAccessToken(`Bearer ${contextToken.token}`, MCP_DRAFT_CREATE_SCOPE),
    null,
  );
  assert.equal(
    (await authenticateMcpAccessToken(`Bearer ${contextToken.token}`, MCP_CONTEXT_READ_SCOPE))?.userId,
    contextUserId,
  );

  const draftUserId = `user_draft_scope_${crypto.randomUUID()}`;
  const draftToken = await createMcpAccessTokenForUser(draftUserId, 'Draft only');
  assert.deepEqual(draftToken.record.scopes, [MCP_DRAFT_CREATE_SCOPE]);
  assert.equal(
    await authenticateMcpAccessToken(`Bearer ${draftToken.token}`, MCP_CONTEXT_READ_SCOPE),
    null,
  );
  assert.equal(
    (await authenticateMcpAccessToken(`Bearer ${draftToken.token}`, MCP_DRAFT_CREATE_SCOPE))?.userId,
    draftUserId,
  );

  await assert.rejects(
    createMcpAccessTokenForUser(`user_empty_scope_${crypto.randomUUID()}`, 'No access', []),
    /supported MCP scope/i,
  );
  await assert.rejects(
    createMcpAccessTokenForUser(`user_unknown_scope_${crypto.randomUUID()}`, 'Unknown access', ['knowledge:everything']),
    /supported MCP scope/i,
  );
});

test('limits active MCP tokens and hourly drafts without breaking idempotent retries', async () => {
  const tokenLimitUserId = `user_token_limit_${crypto.randomUUID()}`;
  for (let index = 0; index < 10; index += 1) {
    await createMcpAccessTokenForUser(tokenLimitUserId, `Client ${index + 1}`);
  }
  await assert.rejects(
    createMcpAccessTokenForUser(tokenLimitUserId, 'Client 11'),
    /quota exceeded/i
  );

  const ingestionUserId = `user_ingestion_quota_${crypto.randomUUID()}`;
  const { record } = await createMcpAccessTokenForUser(ingestionUserId, 'Quota client');
  const cards = Array.from({ length: 50 }, (_, index) => ({
    clientCardId: `card-${index}`,
    title: `Concept ${index}`,
  }));
  let lastRequestId = '';
  for (let batch = 0; batch < 5; batch += 1) {
    lastRequestId = `quota-batch-${batch}`;
    const result = await createKnowledgeDraftBatchForUser(
      ingestionUserId,
      { provider: 'chatgpt', requestId: lastRequestId, cards },
      record.id
    );
    assert.equal(result.created, true);
  }
  const retry = await createKnowledgeDraftBatchForUser(
    ingestionUserId,
    { provider: 'chatgpt', requestId: lastRequestId, cards },
    record.id
  );
  assert.equal(retry.created, false);
  await assert.rejects(
    createKnowledgeDraftBatchForUser(
      ingestionUserId,
      { provider: 'chatgpt', requestId: 'quota-overflow', cards: [{ title: 'One too many' }] },
      record.id
    ),
    /quota exceeded/i
  );
});

test('rate-limits MCP requests by token before additional tool work', async () => {
  const userId = `user_request_rate_${crypto.randomUUID()}`;
  const { token } = await createMcpAccessTokenForUser(userId, 'Rate-limited client');
  for (let index = 0; index < MCP_REQUESTS_PER_TOKEN_PER_MINUTE; index += 1) {
    const principal = await authenticateMcpAccessToken(`Bearer ${token}`);
    assert.equal(principal?.userId, userId);
  }
  await assert.rejects(
    authenticateMcpAccessToken(`Bearer ${token}`),
    McpRequestRateLimitError
  );
});

test('rate-limits Clerk OAuth MCP requests by user and client without retaining either identifier', async () => {
  const userId = `user_oauth_rate_${crypto.randomUUID()}`;
  const clientId = `client_${crypto.randomUUID()}`;
  let credentialId = '';
  for (let index = 0; index < MCP_REQUESTS_PER_TOKEN_PER_MINUTE; index += 1) {
    credentialId = await rateLimitMcpOAuthPrincipal(userId, clientId);
  }
  assert.match(credentialId, /^oauth_[a-f0-9]{64}$/);
  assert.equal(credentialId.includes(userId), false);
  assert.equal(credentialId.includes(clientId), false);
  await assert.rejects(
    rateLimitMcpOAuthPrincipal(userId, clientId),
    McpRequestRateLimitError
  );

  const cimdCredentialId = await rateLimitMcpOAuthPrincipal(
    `user_cimd_${crypto.randomUUID()}`,
    `https://client.example/.well-known/oauth-client/${'a'.repeat(1500)}`
  );
  assert.match(cimdCredentialId, /^oauth_[a-f0-9]{64}$/);
});

test('shares the per-user MCP request ceiling across PAT and OAuth credentials', async () => {
  const userId = `user_shared_rate_${crypto.randomUUID()}`;
  for (let tokenIndex = 0; tokenIndex < 5; tokenIndex += 1) {
    const { token } = await createMcpAccessTokenForUser(userId, `Shared limit ${tokenIndex}`);
    for (let requestIndex = 0; requestIndex < MCP_REQUESTS_PER_TOKEN_PER_MINUTE; requestIndex += 1) {
      assert.ok(await authenticateMcpAccessToken(`Bearer ${token}`));
    }
  }
  await assert.rejects(
    rateLimitMcpOAuthPrincipal(userId, `oauth_client_${crypto.randomUUID()}`),
    McpRequestRateLimitError
  );
});

test('prunes stale OAuth credential counters in bounded batches without resetting PAT counters', async () => {
  const originalDateNow = Date.now;
  let now = originalDateNow();

  try {
    Date.now = () => now;
    const initialCredentialRecords = getMemoryMcpCredentialRateLimitRecordCountForTesting();
    const cleanupUserId = `user_oauth_cleanup_${crypto.randomUUID()}`;
    const recordsToAdd = MCP_CREDENTIAL_RATE_LIMIT_CLEANUP_BATCH_SIZE + 5;

    for (let index = 0; index < recordsToAdd; index += 1) {
      await rateLimitMcpOAuthPrincipal(
        cleanupUserId,
        `cleanup_client_${index}_${crypto.randomUUID()}`
      );
    }

    const recordsBeforeCleanup = getMemoryMcpCredentialRateLimitRecordCountForTesting();
    assert.equal(recordsBeforeCleanup, initialCredentialRecords + recordsToAdd);

    now += MCP_CREDENTIAL_RATE_LIMIT_RETENTION_MS + 1;

    const patUserId = `user_pat_cleanup_regression_${crypto.randomUUID()}`;
    const { token } = await createMcpAccessTokenForUser(patUserId, 'Cleanup regression PAT');
    for (let index = 0; index < MCP_REQUESTS_PER_TOKEN_PER_MINUTE - 1; index += 1) {
      assert.ok(await authenticateMcpAccessToken(`Bearer ${token}`));
    }

    await rateLimitMcpOAuthPrincipal(
      `user_oauth_cleanup_trigger_${crypto.randomUUID()}`,
      `cleanup_trigger_${crypto.randomUUID()}`
    );

    assert.equal(
      getMemoryMcpCredentialRateLimitRecordCountForTesting(),
      recordsBeforeCleanup - MCP_CREDENTIAL_RATE_LIMIT_CLEANUP_BATCH_SIZE + 1
    );
    assert.ok(await authenticateMcpAccessToken(`Bearer ${token}`));
    await assert.rejects(
      authenticateMcpAccessToken(`Bearer ${token}`),
      McpRequestRateLimitError
    );
  } finally {
    Date.now = originalDateNow;
  }
});

test('database OAuth rate limiting locks first and refuses a tombstoned account without rate inserts', async (context) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  const userId = 'user_deleted_oauth_owner';
  const calls: Array<{ text: string; params?: unknown[] }> = [];

  context.after(() => {
    db.query = originalQuery;
    db.transaction = originalTransaction;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  process.env.DATABASE_URL = 'postgresql://mock.invalid/girapphe';
  db.query = (async (text: string) => {
    if (/^\s*(?:ALTER TABLE|CREATE TABLE|CREATE(?: UNIQUE)? INDEX)/.test(text)) return { rows: [] };
    throw new Error(`Unexpected OAuth setup query: ${text}`);
  }) as typeof db.query;
  db.transaction = (async (
    queries: Parameters<typeof db.transaction>[0],
    options: Parameters<typeof db.transaction>[1],
  ) => {
    calls.push(...queries);
    assert.deepEqual(options, { isolationLevel: 'ReadCommitted' });
    return [
      { rows: [] },
      { rows: [{ account_active: false, rate_allowed: false }] },
    ];
  }) as typeof db.transaction;

  await assert.rejects(
    rateLimitMcpOAuthPrincipal(userId, 'deleted-oauth-client'),
    McpDeletedAccountError,
  );
  assert.equal(calls.length, 2);
  assert.match(calls[0]!.text, /pg_advisory_xact_lock/);
  assert.match(String(calls[0]!.params?.[0]), /^mcp-account-lifecycle:[0-9a-f]{64}$/);
  assert.equal(String(calls[0]!.params?.[0]).includes(userId), false);
  assert.match(calls[1]!.text, /mcp_deleted_account_markers/);
  assert.match(calls[1]!.text, /FROM account_state WHERE account_active/g);
  assert.equal(calls[1]!.params?.[6], deriveMcpDeletedAccountScopeKey(userId));
  assert.equal(String(calls[1]!.params?.[6]).includes(userId), false);
});

test('database PAT authentication uses a read-only owner preflight then fully rechecks under the lifecycle lock', async (context) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  const rawToken = 'girapphe_mcp_database_recheck_token';
  const tokenHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
  const userId = 'user_pat_recheck_owner';
  const transactionCalls: Array<Array<{ text: string; params?: unknown[] }>> = [];
  let preflightCount = 0;

  context.after(() => {
    db.query = originalQuery;
    db.transaction = originalTransaction;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  process.env.DATABASE_URL = 'postgresql://mock.invalid/girapphe';
  db.query = (async (text: string, params?: unknown[]) => {
    if (/^\s*(?:ALTER TABLE|CREATE TABLE|CREATE(?: UNIQUE)? INDEX)/.test(text)) return { rows: [] };
    assert.match(text, /^SELECT user_id FROM mcp_access_tokens WHERE token_hash = \$1 LIMIT 1$/);
    assert.doesNotMatch(text, /UPDATE|INSERT|DELETE/);
    assert.deepEqual(params, [tokenHash]);
    preflightCount += 1;
    return { rows: [{ user_id: userId }] };
  }) as typeof db.query;
  db.transaction = (async (
    queries: Parameters<typeof db.transaction>[0],
    options: Parameters<typeof db.transaction>[1],
  ) => {
    transactionCalls.push(queries);
    assert.deepEqual(options, { isolationLevel: 'ReadCommitted' });
    return transactionCalls.length === 1
      ? [
          { rows: [] },
          { rows: [{
            id: 'pat-token-id',
            user_id: userId,
            token_hash: tokenHash,
            scopes: [MCP_DRAFT_CREATE_SCOPE],
            rate_allowed: true,
          }] },
        ]
      : [{ rows: [] }, { rows: [] }];
  }) as typeof db.transaction;

  assert.deepEqual(await authenticateMcpAccessToken(rawToken), {
    userId,
    tokenId: 'pat-token-id',
    scopes: [MCP_DRAFT_CREATE_SCOPE],
  });
  assert.equal(await authenticateMcpAccessToken(rawToken), null);
  assert.equal(preflightCount, 2);
  assert.equal(transactionCalls.length, 2);
  for (const queries of transactionCalls) {
    assert.equal(queries.length, 2);
    assert.match(queries[0]!.text, /pg_advisory_xact_lock/);
    assert.match(queries[1]!.text, /mcp_deleted_account_markers/);
    assert.match(queries[1]!.text, /token_hash = \$1 AND user_id = \$5/);
    assert.match(queries[1]!.text, /revoked_at IS NULL AND expires_at > NOW\(\)/);
    assert.match(queries[1]!.text, /scopes @> \$2::jsonb/);
    assert.equal(queries[1]!.params?.[4], userId);
    assert.equal(queries[1]!.params?.[5], deriveMcpDeletedAccountScopeKey(userId));
  }
});

test('database MCP draft, token, and reuse writers lock then reject post-delete reinsertion', async (context) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  const userId = 'user_post_delete_writers';
  const scopeKey = deriveMcpDeletedAccountScopeKey(userId);
  const neonTransactions: Array<{
    calls: Array<{ text: string; params: unknown[] }>;
    options: unknown;
  }> = [];
  const poolTransactions: Array<{
    queries: Array<{ text: string; params?: unknown[] }>;
    options: unknown;
  }> = [];
  const fakeTransactionSql = {
    transaction: async (
      callback: (tx: { query: (text: string, params?: unknown[]) => Promise<unknown[]> }) => Array<Promise<unknown[]>>,
      options: unknown,
    ) => {
      const calls: Array<{ text: string; params: unknown[] }> = [];
      const queries = callback({
        query: (text, params = []) => {
          calls.push({ text, params });
          return Promise.resolve(text.includes('EXISTS (SELECT 1 FROM inserted_token) AS inserted')
            ? [{ account_active: false, inserted: false }]
            : []);
        },
      });
      const result = await Promise.all(queries);
      neonTransactions.push({ calls, options });
      return result;
    },
  };

  context.after(() => {
    db.query = originalQuery;
    db.transaction = originalTransaction;
    setKnowledgeTransactionSqlForTesting(null);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  process.env.DATABASE_URL = 'postgresql://mock.invalid/girapphe';
  db.query = (async () => ({ rows: [] })) as typeof db.query;
  db.transaction = (async (
    queries: Parameters<typeof db.transaction>[0],
    options: Parameters<typeof db.transaction>[1],
  ) => {
    poolTransactions.push({ queries, options });
    return queries.map(() => ({ rows: [] }));
  }) as typeof db.transaction;
  setKnowledgeTransactionSqlForTesting(
    fakeTransactionSql as unknown as NonNullable<Parameters<typeof setKnowledgeTransactionSqlForTesting>[0]>,
  );

  await assert.rejects(
    createKnowledgeDraftBatchForUser(userId, {
      provider: 'chatgpt',
      requestId: 'post-delete-draft',
      cards: [{ title: 'Must not reappear' }],
    }),
    /token or ingestion quota is unavailable/,
  );
  await assert.rejects(
    createMcpAccessTokenForUser(userId, 'Post-delete token'),
    McpDeletedAccountError,
  );
  assert.equal(await recordKnowledgeReuseForUser(userId, ['deleted-item']), 0);

  assert.equal(neonTransactions.length, 2);
  for (const [index, transaction] of neonTransactions.entries()) {
    assert.deepEqual(transaction.options, { isolationLevel: 'ReadCommitted' });
    assert.equal(transaction.calls.length, 3);
    assert.deepEqual(transaction.calls[0]!.params, [`mcp-account-lifecycle:${scopeKey}`]);
    assert.deepEqual(
      transaction.calls[1]!.params,
      [index === 0 ? `knowledge-ingestion:${userId}` : `mcp-token:${userId}`],
    );
    assert.match(transaction.calls[2]!.text, /mcp_deleted_account_markers/);
    assert.equal(transaction.calls[2]!.params.at(-1), scopeKey);
  }
  assert.equal(poolTransactions.length, 1);
  assert.deepEqual(poolTransactions[0]!.options, { isolationLevel: 'ReadCommitted' });
  assert.deepEqual(poolTransactions[0]!.queries[0]!.params, [`mcp-account-lifecycle:${scopeKey}`]);
  assert.match(poolTransactions[0]!.queries[1]!.text, /mcp_deleted_account_markers/);
  assert.match(poolTransactions[0]!.queries[1]!.text, /WITH eligible_items AS MATERIALIZED/);
  assert.match(
    poolTransactions[0]!.queries[1]!.text,
    /selection\.eligible_count = cardinality\(\$2::text\[\]\)/,
  );
  assert.equal(poolTransactions[0]!.queries[1]!.params?.[3], scopeKey);
});

test('supports selected approval and add-all while rejecting stale versions', async () => {
  const userId = `user_ingestion_approval_${crypto.randomUUID()}`;
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'claude',
    requestId: 'approval-version-request',
    cards: [
      { clientCardId: 'one', title: 'Concept one', summary: 'First summary', tags: ['first'] },
      { clientCardId: 'two', title: 'Concept two', summary: 'Second summary', tags: ['second'] },
    ],
  });
  const loaded = await getKnowledgeDraftBatchForUser(userId, created.batchId);
  assert.ok(loaded);
  const [first, second] = loaded.drafts;

  const stale = await approveKnowledgeDraftsForUser(userId, created.batchId, [first.id], { [first.id]: first.version + 1 });
  assert.equal(stale.approved, 0);

  const selected = await approveKnowledgeDraftsForUser(userId, created.batchId, [first.id], { [first.id]: first.version });
  assert.equal(selected.approved, 1);
  const addAll = await approveKnowledgeDraftsForUser(userId, created.batchId, null, { [second.id]: second.version });
  assert.equal(addAll.approved, 1);

  const graph = await getPrivateKnowledgeGraphForUser(userId);
  assert.equal(graph.nodes.length, 2);
  assert.deepEqual(graph.nodes.map((node) => node.tags).sort(), [['first'], ['second']]);
});

test('server approval requires pending draft dependencies so their edge is not lost', async () => {
  const userId = `user_ingestion_dependency_${crypto.randomUUID()}`;
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'gemini',
    requestId: 'dependency-closure-request',
    cards: [
      {
        clientCardId: 'source-card',
        title: 'Source concept',
        relations: [{ targetKind: 'draft', targetId: 'target-card', type: 'related' }],
      },
      { clientCardId: 'target-card', title: 'Target concept' },
    ],
  });
  const loaded = await getKnowledgeDraftBatchForUser(userId, created.batchId);
  assert.ok(loaded);
  const source = loaded.drafts.find((draft) => draft.client_card_id === 'source-card');
  const target = loaded.drafts.find((draft) => draft.client_card_id === 'target-card');
  assert.ok(source);
  assert.ok(target);

  const incompleteSelection = await approveKnowledgeDraftsForUser(
    userId,
    created.batchId,
    [source.id],
    { [source.id]: source.version, [target.id]: target.version }
  );
  assert.equal(incompleteSelection.approved, 0);

  const approved = await approveKnowledgeDraftsForUser(
    userId,
    created.batchId,
    [source.id, target.id],
    { [source.id]: source.version, [target.id]: target.version }
  );
  assert.deepEqual(approved, { approved: 2, skippedEdges: 0 });
  const graph = await getPrivateKnowledgeGraphForUser(userId);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
});

test('per-draft create persists reviewed conversation relations with direction, weight, and provenance', async () => {
  const userId = `user_single_relation_create_${crypto.randomUUID()}`;
  const privateTarget = createMemoryKnowledgeItemForUser(userId, {
    title: 'Existing private target', content: 'A canonical dependency.', topic: 'Relations',
  });
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'chatgpt',
    requestId: `single-relation-create-${crypto.randomUUID()}`,
    cards: [{
      clientCardId: 'relation-source',
      title: 'Reviewed relation source',
      topic: 'Relations',
      relations: [
        {
          targetKind: 'public', targetId: 'graph_mathematics', type: 'related',
          direction: 'outgoing', weight: 0.4, relationOrigin: 'extracted_from_source',
        },
        {
          targetKind: 'private', targetId: privateTarget.id, type: 'derived_from',
          direction: 'incoming', weight: 0.75, relationOrigin: 'explicit_user',
        },
      ],
    }],
  });
  const draft = (await getKnowledgeDraftBatchForUser(userId, created.batchId))!.drafts[0];
  const result = await resolveKnowledgeDraftForUser(userId, {
    batchId: created.batchId,
    draftId: draft.id,
    expectedDraftVersion: draft.version,
    action: 'create',
  });
  assert.equal(result.resolved, true);
  assert.equal(result.skippedEdges, 0);
  assert.ok(result.knowledgeItemId);

  const edges = getMemoryPrivateKnowledgeEdgesForTesting(userId);
  assert.equal(edges.length, 2);
  const publicEdge = edges.find((edge) => edge.type === 'related');
  assert.ok(publicEdge);
  assert.deepEqual(new Set([publicEdge.source, publicEdge.target]), new Set([
    `personal:${result.knowledgeItemId}`,
    'graph_mathematics',
  ]));
  assert.equal(publicEdge.weight, 0.4);
  assert.equal(publicEdge.origin, 'conversation');
  assert.equal(publicEdge.relation_origin, 'extracted_from_source');
  const incoming = edges.find((edge) => edge.type === 'derived_from');
  assert.equal(incoming?.source, `personal:${privateTarget.id}`);
  assert.equal(incoming?.target, `personal:${result.knowledgeItemId}`);
  assert.equal(incoming?.weight, 0.75);
  assert.equal(incoming?.origin, 'conversation');
  assert.equal(incoming?.relation_origin, 'explicit_user');
});

test('concurrent memory resolutions commit one related item and one edge', async () => {
  const userId = `user_single_relation_race_${crypto.randomUUID()}`;
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'chatgpt',
    requestId: `single-relation-race-${crypto.randomUUID()}`,
    cards: [{
      title: 'Single-flight relation source',
      relations: [{ targetKind: 'public', targetId: 'graph_mathematics', type: 'supports' }],
    }],
  });
  const draft = (await getKnowledgeDraftBatchForUser(userId, created.batchId))!.drafts[0];
  const input = {
    batchId: created.batchId,
    draftId: draft.id,
    expectedDraftVersion: draft.version,
    action: 'create' as const,
  };
  const results = await Promise.all([
    resolveKnowledgeDraftForUser(userId, input),
    resolveKnowledgeDraftForUser(userId, input),
  ]);
  const successful = results.filter((result) => result.resolved);
  const stale = results.filter((result) => !result.resolved && result.stale);
  assert.equal(successful.length, 1);
  assert.equal(stale.length, 1);
  assert.equal(getMemoryKnowledgeItemsForUser(userId).length, 1);
  assert.equal(getMemoryPrivateKnowledgeEdgesForTesting(userId).length, 1);
  const resolvedDraft = (await getKnowledgeDraftBatchForUser(userId, created.batchId))!.drafts[0];
  assert.equal(resolvedDraft.status, 'approved');
  assert.equal(resolvedDraft.knowledge_item_id, successful[0]?.knowledgeItemId);
});

test('per-draft merge and update connect through one canonical graph node', async () => {
  const userId = `user_single_relation_revision_${crypto.randomUUID()}`;
  const target = createMemoryKnowledgeItemForUser(userId, {
    title: 'Canonical relation target', content: 'Version one.', topic: 'Relations',
  });
  const initialGraph = await getPrivateKnowledgeGraphForUser(userId);
  const canonicalNodeId = initialGraph.nodes.find((node) => node.knowledge_item_id === target.id)?.graph_node_id;
  assert.ok(canonicalNodeId);

  let expectedTargetVersion = target.version;
  for (const [action, publicTarget] of [
    ['merge', 'mathematics'],
    ['update', 'computer_science'],
  ] as const) {
    const created = await createKnowledgeDraftBatchForUser(userId, {
      provider: 'claude',
      requestId: `single-relation-${action}-${crypto.randomUUID()}`,
      cards: [{
        title: `${action} relation candidate`,
        topic: 'Relations',
        relations: [{
          targetKind: 'public', targetId: `graph_${publicTarget}`, type: 'supports',
          direction: 'outgoing', relationOrigin: 'model_inferred',
        }],
      }],
    });
    const draft = (await getKnowledgeDraftBatchForUser(userId, created.batchId))!.drafts[0];
    const result = await resolveKnowledgeDraftForUser(userId, {
      batchId: created.batchId,
      draftId: draft.id,
      expectedDraftVersion: draft.version,
      action,
      targetKnowledgeItemId: target.id,
      expectedTargetVersion,
      reviewed: {
        title: `Canonical after ${action}`,
        summary: '',
        content: `Canonical content after ${action}.`,
        topic: 'Relations',
        tags: [],
        knowledgeType: null,
        centralQuestion: null,
        structuredContent: null,
        bundleSchemaVersion: null,
      },
    });
    assert.equal(result.resolved, true);
    assert.equal(result.skippedEdges, 0);
    expectedTargetVersion += 1;
    assert.equal(result.version, expectedTargetVersion);
  }

  const graph = await getPrivateKnowledgeGraphForUser(userId);
  assert.equal(graph.nodes.filter((node) => node.knowledge_item_id === target.id).length, 1);
  assert.equal(graph.nodes.find((node) => node.knowledge_item_id === target.id)?.graph_node_id, canonicalNodeId);
  assert.deepEqual(
    new Set(graph.edges.filter((edge) => edge.type === 'supports').map((edge) => `${edge.source}->${edge.target}`)),
    new Set([
      `personal:${target.id}->graph_mathematics`,
      `personal:${target.id}->graph_computer_science`,
    ]),
  );
});

test('per-draft merge and update restore a missing canonical graph node before adding relations', async () => {
  const userId = `user_single_relation_missing_node_${crypto.randomUUID()}`;

  for (const action of ['merge', 'update'] as const) {
    const target = createMemoryKnowledgeItemForUser(userId, {
      title: `${action} target without graph node`,
      content: 'Canonical content.',
      topic: 'Relations',
    }, { syncGraph: false });
    assert.equal(
      (await getPrivateKnowledgeGraphForUser(userId)).nodes.some(
        (node) => node.knowledge_item_id === target.id,
      ),
      false,
    );

    const created = await createKnowledgeDraftBatchForUser(userId, {
      provider: 'other',
      requestId: `single-relation-missing-node-${action}-${crypto.randomUUID()}`,
      cards: [{
        title: `${action} candidate`,
        topic: 'Relations',
        relations: [{ targetKind: 'public', targetId: 'graph_mathematics', type: 'supports' }],
      }],
    });
    const draft = (await getKnowledgeDraftBatchForUser(userId, created.batchId))!.drafts[0];
    const result = await resolveKnowledgeDraftForUser(userId, {
      batchId: created.batchId,
      draftId: draft.id,
      expectedDraftVersion: draft.version,
      action,
      targetKnowledgeItemId: target.id,
      expectedTargetVersion: target.version,
      reviewed: {
        title: `${action} canonical with relation`,
        summary: '',
        content: 'Reviewed content.',
        topic: 'Relations',
        tags: [],
        knowledgeType: null,
        centralQuestion: null,
        structuredContent: null,
        bundleSchemaVersion: null,
      },
    });

    assert.equal(result.resolved, true);
    assert.equal(result.skippedEdges, 0);
    const graph = await getPrivateKnowledgeGraphForUser(userId);
    assert.equal(graph.nodes.filter((node) => node.knowledge_item_id === target.id).length, 1);
    assert.ok(graph.edges.some((edge) => (
      edge.source === `personal:${target.id}`
      && edge.target === 'graph_mathematics'
      && edge.type === 'supports'
    )));
  }
});

test('per-draft resolution keeps a source pending until its draft dependency is canonical', async () => {
  const userId = `user_single_relation_dependency_${crypto.randomUUID()}`;
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'gemini',
    requestId: `single-relation-dependency-${crypto.randomUUID()}`,
    cards: [
      {
        clientCardId: 'single-source',
        title: 'Single source',
        relations: [{ targetKind: 'draft', targetId: 'single-target', type: 'related' }],
      },
      { clientCardId: 'single-target', title: 'Single target' },
    ],
  });
  const loaded = (await getKnowledgeDraftBatchForUser(userId, created.batchId))!;
  const source = loaded.drafts.find((draft) => draft.client_card_id === 'single-source')!;
  const target = loaded.drafts.find((draft) => draft.client_card_id === 'single-target')!;

  const blocked = await resolveKnowledgeDraftForUser(userId, {
    batchId: created.batchId,
    draftId: source.id,
    expectedDraftVersion: source.version,
    action: 'create',
  });
  assert.equal(blocked.resolved, false);
  assert.equal(blocked.pendingDependency, true);
  assert.equal(blocked.stale, undefined);
  assert.equal(getMemoryKnowledgeItemsForUser(userId).length, 0);
  assert.equal((await getKnowledgeDraftBatchForUser(userId, created.batchId))!.drafts.find((draft) => draft.id === source.id)?.status, 'pending');

  const targetResult = await resolveKnowledgeDraftForUser(userId, {
    batchId: created.batchId,
    draftId: target.id,
    expectedDraftVersion: target.version,
    action: 'create',
  });
  assert.equal(targetResult.resolved, true);
  const sourceResult = await resolveKnowledgeDraftForUser(userId, {
    batchId: created.batchId,
    draftId: source.id,
    expectedDraftVersion: source.version,
    action: 'create',
  });
  assert.equal(sourceResult.resolved, true);
  assert.equal(sourceResult.skippedEdges, 0);
  assert.deepEqual(getMemoryPrivateKnowledgeEdgesForTesting(userId).map((edge) => new Set([edge.source, edge.target])), [
    new Set([`personal:${sourceResult.knowledgeItemId}`, `personal:${targetResult.knowledgeItemId}`]),
  ]);
});

test('per-draft self and missing targets are counted without corrupting canonical approval', async () => {
  const userId = `user_single_relation_skips_${crypto.randomUUID()}`;
  const created = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'other',
    requestId: `single-relation-skips-${crypto.randomUUID()}`,
    cards: [{
      clientCardId: 'self-card',
      title: 'Self relation candidate',
      relations: [
        { targetKind: 'draft', targetId: 'self-card', type: 'related' },
        { targetKind: 'public', targetId: 'graph_missing-public-node', type: 'supports' },
      ],
    }],
  });
  const draft = (await getKnowledgeDraftBatchForUser(userId, created.batchId))!.drafts[0];
  const result = await resolveKnowledgeDraftForUser(userId, {
    batchId: created.batchId,
    draftId: draft.id,
    expectedDraftVersion: draft.version,
    action: 'create',
  });
  assert.equal(result.resolved, true);
  assert.equal(result.skippedEdges, 2);
  assert.equal(getMemoryKnowledgeItemsForUser(userId).length, 1);
  assert.equal(getMemoryPrivateKnowledgeEdgesForTesting(userId).length, 0);
  assert.equal((await getKnowledgeDraftBatchForUser(userId, created.batchId))!.drafts[0].status, 'approved');
});

test('skips prerequisite cycles and symmetric duplicates, then restores trashed graph data', async () => {
  const userId = `user_ingestion_graph_${crypto.randomUUID()}`;
  const first = createMemoryKnowledgeItemForUser(userId, { title: 'First', content: '', topic: '테스트' });
  const second = createMemoryKnowledgeItemForUser(userId, { title: 'Second', content: '', topic: '테스트' });

  assert.deepEqual(
    await createPrivateKnowledgeEdgeForUser(userId, `personal:${first.id}`, `personal:${second.id}`, 'prerequisite'),
    { created: true }
  );
  assert.equal((await createPrivateKnowledgeEdgeForUser(
    userId, `personal:${second.id}`, `personal:${first.id}`, 'prerequisite'
  )).created, false);
  assert.equal((await createPrivateKnowledgeEdgeForUser(
    userId, `personal:${first.id}`, `personal:${second.id}`, 'related'
  )).created, true);
  assert.equal((await createPrivateKnowledgeEdgeForUser(
    userId, `personal:${second.id}`, `personal:${first.id}`, 'related'
  )).created, false);

  softDeleteMemoryKnowledgeItemForUser(userId, first.id, 14);
  assert.equal((await getPrivateKnowledgeGraphForUser(userId)).nodes.length, 1);
  restoreMemoryKnowledgeItemForUser(userId, first.id);
  const restored = await getPrivateKnowledgeGraphForUser(userId);
  assert.equal(restored.nodes.length, 2);
  assert.equal(restored.edges.length, 2);
});

test('keeps guest item CRUD out of the private graph while signed-in CRUD stays synchronized', async () => {
  const guestId = `guest_item_only_${crypto.randomUUID()}`;
  const guestItem = createMemoryKnowledgeItemForUser(
    guestId,
    { title: 'Guest note', content: 'Guest content', topic: 'guest-topic' },
    { syncGraph: false }
  );

  assert.equal(getMemoryKnowledgeItemsForUser(guestId).length, 1);
  assert.deepEqual(await getPrivateKnowledgeGraphForUser(guestId), { nodes: [], edges: [] });

  updateMemoryKnowledgeItemForUser(
    guestId,
    guestItem.id,
    { title: 'Updated guest note', content: 'Updated guest content', topic: 'guest-updated' },
    { syncGraph: false }
  );
  assert.equal(getMemoryKnowledgeItemsForUser(guestId)[0]?.title, 'Updated guest note');
  assert.deepEqual(await getPrivateKnowledgeGraphForUser(guestId), { nodes: [], edges: [] });

  softDeleteMemoryKnowledgeItemForUser(guestId, guestItem.id, 14, { syncGraph: false });
  assert.ok(getMemoryKnowledgeItemsForUser(guestId)[0]?.deleted_at);
  assert.deepEqual(await getPrivateKnowledgeGraphForUser(guestId), { nodes: [], edges: [] });

  restoreMemoryKnowledgeItemForUser(guestId, guestItem.id, { syncGraph: false });
  assert.equal(getMemoryKnowledgeItemsForUser(guestId)[0]?.deleted_at, null);
  assert.deepEqual(await getPrivateKnowledgeGraphForUser(guestId), { nodes: [], edges: [] });

  const signedInUserId = `user_graph_sync_${crypto.randomUUID()}`;
  const signedInItem = createMemoryKnowledgeItemForUser(signedInUserId, {
    title: 'Signed-in note',
    content: 'Signed-in content',
    topic: 'signed-in-topic',
  });
  assert.equal((await getPrivateKnowledgeGraphForUser(signedInUserId)).nodes.length, 1);

  updateMemoryKnowledgeItemForUser(signedInUserId, signedInItem.id, {
    title: 'Updated signed-in note',
    content: 'Updated signed-in content',
    topic: 'signed-in-updated',
  });
  assert.equal((await getPrivateKnowledgeGraphForUser(signedInUserId)).nodes[0]?.label, 'Updated signed-in note');

  softDeleteMemoryKnowledgeItemForUser(signedInUserId, signedInItem.id, 14);
  assert.equal((await getPrivateKnowledgeGraphForUser(signedInUserId)).nodes.length, 0);
  restoreMemoryKnowledgeItemForUser(signedInUserId, signedInItem.id);
  assert.equal((await getPrivateKnowledgeGraphForUser(signedInUserId)).nodes.length, 1);
});
