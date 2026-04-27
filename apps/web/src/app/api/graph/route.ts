import { NextResponse } from 'next/server';
import { getGraphDataForUser, getUserGraphStats } from '@stem-brain/graph-engine';
import { getCurrentActor } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentActor();

  const graphData = getGraphDataForUser(user.id);
  const stats = getUserGraphStats(user.id);

  return NextResponse.json({
    ...graphData,
    stats,
  });
}
