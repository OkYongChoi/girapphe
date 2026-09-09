import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import db from '@/lib/db';
import {
  getEligiblePrivatePracticeCards,
  getNextEligiblePrivatePracticeCard,
  getPrivatePracticeDomainProgress,
  getPrivatePracticeStats,
  getSavedPrivatePracticeCards,
  isEligiblePrivatePracticeRecord,
  parsePersonalCardId,
  removePrivatePracticeCardState,
  resetPrivatePracticeProgress,
  savePrivatePracticeCardState,
  toPersonalCardId,
  type PrivatePracticeEligibilityRecord,
} from './private-practice-cards';

const ACTOR_ID = 'user_private_practice_owner';

function eligibilityRecord(
  overrides: Partial<PrivatePracticeEligibilityRecord> = {},
): PrivatePracticeEligibilityRecord {
  return {
    item_user_id: ACTOR_ID,
    has_approved_ingestion_draft: true,
    has_eligible_conversation_source: true,
    archived_at: null,
    deleted_at: null,
    purge_at: null,
    is_superseded: false,
    ...overrides,
  };
}

function cardRow(overrides: Record<string, unknown> = {}) {
  return {
    knowledge_item_id: '449fdaf0-1754-45e9-9c43-50d8a4d578f8',
    title: 'Owner-approved concept',
    summary: 'An explicitly approved summary.',
    explanation: 'Private explanation visible only to the owner.',
    domain: 'machine-learning',
    status: null,
    knowledge_state: null,
    progress_state: null,
    due_at: null,
    last_seen: null,
    ...eligibilityRecord(),
    ...overrides,
  };
}

test('uses a strict personal namespace and round-trips approved item ids', () => {
  const itemId = '449fdaf0-1754-45e9-9c43-50d8a4d578f8';
  const cardId = toPersonalCardId(itemId);
  assert.equal(cardId, `personal:${itemId}`);
  assert.equal(parsePersonalCardId(cardId), itemId);
  assert.equal(parsePersonalCardId('graph_linear_algebra'), null);
  assert.equal(parsePersonalCardId('personal:'), null);
  assert.equal(parsePersonalCardId('personal:item:with:colon'), null);
  assert.equal(parsePersonalCardId('personal:../other-user'), null);
  assert.throws(() => toPersonalCardId('invalid item id'));
});

test('admits only active owner-approved conversation records', () => {
  assert.equal(isEligiblePrivatePracticeRecord(eligibilityRecord(), ACTOR_ID), true);

  const ineligible: PrivatePracticeEligibilityRecord[] = [
    eligibilityRecord({ has_eligible_conversation_source: false }),
    eligibilityRecord({ has_approved_ingestion_draft: false }),
    eligibilityRecord({ archived_at: new Date() }),
    eligibilityRecord({ deleted_at: new Date() }),
    eligibilityRecord({ purge_at: new Date() }),
    eligibilityRecord({ is_superseded: true }),
    eligibilityRecord({ item_user_id: 'user_other' }),
  ];

  for (const record of ineligible) {
    assert.equal(isEligiblePrivatePracticeRecord(record, ACTOR_ID), false);
  }
});

test('admits a valid owner-authored typed bundle without an ingestion source chain', () => {
  const typedManual = eligibilityRecord({
    has_approved_ingestion_draft: false,
    has_eligible_conversation_source: false,
    knowledge_type: 'concept', central_question: 'What is a bounded context?', bundle_schema_version: 1,
    structured_content: { type: 'concept', definition: 'A model boundary.', key_points: [], examples: [], non_examples: [], misconceptions: [] },
  });
  assert.equal(isEligiblePrivatePracticeRecord(typedManual, ACTOR_ID), true);
  assert.equal(isEligiblePrivatePracticeRecord({ ...typedManual, item_user_id: 'user_other' }, ACTOR_ID), false);
  assert.equal(isEligiblePrivatePracticeRecord({ ...typedManual, central_question: null }, ACTOR_ID), false);
  assert.equal(isEligiblePrivatePracticeRecord({
    ...typedManual,
    structured_content: { type: 'concept', unexpected_legacy_field: true },
  }, ACTOR_ID), true);
  assert.equal(isEligiblePrivatePracticeRecord({ ...typedManual, central_question: '\t' }, ACTOR_ID), true);
  assert.equal(isEligiblePrivatePracticeRecord({ ...typedManual, central_question: '   ' }, ACTOR_ID), false);
  assert.equal(isEligiblePrivatePracticeRecord({
    ...typedManual,
    has_approved_ingestion_draft: true,
  }, ACTOR_ID), false);
  assert.equal(isEligiblePrivatePracticeRecord({
    ...typedManual,
    has_approved_ingestion_draft: true,
    has_eligible_conversation_source: true,
  }, ACTOR_ID), true);
});

