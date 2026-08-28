import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';

const databaseUrl = process.env.LIVE_POSTGRES_TEST_DATABASE_URL?.trim();

test('PostgreSQL retains a supersession tombstone when its replacement is purged', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL tombstone test',
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const schema = `knowledge_supersession_${crypto.randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^[a-z0-9_]+$/);
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`CREATE TABLE user_knowledge_items (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (id),
      UNIQUE (id, user_id)
    )`);
    await client.query(`CREATE TABLE knowledge_item_supersessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      superseded_item_id TEXT NOT NULL,
      replacement_item_id TEXT NOT NULL,
      replacement_live_item_id TEXT,
      replacement_live_user_id TEXT,
      CONSTRAINT old_owner_fk
        FOREIGN KEY (superseded_item_id, user_id)
        REFERENCES user_knowledge_items(id, user_id) ON DELETE CASCADE,
      CONSTRAINT live_replacement_owner_fk
        FOREIGN KEY (replacement_live_item_id, replacement_live_user_id)
        REFERENCES user_knowledge_items(id, user_id) ON DELETE SET NULL,
      CONSTRAINT live_replacement_check CHECK (
        (replacement_live_item_id IS NULL AND replacement_live_user_id IS NULL)
        OR (replacement_live_item_id IS NOT NULL
          AND replacement_live_user_id IS NOT NULL
          AND replacement_live_item_id = replacement_item_id
          AND replacement_live_user_id = user_id)
      )
    )`);
    await client.query(`INSERT INTO user_knowledge_items (id, user_id)
      VALUES ('prior', 'owner'), ('replacement', 'owner'), ('foreign', 'other-owner')`);
    await client.query(`INSERT INTO knowledge_item_supersessions
      (id, user_id, superseded_item_id, replacement_item_id,
       replacement_live_item_id, replacement_live_user_id)
      VALUES ('supersession', 'owner', 'prior', 'replacement', 'replacement', 'owner')`);

    await assert.rejects(
      client.query(`INSERT INTO knowledge_item_supersessions
        (id, user_id, superseded_item_id, replacement_item_id,
         replacement_live_item_id, replacement_live_user_id)
        VALUES ('cross-owner', 'owner', 'prior', 'foreign', 'foreign', 'owner')`),
      /foreign key constraint/,
    );
    await client.query(`DELETE FROM user_knowledge_items WHERE id = 'replacement'`);

    assert.deepEqual((await client.query(`SELECT replacement_item_id,
      replacement_live_item_id, replacement_live_user_id
      FROM knowledge_item_supersessions WHERE id = 'supersession'`)).rows[0], {
      replacement_item_id: 'replacement',
      replacement_live_item_id: null,
      replacement_live_user_id: null,
    });
    assert.equal((await client.query(`SELECT 1 FROM user_knowledge_items WHERE id = 'prior'`)).rowCount, 1);

    await client.query(`DELETE FROM user_knowledge_items WHERE id = 'prior'`);
    assert.equal((await client.query(`SELECT 1 FROM knowledge_item_supersessions`)).rowCount, 0);
  } finally {
    await client.query('RESET search_path').catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    client.release();
    await pool.end();
  }
});
