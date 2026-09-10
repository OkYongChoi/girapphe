import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import createResultModule from '../src/lib/knowledge-item-create-result.ts';
import knowledgeIngestionModule from '../src/lib/knowledge-ingestion.ts';

const {
  classifyMemoryKnowledgeItemCreateAdmission,
  readKnowledgeItemCreateDatabaseResult,
  toMobileNoteCreateHttpResult,
} = createResultModule;
const {
  hasMemoryCreateRequest,
  recordMemoryCreateRequest,
} = knowledgeIngestionModule;

const actionSource = readFileSync(
  new URL('../src/actions/user-knowledge-actions.ts', import.meta.url),
  'utf8',
);
const routeSource = readFileSync(
  new URL('../src/app/api/mobile/route.ts', import.meta.url),
  'utf8',
);

test('database create rows expose inserted, replayed, and both quota outcomes', () => {
  assert.deepEqual(
    readKnowledgeItemCreateDatabaseResult({ outcome: 'inserted', id: 'item-1' }),
    { outcome: 'inserted', itemId: 'item-1' },
  );
  assert.deepEqual(
    readKnowledgeItemCreateDatabaseResult({ outcome: 'replayed', id: null }),
    { outcome: 'replayed', itemId: null },
  );
  assert.deepEqual(
    readKnowledgeItemCreateDatabaseResult({ outcome: 'account_quota_exceeded', id: null }),
    { outcome: 'quota_exceeded', itemId: null, limit: 'account' },
  );
  assert.deepEqual(
    readKnowledgeItemCreateDatabaseResult({ outcome: 'guest_quota_exceeded', id: null }),
    { outcome: 'quota_exceeded', itemId: null, limit: 'guest' },
  );
  assert.throws(
    () => readKnowledgeItemCreateDatabaseResult({ outcome: 'inserted', id: null }),
    /Unexpected knowledge item create result/,
  );
});

test('memory admission never consumes a request id for a quota rejection', () => {
  const base = {
    requestAlreadySeen: false,
    isGuest: false,
    activeCount: 0,
    totalCount: 0,
    guestLimit: 100,
    accountLimit: 50_000,
  };
  assert.equal(classifyMemoryKnowledgeItemCreateAdmission(base), 'admitted');
  assert.equal(classifyMemoryKnowledgeItemCreateAdmission({
    ...base, requestAlreadySeen: true, totalCount: 50_000,
  }), 'replayed');
  assert.equal(classifyMemoryKnowledgeItemCreateAdmission({
    ...base, isGuest: true, activeCount: 100,
  }), 'guest_quota_exceeded');
  assert.equal(classifyMemoryKnowledgeItemCreateAdmission({
    ...base, isGuest: true, activeCount: 100, totalCount: 50_000,
  }), 'guest_quota_exceeded');
  const quotaAdmission = classifyMemoryKnowledgeItemCreateAdmission({
    ...base, totalCount: 50_000,
  });
  assert.equal(quotaAdmission, 'account_quota_exceeded');

  const userId = `mobile-create-contract-${crypto.randomUUID()}`;
  const requestId = 'stable-request';
  assert.equal(hasMemoryCreateRequest(userId, requestId), false);
  if (quotaAdmission === 'admitted') recordMemoryCreateRequest(userId, requestId);
  assert.equal(hasMemoryCreateRequest(userId, requestId), false);

  const admitted = classifyMemoryKnowledgeItemCreateAdmission(base);
  if (admitted === 'admitted') recordMemoryCreateRequest(userId, requestId);
  assert.equal(hasMemoryCreateRequest(userId, requestId), true);
});

test('mobile create maps only a new insert to 201 and makes quota actionable', () => {
  assert.deepEqual(
    toMobileNoteCreateHttpResult({ outcome: 'inserted', itemId: 'item-1' }),
    { status: 201, body: { success: true, outcome: 'inserted' } },
  );
  assert.deepEqual(
    toMobileNoteCreateHttpResult({ outcome: 'replayed', itemId: null }),
    { status: 200, body: { success: true, outcome: 'replayed' } },
  );
  const quota = toMobileNoteCreateHttpResult({
    outcome: 'quota_exceeded', itemId: null, limit: 'account',
  });
  assert.equal(quota.status, 409);
  assert.deepEqual(quota.body, {
    success: false,
    error: 'My Notes is at its storage limit. Move unneeded notes to Trash; account-wide space is reclaimed after the 14-day retention period. Contact support if you need to save now.',
    code: 'KNOWLEDGE_ITEM_QUOTA_EXCEEDED',
  });
});

test('the create transaction claims an idempotency key only after quota admission', () => {
  const createBlock = actionSource.slice(
    actionSource.indexOf('export async function createKnowledgeItemWithOutcome'),
    actionSource.indexOf('export async function createKnowledgeItem('),
  );
  assert.match(createBlock, /WITH admission AS MATERIALIZED/);
  assert.match(
    createBlock,
    /INSERT INTO user_knowledge_create_requests[\s\S]*?SELECT \$1, \$2[\s\S]*?account_quota_available AND guest_quota_available[\s\S]*?NOT EXISTS \(SELECT 1 FROM existing_request\)/,
  );
  assert.match(createBlock, /WHEN EXISTS \(SELECT 1 FROM inserted_item\) THEN 'inserted'/);
  assert.match(createBlock, /WHEN EXISTS \(SELECT 1 FROM existing_request\) THEN 'replayed'/);
  assert.match(
    createBlock,
    /THEN 'guest_quota_exceeded'[\s\S]*?THEN 'account_quota_exceeded'/,
  );

  const memoryCreate = createBlock.slice(
    createBlock.indexOf('if (!process.env.DATABASE_URL)'),
    createBlock.indexOf('await ensureSchema()'),
  );
  assert.ok(memoryCreate.indexOf('classifyMemoryKnowledgeItemCreateAdmission') < memoryCreate.indexOf('createMemoryKnowledgeItemForUser'));
  assert.ok(memoryCreate.indexOf('createMemoryKnowledgeItemForUser') < memoryCreate.indexOf('recordMemoryCreateRequest'));
});

test('the mobile route returns the explicit create outcome instead of unconditional 201', () => {
  const createStart = routeSource.indexOf("if (action === 'create-note')");
  const routeBlock = routeSource.slice(
    createStart,
    routeSource.indexOf("if (!id) return invalid", createStart),
  );
  assert.match(routeBlock, /createKnowledgeItemWithOutcome/);
  assert.match(routeBlock, /toMobileNoteCreateHttpResult\(result\)/);
  assert.match(routeBlock, /status: response\.status/);
  assert.doesNotMatch(routeBlock, /status: 201/);
});

test('the generic web action preserves its historical account-quota no-op', () => {
  const wrapper = actionSource.slice(
    actionSource.indexOf('export async function createKnowledgeItem('),
    actionSource.indexOf('export async function updateKnowledgeItem('),
  );
  assert.match(wrapper, /result\.outcome === 'quota_exceeded' && result\.limit === 'guest'/);
  assert.match(wrapper, /throw new Error\('guest_knowledge_item_limit'\)/);
  assert.doesNotMatch(wrapper, /throw new Error\('knowledge_item_limit'\)/);
});