test('practice selection filters ineligible provenance, deleted, cross-owner, and invalid-id rows again in application code', async (context) => {
  const originalQuery = db.query;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => { db.query = originalQuery; });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    return {
      rows: [
        cardRow(),
        cardRow({ knowledge_item_id: 'discarded-item', has_eligible_conversation_source: false }),
        cardRow({ knowledge_item_id: 'deleted-item', deleted_at: new Date() }),
        cardRow({ knowledge_item_id: 'other-item', item_user_id: 'user_other' }),
        cardRow({ knowledge_item_id: 'invalid:item-id' }),
      ],
    };
  }) as typeof db.query;

  const cards = await getEligiblePrivatePracticeCards(ACTOR_ID, 'new');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, 'personal:449fdaf0-1754-45e9-9c43-50d8a4d578f8');
  assert.equal(cards[0].explanation, 'Private explanation visible only to the owner.');

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [ACTOR_ID]);
  assert.match(calls[0].text, /i\.user_id = \$1/);
  assert.match(calls[0].text, /approved_draft\.user_id = i\.user_id/);
  assert.match(calls[0].text, /d\.user_id = i\.user_id/);
  assert.match(calls[0].text, /b\.user_id = i\.user_id/);
  assert.match(calls[0].text, /src\.user_id = i\.user_id/);
  assert.match(calls[0].text, /d\.status = 'approved'/);
  assert.match(calls[0].text, /d\.approved_at IS NOT NULL/);
  assert.match(calls[0].text, /source_type = 'conversation'/);
  assert.match(calls[0].text, /i\.archived_at IS NULL/);
  assert.match(calls[0].text, /i\.deleted_at IS NULL/);
  assert.match(calls[0].text, /i\.purge_at IS NULL/);
  assert.match(calls[0].text, /NOT EXISTS \(\s*SELECT 1\s*FROM knowledge_item_supersessions supersession/);
  assert.match(calls[0].text, /s\.recall_schedule_state IS NULL/);
  assert.match(calls[0].text, /s\.recall_schedule_state = 'ordinary_practice'/);
  assert.match(calls[0].text, /s\.due_at IS NOT NULL/);
  assert.match(calls[0].text, /s\.due_at <= NOW\(\)/);
  assert.doesNotMatch(calls[0].text, /\bknowledge_cards\b/);
  assert.doesNotMatch(calls[0].text, /\buser_card_states\b/);
});

