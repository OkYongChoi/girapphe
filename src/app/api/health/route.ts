import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  const hasDatabase = Boolean(process.env.DATABASE_URL);

  if (!hasDatabase) {
    return NextResponse.json({
      status: 'ok',
      mode: 'memory',
      database: 'not_configured',
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
      duration_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'degraded',
        mode: 'database',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'unknown_error',
        duration_ms: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
