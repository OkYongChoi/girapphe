import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { normalizeDeploymentRevision } from '@/lib/deployment-revision';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const revision = normalizeDeploymentRevision(process.env.GIRAPPHE_REVISION);

  if (!hasDatabase) {
    return NextResponse.json({
      status: 'ok',
      mode: 'memory',
      database: 'not_configured',
      revision,
      duration_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    await pool.query('SELECT 1');

    return NextResponse.json({
      status: 'ok',
      mode: 'database',
      database: 'connected',
      revision,
      duration_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health database check failed:', error);
    return NextResponse.json(
      {
        status: 'degraded',
        mode: 'database',
        database: 'disconnected',
        revision,
        error: 'database_unavailable',
        duration_ms: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
