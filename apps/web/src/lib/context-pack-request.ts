export function contextPackMethodNotAllowed() {
  return new Response(JSON.stringify({ error: 'Use an explicit POST to create a context pack.' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie, Authorization',
      Allow: 'POST',
    },
  });
}

export function isContextPackPayloadWithinLimit(payload: string, maxBytes: number) {
  return Number.isSafeInteger(maxBytes)
    && maxBytes > 0
    && new TextEncoder().encode(payload).byteLength <= maxBytes;
}

export class ContextPackReuseMismatchError extends Error {
  constructor(
    public readonly expectedCount: number,
    public readonly recordedCount: number,
  ) {
    super(`Expected ${expectedCount} context-pack reuse records, but recorded ${recordedCount}.`);
    this.name = 'ContextPackReuseMismatchError';
  }
}

export class ContextPackReuseRecordingError extends Error {
  constructor(public readonly recordingError: unknown) {
    super('Context-pack reuse activity could not be recorded.');
    this.name = 'ContextPackReuseRecordingError';
  }
}

export async function requireCompleteContextPackReuse(
  expectedCount: number,
  recordReuse: () => Promise<number>,
) {
  let recordedCount: number;
  try {
    recordedCount = await recordReuse();
  } catch (error) {
    throw new ContextPackReuseRecordingError(error);
  }
  if (recordedCount !== expectedCount) {
    throw new ContextPackReuseMismatchError(expectedCount, recordedCount);
  }
  return recordedCount;
}
