import { NextResponse } from 'next/server';
import { getGraphDataForUser, getUserGraphStats } from '@/lib/graph-store';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const graphData = getGraphDataForUser(user.id);
  const stats = getUserGraphStats(user.id);

  return NextResponse.json({
    ...graphData,
    stats,
  });
}
