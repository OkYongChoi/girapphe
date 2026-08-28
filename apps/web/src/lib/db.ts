import { neon } from '@neondatabase/serverless';
import { buildActiveAccountGuardQueries } from '@/lib/account-lifecycle';

let _sql: ReturnType<typeof neon> | null = null;

function getSql(): ReturnType<typeof neon> {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}

type QueryResult<T> = { rows: T[] };
type TransactionQuery = { text: string; params?: unknown[] };
type TransactionOptions = { isolationLevel?: 'ReadCommitted' };

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
  options?: TransactionOptions,
): Promise<QueryResult<T>[]> {
  const sql = getSql();
  const rowSets = await sql.transaction(
    queries.map(({ text, params }) => sql.query(text, params ?? [])),
    options,
  );
  return rowSets.map((rows) => ({ rows: rows as T[] }));
}

async function accountTransaction<T = Record<string, unknown>>(
  userId: string,
  queries: TransactionQuery[],
): Promise<QueryResult<T>[]> {
  const guardedResults = await db.transaction<T>(
    [...buildActiveAccountGuardQueries(userId), ...queries],
    { isolationLevel: 'ReadCommitted' },
  );
  return guardedResults.slice(2);
}

const db = { query, transaction, accountTransaction };

export default db;
