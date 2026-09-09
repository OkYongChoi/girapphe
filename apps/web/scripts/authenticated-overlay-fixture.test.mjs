import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTHENTICATED_OVERLAY_DRAFT_PROBE_TITLE_PREFIX,
  AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE,
  ensureSyntheticClerkUser,
  fixtureIdsForUser,
  normalizeSyntheticEmail,
  seedAuthenticatedOverlayFixtureWithClient,
} from './authenticated-overlay-fixture.mjs';

const SYNTHETIC_EMAIL = 'qa+clerk_test_girapphe_overlay_e2e@example.com';
const SYNTHETIC_USER = {
  id: 'user_synthetic',
  publicMetadata: { girappheSyntheticPurpose: AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE },
};

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
