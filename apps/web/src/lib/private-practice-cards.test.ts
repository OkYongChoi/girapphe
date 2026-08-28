import assert from 'node:assert/strict';
import test from 'node:test';
import db from '@/lib/db';
import {
  getEligiblePrivatePracticeCards,
  isEligiblePrivatePracticeRecord,
  parsePersonalCardId,
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
    draft_user_id: ACTOR_ID,
    batch_user_id: ACTOR_ID,
    source_user_id: ACTOR_ID,
    draft_status: 'approved',
    approved_at: new Date('2026-08-16T00:00:00.000Z'),
    batch_status: 'approved',
    batch_source_type: 'conversation',
    source_type: 'conversation',
    deleted_at: null,
    purge_at: null,
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
    eligibilityRecord({ draft_status: 'pending', approved_at: null }),
    eligibilityRecord({ approved_at: null }),
    eligibilityRecord({ batch_status: 'pending' }),
    eligibilityRecord({ batch_status: 'discarded' }),
    eligibilityRecord({ batch_source_type: 'manual' }),
    eligibilityRecord({ source_type: 'manual' }),
    eligibilityRecord({ deleted_at: new Date() }),
    eligibilityRecord({ purge_at: new Date() }),
    eligibilityRecord({ item_user_id: 'user_other' }),
    eligibilityRecord({ draft_user_id: 'user_other' }),
    eligibilityRecord({ batch_user_id: 'user_other' }),
    eligibilityRecord({ source_user_id: 'user_other' }),
  ];

  for (const record of ineligible) {
    assert.equal(isEligiblePrivatePracticeRecord(record, ACTOR_ID), false);
  }
});

test('admits a valid owner-authored typed bundle without an ingestion source chain', () => {
  const typedManual = eligibilityRecord({
    draft_user_id: null, batch_user_id: null, source_user_id: null,
    draft_status: null, approved_at: null, batch_status: null,
    batch_source_type: null, source_type: null,
    knowledge_type: 'concept', central_question: 'What is a bounded context?', bundle_schema_version: 1,
    structured_content: { type: 'concept', definition: 'A model boundary.', key_points: [], examples: [], non_examples: [], misconceptions: [] },
  });
  assert.equal(isEligiblePrivatePracticeRecord(typedManual, ACTOR_ID), true);
  assert.equal(isEligiblePrivatePracticeRecord({ ...typedManual, item_user_id: 'user_other' }, ACTOR_ID), false);
  assert.equal(isEligiblePrivatePracticeRecord({ ...typedManual, central_question: null }, ACTOR_ID), false);
});

test('practice selection filters pending, deleted, manual, and cross-owner rows again in application code', async (context) => {
  const originalQuery = db.query;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => { db.query = originalQuery; });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    return {
      rows: [
        cardRow(),
        cardRow({ knowledge_item_id: 'pending-item', draft_status: 'pending', approved_at: null }),
        cardRow({ knowledge_item_id: 'manual-item', source_type: 'manual' }),
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
  assert.match(calls[0].text, /d\.user_id = i\.user_id/);
  assert.match(calls[0].text, /b\.user_id = i\.user_id/);
  assert.match(calls[0].text, /src\.user_id = i\.user_id/);
  assert.match(calls[0].text, /d\.status = 'approved'/);
  assert.match(calls[0].text, /d\.approved_at IS NOT NULL/);
  assert.match(calls[0].text, /source_type = 'conversation'/);
  assert.match(calls[0].text, /i\.deleted_at IS NULL/);
  assert.match(calls[0].text, /i\.purge_at IS NULL/);
  assert.doesNotMatch(calls[0].text, /\bknowledge_cards\b/);
  assert.doesNotMatch(calls[0].text, /\buser_card_states\b/);
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
    return { rows: [{ knowledge_item_id: params?.[1] }] };
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
  assert.equal(saved, true);
  assert.deepEqual(calls[0].params, [
    ACTOR_ID,
    '449fdaf0-1754-45e9-9c43-50d8a4d578f8',
    'saved',
  ]);
  assert.match(calls[0].text, /INSERT INTO user_private_card_states/);
  assert.match(calls[0].text, /FROM user_knowledge_items i/);
  assert.match(calls[0].text, /EXISTS \(/);
  assert.match(calls[0].text, /i\.user_id = \$1/);
  assert.match(calls[0].text, /i\.id = \$2/);
  assert.match(calls[0].text, /d\.status = 'approved'/);
  assert.match(calls[0].text, /src\.source_type = 'conversation'/);
  assert.doesNotMatch(calls[0].text, /INSERT INTO knowledge_cards/);
  assert.doesNotMatch(calls[0].text, /user_knowledge_states/);
  assert.doesNotMatch(calls[0].text, /user_knowledge_evidence/);
});