test('private mobile cursor selection is owner-scoped and fetches one raw-id keyset row', async (context) => {
  const originalQuery = db.query;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => { db.query = originalQuery; });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    return { rows: [cardRow()] };
  }) as typeof db.query;

  const afterCardId = 'personal:11111111-1111-4111-8111-111111111111';
  const card = await getNextEligiblePrivatePracticeCard(ACTOR_ID, 'new', afterCardId);

  assert.equal(card?.id, 'personal:449fdaf0-1754-45e9-9c43-50d8a4d578f8');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [ACTOR_ID, '11111111-1111-4111-8111-111111111111']);
  assert.match(calls[0].text, /i\.user_id = \$1/);
  assert.match(calls[0].text, /i\.id > \$2/);
  assert.doesNotMatch(calls[0].text, /'personal:' \|\| i\.id/);
  assert.match(calls[0].text, /char_length\(i\.id\) BETWEEN 1 AND 128/);
  assert.match(calls[0].text, /i\.id ~ '\^\[A-Za-z0-9\]/);
  assert.match(calls[0].text, /NOT EXISTS \([\s\S]*?FROM knowledge_card_drafts approved_draft/);
  assert.match(calls[0].text, /approved_draft\.status = 'approved'/);
  assert.match(calls[0].text, /b\.status IN \('partial', 'approved'\)/);
  assert.match(calls[0].text, /src\.knowledge_item_id = i\.id/);
  assert.match(calls[0].text, /ORDER BY i\.id ASC[\s\S]*?LIMIT 1/);
  assert.doesNotMatch(calls[0].text, /LEFT JOIN knowledge_card_drafts/);
  assert.match(calls[0].text, /i\.archived_at IS NULL/);
  assert.match(calls[0].text, /NOT EXISTS \([\s\S]*?knowledge_item_supersessions/);
});

test('private cursor degrades a DB-valid legacy typed payload without ending the lane', async (context) => {
  const originalQuery = db.query;
  context.after(() => { db.query = originalQuery; });
  db.query = (async () => ({ rows: [cardRow({
    knowledge_item_id: '22222222-2222-4222-8222-222222222222',
    has_approved_ingestion_draft: false,
    has_eligible_conversation_source: false,
    knowledge_type: 'concept',
    central_question: 'What remains readable?',
    structured_content: { type: 'concept', unexpected_legacy_field: true },
    bundle_schema_version: 1,
  })] })) as typeof db.query;

  const card = await getNextEligiblePrivatePracticeCard(ACTOR_ID, 'new', null);
  assert.equal(card?.id, 'personal:22222222-2222-4222-8222-222222222222');
  assert.equal(card?.structured_content, null);
  assert.equal(card?.title, 'Owner-approved concept');
});

test('private cursor rejects a noncanonical seek id before querying PostgreSQL', async (context) => {
  const originalQuery = db.query;
  let queried = false;
  context.after(() => { db.query = originalQuery; });
  db.query = (async () => {
    queried = true;
    return { rows: [] };
  }) as typeof db.query;

  await assert.rejects(
    () => getNextEligiblePrivatePracticeCard(ACTOR_ID, 'new', 'personal:bad/id'),
    /Invalid private Practice cursor card id/,
  );
  assert.equal(queried, false);
});

test('private Practice raw-id seek has a checked-in owner cursor index', () => {
  const schema = readFileSync(new URL('../../drizzle/schema.ts', import.meta.url), 'utf8');
  const migration = readFileSync(
    new URL('../../drizzle/migrations/0025_mobile_practice_owner_cursor.sql', import.meta.url),
    'utf8',
  );
  assert.match(schema, /idx_user_knowledge_items_user_id_cursor[\s\S]*?t\.userId, t\.id/);
  assert.match(schema, /idx_knowledge_card_drafts_approved_item_owner[\s\S]*?t\.userId, t\.knowledgeItemId/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS "idx_user_knowledge_items_user_id_cursor"[\s\S]*?"user_id", "id"/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS "idx_knowledge_card_drafts_approved_item_owner"[\s\S]*?"user_id", "knowledge_item_id"[\s\S]*?WHERE "status" = 'approved'/);
});

test('private review SQL admits due known/review rows through the shared due queue', async (context) => {
  const originalQuery = db.query;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => { db.query = originalQuery; });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    return { rows: [] };
  }) as typeof db.query;

  await getEligiblePrivatePracticeCards(ACTOR_ID, 'review');

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.text, /s\.progress_state = 'learning'/);
  assert.match(calls[0]!.text, /s\.status = 'saved'/);
  assert.match(calls[0]!.text, /s\.progress_state = 'review'/);
  assert.match(calls[0]!.text, /s\.status = 'known'/);
  assert.match(calls[0]!.text, /s\.due_at IS NULL OR s\.due_at <= NOW\(\)/);
  assert.match(calls[0]!.text, /s\.due_at IS NOT NULL/);
  assert.match(calls[0]!.text, /s\.recall_schedule_state IS NULL/);
  assert.match(calls[0]!.text, /s\.recall_schedule_state = 'ordinary_practice'/);
});

