export function formatDomainLabel(domain: string): string {
  const normalized = domain.trim().toLowerCase();
  if (normalized === 'ml') return 'ML';
  if (normalized === 'computer_science') return 'CS';
  if (normalized === 'artificial_intelligence') return 'AI';
  if (normalized === 'machine_learning') return 'ML';
  if (normalized === 'probability_and_statistics') return 'Probability & Statistics';
  if (normalized.includes('_')) {
    return normalized
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  if (!normalized) return domain;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
