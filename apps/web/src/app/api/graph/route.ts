import { NextRequest, NextResponse } from 'next/server';
import { getCurrentActor } from '@/lib/auth';
import { getDbGraphDataForUser, getDbUserGraphStats } from '@/lib/knowledge-graph-db';
import { localizeGraphNodes, parseContentLocale } from '@/lib/content-localization';

export async function GET(request: NextRequest) {
  const user = await getCurrentActor();
  const localeInput = request.nextUrl.searchParams.get('locale') ?? request.headers.get('x-girapphe-locale') ?? 'en';
  const locale = parseContentLocale(localeInput);
  if (!locale) {
    return NextResponse.json(
      { error: 'The requested graph locale is not supported.', code: 'UNSUPPORTED_LOCALE' },
      { status: 400 }
    );
  }

  const graphData = await getDbGraphDataForUser(user.id);
  const stats = await getDbUserGraphStats(user.id);
  const nodes = await localizeGraphNodes(graphData.nodes, locale, { generateMissing: false });

  return NextResponse.json({
    ...graphData,
    nodes,
    stats,
  });
}
