import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const PREVIEW_MIGRATIONS = [
  new URL('../drizzle/migrations/0014_guest_knowledge_limits.sql', import.meta.url),
];

const SAFE_STATEMENT_PREFIXES = [
  /^CREATE TABLE IF NOT EXISTS\b/i,
  /^CREATE INDEX IF NOT EXISTS\b/i,
];

export function parsePreviewMigration(sql) {
  return sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function assertSafePreviewStatement(statement) {
  const isBoundedRetentionBackfill = /^UPDATE "user_knowledge_items"\s+SET "purge_at"\s*=/i.test(statement)
    && /AND "purge_at" IS NULL;?$/i.test(statement);
  if (!isBoundedRetentionBackfill && !SAFE_STATEMENT_PREFIXES.some((pattern) => pattern.test(statement))) {
    throw new Error(`Refusing non-idempotent preview migration statement: ${statement.slice(0, 80)}`);
  }
}

export async function applyPreviewSchema({ databaseUrl, appEnv }) {
  if (appEnv !== 'preview') {
    throw new Error('Preview schema preparation requires APP_ENV=preview');
  }
  if (!databaseUrl) {
    throw new Error('Preview schema preparation requires DATABASE_URL');
  }

  const migrations = await Promise.all(
    PREVIEW_MIGRATIONS.map(async (url) => ({
      name: url.pathname.split('/').at(-1),
      statements: parsePreviewMigration(await readFile(url, 'utf8')),
    })),
  );
  for (const migration of migrations) {
    for (const statement of migration.statements) assertSafePreviewStatement(statement);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('girapphe-preview-schema-v1'))");
    for (const migration of migrations) {
      for (const statement of migration.statements) await client.query(statement);
      console.log(`Applied preview schema update: ${migration.name}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  await applyPreviewSchema({
    databaseUrl: process.env.DATABASE_URL,
    appEnv: process.env.APP_ENV,
  });
}