test('private stats reports the exact due review pool separately from mastery totals', async (context) => {
  const originalQuery = db.query;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => { db.query = originalQuery; });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    return { rows: [{ known_count: '2', saved_count: '1', reviewable_count: '1' }] };
  }) as typeof db.query;

  assert.deepEqual(await getPrivatePracticeStats(ACTOR_ID), {
    known_count: 2,
    saved_count: 1,
    reviewable_count: 1,
  });
  assert.match(calls[0]!.text, /AS reviewable_count/);
  assert.match(calls[0]!.text, /s\.recall_schedule_state = 'ordinary_practice'/);
  assert.match(calls[0]!.text, /s\.progress_state = 'review'/);
  assert.match(calls[0]!.text, /s\.due_at <= NOW\(\)/);
  assert.match(calls[0]!.text, /char_length\(i\.id\) BETWEEN 1 AND 128/);
});

test('private ratings use one owner-gated insert and never write shared cards or graph state', async (context) => {
  const originalQuery = db.query;
  const originalAccountTransaction = db.accountTransaction;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => {
    db.query = originalQuery;
    db.accountTransaction = originalAccountTransaction;
  });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    if (text.includes('INSERT INTO user_private_card_states')) {
      return { rows: [{ knowledge_item_id: params?.[1], recall_schedule_state: null }] };
    }
    return { rows: [] };
  }) as typeof db.query;
  db.accountTransaction = (async (
    _userId: string,
    queries: Parameters<typeof db.accountTransaction>[1],
  ) => Promise.all(queries.map(({ text, params }) => db.query(text, params))) as never) as typeof db.accountTransaction;

  const saved = await savePrivatePracticeCardState(
    ACTOR_ID,
    '449fdaf0-1754-45e9-9c43-50d8a4d578f8',
    'saved',
  );
  assert.deepEqual(saved, { kind: 'saved' });
  const write = calls.find((call) => call.text.includes('INSERT INTO user_private_card_states'));
  assert.ok(write);
  assert.deepEqual(write.params, [
    ACTOR_ID,
    '449fdaf0-1754-45e9-9c43-50d8a4d578f8',
    'saved',
  ]);
  assert.match(write.text, /FROM user_knowledge_items i/);
  assert.match(write.text, /EXISTS \(/);
  assert.match(write.text, /i\.user_id = \$1/);
  assert.match(write.text, /i\.id = \$2/);
  assert.match(write.text, /d\.status = 'approved'/);
  assert.match(write.text, /src\.source_type = 'conversation'/);
  assert.match(write.text, /s\.recall_schedule_state = 'ordinary_practice'/);
  assert.doesNotMatch(write.text, /recall_enrolled_at\s*=/);
  assert.doesNotMatch(write.text, /recall_d7_outcome\s*=/);
  assert.doesNotMatch(write.text, /INSERT INTO knowledge_cards/);
  assert.doesNotMatch(write.text, /user_knowledge_states/);
  assert.doesNotMatch(write.text, /user_knowledge_evidence/);
});

test('private ratings fail closed while a Recall milestone is active', async (context) => {
  const originalAccountTransaction = db.accountTransaction;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => { db.accountTransaction = originalAccountTransaction; });
  db.accountTransaction = (async (
    _userId: string,
    queries: Parameters<typeof db.accountTransaction>[1],
  ) => {
    calls.push(...queries);
    return [
      { rows: [] },
      { rows: [] },
      { rows: [{ knowledge_item_id: 'eligible-item', recall_schedule_state: 'd7_pending' }] },
    ];
  }) as typeof db.accountTransaction;

  const result = await savePrivatePracticeCardState(ACTOR_ID, 'eligible-item', 'known');
  assert.deepEqual(result, { kind: 'active_recall' });
  assert.deepEqual(calls[0]?.params, [`recall-schedule:${ACTOR_ID}:eligible-item`]);
  assert.match(calls[1]?.text ?? '', /WHERE s\.recall_schedule_state IS NULL/);
  assert.match(calls[1]?.text ?? '', /OR s\.recall_schedule_state = 'ordinary_practice'/);
});

