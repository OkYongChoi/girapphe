import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  AUTHENTICATED_OVERLAY_DRAFT_PROBE_TITLE_PREFIX,
  AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE,
  assertPendingAuthenticatedOverlayImportIsInertWithClient,
  deleteExactAuthenticatedOverlayImportWithClient,
  ensureSyntheticClerkUser,
  findExistingAuthenticatedOverlaySyntheticUser,
  fixtureIdsForUser,
  normalizeSyntheticEmail,
  readAuthenticatedOverlayPublishedStateWithClient,
  seedAuthenticatedOverlayFixtureWithClient,
} from './authenticated-overlay-fixture.mjs';

const SYNTHETIC_EMAIL = 'qa+clerk_test_girapphe_overlay_e2e@example.com';
const SYNTHETIC_USER = {
  id: 'user_synthetic',
  publicMetadata: { girappheSyntheticPurpose: AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE },
};
const SYNTHETIC_BATCH_ID = '123e4567-e89b-42d3-a456-426614174000';
const SYNTHETIC_IMPORT_SESSION_ID = '223e4567-e89b-42d3-a456-426614174000';
const SYNTHETIC_IMPORT_MARKER = 'E2E_SELECTED_QUESTION_A_0123456789abcdef0123456789abcdef';

function eventSubjectHash(subjectId) {
  return createHash('sha256')
    .update(`${SYNTHETIC_USER.id}\0${subjectId}`)
    .digest('hex');
}

test('synthetic email validation rejects an unmarked account', () => {
  assert.equal(normalizeSyntheticEmail(SYNTHETIC_EMAIL.toUpperCase()), SYNTHETIC_EMAIL);
  assert.throws(
    () => normalizeSyntheticEmail('real-user@example.com'),
    /dedicated \+clerk_test_girapphe_overlay_e2e marker/,
  );
});

test('fixture IDs are deterministic, owner-specific, and do not expose Clerk IDs', () => {
  const first = fixtureIdsForUser('user_private_owner_a');
  const repeated = fixtureIdsForUser('user_private_owner_a');
  const other = fixtureIdsForUser('user_private_owner_b');

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, other);
  assert.equal(JSON.stringify(first).includes('user_private_owner_a'), false);
});

test('Clerk setup creates a marked synthetic user once and reuses only that user', async () => {
  const createdUser = SYNTHETIC_USER;
  let users = [];
  let creates = 0;
  const clerkClient = {
    users: {
      async getUserList() {
        return { data: users };
      },
      async createUser(input) {
        creates += 1;
        assert.deepEqual(input.emailAddress, [SYNTHETIC_EMAIL]);
        assert.equal(input.publicMetadata.girappheSyntheticPurpose, AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE);
        assert.ok(input.password.length >= 32);
        users = [createdUser];
        return createdUser;
      },
    },
  };

  const first = await ensureSyntheticClerkUser({ clerkClient, emailAddress: SYNTHETIC_EMAIL });
  const second = await ensureSyntheticClerkUser({ clerkClient, emailAddress: SYNTHETIC_EMAIL });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(creates, 1);

  users = [{ id: 'user_unmarked', publicMetadata: {} }];
  await assert.rejects(
    () => ensureSyntheticClerkUser({ clerkClient, emailAddress: SYNTHETIC_EMAIL }),
    /not marked as this synthetic fixture/,
  );
});

test('cleanup resolves one existing marked synthetic Clerk user without creating an account', async () => {
  const requests = [];
  const clerkClient = {
    users: {
      async getUserList(input) {
        requests.push(input);
        return { data: [SYNTHETIC_USER] };
      },
    },
  };

  assert.equal(
    await findExistingAuthenticatedOverlaySyntheticUser({
      clerkClient,
      emailAddress: SYNTHETIC_EMAIL,
    }),
    SYNTHETIC_USER,
  );
  assert.deepEqual(requests, [{ emailAddress: [SYNTHETIC_EMAIL], limit: 2 }]);

  clerkClient.users.getUserList = async () => ({ data: [] });
  await assert.rejects(
    () => findExistingAuthenticatedOverlaySyntheticUser({
      clerkClient,
      emailAddress: SYNTHETIC_EMAIL,
    }),
    /SYNTHETIC_CLEANUP_OWNER_NOT_UNIQUE/,
  );
});

