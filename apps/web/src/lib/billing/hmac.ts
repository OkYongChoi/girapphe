import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_SECONDS = 300;

function parseTimestampedSignature(header: string) {
  const values = new Map<string, string[]>();
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key || !value) continue;
    values.set(key, [...(values.get(key) ?? []), value]);
  }
  return {
    timestamp: values.get('t')?.[0] ?? null,
    signatures: values.get('v1') ?? [],
  };
}

function constantTimeHexEqual(actual: string, expected: string) {
  if (!/^[a-f0-9]+$/i.test(actual) || !/^[a-f0-9]+$/i.test(expected)) return false;
  const actualBytes = Buffer.from(actual, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function constantTimeTextEqual(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function verifyTimestampedHmac(
  rawBody: string | Uint8Array,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
) {
  const { timestamp, signatures } = parseTimestampedSignature(signatureHeader);
  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > toleranceSeconds) return false;

  const bodyBytes = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : Buffer.from(rawBody);
  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), bodyBytes]);
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  return signatures.some((signature) => constantTimeHexEqual(signature, expected));
}
