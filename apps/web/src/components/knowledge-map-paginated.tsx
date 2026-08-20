'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  getKnowledgeMapCardPage,
  getKnowledgeMapGraphCards,
  type CardStatus,
  type KnowledgeMapCard,
  type KnowledgeMapCardPage,
  type KnowledgeMapEdge,
} from '@/actions/card-actions';
import KnowledgeGraph3D from './knowledge-graph-3d';
import type { KnowledgeGraphEdgeView } from './knowledge-graph-3d';
import { formatDomainLabel, getCardLevelMeta } from '@stem-brain/graph-engine';
import { deleteKnowledgeItem, type UserKnowledgeItem } from '@/actions/user-knowledge-actions';
import ConfirmDeleteButton from '@/components/confirm-delete-button';
import type { KnowledgeLinkTarget } from '@/actions/knowledge-ingestion-actions';
import {
  getKnowledgeMapCardDomains,
  matchesKnowledgeMapCard,
} from '@/lib/knowledge-map-pagination';
import { sortConceptCards, type AddedDateRange, type ConceptSort } from '@/lib/knowledge-map-time';
import type { Locale } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';

type MapCard = KnowledgeMapCard & {
  explanation?: string;
  isPersonal?: boolean;
  personalItemId?: string;
  tags?: string[];
};

type Props = {
  initialCardPage?: KnowledgeMapCardPage;
  initialView?: 'grid' | 'graph';
  personalItems?: UserKnowledgeItem[];
  publicEdges?: KnowledgeMapEdge[];
  privateGraph?: {
    nodes?: unknown[];
    edges?: unknown[];
  } | null;
  graphLinkTargets?: KnowledgeLinkTarget[];
  locale: Locale;
};

const EDGE_TYPES = new Set(['prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to']);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function readStringArray(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && !!item.trim());
    if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function fallbackEndpointLabel(id: string) {
  const raw = id.replace(/^graph_/, '').replace(/^personal:/, '');
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(raw)) return raw.slice(0, 8);
  const readable = raw.replace(/[_-]+/g, ' ').trim();
  return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : '';
}

