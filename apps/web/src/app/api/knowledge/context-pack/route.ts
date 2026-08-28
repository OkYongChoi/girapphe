import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  buildTopicKnowledgeContextPackForUser,
  MAX_CONTEXT_PACK_BYTES,
  serializeTopicKnowledgeHub,
  type KnowledgeContextFormat,
} from '@/lib/topic-knowledge-hub';
import { recordKnowledgeReuseForUser } from '@/lib/knowledge-ingestion';
import { readBoundedJson } from '@/lib/billing/bounded-json';
import {
  ContextPackReuseMismatchError,
  ContextPackReuseRecordingError,
  contextPackMethodNotAllowed,
  isContextPackPayloadWithinLimit,
  requireCompleteContextPackReuse,
} from '@/lib/context-pack-request';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CONTENT_TYPES: Record<KnowledgeContextFormat, string> = {
  json: 'application/json; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  yaml: 'application/yaml; charset=utf-8',
};

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie, Authorization',
    },
  });
}

function parseFormat(value: string | null): KnowledgeContextFormat | null {
  return value === 'json' || value === 'markdown' || value === 'yaml' ? value : null;
}

function parseItemIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null;
  const values = value.map((item) => typeof item === 'string' ? item.trim() : '');
  if (values.some((item) => !item || item.length > 160)) return null;
  return [...new Set(values)];
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export const GET = contextPackMethodNotAllowed;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'unauthorized');
  if (!sameOrigin(request)) return jsonError(403, 'A same-origin request is required.');

  const parsed = await readBoundedJson(request, 32_768);
  if (!parsed.ok) return jsonError(parsed.reason === 'too_large' ? 413 : 400, 'A small JSON request is required.');
  const input = parsed.value;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return jsonError(400, 'A JSON object is required.');
  const body = input as Record<string, unknown>;

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const format = parseFormat(typeof body.format === 'string' ? body.format : null);
  const itemIds = parseItemIds(body.itemIds);
  if (!topic || topic.length > 120 || !format || itemIds === null || itemIds.length === 0) {
    return jsonError(400, 'A bounded topic, format=json|markdown|yaml, and 1 to 100 explicit item selectors are required.');
  }

  try {
    const pack = await buildTopicKnowledgeContextPackForUser(user.id, topic, {
      format,
      ...(itemIds.length > 0 ? { itemIds } : {}),
    });
    if (pack.items.length !== itemIds.length) {
      return jsonError(409, 'The selected knowledge changed. Refresh the Topic Hub and select the current items again.');
    }
    const body = serializeTopicKnowledgeHub(pack, format);
    if (!isContextPackPayloadWithinLimit(body, MAX_CONTEXT_PACK_BYTES)) {
      return jsonError(413, 'The selected context pack is too large.');
    }
    await requireCompleteContextPackReuse(pack.items.length, () => (
      recordKnowledgeReuseForUser(user.id, pack.items.map((item) => item.id), {
        topic: pack.topic,
        format,
        count: pack.items.length,
      })
    ));
    return new Response(body, {
      headers: {
        'Content-Type': CONTENT_TYPES[format],
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        Vary: 'Cookie, Authorization',
        'Content-Disposition': `attachment; filename="girapphe-context-pack.${format === 'markdown' ? 'md' : format}"`,
      },
    });
  } catch (error) {
    const stale = error instanceof ContextPackReuseMismatchError;
    const recordingFailure = error instanceof ContextPackReuseRecordingError ? error : null;
    const oversized = !recordingFailure && error instanceof Error && error.message.includes('size limit');
    let failureReason = error instanceof Error ? error.message : 'unknown error';
    if (stale) failureReason = 'reuse activity count mismatch';
    else if (recordingFailure) {
      failureReason = recordingFailure.recordingError instanceof Error
        ? recordingFailure.recordingError.message
        : 'reuse activity recording failed';
    } else if (oversized) failureReason = 'size limit exceeded';
    console.error('Knowledge context pack failed:', failureReason);
    return jsonError(
      stale ? 409 : oversized ? 413 : 500,
      stale
        ? 'The selected knowledge changed. Refresh the Topic Hub and select the current items again.'
        : oversized
          ? 'The selected context pack is too large.'
          : 'The context pack could not be created.',
    );
  }
}