test('pending selected import leaves published, graph, mastery, and ranking state inert', async () => {
  const calls = [];
  const publishedRow = {
    canonical_knowledge: 4,
    private_graph_nodes: 4,
    private_graph_edges: 3,
    public_graph_nodes: 600,
    public_graph_edges: 900,
    private_mastery_rows: 0,
    public_mastery_rows: 2,
    ranking_rows: 1,
    published_digest: 'a'.repeat(32),
  };
  const inertRow = {
    target_batch_count: 1,
    draft_count: 2,
    pending_drafts: 2,
    marker_matches: 1,
    foreign_drafts: 0,
    canonical_links: 0,
    source_rows: 0,
    private_graph_nodes: 0,
    private_graph_edges: 0,
    private_mastery_rows: 0,
    revision_rows: 0,
    activity_rows: 0,
  };
  const client = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (text.includes('AS published_digest')) return { rows: [publishedRow] };
      if (text.includes('AS target_batch_count')) return { rows: [inertRow] };
      return { rows: [] };
    },
  };

  assert.deepEqual(
    await readAuthenticatedOverlayPublishedStateWithClient(client, SYNTHETIC_USER),
    {
      canonicalKnowledge: 4,
      privateGraphNodes: 4,
      privateGraphEdges: 3,
      publicGraphNodes: 600,
      publicGraphEdges: 900,
      privateMasteryRows: 0,
      publicMasteryRows: 2,
      rankingRows: 1,
      digest: 'a'.repeat(32),
    },
  );
  assert.deepEqual(
    await assertPendingAuthenticatedOverlayImportIsInertWithClient(
      client,
      SYNTHETIC_USER,
      {
        batchId: SYNTHETIC_BATCH_ID,
        marker: SYNTHETIC_IMPORT_MARKER,
        expectedDraftCount: 2,
      },
    ),
    {
      targetBatch: 1,
      drafts: 2,
      pendingDrafts: 2,
      markerMatches: 1,
      foreignDrafts: 0,
      canonicalLinks: 0,
      sourceRows: 0,
      privateGraphNodes: 0,
      privateGraphEdges: 0,
      privateMasteryRows: 0,
      revisionRows: 0,
      activityRows: 0,
    },
  );

  const publishedQuery = calls.find((call) => call.text.includes('AS published_digest'));
  assert.deepEqual(publishedQuery?.values, [SYNTHETIC_USER.id]);
  assert.match(publishedQuery?.text ?? '', /FROM user_knowledge_items WHERE user_id = \$1/);
  assert.match(publishedQuery?.text ?? '', /FROM user_knowledge_states WHERE user_id = \$1/);
  assert.match(publishedQuery?.text ?? '', /FROM user_card_states WHERE user_id = \$1/);
  assert.match(publishedQuery?.text ?? '', /string_agg\(to_jsonb\(i\)::text/);
  assert.match(publishedQuery?.text ?? '', /string_agg\(to_jsonb\(n\)::text/);
  assert.doesNotMatch(
    publishedQuery?.text ?? '',
    /-\s*'(?:title|summary|content|topic|tags|central_question|structured_content|label)'/,
    'published-state digest must include canonical content and graph labels',
  );
  const pendingQuery = calls.find((call) => call.text.includes('AS target_batch_count'));
  assert.deepEqual(pendingQuery?.values, [
    SYNTHETIC_BATCH_ID,
    SYNTHETIC_USER.id,
    SYNTHETIC_IMPORT_MARKER,
  ]);
  assert.match(pendingQuery?.text ?? '', /b\.provider = 'chatgpt'/);
  assert.match(pendingQuery?.text ?? '', /b\.scope = 'selected_export'/);
  assert.match(pendingQuery?.text ?? '', /knowledge_card_sources/);
  assert.match(pendingQuery?.text ?? '', /user_private_card_states/);

  const contaminatedClient = {
    async query() {
      return { rows: [{ ...inertRow, canonical_links: 1 }] };
    },
  };
  await assert.rejects(
    () => assertPendingAuthenticatedOverlayImportIsInertWithClient(
      contaminatedClient,
      SYNTHETIC_USER,
      { batchId: SYNTHETIC_BATCH_ID, marker: SYNTHETIC_IMPORT_MARKER },
    ),
    /SYNTHETIC_PENDING_IMPORT_NOT_INERT/,
  );
});

