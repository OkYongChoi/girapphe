export type ContentCursorBatch<T> = {
  items: T[];
  nextCursor: string;
  complete: boolean;
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function selectContentCursorBatch<T extends { id: string }>(
  approvedItems: Iterable<T>,
  after: string,
  limit: number
): ContentCursorBatch<T> {
  const pending = [...approvedItems]
    .filter((item) => item.id > after)
    .sort((left, right) => compareIds(left.id, right.id));
  const items = pending.slice(0, limit);

  return {
    items,
    nextCursor: items.at(-1)?.id ?? after,
    complete: pending.length <= limit,
  };
}