test('private removal and all-progress reset cancel Recall rows under account transactions', async (context) => {
  const originalAccountTransaction = db.accountTransaction;
  const calls: Array<{ userId: string; queries: Parameters<typeof db.accountTransaction>[1] }> = [];
  context.after(() => { db.accountTransaction = originalAccountTransaction; });
  db.accountTransaction = (async (
    userId: string,
    queries: Parameters<typeof db.accountTransaction>[1],
  ) => {
    calls.push({ userId, queries });
    if (queries.some((query) => query.text.includes('WITH eligible AS'))) {
      return [{ rows: [] }, { rows: [{ eligible: true, deleted: true }] }];
    }
    return queries.map(() => ({ rows: [] }));
  }) as typeof db.accountTransaction;

  assert.equal(await removePrivatePracticeCardState(ACTOR_ID, 'eligible-item'), true);
  await resetPrivatePracticeProgress(ACTOR_ID);

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.userId, ACTOR_ID);
  assert.deepEqual(calls[0]?.queries[0]?.params, [`recall-schedule:${ACTOR_ID}:eligible-item`]);
  assert.match(calls[0]?.queries[1]?.text ?? '', /DELETE FROM user_private_card_states/);
  assert.match(calls[0]?.queries[1]?.text ?? '', /UPDATE recall_attempts a/);
  assert.match(calls[0]?.queries[1]?.text ?? '', /invalidation_reason = 'item_removed'/);
  const removalSql = calls[0]?.queries[1]?.text ?? '';
  assert.ok(removalSql.indexOf('invalidated_attempts AS') < removalSql.indexOf('DELETE FROM user_private_card_states'));
  assert.equal(calls[1]?.userId, ACTOR_ID);
  assert.match(calls[1]?.queries[0]?.text ?? '', /pg_advisory_xact_lock/);
  assert.match(calls[1]?.queries[0]?.text ?? '', /ordered_recall_items AS MATERIALIZED/);
  assert.match(calls[1]?.queries[0]?.text ?? '', /FROM recall_attempts a/);
  assert.match(calls[1]?.queries[0]?.text ?? '', /ORDER BY candidates\.knowledge_item_id/);
  assert.match(calls[1]?.queries[1]?.text ?? '', /DELETE FROM recall_attempts WHERE user_id = \$1/);
  assert.match(calls[1]?.queries[2]?.text ?? '', /DELETE FROM user_private_card_states WHERE user_id = \$1/);
});

test('every private-practice query excludes archived and superseded knowledge', async (context) => {
  const originalQuery = db.query;
  const originalAccountTransaction = db.accountTransaction;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => {
    db.query = originalQuery;
    db.accountTransaction = originalAccountTransaction;
  });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    return { rows: [] };
  }) as typeof db.query;
  db.accountTransaction = (async (
    _userId: string,
    queries: Parameters<typeof db.accountTransaction>[1],
  ) => Promise.all(queries.map(({ text, params }) => db.query(text, params))) as never) as typeof db.accountTransaction;

  await getEligiblePrivatePracticeCards(ACTOR_ID, 'new');
  await savePrivatePracticeCardState(ACTOR_ID, 'eligible-item', 'saved');
  await getSavedPrivatePracticeCards(ACTOR_ID);
  await removePrivatePracticeCardState(ACTOR_ID, 'eligible-item');
  await getPrivatePracticeStats(ACTOR_ID);
  await getPrivatePracticeDomainProgress(ACTOR_ID);

  const ownerQueries = calls.filter((call) => call.text.includes('FROM user_knowledge_items i'));
  assert.equal(ownerQueries.length, 7);
  for (const call of ownerQueries) {
    assert.match(call.text, /i\.user_id = \$1/);
    assert.match(call.text, /i\.archived_at IS NULL/);
    assert.match(call.text, /i\.deleted_at IS NULL/);
    assert.match(call.text, /i\.purge_at IS NULL/);
    assert.match(call.text, /NOT EXISTS \(\s*SELECT 1\s*FROM knowledge_item_supersessions supersession/);
    assert.match(call.text, /supersession\.user_id = i\.user_id/);
    assert.match(call.text, /supersession\.superseded_item_id = i\.id/);
    assert.match(call.text, /char_length\(i\.id\) BETWEEN 1 AND 128/);
    assert.match(call.text, /i\.id ~ '\^\[A-Za-z0-9\]/);
  }
});
