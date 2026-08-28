export const MAX_KNOWLEDGE_SOURCE_URL_LENGTH = 2_048;

const URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//i;
const OPAQUE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/;

export function normalizeKnowledgeSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > MAX_KNOWLEDGE_SOURCE_URL_LENGTH
    || /[\u0000-\u001F\u007F]/u.test(candidate)) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return null;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeKnowledgeEvidenceSourceReference(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.normalize('NFKC').trim();
  if (!candidate) return null;
  if (URL_SCHEME_PATTERN.test(candidate)) return normalizeKnowledgeSourceUrl(candidate);
  if (Array.from(candidate).length > 240) return null;
  return normalizeKnowledgeOpaqueReference(candidate);
}

export function normalizeKnowledgeOpaqueReference(value: unknown, maxLength = 240): string | null {
  if (typeof value !== 'string') return null;
  const candidate = Array.from(value.normalize('NFKC').trim()).slice(0, maxLength).join('');
  if (!candidate || URL_SCHEME_PATTERN.test(candidate)) return null;
  return OPAQUE_REFERENCE_PATTERN.test(candidate) ? candidate : null;
}
