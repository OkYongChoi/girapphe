import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE,
  ensureSyntheticClerkUser,
  fixtureIdsForUser,
  normalizeSyntheticEmail,
  seedAuthenticatedOverlayFixtureWithClient,
} from './authenticated-overlay-fixture.mjs';

const SYNTHETIC_EMAIL = 'qa+clerk_test_girapphe_overlay_e2e@example.com';

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
  const createdUser = {
    id: 'user_synthetic',
    publicMetadata: { girappheSyntheticPurpose: AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE },
  };
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
        return { rows: [{ private_nodes: 2, private_edges: 1, public_links: 1 }] };
      }
      return { rows: [] };
    },
  };

  const first = await seedAuthenticatedOverlayFixtureWithClient(client, 'user_synthetic');
  const second = await seedAuthenticatedOverlayFixtureWithClient(client, 'user_synthetic');
  assert.deepEqual(first, second);
  assert.deepEqual(first.counts, { privateNodes: 2, privateEdges: 1, publicLinks: 1 });
  assert.equal(calls.filter((call) => call.text === 'BEGIN').length, 2);
  assert.equal(calls.filter((call) => call.text === 'COMMIT').length, 2);
  assert.equal(calls.some((call) => call.text === 'ROLLBACK'), false);

  const mutations = calls.filter((call) => call.text.startsWith('INSERT INTO'));
  assert.ok(mutations.length >= 8);
  assert.ok(mutations.every((call) => call.text.includes('ON CONFLICT (id) DO UPDATE')));
  assert.ok(mutations.every((call) => !call.text.includes('user_synthetic')));
  assert.ok(mutations.every((call) => call.values.includes('user_synthetic')));
});

test('database fixture remains valid when a schema-only preview has no public nodes', async () => {
  const calls = [];
  const client = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (text.startsWith('SELECT id FROM graph_nodes')) return { rows: [] };
      if (text.includes('AS private_nodes')) {
        return { rows: [{ private_nodes: 2, private_edges: 1, public_links: 0 }] };
      }
      return { rows: [] };
    },
  };

  const fixture = await seedAuthenticatedOverlayFixtureWithClient(client, 'user_synthetic');
  assert.deepEqual(fixture.counts, { privateNodes: 2, privateEdges: 1, publicLinks: 0 });
  assert.equal(calls.filter((call) => call.text.startsWith('INSERT INTO user_graph_edges')).length, 1);
  assert.equal(calls.some((call) => call.text === 'ROLLBACK'), false);
});
