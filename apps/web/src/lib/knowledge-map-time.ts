export type AddedDateRange = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year';

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