test('exact import fallback deletes every event for only the owner batch and session subjects', async () => {
  const calls = [];
  const client = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (text.includes('AS marker_matches')) {
        return { rows: [{
          id: SYNTHETIC_BATCH_ID,
          request_id: `chatgpt-export:test:session:${SYNTHETIC_IMPORT_SESSION_ID}`,
          marker_matches: 1,
          protected_drafts: 0,
          foreign_drafts: 0,
          linked_sources: 0,
        }] };
      }
      if (text.trimStart().startsWith('DELETE FROM knowledge_ingestion_batches')) {
        return { rows: [{ id: SYNTHETIC_BATCH_ID }] };
      }
      if (text.includes('AS remaining_batches')) {
        return { rows: [{
          remaining_batches: 0,
          remaining_drafts: 0,
          remaining_events: 0,
        }] };
      }
      return { rows: [] };
    },
  };

  assert.deepEqual(
    await deleteExactAuthenticatedOverlayImportWithClient(
      client,
      SYNTHETIC_USER,
      { batchId: SYNTHETIC_BATCH_ID, marker: SYNTHETIC_IMPORT_MARKER },
    ),
    {
      deleted: true,
      remainingBatches: 0,
      remainingDrafts: 0,
      remainingEvents: 0,
    },
  );

  const eligibility = calls.find((call) => call.text.includes('AS marker_matches'));
  assert.deepEqual(eligibility?.values, [
    SYNTHETIC_BATCH_ID,
    SYNTHETIC_USER.id,
    SYNTHETIC_IMPORT_MARKER,
  ]);
  assert.match(eligibility?.text ?? '', /b\.id = \$1/);
  assert.match(eligibility?.text ?? '', /b\.user_id = \$2/);
  assert.match(eligibility?.text ?? '', /marker_draft\.central_question = \$3/);
  assert.match(eligibility?.text ?? '', /b\.provider = 'chatgpt'/);
  assert.match(eligibility?.text ?? '', /b\.scope = 'selected_export'/);
  assert.match(eligibility?.text ?? '', /b\.status IN \('pending', 'partial', 'discarded'\)/);
  assert.match(eligibility?.text ?? '', /protected_draft\.status = 'approved'/);
  assert.match(eligibility?.text ?? '', /knowledge_card_sources source/);
  assert.doesNotMatch(eligibility?.text ?? '', /source\.user_id = b\.user_id/);

  const accountLock = calls.findIndex((call) => call.text.includes("'mcp-account-lifecycle:'"));
  const activeAccountGuard = calls.findIndex((call) => call.text.startsWith('INSERT INTO mcp_deleted_account_markers'));
  const ingestionLock = calls.findIndex((call) => call.values[0] === `knowledge-ingestion:${SYNTHETIC_USER.id}`);
  const importLock = calls.findIndex((call) => call.values[0] === `knowledge-import:${SYNTHETIC_USER.id}:${SYNTHETIC_BATCH_ID}`);
  const deleteIndex = calls.findIndex((call) => call.text.trimStart().startsWith('DELETE FROM knowledge_ingestion_batches'));
  assert.ok(accountLock >= 0 && accountLock < activeAccountGuard);
  assert.ok(activeAccountGuard < ingestionLock && ingestionLock < importLock && importLock < deleteIndex);
  assert.equal(calls.at(-1)?.text, 'COMMIT');

  const deletion = calls[deleteIndex];
  assert.deepEqual(deletion.values, [SYNTHETIC_BATCH_ID, SYNTHETIC_USER.id]);
  assert.match(deletion.text, /id = \$1[\s\S]*user_id = \$2[\s\S]*provider = 'chatgpt'[\s\S]*scope = 'selected_export'/);
  const eventDeletion = calls.find((call) => call.text.trimStart().startsWith('DELETE FROM knowledge_product_events'));
  assert.deepEqual(eventDeletion?.values, [
    SYNTHETIC_USER.id,
    [eventSubjectHash(SYNTHETIC_BATCH_ID), eventSubjectHash(SYNTHETIC_IMPORT_SESSION_ID)],
  ]);
  assert.match(eventDeletion?.text ?? '', /subject_id = ANY\(\$2::text\[\]\)/);
  assert.doesNotMatch(eventDeletion?.text ?? '', /event_name/);
  assert.ok(calls.indexOf(eventDeletion) < deleteIndex);
  assert.equal(calls.some((call) => call.text.startsWith('DELETE FROM knowledge_ingestion_request_tombstones')), false);
});

