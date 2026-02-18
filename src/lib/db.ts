import { Pool, type QueryResult, type QueryResultRow } from '@neondatabase/serverless';

async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    if (params === undefined) {
      return await pool.query<T>(text);
    }
    return await pool.query<T, unknown[]>(text, params);
  } finally {
    // Avoid cross-request I/O object reuse in Cloudflare Workers runtime.
    await pool.end();
  }
}

const db = { query };

export default db;
