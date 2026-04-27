import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { buildKnowledgeContext } from '@/lib/knowledge-graph-db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const context = await buildKnowledgeContext(user.id);
    return NextResponse.json(context);
  } catch (error) {
    console.error('Error in GET /api/knowledge-context:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