test('exact import fallback refuses invalid identity and protected or mismatched batches', async () => {
  const invalidCalls = [];
  const invalidClient = {
    async query(text, values = []) {
      invalidCalls.push({ text, values });
      return { rows: [] };
    },
  };
  await assert.rejects(
    () => deleteExactAuthenticatedOverlayImportWithClient(
      invalidClient,
      { id: 'user_real', publicMetadata: {} },
      { batchId: SYNTHETIC_BATCH_ID, marker: SYNTHETIC_IMPORT_MARKER },
    ),
    /dedicated authenticated overlay synthetic user/,
  );
  await assert.rejects(
    () => deleteExactAuthenticatedOverlayImportWithClient(
      invalidClient,
      SYNTHETIC_USER,
      { batchId: 'not-a-batch', marker: SYNTHETIC_IMPORT_MARKER },
    ),
    /SYNTHETIC_CLEANUP_BATCH_INVALID/,
  );
  await assert.rejects(
    () => deleteExactAuthenticatedOverlayImportWithClient(
      invalidClient,
      SYNTHETIC_USER,
      { batchId: SYNTHETIC_BATCH_ID, marker: 'not-a-marker' },
    ),
    /SYNTHETIC_CLEANUP_MARKER_INVALID/,
  );
  assert.deepEqual(invalidCalls, []);

  for (const protectedRow of [
    { marker_matches: 0, protected_drafts: 0, foreign_drafts: 0, linked_sources: 0 },
    { marker_matches: 1, protected_drafts: 1, foreign_drafts: 0, linked_sources: 0 },
    { marker_matches: 1, protected_drafts: 0, foreign_drafts: 1, linked_sources: 0 },
    { marker_matches: 1, protected_drafts: 0, foreign_drafts: 0, linked_sources: 1 },
  ]) {
    const calls = [];
    const client = {
      async query(text, values = []) {
        calls.push({ text, values });
        if (text.includes('AS marker_matches')) {
          return { rows: [{
            id: SYNTHETIC_BATCH_ID,
            request_id: `chatgpt-export:test:session:${SYNTHETIC_IMPORT_SESSION_ID}`,
            ...protectedRow,
          }] };
        }
        return { rows: [] };
      },
    };
    await assert.rejects(
      () => deleteExactAuthenticatedOverlayImportWithClient(
        client,
        SYNTHETIC_USER,
        { batchId: SYNTHETIC_BATCH_ID, marker: SYNTHETIC_IMPORT_MARKER },
      ),
      /SYNTHETIC_CLEANUP_TARGET_NOT_ELIGIBLE/,
    );
    assert.equal(calls.some((call) => call.text.trimStart().startsWith('DELETE FROM knowledge_ingestion_batches')), false);
    assert.equal(calls.at(-1)?.text, 'ROLLBACK');
  }
});

