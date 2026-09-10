import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanupAuthenticatedMobileApiFixtureWithClient,
  createAuthenticatedMobileApiFixtureWithClient,
} from './authenticated-mobile-api-fixture.mjs';

const MARKER = 'E2E_MOBILE_API_0123456789abcdef0123456789abcdef';
const BATCH_ID = '11111111-1111-4111-8111-111111111111';
const NOTE_ID = '22222222-2222-4222-8222-222222222222';
const RANKING_CARD_ID = 'synthetic-public-card';
const SYNTHETIC_USER = {
  id: 'user_mobile_api_fixture',
  publicMetadata: { girappheSyntheticPurpose: 'authenticated-overlay-e2e' },
};

function mockClient(resolver) {
  const calls = [];
  return {
    calls,
    async query(text, params = []) {
      calls.push({ text, params });
      return resolver(text, params);
    },
  };
}

test('candidate fixture creates exactly two owner-scoped pending drafts in one transaction', async () => {
  const client = mockClient((text) => {
    if (/SELECT COUNT\(\*\)::integer AS count/.test(text)) return { rows: [{ count: 0 }] };
    if (/SELECT c\.id/.test(text)) return { rows: [{ id: RANKING_CARD_ID }] };
    return { rows: [] };
  });
  const result = await createAuthenticatedMobileApiFixtureWithClient(
    client,
    SYNTHETIC_USER,
    MARKER,
  );

  assert.match(result.batchId, /^[0-9a-f-]{36}$/);
  assert.equal(result.drafts.approve.version, 1);
  assert.equal(result.drafts.ignore.version, 1);
  assert.equal(result.rankingCardId, RANKING_CARD_ID);
  assert.match(result.expectedParticipantId, /^[0-9a-f]{12}$/);
  const batchInsert = client.calls.find((call) => /INSERT INTO knowledge_ingestion_batches/.test(call.text));
  const draftInsert = client.calls.find((call) => /INSERT INTO knowledge_card_drafts/.test(call.text));
  assert.deepEqual(batchInsert.params.slice(1), [
    SYNTHETIC_USER.id,
    `mobile-api-evidence:${MARKER}`,
  ]);
  assert.deepEqual(draftInsert.params.slice(2), [
    result.batchId,
    SYNTHETIC_USER.id,
    `${MARKER}:approve`,
    `${MARKER}:ignore`,
  ]);
  assert.equal(client.calls.at(-1).text, 'COMMIT');
});

