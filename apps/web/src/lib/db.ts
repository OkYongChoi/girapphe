import { neon } from '@neondatabase/serverless';

let _sql: ReturnType<typeof neon> | null = null;

function getSql(): ReturnType<typeof neon> {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}

type QueryResult<T> = { rows: T[] };
type TransactionQuery = { text: string; params?: unknown[] };

async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const sql = getSql();
  const rows = await sql.query(text, params ?? []) as T[];
  return { rows };
}

async function transaction<T = Record<string, unknown>>(
  queries: TransactionQuery[],
): Promise<QueryResult<T>[]> {
  const sql = getSql();
  const rowSets = await sql.transaction(
    queries.map(({ text, params }) => sql.query(text, params ?? [])),
  );
  return rowSets.map((rows) => ({ rows: rows as T[] }));
}

const db = { query, transaction };

export default db;