test('exact import fallback rolls back when exact event cleanup cannot be verified', async () => {
  const calls = [];
  const client = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (text.includes('AS marker_matches')) {
        return { rows: [{
          id: SYNTHETIC_BATCH_ID,
          request_id: `chatgpt-export:test:session:${SYNTHETIC_IMPORT_SESSION_ID}`,
          marker_matches: 1,
          protected_drafts: 0,
          foreign_drafts: 0,
          linked_sources: 0,
        }] };
      }
      if (text.trimStart().startsWith('DELETE FROM knowledge_ingestion_batches')) {
        return { rows: [{ id: SYNTHETIC_BATCH_ID }] };
      }
      if (text.includes('AS remaining_batches')) {
        return { rows: [{
          remaining_batches: 0,
          remaining_drafts: 0,
          remaining_events: 1,
        }] };
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    () => deleteExactAuthenticatedOverlayImportWithClient(
      client,
      SYNTHETIC_USER,
      { batchId: SYNTHETIC_BATCH_ID, marker: SYNTHETIC_IMPORT_MARKER },
    ),
    /SYNTHETIC_CLEANUP_VERIFICATION_FAILED/,
  );
  assert.equal(calls.some((call) => call.text === 'COMMIT'), false);
  assert.equal(calls.at(-1)?.text, 'ROLLBACK');
});

test('database fixture is owner-bound and repeatable', async () => {
  const calls = [];
  const client = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (text.startsWith('SELECT id FROM graph_nodes')) return { rows: [{ id: 'public_node' }] };
      if (text.includes('AS private_nodes')) {
        return { rows: [{
          private_nodes: 4,
          private_edges: 2,
          public_links: 1,
          draft_probes: 0,
          import_submission_events: 0,
        }] };
      }
      return { rows: [] };
    },
  };

  const first = await seedAuthenticatedOverlayFixtureWithClient(
    client,
    SYNTHETIC_USER,
    { resetMcpAccessTokens: true },
  );
  const second = await seedAuthenticatedOverlayFixtureWithClient(
    client,
    SYNTHETIC_USER,
    { resetMcpAccessTokens: true },
  );
  assert.deepEqual(first, second);
  assert.deepEqual(first.counts, {
    privateNodes: 4,
    privateEdges: 2,
    publicLinks: 1,
    importSubmissionEvents: 0,
  });
  assert.equal(calls.filter((call) => call.text === 'BEGIN').length, 2);
  assert.equal(calls.filter((call) => call.text === 'COMMIT').length, 2);
  assert.equal(calls.some((call) => call.text === 'ROLLBACK'), false);

  const draftProbeCleanup = calls.filter((call) => (
    call.text.startsWith('DELETE FROM user_graph_nodes')
    || call.text.startsWith('DELETE FROM user_knowledge_items')
  ));
  assert.equal(draftProbeCleanup.length, 4);
  assert.ok(draftProbeCleanup.every((call) => (
    call.values[0] === SYNTHETIC_USER.id
    && call.values[1] === 'Unsaved create draft'
    && call.values[2] === `${AUTHENTICATED_OVERLAY_DRAFT_PROBE_TITLE_PREFIX} %`
  )));

  const tokenResets = calls.filter((call) => (
    call.text === 'DELETE FROM mcp_access_tokens WHERE user_id = $1'
  ));
  assert.equal(tokenResets.length, 2);
  assert.ok(tokenResets.every((call) => (
    call.values.length === 1 && call.values[0] === SYNTHETIC_USER.id
  )));
  for (const tokenReset of tokenResets) {
    const resetIndex = calls.indexOf(tokenReset);
    const precedingBegin = calls.findLastIndex((call, index) => (
      index < resetIndex && call.text === 'BEGIN'
    ));
    const followingCommit = calls.findIndex((call, index) => (
      index > resetIndex && call.text === 'COMMIT'
    ));
    assert.ok(precedingBegin >= 0 && followingCommit > resetIndex);
  }

  const mutations = calls.filter((call) => call.text.startsWith('INSERT INTO'));
  assert.ok(mutations.length >= 8);
  assert.ok(mutations.every((call) => call.text.includes('ON CONFLICT (id) DO UPDATE')));
  assert.ok(mutations.every((call) => !call.text.includes('user_synthetic')));
  assert.ok(mutations.every((call) => call.values.includes('user_synthetic')));
  const privateEdgeMutation = mutations.find((call) => call.values.includes(first.privateEdgeId));
  const secondaryPrivateEdgeMutation = mutations.find((call) => call.values.includes(first.secondaryPrivateEdgeId));
  assert.match(privateEdgeMutation?.text ?? '', /type = 'related'/);
  assert.doesNotMatch(privateEdgeMutation?.text ?? '', /supports/);
  assert.match(secondaryPrivateEdgeMutation?.text ?? '', /type = 'related'/);
  assert.ok(calls
    .filter((call) => call.text.startsWith('DELETE FROM knowledge_ingestion'))
    .every((call) => call.values.length === 1 && call.values[0] === 'user_synthetic'));
});

