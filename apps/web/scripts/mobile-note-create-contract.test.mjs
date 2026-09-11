import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import createResultModule from '../src/lib/knowledge-item-create-result.ts';
import knowledgeIngestionModule from '../src/lib/knowledge-ingestion.ts';

const {
  classifyMemoryKnowledgeItemCreateAdmission,
  commitSynchronousMemoryKnowledgeItemCreate,
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

test('database create rows expose inserted, replayed, quota, and guest-rate outcomes', () => {
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
  assert.deepEqual(
    readKnowledgeItemCreateDatabaseResult({ outcome: 'guest_write_rate_limited', id: null }),
    { outcome: 'rate_limited', itemId: null, limit: 'guest_write' },
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

test('deferred guest creates synchronously admit only one item at the final quota slot', async () => {
  let activeCount = 99;
  let totalCount = 99;
  let rateClaims = 0;
  const seenRequests = new Set();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });

  const attempt = async (requestId) => {
    await gate;
    return commitSynchronousMemoryKnowledgeItemCreate({
      requestAlreadySeen: () => seenRequests.has(requestId),
      isGuest: true,
      activeCount: () => activeCount,
      totalCount: () => totalCount,
      guestLimit: 100,
      accountLimit: 50_000,
      claimGuestWrite: () => {
        rateClaims += 1;
        return true;
      },
      createItem: () => {
        activeCount += 1;
        totalCount += 1;
        return { id: `item-${requestId}` };
      },
      recordRequest: () => { seenRequests.add(requestId); },
    }).result;
  };

  const first = attempt('first-request');
  const second = attempt('second-request');
  release();
  const results = await Promise.all([first, second]);

  assert.deepEqual(results.map((result) => result.outcome).sort(), [
    'inserted',
    'quota_exceeded',
  ]);
  assert.equal(activeCount, 100);
  assert.equal(totalCount, 100);
  assert.equal(rateClaims, 1);
  assert.equal(seenRequests.size, 1);
  const rejectedRequest = results[0].outcome === 'quota_exceeded'
    ? 'first-request'
    : 'second-request';
  assert.equal(seenRequests.has(rejectedRequest), false);
});

test('a replay consumes neither a second rate claim nor a second item', () => {
  let activeCount = 99;
  let totalCount = 99;
  let rateClaims = 0;
  const seenRequests = new Set();
  const attempt = () => commitSynchronousMemoryKnowledgeItemCreate({
    requestAlreadySeen: () => seenRequests.has('stable-request'),
    isGuest: true,
    activeCount: () => activeCount,
    totalCount: () => totalCount,
    guestLimit: 100,
    accountLimit: 50_000,
    claimGuestWrite: () => {
      rateClaims += 1;
      return true;
    },
    createItem: () => {
      activeCount += 1;
      totalCount += 1;
      return { id: 'item-stable-request' };
    },
    recordRequest: () => { seenRequests.add('stable-request'); },
  }).result;

  assert.equal(attempt().outcome, 'inserted');
  assert.equal(attempt().outcome, 'replayed');
  assert.equal(activeCount, 100);
  assert.equal(totalCount, 100);
  assert.equal(rateClaims, 1);
});

test('a guest rate denial creates no item and consumes no request id', () => {
  let createCalls = 0;
  let recordCalls = 0;

  const committed = commitSynchronousMemoryKnowledgeItemCreate({
    requestAlreadySeen: () => false,
    isGuest: true,
    activeCount: () => 0,
    totalCount: () => 0,
    guestLimit: 100,
    accountLimit: 50_000,
    claimGuestWrite: () => false,
    createItem: () => {
      createCalls += 1;
      return { id: 'must-not-be-created' };
    },
    recordRequest: () => {
      recordCalls += 1;
    },
  });

  assert.deepEqual(committed, {
    result: { outcome: 'rate_limited', itemId: null, limit: 'guest_write' },
    item: null,
  });
  assert.equal(createCalls, 0);
  assert.equal(recordCalls, 0);
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
  assert.ok(createBlock.indexOf('existing_request AS MATERIALIZED') < createBlock.indexOf('rate_claim AS'));
  assert.match(
    createBlock,
    /rate_claim AS \([\s\S]*?INSERT INTO guest_knowledge_write_limits[\s\S]*?NOT EXISTS \(SELECT 1 FROM existing_request\)[\s\S]*?request_count < \$23/,
  );
  assert.match(
    createBlock,
    /INSERT INTO user_knowledge_create_requests[\s\S]*?SELECT \$1, \$2[\s\S]*?account_quota_available AND guest_quota_available[\s\S]*?EXISTS \(SELECT 1 FROM rate_claim\)[\s\S]*?NOT EXISTS \(SELECT 1 FROM existing_request\)/,
  );
  assert.match(createBlock, /WHEN EXISTS \(SELECT 1 FROM inserted_item\) THEN 'inserted'/);
  assert.match(createBlock, /WHEN EXISTS \(SELECT 1 FROM existing_request\) THEN 'replayed'/);
  assert.match(
    createBlock,
    /WHEN EXISTS \(SELECT 1 FROM existing_request\) THEN 'replayed'[\s\S]*?THEN 'guest_quota_exceeded'[\s\S]*?THEN 'account_quota_exceeded'[\s\S]*?THEN 'guest_write_rate_limited'/,
  );
  assert.match(createBlock, /guest-knowledge-rate:\$\{guestRateScope\}/);

  const memoryCreate = createBlock.slice(
    createBlock.indexOf('if (!process.env.DATABASE_URL)'),
    createBlock.indexOf('await ensureSchema()'),
  );
  assert.ok(memoryCreate.indexOf('await getGuestRateScope') < memoryCreate.indexOf('commitSynchronousMemoryKnowledgeItemCreate'));
  assert.match(memoryCreate, /commitSynchronousMemoryKnowledgeItemCreate\(\{[\s\S]*?createItem:[\s\S]*?createMemoryKnowledgeItemForUser[\s\S]*?recordRequest:/);
  assert.doesNotMatch(
    memoryCreate.slice(
      memoryCreate.indexOf('commitSynchronousMemoryKnowledgeItemCreate'),
      memoryCreate.indexOf('if (committed.result.outcome'),
    ),
    /await /,
  );
});

test('the mobile route returns the explicit create outcome instead of unconditional 201', () => {
  const createStart = routeSource.indexOf("if (action === 'create-note')");
  const routeBlock = routeSource.slice(
    createStart,
    routeSource.indexOf("if (!id) return invalid", createStart),
  );
  assert.match(routeBlock, /createKnowledgeItemWithOutcome/);
  assert.match(routeBlock, /result\.outcome === 'rate_limited'/);
  assert.match(routeBlock, /guest-only rate limit/);
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
