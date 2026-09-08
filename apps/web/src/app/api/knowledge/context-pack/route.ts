import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  buildTopicKnowledgeContextPackForUser,
  MAX_CONTEXT_PACK_BYTES,
  serializeTopicKnowledgeHub,
  type KnowledgeContextFormat,
} from '@/lib/topic-knowledge-hub';
import { recordKnowledgeReuseForUser } from '@/lib/knowledge-ingestion';
import {
  getKnowledgeIntelligenceForUser,
  getKnowledgeIntelligenceSignalForUser,
} from '@/lib/knowledge-intelligence';
import {
  recordKnowledgeProductEventForUser,
  recordKnowledgeProductEventsForUser,
} from '@/lib/knowledge-product-events';
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

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function signalId(value: unknown) {
  return typeof value === 'string' && /^kis_[a-z0-9]+$/.test(value) ? value : null;
}

function noContent() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization' } });
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
  if (typeof body.operation === 'string') return recordSignalEvent(user.id, body);

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const format = parseFormat(typeof body.format === 'string' ? body.format : null);
  const itemIds = parseItemIds(body.itemIds);
  const signalId = body.signalId === undefined
    ? null
    : typeof body.signalId === 'string' && /^kis_[a-z0-9]+$/.test(body.signalId)
      ? body.signalId
      : undefined;
  if (!topic || topic.length > 120 || !format || itemIds === null || itemIds.length === 0 || signalId === undefined) {
    return jsonError(400, 'A bounded topic, format=json|markdown|yaml, and 1 to 100 explicit item selectors are required.');
  }

  try {
    const signal = signalId ? await getKnowledgeIntelligenceSignalForUser(user.id, signalId) : null;
    if (signalId && (!signal || signal.topic !== topic
      || itemIds.some((itemId) => !signal.contextItemIds.includes(itemId)))) {
      return jsonError(409, 'The selected intelligence signal changed. Refresh Insights and select the current evidence again.');
    }
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
    await recordKnowledgeProductEventForUser(user.id, {
      eventName: 'knowledge_context_created',
      eventVersion: 1,
      subjectId: signal?.id ?? pack.items[0].id,
      selectionCount: pack.items.length,
    }).catch(() => undefined);
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

async function recordSignalEvent(userId: string, body: Record<string, unknown>) {
  try {
    if (body.operation === 'viewed' && hasExactKeys(body, ['operation', 'signalIds'])) {
      if (!Array.isArray(body.signalIds) || body.signalIds.length < 1 || body.signalIds.length > 6) {
        return jsonError(400, 'One to six signal identifiers are required.');
      }
      const requested = body.signalIds.map(signalId);
      if (requested.some((id) => id === null) || new Set(requested).size !== requested.length) {
        return jsonError(400, 'Unique bounded signal identifiers are required.');
      }
      const current = new Map((await getKnowledgeIntelligenceForUser(userId)).map((signal) => [signal.id, signal]));
      if (requested.some((id) => !current.has(id!))) return jsonError(409, 'The intelligence signals changed. Refresh Thinking History.');
      await recordKnowledgeProductEventsForUser(userId, requested.map((id) => {
        const signal = current.get(id!)!;
        return { eventName: 'knowledge_signal_viewed', eventVersion: 1, subjectId: signal.id, signalType: signal.type };
      }));
      return noContent();
    }

    const id = signalId(body.signalId);
    const signal = id ? await getKnowledgeIntelligenceSignalForUser(userId, id) : null;
    if (!signal) return jsonError(id ? 409 : 400, id ? 'The intelligence signal changed. Refresh Thinking History.' : 'A bounded signal identifier is required.');

    if (body.operation === 'evidence_opened' && hasExactKeys(body, ['operation', 'signalId', 'itemId'])) {
      const itemId = typeof body.itemId === 'string' && body.itemId.length <= 160 ? body.itemId : '';
      if (!itemId || !signal.contextItemIds.includes(itemId)) return jsonError(409, 'The signal evidence changed. Refresh Thinking History.');
      await recordKnowledgeProductEventForUser(userId, {
        eventName: 'knowledge_signal_evidence_opened', eventVersion: 1, subjectId: signal.id, signalType: signal.type,
      });
      return noContent();
    }

    if (body.operation === 'dismissed' && hasExactKeys(body, ['operation', 'signalId', 'outcome'])) {
      const outcome = body.outcome;
      if (outcome !== 'unhelpful' && outcome !== 'incorrect' && outcome !== 'scope_changed') {
        return jsonError(400, 'A supported dismissal outcome is required.');
      }
      await recordKnowledgeProductEventForUser(userId, {
        eventName: 'knowledge_signal_dismissed', eventVersion: 1, subjectId: signal.id, signalType: signal.type, outcome,
      });
      return noContent();
    }

    return jsonError(400, 'A supported signal operation is required.');
  } catch (error) {
    console.error('Knowledge signal event failed:', error instanceof Error ? error.message : 'unknown error');
    return jsonError(500, 'The signal event could not be recorded.');
  }
}