test('cleanup removes only exact owner batch, approved item, note, and hashed event subject', async () => {
  const approvedItemId = '33333333-3333-4333-8333-333333333333';
  const client = mockClient((text) => {
    if (/SELECT b\.id,/.test(text)) {
      return { rows: [{ id: BATCH_ID, owner_drafts: 2, foreign_drafts: 0, marker_drafts: 2 }] };
    }
    if (/SELECT id FROM user_knowledge_items/.test(text)) {
      return { rows: [{ id: NOTE_ID }] };
    }
    if (/SELECT DISTINCT d\.knowledge_item_id AS id/.test(text)) {
      return { rows: [{ id: approvedItemId }] };
    }
    if (/DELETE FROM user_knowledge_items[\s\S]*title = \$3/.test(text)) {
      return { rows: [{ id: NOTE_ID }] };
    }
    if (/DELETE FROM user_card_states/.test(text)) {
      return { rows: [{ card_id: RANKING_CARD_ID }] };
    }
    if (/DELETE FROM knowledge_ingestion_batches/.test(text)) {
      return { rows: [{ id: BATCH_ID }] };
    }
    if (/\(SELECT COUNT\(\*\)::integer FROM knowledge_ingestion_batches/.test(text)) {
      return { rows: [{
        batches: 0, drafts: 0, events: 0, items: 0, ranking_rows: 0, private_states: 0,
      }] };
    }
    return { rows: [] };
  });

  const result = await cleanupAuthenticatedMobileApiFixtureWithClient(
    client,
    SYNTHETIC_USER,
    { marker: MARKER, batchId: BATCH_ID, noteId: NOTE_ID, rankingCardId: RANKING_CARD_ID },
  );
  assert.deepEqual(result, {
    deletedBatch: true,
    deletedApprovedItems: 1,
    deletedNote: true,
    deletedRankingRow: true,
    remainingRows: 0,
  });

  const itemDelete = client.calls.findIndex((call) => (
    /DELETE FROM user_knowledge_items WHERE user_id/.test(call.text)
  ));
  const eventDelete = client.calls.findIndex((call) => (
    /DELETE FROM knowledge_product_events/.test(call.text)
  ));
  const batchDelete = client.calls.findIndex((call) => (
    /DELETE FROM knowledge_ingestion_batches/.test(call.text)
  ));
  assert.ok(itemDelete >= 0 && itemDelete < eventDelete && eventDelete < batchDelete);
  assert.deepEqual(client.calls[eventDelete].params[0], SYNTHETIC_USER.id);
  assert.match(client.calls[eventDelete].params[1], /^[0-9a-f]{64}$/);
  assert.doesNotMatch(client.calls[eventDelete].text, /event_name/);
  assert.equal(client.calls.at(-1).text, 'COMMIT');
});

test('cleanup rejects ambiguous ownership and rolls back before any deletion', async () => {
  const client = mockClient((text) => {
    if (/SELECT b\.id,/.test(text)) {
      return { rows: [{ id: BATCH_ID, owner_drafts: 2, foreign_drafts: 1, marker_drafts: 2 }] };
    }
    return { rows: [] };
  });
  await assert.rejects(
    cleanupAuthenticatedMobileApiFixtureWithClient(
      client,
      SYNTHETIC_USER,
      { marker: MARKER, batchId: BATCH_ID, noteId: NOTE_ID, rankingCardId: RANKING_CARD_ID },
    ),
    /MOBILE_API_FIXTURE_CLEANUP_NOT_ELIGIBLE/,
  );
  assert.equal(client.calls.at(-1).text, 'ROLLBACK');
  assert.equal(client.calls.some((call) => /^DELETE /.test(call.text.trim())), false);
});

test('cleanup can recover an exact marker-owned note before its ID is observed', async () => {
  const client = mockClient((text) => {
    if (/SELECT b\.id,/.test(text)) {
      return { rows: [{ id: BATCH_ID, owner_drafts: 2, foreign_drafts: 0, marker_drafts: 2 }] };
    }
    if (/SELECT id FROM user_knowledge_items/.test(text)) return { rows: [{ id: NOTE_ID }] };
    if (/SELECT DISTINCT d\.knowledge_item_id AS id/.test(text)) return { rows: [] };
    if (/DELETE FROM user_knowledge_items[\s\S]*title = \$3/.test(text)) {
      return { rows: [{ id: NOTE_ID }] };
    }
    if (/DELETE FROM user_card_states/.test(text)) {
      return { rows: [{ card_id: RANKING_CARD_ID }] };
    }
    if (/DELETE FROM knowledge_ingestion_batches/.test(text)) {
      return { rows: [{ id: BATCH_ID }] };
    }
    if (/\(SELECT COUNT\(\*\)::integer FROM knowledge_ingestion_batches/.test(text)) {
      return { rows: [{
        batches: 0, drafts: 0, events: 0, items: 0, ranking_rows: 0, private_states: 0,
      }] };
    }
    return { rows: [] };
  });
  const result = await cleanupAuthenticatedMobileApiFixtureWithClient(
    client,
    SYNTHETIC_USER,
    { marker: MARKER, batchId: BATCH_ID, rankingCardId: RANKING_CARD_ID },
  );
  assert.equal(result.deletedNote, true);
  const noteDelete = client.calls.find((call) => (
    /DELETE FROM user_knowledge_items[\s\S]*title = \$3/.test(call.text)
  ));
  assert.deepEqual(noteDelete.params, [NOTE_ID, SYNTHETIC_USER.id, MARKER]);
});

test('fixture rejects a non-unique marker before starting a transaction', async () => {
  const client = mockClient(() => ({ rows: [] }));
  await assert.rejects(
    createAuthenticatedMobileApiFixtureWithClient(client, SYNTHETIC_USER, 'mobile-api'),
    /unique run marker/,
  );
  assert.equal(client.calls.length, 0);
});
