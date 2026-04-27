import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { buildKnowledgeProfile } from '@/lib/knowledge-graph-db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const profile = await buildKnowledgeProfile(user.id);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error in GET /api/knowledge-profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
