export const MAX_QUIZ_REQUEST_BYTES = 4_096;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body exceeds the allowed size.');
    this.name = 'RequestBodyTooLargeError';
  }
}

export class InvalidJsonBodyError extends Error {
  constructor() {
    super('Request body must be valid JSON.');
    this.name = 'InvalidJsonBodyError';
  }
}

export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number
): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError('maxBytes must be a positive safe integer.');
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size error is the useful response even if stream cancellation fails.
        }
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidJsonBodyError();
  }
}