export default function KnowledgeMapPaginated({
  initialCardPage,
  initialView = 'graph',
  personalItems = [],
  publicEdges = [],
  privateGraph = null,
  graphLinkTargets = [],
  locale,
}: Props) {
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);
  const [selectedDomain, setSelectedDomain] = useState<string | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<CardStatus | 'all' | 'unstarted'>('all');
  const [addedDateRange, setAddedDateRange] = useState<AddedDateRange>('all');
  const [sort, setSort] = useState<ConceptSort>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'graph'>(initialView);
  const [includeGenerated, setIncludeGenerated] = useState(false);
  const [generatedLimit, setGeneratedLimit] = useState(250);
  const [cardPage, setCardPage] = useState<KnowledgeMapCardPage | null>(initialCardPage ?? null);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [graphPublicCards, setGraphPublicCards] = useState<KnowledgeMapCard[] | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [, startTransition] = useTransition();
  const cardRequestId = useRef(0);
  const graphRequestId = useRef(0);
  const graphCache = useRef(new Map<string, KnowledgeMapCard[]>());
  const { t } = useI18n();

  const cardPageKey = [
    locale,
    includeGenerated ? 'generated' : 'core',
    generatedLimit,
    deferredFilter,
    selectedDomain,
    selectedStatus,
    addedDateRange,
    sort,
  ].join('|');
  const graphSourceKey = [locale, includeGenerated ? 'generated' : 'core', generatedLimit].join('|');
  const lastCardPageKey = useRef(initialCardPage ? cardPageKey : null);

  useEffect(() => {
    if (viewMode !== 'grid') return;
    if (lastCardPageKey.current === cardPageKey && cardPage) return;

    let active = true;
    const requestId = ++cardRequestId.current;
    lastCardPageKey.current = cardPageKey;
    setIsLoadingCards(true);

    void getKnowledgeMapCardPage({
      page: 1,
      query: deferredFilter,
      domain: selectedDomain,
      status: selectedStatus,
      addedDateRange,
      sort,
      includeGenerated,
      generatedLimit,
      locale,
    }).then((nextPage) => {
      if (!active || requestId !== cardRequestId.current) return;
      startTransition(() => setCardPage(nextPage));
    }).catch(() => {
      // Keep the last successful page available if a later request fails.
    }).finally(() => {
      if (active && requestId === cardRequestId.current) setIsLoadingCards(false);
    });

    return () => {
      active = false;
    };
  }, [
    addedDateRange,
    cardPage,
    cardPageKey,
    deferredFilter,
    generatedLimit,
    includeGenerated,
    locale,
    selectedDomain,
    selectedStatus,
    sort,
    startTransition,
    viewMode,
  ]);

  useEffect(() => {
    if (viewMode !== 'graph') return;

    const cached = graphCache.current.get(graphSourceKey);
    if (cached) {
      setGraphPublicCards(cached);
      setIsLoadingGraph(false);
      return;
    }
    let active = true;
    const requestId = ++graphRequestId.current;
    setIsLoadingGraph(true);
    setGraphPublicCards(null);

    void getKnowledgeMapGraphCards({ includeGenerated, generatedLimit, locale })
      .then((cards) => {
        if (!active || requestId !== graphRequestId.current) return;
        graphCache.current.set(graphSourceKey, cards);
        setGraphPublicCards(cards);
      })
      .catch(() => {
        if (!active || requestId !== graphRequestId.current) return;
        setGraphPublicCards([]);
      })
      .finally(() => {
        if (active && requestId === graphRequestId.current) setIsLoadingGraph(false);
      });

    return () => {
      active = false;
    };
  }, [generatedLimit, graphSourceKey, includeGenerated, locale, viewMode]);

  const personalItemById = useMemo(
    () => new Map(personalItems.map((item) => [item.id, item])),
    [personalItems]
  );
  const graphPrivateCards = useMemo<MapCard[]>(() => (privateGraph?.nodes ?? []).flatMap((node) => {
    const record = asRecord(node);
    const id = readString(record, 'node_id', 'id');
    if (!id) return [];
    const personalItemId = readString(record, 'knowledge_item_id', 'item_id', 'personal_item_id');
    const personalItem = personalItemById.get(personalItemId);
    const topic = readString(record, 'topic', 'domain') || 'personal';
    const tags = readStringArray(record, 'tags');
    const endpointLabel = fallbackEndpointLabel(id);

    return [{
      id,
      personalItemId: personalItemId || undefined,
      isPersonal: true,
      title: personalItem?.title
        || readString(record, 'title', 'label')
        || (endpointLabel
          ? t('knowledge.linkedConceptWithId', { id: endpointLabel })
          : t('knowledge.linkedConcept')),
      summary: personalItem?.summary
        || personalItem?.content
        || readString(record, 'summary', 'content')
        || t('knowledge.privatePersonalCard'),
      explanation: personalItem?.content || readString(record, 'explanation', 'content'),
      wiki_url: '',
      domain: topic,
      domains: [topic],
      tags: personalItem?.tags ?? tags,
      level: 'understand' as const,
      status: null,
      createdAt: personalItem?.created_at || readString(record, 'created_at'),
      updatedAt: personalItem?.updated_at || readString(record, 'updated_at'),
    }];
  }), [personalItemById, privateGraph?.nodes, t]);

  const graphPersonalItemIds = useMemo(
    () => new Set(graphPrivateCards.map((card) => card.personalItemId).filter(Boolean)),
    [graphPrivateCards]
  );
  const legacyPersonalCards = useMemo<MapCard[]>(() => personalItems
    .filter((item) => !graphPersonalItemIds.has(item.id))
    .map((item) => ({
      id: `personal:${item.id}`,
      personalItemId: item.id,
      isPersonal: true,
      title: item.title,
      summary: item.summary || item.content || t('knowledge.privatePersonalCard'),
      explanation: item.content,
      wiki_url: '',
      domain: 'personal',
      domains: [item.topic || 'personal'],
      tags: item.tags,
      level: 'understand' as const,
      status: null,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })), [graphPersonalItemIds, personalItems, t]);
  const personalCards = useMemo<MapCard[]>(
    () => [...graphPrivateCards, ...legacyPersonalCards],
    [graphPrivateCards, legacyPersonalCards]
  );

  const graphEdges = useMemo<KnowledgeGraphEdgeView[]>(() => {
    const canonicalEdges: KnowledgeGraphEdgeView[] = publicEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      weight: edge.weight,
      scope: 'public',
    }));
    const privateEdges: KnowledgeGraphEdgeView[] = (privateGraph?.edges ?? []).flatMap((edge) => {
      const record = asRecord(edge);
      const source = readString(record, 'source', 'source_node_id');
      const target = readString(record, 'target', 'target_node_id');
      const type = readString(record, 'type', 'relation_type');
      if (!source || !target || !EDGE_TYPES.has(type)) return [];
      const rawWeight = record.weight;

      return [{
        id: readString(record, 'id') || `personal-edge:${type}:${source}:${target}`,
        source,
        target,
        type: type as KnowledgeGraphEdgeView['type'],
        weight: typeof rawWeight === 'number' ? rawWeight : 1,
        scope: 'private' as const,
      }];
    });
    return [...canonicalEdges, ...privateEdges];
  }, [privateGraph?.edges, publicEdges]);

  const graphCards = useMemo<MapCard[]>(() => {
    const publicCards = graphPublicCards ?? [];
    const baseCards: MapCard[] = [...publicCards, ...personalCards];
    const visibleIds = new Set(baseCards.map((card) => card.id));
    const targetById = new Map(graphLinkTargets.map((target) => [target.id, target]));
    const endpointIds = new Set(graphEdges
      .filter((edge) => edge.scope === 'private')
      .flatMap((edge) => [edge.source, edge.target]));
    const endpointCards: MapCard[] = [];

    for (const id of endpointIds) {
      if (visibleIds.has(id)) continue;
      const target = targetById.get(id);
      const topic = target?.topic || 'connected';
      const fallbackLabel = fallbackEndpointLabel(id);

      endpointCards.push({
        id,
        isPersonal: target?.scope === 'private' || id.startsWith('personal:'),
        title: target?.label || (fallbackLabel
          ? t('knowledge.linkedConceptWithId', { id: fallbackLabel })
          : t('knowledge.linkedConcept')),
        summary: t('knowledge.endpointSummary'),
        wiki_url: '',
        domain: topic,
        domains: [topic],
        tags: [],
        level: 'understand',
        status: null,
      });
    }

    return [...baseCards, ...endpointCards];
  }, [graphEdges, graphLinkTargets, graphPublicCards, personalCards, t]);

  const pageCards = cardPage?.cards;
  const filteredPersonalCards = useMemo(() => sortConceptCards(
    personalCards.filter((card) => matchesKnowledgeMapCard(card, {
      query: deferredFilter,
      domain: selectedDomain,
      status: selectedStatus,
      addedDateRange,
      sort,
    })),
    sort,
  ), [addedDateRange, deferredFilter, personalCards, selectedDomain, selectedStatus, sort]);
  const gridCards = useMemo<MapCard[]>(
    () => [...(pageCards ?? []), ...filteredPersonalCards],
    [filteredPersonalCards, pageCards]
  );
  const filteredTotal = (cardPage?.total ?? 0) + filteredPersonalCards.length;
  const availablePublicDomains = cardPage?.domains
    ?? Array.from(new Set((graphPublicCards ?? []).flatMap(getKnowledgeMapCardDomains))).sort();
  const domains = useMemo(
    () => Array.from(new Set([...availablePublicDomains, ...personalCards.flatMap(getKnowledgeMapCardDomains)])).sort(),
    [availablePublicDomains, personalCards]
  );
  const coreCardCount = cardPage?.coreTotal
    ?? (graphPublicCards ?? []).filter((card) => !card.id.startsWith('drill_')).length;
  const generatedCardCount = cardPage?.generatedTotal
    ?? (graphPublicCards ?? []).filter((card) => card.id.startsWith('drill_')).length;
  const activeFilterCount = Number(selectedDomain !== 'all')
    + Number(selectedStatus !== 'all')
    + Number(addedDateRange !== 'all')
    + Number(includeGenerated);

  const loadMoreCards = () => {
    if (!cardPage || !cardPage.hasMore || isLoadingCards) return;

    const requestId = ++cardRequestId.current;
    setIsLoadingCards(true);
    void getKnowledgeMapCardPage({
      page: cardPage.page + 1,
      query: deferredFilter,
      domain: selectedDomain,
      status: selectedStatus,
      addedDateRange,
      sort,
      includeGenerated,
      generatedLimit,
      locale,
    }).then((nextPage) => {
      if (requestId !== cardRequestId.current) return;
      startTransition(() => setCardPage((current) => current
        ? { ...nextPage, cards: [...current.cards, ...nextPage.cards] }
        : nextPage));
    }).catch(() => {
      // Leave the current page visible and allow another attempt.
    }).finally(() => {
      if (requestId === cardRequestId.current) setIsLoadingCards(false);
    });
  };

  if (viewMode === 'graph') {
    if (isLoadingGraph || graphPublicCards === null) {
      return (
        <div className="flex min-h-[70vh] w-full items-center justify-center bg-gray-950 text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span className="text-sm text-gray-300">{t('graph.loading')}</span>
          </div>
        </div>
      );
    }

    return (
      <KnowledgeGraph3D
        cards={graphCards}
        edges={graphEdges}
        locale={locale}
        onClose={() => setViewMode('grid')}
      />
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="mb-8 flex flex-col gap-4 justify-between items-center xl:flex-row">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('nav.concepts')}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('knowledge.showing', { filtered: gridCards.length, total: filteredTotal })}
            {isLoadingCards ? <span className="ml-2 text-xs text-gray-400">{t('common.loading')}</span> : null}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {t('knowledge.generatedSummary', {
              core: coreCardCount,
              generated: generatedCardCount,
              state: includeGenerated
                ? t('knowledge.generatedShown', { limit: generatedLimit })
                : t('knowledge.generatedHidden'),
            })}
            {personalCards.length > 0 ? t('knowledge.privateCount', { count: personalCards.length }) : ''}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:flex-nowrap">
          <button
            type="button"
            onClick={() => setViewMode('graph')}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white shadow transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {t('knowledge.graphView')}
          </button>

          <div className="min-w-[12rem] flex-1 xl:w-60 xl:flex-none">
            <input
              id="concept-search"
              type="text"
              aria-label={t('knowledge.searchPlaceholder')}
              placeholder={t('knowledge.searchPlaceholder')}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="w-full rounded border bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <select
              id="concept-sort"
              aria-label={t('knowledge.sort')}
              value={sort}
              onChange={(event) => setSort(event.target.value as ConceptSort)}
              className="rounded border bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="newest">{t('knowledge.sortNewest')}</option>
              <option value="updated">{t('knowledge.sortUpdated')}</option>
              <option value="title">{t('knowledge.sortTitle')}</option>
            </select>
          </div>

          <details className="w-full xl:relative xl:w-auto">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-details-marker]:hidden">
              <span>{t('knowledge.filters')}</span>
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
                  {activeFilterCount}
                </span>
              ) : null}
            </summary>
            <div data-testid="concept-filters" className="mt-2 w-full rounded-xl border bg-white p-4 shadow-lg xl:absolute xl:right-0 xl:z-20 xl:w-80">
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-medium text-gray-700" htmlFor="concept-domain">
                  {t('common.domain')}
                  <select
                    id="concept-domain"
                    value={selectedDomain}
                    onChange={(event) => setSelectedDomain(event.target.value)}
                    className="rounded border bg-white p-2 font-normal focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="all">{t('common.allDomains')}</option>
                    {domains.map((domain) => (
                      <option key={domain} value={domain}>{formatDomainLabel(domain)}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm font-medium text-gray-700" htmlFor="concept-status">
                  {t('common.status')}
                  <select
                    id="concept-status"
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value as CardStatus | 'all' | 'unstarted')}
                    className="rounded border bg-white p-2 font-normal focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="all">{t('common.allStatus')}</option>
                    <option value="known">{t('common.canExplain')}</option>
                    <option value="saved">{t('common.unclear')}</option>
                    <option value="unstarted">{t('common.notStarted')}</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm font-medium text-gray-700" htmlFor="concept-added-range">
                  {t('knowledge.addedWithin')}
                  <select
                    id="concept-added-range"
                    value={addedDateRange}
                    onChange={(event) => setAddedDateRange(event.target.value as AddedDateRange)}
                    className="rounded border bg-white p-2 font-normal focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="all">{t('knowledge.allTime')}</option>
                    <option value="today">{t('knowledge.today')}</option>
                    <option value="week">{t('knowledge.pastDays', { days: 7 })}</option>
                    <option value="month">{t('knowledge.pastDays', { days: 30 })}</option>
                    <option value="quarter">{t('knowledge.pastDays', { days: 90 })}</option>
                    <option value="year">{t('knowledge.pastYear')}</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700" htmlFor="toggle-generated">
                  <input
                    id="toggle-generated"
                    type="checkbox"
                    checked={includeGenerated}
                    onChange={(event) => {
                      setIncludeGenerated(event.target.checked);
                      setCardPage(null);
                    }}
                  />
                  {t('knowledge.showGenerated')}
                </label>

                {includeGenerated ? (
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedLimit((current) => Math.min(5000, current + 250));
                      setCardPage(null);
                    }}
                    disabled={isLoadingCards}
                    className="rounded-md border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {isLoadingCards ? t('common.loading') : t('knowledge.loadMore')}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setFilter('');
                    setSelectedDomain('all');
                    setSelectedStatus('all');
                    setAddedDateRange('all');
                    setSort('newest');
                    setIncludeGenerated(false);
                    setGeneratedLimit(250);
                    setCardPage(null);
                  }}
                  className="rounded border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {t('knowledge.resetAll')}
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-6 rounded-xl border bg-white px-4 py-3 text-xs">
        <div>
          <span className="mb-1.5 block font-semibold text-gray-500 uppercase tracking-wide">{t('common.status')}</span>
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-green-300 border border-green-400" />{t('common.canExplain')}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-blue-300 border border-blue-400" />{t('common.unclear')}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-gray-200 border border-gray-300" />{t('common.notStarted')}</span>
          </div>
        </div>
      </div>

      <div>
        <div data-testid="concept-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {gridCards.map((card) => (
            <KnowledgeCardItem key={card.id} card={card} />
          ))}
        </div>

        {gridCards.length === 0 && !isLoadingCards ? (
          <div className="text-center py-12 text-gray-600">{t('knowledge.noMatches')}</div>
        ) : null}

        {cardPage?.hasMore ? (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={loadMoreCards}
              disabled={isLoadingCards}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {isLoadingCards ? t('common.loading') : t('knowledge.loadMore')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function KnowledgeCardItem({ card }: { card: MapCard }) {
  const levelMeta = getCardLevelMeta(card.level);
  const { t } = useI18n();

  const getStatusColor = (status: CardStatus | null) => {
    switch (status) {
      case 'known': return 'bg-green-100 border-green-300';
      case 'saved': return 'bg-blue-100 border-blue-300';
      default: return 'bg-gray-100 border-gray-200';
    }
  };

  const getStatusLabel = (status: CardStatus | null) => {
    if (status === 'known') return t('common.explainable');
    if (status === 'saved') return t('common.reviewing');
    return t('common.notStarted');
  };

  return (
    <div data-testid="concept-card" className={`p-4 rounded-lg border shadow-sm transition-all hover:shadow-md ${getStatusColor(card.status)}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs tracking-wider text-gray-700 font-semibold">
          {card.isPersonal
            ? t('common.privateCard')
            : t('common.difficulty', { rank: levelMeta.rank, label: levelMeta.label })}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 text-gray-700">
          {getStatusLabel(card.status)}
        </span>
      </div>
      <h3 className="font-bold text-lg mb-1 leading-tight text-gray-900">{card.title}</h3>
      {card.isPersonal && card.createdAt ? (
        <p className="mb-2 text-xs text-gray-500">
          {t('knowledge.added', { date: new Date(card.createdAt).toLocaleDateString() })}
        </p>
      ) : null}
      {card.domains && card.domains.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {card.domains.map((domain) => (
            <span key={domain} className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              {formatDomainLabel(domain)}
            </span>
          ))}
        </div>
      ) : null}
      {card.isPersonal && card.tags && card.tags.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">#{tag}</span>
          ))}
        </div>
      ) : null}
      <p className="text-sm text-gray-700 line-clamp-2 mb-3">{card.summary}</p>

      {card.wiki_url ? (
        <a
          href={card.wiki_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-700 hover:text-blue-800 hover:underline transition-colors"
        >
          {t('knowledge.wiki')}
        </a>
      ) : null}
      {card.isPersonal && card.personalItemId ? (
        <form action={deleteKnowledgeItem} className="mt-3">
          <input type="hidden" name="id" value={card.personalItemId} />
          <ConfirmDeleteButton
            label={t('knowledge.moveTrash')}
            confirmMessage={t('knowledge.moveTrashConfirm', { title: card.title, days: 14 })}
            ariaLabel={t('knowledge.moveTrashAria', { title: card.title })}
            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          />
        </form>
      ) : null}
    </div>
  );
}