test('database fixture remains valid when a schema-only preview has no public nodes', async () => {
  const calls = [];
  const client = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (text.startsWith('SELECT id FROM graph_nodes')) return { rows: [] };
      if (text.includes('AS private_nodes')) {
        return { rows: [{
          private_nodes: 4,
          private_edges: 2,
          public_links: 0,
          draft_probes: 0,
          import_submission_events: 0,
        }] };
      }
      return { rows: [] };
    },
  };

  const fixture = await seedAuthenticatedOverlayFixtureWithClient(client, SYNTHETIC_USER);
  assert.deepEqual(fixture.counts, {
    privateNodes: 4,
    privateEdges: 2,
    publicLinks: 0,
    importSubmissionEvents: 0,
  });
  assert.equal(
    calls.some((call) => call.text === 'DELETE FROM mcp_access_tokens WHERE user_id = $1'),
    false,
  );
  assert.equal(calls.filter((call) => call.text.startsWith('INSERT INTO user_graph_edges')).length, 2);
  assert.equal(calls.some((call) => call.text === 'ROLLBACK'), false);
});

test('database fixture refuses to mutate an account without the synthetic purpose marker', async () => {
  const calls = [];
  const client = {
    async query(text, values = []) {
      calls.push({ text, values });
      return { rows: [] };
    },
  };

  await assert.rejects(
    () => seedAuthenticatedOverlayFixtureWithClient(client, {
      id: 'user_real',
      publicMetadata: {},
    }),
    /dedicated authenticated overlay synthetic user/,
  );
  assert.deepEqual(calls, []);
});

test('database fixture refuses a nonzero pre-consent import-event baseline', async () => {
  const calls = [];
  const client = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (text.startsWith('SELECT id FROM graph_nodes')) return { rows: [] };
      if (text.includes('AS private_nodes')) {
        return { rows: [{
          private_nodes: 4,
          private_edges: 2,
          public_links: 0,
          draft_probes: 0,
          import_submission_events: 1,
        }] };
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    () => seedAuthenticatedOverlayFixtureWithClient(client, SYNTHETIC_USER),
    /required owner-scoped rows/,
  );
  assert.equal(calls.some((call) => call.text === 'COMMIT'), false);
  assert.equal(calls.some((call) => call.text === 'ROLLBACK'), true);
});
