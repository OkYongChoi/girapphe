export function normalizeKnowledgeTopic(input: string): string {
  const trimmed = input.normalize('NFKC').trim().toLocaleLowerCase();
  if (!trimmed) return 'general';
  const normalized = trimmed
    .replace(/\s+/gu, '-')
    .replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '');
  return Array.from(normalized).slice(0, 48).join('') || 'general';
}
