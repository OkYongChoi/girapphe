export function formatDomainLabel(domain: string): string {
  const normalized = domain.trim().toLowerCase();
  if (normalized === 'ml') return 'ML';
  if (!normalized) return domain;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
