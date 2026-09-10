import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import path from 'node:path';
import { Pool } from 'pg';
import * as importedPrivatePracticeCards from '../src/lib/private-practice-cards.ts';

const privatePracticeCards = importedPrivatePracticeCards.default ?? importedPrivatePracticeCards;
const { buildEligiblePrivatePracticeQuery } = privatePracticeCards;

const OWNER_CURSOR_INDEX = 'idx_user_knowledge_items_user_id_cursor';
const APPROVED_DRAFT_INDEX = 'idx_knowledge_card_drafts_approved_item_owner';
const configuredDatabaseUrl = (
  process.env.NEON_PREVIEW_DATABASE_URL?.trim()
  || process.env.LIVE_POSTGRES_TEST_DATABASE_URL?.trim()
);

export function resolveDirectNeonConnectionString(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Preview database URL must be a valid PostgreSQL URL');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('Preview database URL must use the PostgreSQL protocol');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.endsWith('.neon.tech')) {
    throw new Error('Preview database URL must target Neon');
  }

  const labels = hostname.split('.');
  const firstLabel = labels[0] ?? '';
  const endpointLabel = firstLabel.endsWith('-pooler')
    ? firstLabel.slice(0, -'-pooler'.length)
    : firstLabel;
  if (!/^ep-[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(endpointLabel)) {
    throw new Error('Preview database URL must target a Neon endpoint');
  }

  if (endpointLabel !== firstLabel) {
    parsed.hostname = [endpointLabel, ...labels.slice(1)].join('.');
  }
  return parsed.toString();
}

const databaseUrl = configuredDatabaseUrl
  ? resolveDirectNeonConnectionString(configuredDatabaseUrl)
  : undefined;

export function collectPlanIndexes(node, names = new Set()) {
  if (!node || typeof node !== 'object') return names;
  if (typeof node['Index Name'] === 'string') names.add(node['Index Name']);
  if (Array.isArray(node.Plans)) {
    for (const child of node.Plans) collectPlanIndexes(child, names);
  }
  return names;
}

export function assertDirectPreviewConnection({ databaseUrl: value, expectedBranchId, actualBranchId }) {
  const parsed = new URL(value);
  const firstLabel = parsed.hostname.split('.')[0] ?? '';
  assert.match(parsed.hostname, /\.neon\.tech$/i, 'live plan evidence must run on Neon');
  assert.doesNotMatch(firstLabel, /-pooler$/i, 'live plan evidence requires a direct Neon connection');
  assert.match(expectedBranchId, /^br-[a-z0-9-]+$/i, 'EXPECTED_NEON_PREVIEW_BRANCH_ID is required');
  assert.equal(actualBranchId, expectedBranchId, 'live plan evidence must target the configured Preview branch');
}

function planPayload(result) {
  const payload = result.rows[0]?.['QUERY PLAN'];
  assert.ok(Array.isArray(payload) && payload.length === 1, 'expected PostgreSQL JSON plan');
  assert.ok(payload[0]?.Plan, 'expected PostgreSQL root plan');
  return payload[0];
}

function summarizePlan(payload) {
  return {
    indexes: [...collectPlanIndexes(payload.Plan)].sort(),
    planningTimeMs: Number(payload['Planning Time'] ?? 0),
    executionTimeMs: Number(payload['Execution Time'] ?? 0),
  };
}

test('plan index collector traverses nested PostgreSQL JSON plans', () => {
  const names = collectPlanIndexes({
    'Node Type': 'Limit',
    Plans: [{
      'Node Type': 'Nested Loop',
      Plans: [
        { 'Node Type': 'Index Scan', 'Index Name': OWNER_CURSOR_INDEX },
        { 'Node Type': 'Index Only Scan', 'Index Name': APPROVED_DRAFT_INDEX },
      ],
    }],
  });
  assert.deepEqual([...names].sort(), [APPROVED_DRAFT_INDEX, OWNER_CURSOR_INDEX].sort());
});

test('production private Practice query builder loads through ESM and CommonJS interop', () => {
  assert.equal(typeof buildEligiblePrivatePracticeQuery, 'function');
});

test('direct Preview guard rejects pooled, foreign, and malformed targets', () => {
  const expectedBranchId = 'br-preview-123';
  assert.doesNotThrow(() => assertDirectPreviewConnection({
    databaseUrl: 'postgresql://role:secret@ep-preview.us-east-1.aws.neon.tech/neondb?sslmode=require',
    expectedBranchId,
    actualBranchId: expectedBranchId,
  }));
  assert.throws(() => assertDirectPreviewConnection({
    databaseUrl: 'postgresql://role:secret@ep-preview-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
    expectedBranchId,
    actualBranchId: expectedBranchId,
  }), /direct Neon connection/);
  assert.throws(() => assertDirectPreviewConnection({
    databaseUrl: 'postgresql://role:secret@example.com/neondb',
    expectedBranchId,
    actualBranchId: expectedBranchId,
  }), /must run on Neon/);
  assert.throws(() => assertDirectPreviewConnection({
    databaseUrl: 'postgresql://role:secret@ep-preview.us-east-1.aws.neon.tech/neondb?sslmode=require',
    expectedBranchId,
    actualBranchId: 'br-production-456',
  }), /configured Preview branch/);
});

