export type CardLevel = 'memorize' | 'understand' | 'connect' | 'apply';

const LEVEL_META: Record<CardLevel, { rank: number; label: string }> = {
  memorize: { rank: 1, label: 'Memorize' },
  understand: { rank: 2, label: 'Understand' },
  connect: { rank: 3, label: 'Connect' },
  apply: { rank: 4, label: 'Apply' },
};

export function getCardLevelMeta(level: string | null | undefined) {
  const normalized = (level ?? '').toLowerCase() as CardLevel;
  return LEVEL_META[normalized] ?? { rank: 0, label: 'Unknown' };
}

