import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approveKnowledgeDraftsForUser,
  authenticateMcpAccessToken,
  createKnowledgeDraftBatchForUser,
  createMcpAccessTokenForUser,
  createMemoryKnowledgeItemForUser,
  createPrivateKnowledgeEdgeForUser,
  getKnowledgeDraftBatchForUser,
  getMemoryMcpCredentialRateLimitRecordCountForTesting,
  getMemoryKnowledgeItemsForUser,
  getPrivateKnowledgeGraphForUser,
  MCP_CREDENTIAL_RATE_LIMIT_CLEANUP_BATCH_SIZE,
  MCP_CREDENTIAL_RATE_LIMIT_RETENTION_MS,
  MCP_REQUESTS_PER_TOKEN_PER_MINUTE,
  McpRequestRateLimitError,
  normalizeKnowledgeTopic,
  rateLimitMcpOAuthPrincipal,
  restoreMemoryKnowledgeItemForUser,
  softDeleteMemoryKnowledgeItemForUser,
} from './knowledge-ingestion';

test('normalizes Korean topics without collapsing them to general', () => {
  assert.equal(normalizeKnowledgeTopic('  머신 러닝 / 기초  '), '머신-러닝-기초');
  assert.equal(normalizeKnowledgeTopic('확률과_통계!'), '확률과_통계');
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
