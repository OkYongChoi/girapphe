import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import type { LocalizationBackfillKind } from '@/lib/content-localization';

const MAX_BODY_BYTES = 2_048;

function responseError(status: number, code: string, error: string) {
  return NextResponse.json({ error, code }, { status });
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

async function readBoundedBody(request: NextRequest): Promise<string | null> {
  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest) {
  const {
    backfillLocalizedContentBatch,
    MAX_BACKFILL_CARDS,
    MAX_BACKFILL_NODES,
    parseContentLocale,
  } = await import('@/lib/content-localization');
  if (!isSameOrigin(request)) {
    return responseError(403, 'CROSS_ORIGIN_REQUEST_REJECTED', 'A same-origin request is required.');
  }

  const user = await getCurrentUser();
  if (
    !user
    || !process.env.ADMIN_CLERK_USER_ID
    || user.id !== process.env.ADMIN_CLERK_USER_ID
  ) {
    return responseError(403, 'ADMIN_REQUIRED', 'Administrator access is required.');
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return responseError(413, 'BODY_TOO_LARGE', 'The backfill request body is too large.');
  }

  let rawBody: string | null;
  try {
    rawBody = await readBoundedBody(request);
  } catch {
    return responseError(400, 'INVALID_JSON', 'A small JSON object is required.');
  }
  if (rawBody === null) {
    return responseError(413, 'BODY_TOO_LARGE', 'The backfill request body is too large.');
  }

  let body: Record<string, unknown>;
  try {
    const input: unknown = JSON.parse(rawBody);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid body');
    body = input as Record<string, unknown>;
  } catch {
    return responseError(400, 'INVALID_JSON', 'A small JSON object is required.');
  }

  const locale = parseContentLocale(typeof body.locale === 'string' ? body.locale : null);
  if (!locale || locale === 'en') {
    return responseError(400, 'UNSUPPORTED_TARGET_LOCALE', 'Choose ja, zh-CN, es, ar, or hi.');
  }
  if (body.kind !== 'nodes' && body.kind !== 'cards') {
    return responseError(400, 'UNSUPPORTED_BACKFILL_KIND', 'Choose cards or nodes.');
  }
  const kind: LocalizationBackfillKind = body.kind;
  const maxLimit = kind === 'cards' ? MAX_BACKFILL_CARDS : MAX_BACKFILL_NODES;
  const requestedLimit = typeof body.limit === 'number' && Number.isInteger(body.limit) ? body.limit : maxLimit;
  const limit = Math.max(1, Math.min(requestedLimit, maxLimit));
  const after = typeof body.after === 'string' && body.after.length <= 160 ? body.after.trim() : '';

  try {
    const result = await backfillLocalizedContentBatch({
      kind,
      locale,
      after,
      limit,
      retryFailed: body.retry_failed === true,
    });
    return NextResponse.json(result);
  } catch {
    return responseError(
      503,
      'CONTENT_BACKFILL_UNAVAILABLE',
      'The localization backfill could not run. No source content was changed.'
    );
  }
}
