import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getTopicKnowledgeHubForUser,
  serializeTopicKnowledgeHub,
  type KnowledgeContextFormat,
} from '@/lib/topic-knowledge-hub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CONTENT_TYPES: Record<KnowledgeContextFormat, string> = {
  json: 'application/json; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  yaml: 'application/yaml; charset=utf-8',
};

const EXTENSIONS: Record<KnowledgeContextFormat, string> = {
  json: 'json',
  markdown: 'md',
  yaml: 'yaml',
};

function parseFormat(value: string | null): KnowledgeContextFormat | null {
  return value === 'json' || value === 'markdown' || value === 'yaml' ? value : null;
}

function privateHeaders(contentType?: string) {
  return {
    ...(contentType ? { 'Content-Type': contentType } : {}),
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Cookie, Authorization',
  };
}

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: privateHeaders('application/json; charset=utf-8'),
  });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'unauthorized');

  const topic = request.nextUrl.searchParams.get('topic')?.trim() ?? '';
  const format = parseFormat(request.nextUrl.searchParams.get('format'));
  if (!topic || topic.length > 120 || !format) return jsonError(400, 'A bounded topic and format=json|markdown|yaml are required.');

  try {
    const hub = await getTopicKnowledgeHubForUser(user.id, topic);
    const body = serializeTopicKnowledgeHub(hub, format);
    const encodedTopic = encodeURIComponent(hub.topic);
    const filename = `girapphe-${hub.topic.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'topic'}.${EXTENSIONS[format]}`;
    return new Response(body, {
      headers: {
        ...privateHeaders(CONTENT_TYPES[format]),
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''girapphe-${encodedTopic}.${EXTENSIONS[format]}`,
      },
    });
  } catch (error) {
    console.error('Topic knowledge export failed:', error instanceof Error ? error.message : 'unknown error');
    return jsonError(500, 'The topic export could not be created.');
  }
}
