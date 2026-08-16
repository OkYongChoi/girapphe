import { useEffect, useMemo, useState } from 'react';
import { mobileApi, type LocalizedContent } from '@/api';
import { useI18n } from '@/i18n';

const BATCH_SIZE = 12;

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
    const requests = [
      ...(normalizedDetailId ? [mobileApi.content([normalizedDetailId])] : []),
      ...batches.map((batch) => mobileApi.content(batch)),
    ];
    void Promise.allSettled(requests)
      .then((responses) => {
        if (!active) return;
        const translatedItems = responses.flatMap((response) => response.status === 'fulfilled' ? response.value.items : []);
        setItems(new Map(translatedItems.map((item) => [item.id, item])));
      });

    return () => { active = false; };
  }, [idKey, locale, normalizedDetailId]);

  return useMemo(() => ({
    get: (id: string) => items.get(id) ?? items.get(normalizeCardNodeId(id)),
    items,
  }), [items]);
}
