import {
  MAX_KNOWLEDGE_TAG_SUGGESTIONS,
  normalizeKnowledgeTag,
} from './knowledge-tag-normalization';

type RankedTag = {
  tag: string;
  count: number;
};

function comparePreferred(left: RankedTag, right: RankedTag, collator: Intl.Collator) {
  const countOrder = right.count - left.count;
  if (countOrder !== 0) return countOrder;
  const localeOrder = collator.compare(left.tag, right.tag);
  if (localeOrder !== 0) return localeOrder;
  return left.tag < right.tag ? -1 : left.tag > right.tag ? 1 : 0;
}

function isWorse(left: RankedTag, right: RankedTag, collator: Intl.Collator) {
  return comparePreferred(left, right, collator) > 0;
}

function pushWorstFirst(heap: RankedTag[], entry: RankedTag, collator: Intl.Collator) {
  heap.push(entry);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (!isWorse(heap[index], heap[parent], collator)) break;
    [heap[index], heap[parent]] = [heap[parent], heap[index]];
    index = parent;
  }
}

function restoreWorstFirst(heap: RankedTag[], collator: Intl.Collator) {
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    let worst = index;
    if (left < heap.length && isWorse(heap[left], heap[worst], collator)) worst = left;
    if (right < heap.length && isWorse(heap[right], heap[worst], collator)) worst = right;
    if (worst === index) return;
    [heap[index], heap[worst]] = [heap[worst], heap[index]];
    index = worst;
  }
}

export function collectKnowledgeTagSuggestions(
  tagGroups: readonly (readonly string[])[],
  locale: string,
  limit = MAX_KNOWLEDGE_TAG_SUGGESTIONS,
): string[] {
  const boundedLimit = Math.max(0, Math.floor(limit));
  if (boundedLimit === 0) return [];

  const counts = new Map<string, number>();
  for (const tags of tagGroups) {
    for (const rawTag of tags) {
      const tag = normalizeKnowledgeTag(rawTag);
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const collator = new Intl.Collator(locale);
  const heap: RankedTag[] = [];
  for (const [tag, count] of counts) {
    const entry = { tag, count };
    if (heap.length < boundedLimit) {
      pushWorstFirst(heap, entry, collator);
      continue;
    }
    if (comparePreferred(entry, heap[0], collator) >= 0) continue;
    heap[0] = entry;
    restoreWorstFirst(heap, collator);
  }

  return heap.sort((left, right) => comparePreferred(left, right, collator)).map(({ tag }) => tag);
}
