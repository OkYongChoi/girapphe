import { NextRequest, NextResponse } from 'next/server';
import { purgeExpiredPersonalKnowledgeItems } from '@/lib/personal-knowledge';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest) {
  const token = process.env.PERSONAL_KNOWLEDGE_PURGE_TOKEN;
  if (!token) return false;
  return request.headers.get('authorization') === `Bearer ${token}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return new NextResponse(null, { status: 401 });

  try {
    const deleted = await purgeExpiredPersonalKnowledgeItems();
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error('Personal knowledge purge failed:', error);
    return NextResponse.json({ error: 'purge_failed' }, { status: 500 });
  }
}
