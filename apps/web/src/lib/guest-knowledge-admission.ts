import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export const GUEST_KNOWLEDGE_ITEM_LIMIT = 100;
export const GUEST_KNOWLEDGE_WRITES_PER_HOUR = 20;
export const GUEST_KNOWLEDGE_RETENTION_DAYS = 90;
export const KNOWLEDGE_REQUEST_ID_MAX_LENGTH = 160;

export function normalizeKnowledgeRequestId(value: FormDataEntryValue | null): string {
  const requestId = String(value ?? '').trim();
  if (requestId.length > KNOWLEDGE_REQUEST_ID_MAX_LENGTH) {
    throw new Error('knowledge_request_id_too_long');
  }
  return requestId;
}

export function getGuestKnowledgeRateScope(userId: string, connectingIp: string | null): string {
  const normalizedIp = connectingIp?.trim() ?? '';
  const source = isIP(normalizedIp) ? `ip:${normalizedIp}` : `guest:${userId}`;
  return createHash('sha256')
    .update('girapphe:guest-knowledge-rate:v1\0')
    .update(source)
    .digest('hex');
}
