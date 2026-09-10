export function withoutOptimisticRecallItem(
  current: ReadonlySet<string>,
  knowledgeItemId: string,
): Set<string> {
  const next = new Set(current);
  next.delete(knowledgeItemId);
  return next;
}
