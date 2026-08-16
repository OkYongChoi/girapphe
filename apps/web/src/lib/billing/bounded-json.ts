export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too_large' | 'invalid_json' };

export type BoundedBytesResult =
  | { ok: true; value: Uint8Array }
  | { ok: false; reason: 'too_large' | 'invalid_body' };

export async function readBoundedBytes(
  request: Request,
  maxBytes: number,
): Promise<BoundedBytesResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError('maxBytes must be a positive safe integer.');
  }

  const declaredLength = request.headers.get('content-length')?.trim();
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    if (BigInt(declaredLength) > BigInt(maxBytes)) {
      await request.body?.cancel().catch(() => undefined);
      return { ok: false, reason: 'too_large' };
    }
  }

  if (!request.body) return { ok: false, reason: 'invalid_body' };
  const reader = request.body.getReader();
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
