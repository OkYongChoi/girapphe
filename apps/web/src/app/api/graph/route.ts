import { NextResponse } from 'next/server';
import { getCurrentActor } from '@/lib/auth';
import { getDbGraphDataForUser, getDbUserGraphStats } from '@/lib/knowledge-graph-db';

export async function GET() {
  const user = await getCurrentActor();

  const graphData = await getDbGraphDataForUser(user.id);
  const stats = await getDbUserGraphStats(user.id);

  return NextResponse.json({
    ...graphData,
    stats,
  });
}
