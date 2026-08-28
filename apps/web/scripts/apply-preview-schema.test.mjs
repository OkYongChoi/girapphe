import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  applyPreviewSchema,
  assertSafePreviewStatement,
  parsePreviewMigration,
} from './apply-preview-schema.mjs';

test('preview schema update contains only bounded idempotent statements', async () => {
  const migrations = [
    ['0014_guest_knowledge_limits.sql', 5],
    ['0015_typed_knowledge_bundles.sql', 4],
  ];
  for (const [name, expectedCount] of migrations) {
    const sql = await readFile(new URL(`../drizzle/migrations/${name}`, import.meta.url), 'utf8');
    const statements = parsePreviewMigration(sql);
    assert.equal(statements.length, expectedCount, name);
    for (const statement of statements) assert.doesNotThrow(() => assertSafePreviewStatement(statement));
  }
});

test('preview schema update rejects destructive and unbounded SQL', () => {
  assert.throws(() => assertSafePreviewStatement('DROP TABLE knowledge_cards'));
  assert.throws(() => assertSafePreviewStatement('ALTER TABLE knowledge_cards ADD COLUMN unsafe text'));
  assert.throws(() => assertSafePreviewStatement('UPDATE knowledge_cards SET title = NULL'));
});

test('typed bundle migration keeps all new fields nullable and does not rewrite legacy rows', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0015_typed_knowledge_bundles.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /\bNOT NULL\b/i);
  assert.doesNotMatch(sql, /\bDEFAULT\b/i);
  assert.doesNotMatch(sql, /\bUPDATE\b/i);
  assert.match(sql, /ALTER TABLE "user_knowledge_items"/);
  assert.match(sql, /ALTER TABLE "knowledge_card_drafts"/);
});

test('preview schema update is fenced to an explicit preview environment', async () => {
  await assert.rejects(
    applyPreviewSchema({ databaseUrl: 'postgresql://unused', appEnv: 'prod' }),
    /APP_ENV=preview/,
  );
  await assert.rejects(
    applyPreviewSchema({ databaseUrl: '', appEnv: 'preview' }),
    /DATABASE_URL/,
  );
});
