import type { CardStatus } from '@/actions/card-actions';

export function getCardStatusLabel(status: CardStatus | null) {
  if (status === 'known') return 'Can Explain';
  if (status === 'saved') return 'Unclear';
  return 'Not Started';
}

export function getCardStatusShortLabel(status: CardStatus | null) {
  if (status === 'known') return 'Explainable';
  if (status === 'saved') return 'Reviewing';
  return 'Not Started';
}
