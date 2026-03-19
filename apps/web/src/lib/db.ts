import { neon } from '@neondatabase/serverless';

let _sql: ReturnType<typeof neon> | null = null;

function getSql(): ReturnType<typeof neon> {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}

type QueryResult<T> = { rows: T[] };

async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const sql = getSql();
  const rows = await sql.query(text, params ?? []) as T[];
  return { rows };
}

const db = { query };

export default db;
