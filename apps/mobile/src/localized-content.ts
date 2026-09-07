import { useEffect, useMemo, useState } from 'react';
import { mobileApi, type LocalizedContent } from '@/api';
import { useI18n } from '@/i18n';

const BATCH_SIZE = 12;
const MAX_CONCURRENT_BATCHES = 4;

export function normalizeCardNodeId(id: string): string {
  return id.startsWith('graph_') ? id.slice('graph_'.length) : id;
}

export function useLocalizedContent(ids: string[], detailId?: string | null) {
  const { locale } = useI18n();
  const idKey = [...new Set(ids.filter(Boolean))].sort().join(',');
  // `ids` and `detailId` are canonical graph node ids. Do not strip their
  // `graph_` prefix: several real node ids intentionally begin with it.
  const normalizedDetailId = detailId ?? '';
  const [items, setItems] = useState<Map<string, LocalizedContent>>(new Map());

  useEffect(() => {
    let active = true;
    const uniqueIds = (idKey ? idKey.split(',') : []).filter((id) => id !== normalizedDetailId);
    if (locale === 'en' || (uniqueIds.length === 0 && !normalizedDetailId) || !process.env.EXPO_PUBLIC_APP_BASE_URL) {
      setItems(new Map());
      return () => { active = false; };
    }

    const batches: string[][] = [];
    for (let index = 0; index < uniqueIds.length; index += BATCH_SIZE) {
      batches.push(uniqueIds.slice(index, index + BATCH_SIZE));
    }
    void (async () => {
      const translatedItems: LocalizedContent[] = [];
      if (normalizedDetailId) {
        const detail = await mobileApi.content([normalizedDetailId]).catch(() => null);
        if (detail) translatedItems.push(...detail.items);
      }
      let nextBatch = 0;
      async function worker() {
        while (active) {
          const index = nextBatch;
          nextBatch += 1;
          const batch = batches[index];
          if (!batch) return;
          const response = await mobileApi.content(batch).catch(() => null);
          if (response) translatedItems.push(...response.items);
        }
      }
      await Promise.all(
        Array.from(
          { length: Math.min(MAX_CONCURRENT_BATCHES, batches.length) },
          () => worker(),
        ),
      );
      if (active) setItems(new Map(translatedItems.map((item) => [item.id, item])));
    })();

    return () => { active = false; };
  }, [idKey, locale, normalizedDetailId]);

  return useMemo(() => ({
    get: (id: string) => items.get(id) ?? items.get(normalizeCardNodeId(id)),
    items,
  }), [items]);
}