test('direct Neon resolver accepts direct URLs and safely derives a direct host from a pooler URL', () => {
  const direct = 'postgresql://preview_role:p%40ss@ep-preview-123.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const pooled = 'postgresql://preview_role:p%40ss@ep-preview-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

  assert.equal(resolveDirectNeonConnectionString(direct), direct);
  assert.equal(resolveDirectNeonConnectionString(pooled), direct);
});

test('direct Neon resolver rejects malformed, non-PostgreSQL, non-Neon, and invalid endpoint URLs without echoing secrets', () => {
  const invalidTargets = [
    ['not a URL with top-secret', /valid PostgreSQL URL/],
    ['https://ep-preview.us-east-2.aws.neon.tech/neondb?secret=top-secret', /PostgreSQL protocol/],
    ['postgresql://role:top-secret@example.com/neondb', /target Neon/],
    ['postgresql://role:top-secret@preview.us-east-2.aws.neon.tech/neondb', /Neon endpoint/],
  ];

  for (const [target, expectedMessage] of invalidTargets) {
    assert.throws(
      () => resolveDirectNeonConnectionString(target),
      (error) => expectedMessage.test(error.message) && !error.message.includes('top-secret'),
    );
  }
});

test('migration 0025 indexes serve the production new and review queries on live Preview PostgreSQL', {
  skip: databaseUrl
    ? false
    : 'set NEON_PREVIEW_DATABASE_URL for the live mobile Practice plan test',
}, async () => {
  const expectedBranchId = process.env.EXPECTED_NEON_PREVIEW_BRANCH_ID?.trim() ?? '';
  const expectedRevision = process.env.EXPECTED_HEAD_SHA?.trim() ?? '';
  assert.match(expectedRevision, /^[0-9a-f]{40}$/i, 'EXPECTED_HEAD_SHA must identify the deployed PR revision');

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN READ ONLY');
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '5s'");

    const identity = (await client.query(
      "SELECT current_setting('neon.branch_id', true) AS branch_id",
    )).rows[0] ?? {};
    assertDirectPreviewConnection({
      databaseUrl,
      expectedBranchId,
      actualBranchId: String(identity.branch_id ?? ''),
    });

    const indexes = await client.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = current_schema()
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      [[OWNER_CURSOR_INDEX, APPROVED_DRAFT_INDEX]],
    );
    assert.equal(indexes.rows.length, 2, 'migration 0025 must create both indexes');
    const indexDefinitions = Object.fromEntries(
      indexes.rows.map((row) => [String(row.indexname), String(row.indexdef)]),
    );
    assert.match(indexDefinitions[OWNER_CURSOR_INDEX], /USING btree \(user_id, id\)/i);
    assert.match(indexDefinitions[APPROVED_DRAFT_INDEX], /USING btree \(user_id, knowledge_item_id\)[\s\S]*status = 'approved'/i);
    assert.match(indexDefinitions[APPROVED_DRAFT_INDEX], /approved_at IS NOT NULL/i);

    // The marker values cannot match a real account or item and therefore
    // keep ANALYZE read-only while exercising the production query builder.
    const probeOwner = `mobile-plan-${crypto.randomUUID()}`;
    const probeItem = `mobile-plan-${crypto.randomUUID()}`;
    const newQuery = buildEligiblePrivatePracticeQuery(probeOwner, 'new', {
      afterKnowledgeItemId: probeItem,
      limitOne: true,
    });
    const reviewQuery = buildEligiblePrivatePracticeQuery(probeOwner, 'review', {
      afterKnowledgeItemId: probeItem,
      limitOne: true,
    });
    const newPlan = planPayload(await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${newQuery.text}`,
      newQuery.params,
    ));
    const reviewPlan = planPayload(await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${reviewQuery.text}`,
      reviewQuery.params,
    ));

    const newSummary = summarizePlan(newPlan);
    const reviewSummary = summarizePlan(reviewPlan);
    // The approved-draft table is deliberately tiny on Preview, so PostgreSQL
    // can correctly prefer a sequential scan for that EXISTS predicate. Its
    // partial-index definition is verified above; the latency-critical seek
    // must use the owner-first cursor index in both production query modes.
    const newUsesOwnerCursorIndex = newSummary.indexes.includes(OWNER_CURSOR_INDEX);
    const reviewUsesOwnerCursorIndex = reviewSummary.indexes.includes(OWNER_CURSOR_INDEX);

    const evidence = {
      schemaVersion: 1,
      revision: expectedRevision,
      neonBranchId: expectedBranchId,
      directConnection: true,
      indexDefinitions: Object.keys(indexDefinitions).sort(),
      newPracticePlan: { ...newSummary, usesOwnerCursorIndex: newUsesOwnerCursorIndex },
      reviewPracticePlan: { ...reviewSummary, usesOwnerCursorIndex: reviewUsesOwnerCursorIndex },
    };
    const evidenceDirectory = fileURLToPath(
      new URL('../../../test-results/mobile-practice-index/', import.meta.url),
    );
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      path.join(evidenceDirectory, 'preview-explain.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      { mode: 0o600 },
    );
    console.log(JSON.stringify(evidence));

    assert.equal(newUsesOwnerCursorIndex, true, 'new Practice must use the 0025 owner cursor index');
    assert.equal(reviewUsesOwnerCursorIndex, true, 'review Practice must use the 0025 owner cursor index');

    await client.query('COMMIT');
    transactionOpen = false;
  } finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    client.release();
    await pool.end();
  }
});
