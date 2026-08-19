export type AddedDateRange = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year';
export type ConceptSort = 'newest' | 'updated' | 'title';

export type SortableConceptCard = {
  title: string;
  createdAt?: string;
  updatedAt?: string;
};

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateKey(value: Date) {
  return new Date(value.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function kstDayStart(value: Date) {
  return new Date(`${kstDateKey(value)}T00:00:00+09:00`).getTime();
}

export function getAddedDateRangeStart(range: AddedDateRange, now = new Date()) {
  if (range === 'all') return null;
  if (range === 'today') return kstDayStart(now);

  const days = range === 'week'
    ? 7
    : range === 'month'
      ? 30
      : range === 'quarter'
        ? 90
        : 365;
  return now.getTime() - days * DAY_MS;
}

export function isWithinAddedDateRange(
  createdAt: string | undefined,
  range: AddedDateRange,
  now = new Date(),
) {
  const start = getAddedDateRangeStart(range, now);
  if (start === null) return true;
  if (!createdAt) return false;

  const timestamp = Date.parse(createdAt);
  return !Number.isNaN(timestamp) && timestamp >= start;
}

// Curated graph cards are static source content, so they intentionally have no
// per-card creation timestamp. Keep those cards visible when a date period is
// applied, while still excluding dated cards that fall outside the period.
export function isWithinAddedDateRangeOrUndated(
  createdAt: string | undefined,
  range: AddedDateRange,
  now = new Date(),
) {
  const start = getAddedDateRangeStart(range, now);
  if (start === null || !createdAt) return true;

  const timestamp = Date.parse(createdAt);
  return !Number.isNaN(timestamp) && timestamp >= start;
}

function getTimestamp(value: string | undefined) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getSortTime(card: SortableConceptCard, sort: ConceptSort) {
  if (sort !== 'updated') return getTimestamp(card.createdAt);
  return getTimestamp(card.updatedAt) || getTimestamp(card.createdAt);
}

export function compareConceptCards(a: SortableConceptCard, b: SortableConceptCard, sort: ConceptSort) {
  if (sort !== 'title') {
    const dateDifference = getSortTime(b, sort) - getSortTime(a, sort);
    if (dateDifference !== 0) return dateDifference;
  }

  return a.title.localeCompare(b.title);
}

export function sortConceptCards<T extends SortableConceptCard>(cards: readonly T[], sort: ConceptSort) {
  return [...cards].sort((a, b) => compareConceptCards(a, b, sort));
}
