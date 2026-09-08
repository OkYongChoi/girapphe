export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too_large' | 'invalid_json' };

export type BoundedBytesResult =
  | { ok: true; value: Uint8Array }
  | { ok: false; reason: 'too_large' | 'invalid_body' };

export type BoundedResponseJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too_large' | 'invalid_json' | 'invalid_body' };

async function readBoundedStream(
  body: ReadableStream<Uint8Array> | null,
  declaredLength: string | null,
  maxBytes: number,
): Promise<BoundedBytesResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError('maxBytes must be a positive safe integer.');
  }
  const normalizedLength = declaredLength?.trim();
  if (normalizedLength && /^\d+$/.test(normalizedLength) && BigInt(normalizedLength) > BigInt(maxBytes)) {
    await body?.cancel().catch(() => undefined);
    return { ok: false, reason: 'too_large' };
  }
  if (!body) return { ok: false, reason: 'invalid_body' };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: 'invalid_body' };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, value: bytes };
}

export async function readBoundedBytes(
  request: Request,
  maxBytes: number,
): Promise<BoundedBytesResult> {
  return readBoundedStream(request.body, request.headers.get('content-length'), maxBytes);
}

/** Strictly accepts an absent or zero-byte body, including chunked requests. */
export async function requestBodyIsEmpty(request: Request): Promise<boolean> {
  if (!request.body) return true;
  const result = await readBoundedBytes(request, 1);
  return result.ok && result.value.byteLength === 0;
}

export async function readBoundedResponseJson(
  response: Response,
  maxBytes: number,
): Promise<BoundedResponseJsonResult> {
  const result = await readBoundedStream(
    response.body,
    response.headers.get('content-length'),
    maxBytes,
  );
  if (!result.ok) return { ok: false, reason: result.reason };
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(result.value);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}

export async function readBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<BoundedJsonResult> {
  const result = await readBoundedBytes(request, maxBytes);
  if (!result.ok) {
    return { ok: false, reason: result.reason === 'too_large' ? 'too_large' : 'invalid_json' };
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(result.value);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}
