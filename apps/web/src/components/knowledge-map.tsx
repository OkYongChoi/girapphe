'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import {
  getAllCardsWithStatus,
  getKnowledgeGraphSnapshot,
  getKnowledgeMapCardPage,
  type KnowledgeCard,
  type CardStatus,
  type KnowledgeGraphSnapshot,
} from '@/actions/card-actions';
import type { KnowledgeGraphEdgeView } from './knowledge-graph-3d';
import KnowledgeMapWebMcpRegistration from './knowledge-map-webmcp-registration';
import {
  filterKnowledgeSearchCards,
  getKnowledgeSearchCardDomains as getCardDomains,
  isPublicKnowledgeSearchCard,
  type KnowledgeSearchFilters,
} from './knowledge-map-webmcp';
import { getCardLevelMeta } from '@stem-brain/graph-engine';
import { formatDomainLabel } from '@stem-brain/graph-engine';
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  getUserKnowledgeItems,
  updateKnowledgeItem,
  type UserKnowledgeItem,
} from '@/actions/user-knowledge-actions';
import ConfirmDeleteButton from '@/components/confirm-delete-button';
import type { KnowledgeLinkTarget } from '@/actions/knowledge-ingestion-actions';
import {
  type AddedDateRange,
  type ConceptSort,
} from '@/lib/knowledge-map-time';
import {
  groupConceptCards,
  limitConceptCardGroups,
  UNTAGGED_CONCEPT_GROUP_KEY,
  type ConceptGroupBy,
} from '@/lib/knowledge-map-grouping';
import type { Locale } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';

const KnowledgeGraph3D = dynamic(() => import('./knowledge-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[32rem] items-center justify-center text-gray-400" aria-hidden="true">
      <span className="animate-pulse text-2xl">•••</span>
    </div>
  ),
});

type MapCard = KnowledgeCard & {
  status: CardStatus | null;
  isPersonal?: boolean;
  personalItemId?: string;
  createdAt?: string;
  tags?: string[];
  storedSummary?: string;
};

type KnowledgeMapPersonalItem = Pick<
  UserKnowledgeItem,
  'id' | 'title' | 'summary' | 'content' | 'topic' | 'tags' | 'version' | 'created_at' | 'updated_at'
>;

type EditableCardValues = {
  title: string;
  topic: string;
  summary: string;
  content: string;
  tags: string;
};

type Props = {
  initialCards: (KnowledgeCard & { status: CardStatus | null })[];
  initialHasMoreCards?: boolean;
  initialGraphSnapshot?: KnowledgeGraphSnapshot | null;
  initialView?: 'grid' | 'graph';
  personalItems?: KnowledgeMapPersonalItem[];
  privateGraph?: {
    nodes?: unknown[];
    edges?: unknown[];
  } | null;
  graphLinkTargets?: KnowledgeLinkTarget[];
  enableWebMcp?: boolean;
  isGuest?: boolean;
  locale: Locale;
};

const EDGE_TYPES = new Set(['prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to']);
const INITIAL_VISIBLE_CONCEPT_CARDS = 24;
const EMPTY_GRAPH_CARDS: MapCard[] = [];

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

export default function KnowledgeMap({
  initialCards,
  initialHasMoreCards = false,
  initialGraphSnapshot = null,
  initialView = 'graph',
  personalItems = [],
  privateGraph = null,
  graphLinkTargets = [],
  enableWebMcp = false,
  locale,
}: Props) {
  const [baseCards, setBaseCards] = useState(initialCards);
  const [hasMoreCards, setHasMoreCards] = useState(initialHasMoreCards);
  const [loadingMoreCards, setLoadingMoreCards] = useState(false);
  const [graphSnapshot, setGraphSnapshot] = useState(initialGraphSnapshot);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [isOpeningGraph, startOpeningGraph] = useTransition();
  const [currentPersonalItems, setCurrentPersonalItems] = useState(personalItems);
  const [filter, setFilter] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<CardStatus | 'all' | 'unstarted'>('all');
  const [addedDateRange, setAddedDateRange] = useState<AddedDateRange>('all');
  const [sort, setSort] = useState<ConceptSort>('newest');
  const [groupBy, setGroupBy] = useState<ConceptGroupBy>('domain');
  const [viewMode, setViewMode] = useState<'grid' | 'graph'>(initialView);
  const [includeGenerated, setIncludeGenerated] = useState(false);
  const [generatedLimit, setGeneratedLimit] = useState(250);
  const [generatedCards, setGeneratedCards] = useState<(KnowledgeCard & { status: CardStatus | null })[] | null>(null);
  const [loadingGenerated, setLoadingGenerated] = useState(false);
  const [generatedError, setGeneratedError] = useState<string | null>(null);
  const [visibleCardLimit, setVisibleCardLimit] = useState(INITIAL_VISIBLE_CONCEPT_CARDS);
  const { t, formatNumber } = useI18n();

  useEffect(() => {
    setCurrentPersonalItems(personalItems);
  }, [personalItems]);

  const personalItemById = useMemo(
    () => new Map(currentPersonalItems.map((item) => [item.id, item])),
    [currentPersonalItems]
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
      storedSummary: personalItem?.summary,
    }];
  }), [personalItemById, privateGraph?.nodes, t]);

  const graphPersonalItemIds = useMemo(
    () => new Set(graphPrivateCards.map((card) => card.personalItemId).filter(Boolean)),
    [graphPrivateCards]
  );

  const legacyPersonalCards = useMemo<MapCard[]>(() => currentPersonalItems
    .filter((item) => !graphPersonalItemIds.has(item.id))
    .map((item) => ({
    id: `personal:${item.id}`,
    personalItemId: item.id,
    isPersonal: true,
    title: item.title,
    summary: item.summary || item.content || t('knowledge.privatePersonalCard'),
    storedSummary: item.summary,
    explanation: item.content,
    wiki_url: '',
    domain: 'personal',
    domains: [item.topic || 'personal'],
    tags: item.tags,
    level: 'understand',
    status: null,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  })), [currentPersonalItems, graphPersonalItemIds, t]);
  const personalCards = useMemo<MapCard[]>(
    () => [...graphPrivateCards, ...legacyPersonalCards],
    [graphPrivateCards, legacyPersonalCards]
  );
  const publicCards = useMemo(
    () => includeGenerated ? (generatedCards ?? baseCards) : baseCards,
    [baseCards, generatedCards, includeGenerated]
  );
  const cards = useMemo<MapCard[]>(() => [...publicCards, ...personalCards], [publicCards, personalCards]);
  const graphPublicCards = graphSnapshot?.cards ?? EMPTY_GRAPH_CARDS;
  const graphEdges = useMemo<KnowledgeGraphEdgeView[]>(() => {
    const canonicalEdges: KnowledgeGraphEdgeView[] = (graphSnapshot?.edges ?? []).map((edge) => ({
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
  }, [graphSnapshot?.edges, privateGraph?.edges]);
  const graphCards = useMemo<MapCard[]>(() => {
    const graphBaseCards: MapCard[] = [...graphPublicCards, ...personalCards];
    const visibleIds = new Set(graphBaseCards.map((card) => card.id));
    const targetById = new Map(graphLinkTargets.map((target) => [target.id, target]));
    // Public card limits remain intentional for free maps. Only
    // private overlays may add lightweight endpoints that are required to keep
    // an owner-authored relationship visible.
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
        explanation: '',
        wiki_url: '',
        domain: topic,
        domains: [topic],
        tags: [],
        level: 'understand',
        status: null,
      });
    }

    return [...graphBaseCards, ...endpointCards];
  }, [graphEdges, graphLinkTargets, graphPublicCards, personalCards, t]);

  // Cards can live in multiple taxonomy domains.
  const domains = useMemo(
    () => Array.from(new Set(cards.flatMap(getCardDomains))).sort(),
    [cards]
  );
  const publicDomains = useMemo(
    () => Array.from(new Set(cards
      .filter(isPublicKnowledgeSearchCard)
      .flatMap(getCardDomains))).sort(),
    [cards]
  );

  const coreCardCount = useMemo(() => cards.filter((c) => !c.isPersonal && !c.id.startsWith('drill_')).length, [cards]);
  const generatedCardCount = useMemo(() => cards.filter((c) => c.id.startsWith('drill_')).length, [cards]);

  const loadGenerated = async (nextLimit: number) => {
    setIncludeGenerated(true);
    setGeneratedLimit(nextLimit);
    setLoadingGenerated(true);
    setGeneratedError(null);
    try {
      const next = await getAllCardsWithStatus({
        includeGenerated: true,
        generatedLimit: nextLimit,
        locale,
      });
      setGeneratedCards(next);
    } catch {
      setGeneratedError(t('knowledge.generatedError'));
    } finally {
      setLoadingGenerated(false);
    }
  };

  const loadMoreCards = async () => {
    const nextVisibleLimit = visibleCardLimit + INITIAL_VISIBLE_CONCEPT_CARDS;
    if (nextVisibleLimit <= baseCards.length || !hasMoreCards) {
      setVisibleCardLimit(nextVisibleLimit);
      return;
    }

    setLoadingMoreCards(true);
    try {
      const nextPage = await getKnowledgeMapCardPage({
        locale,
        offset: baseCards.length,
        limit: INITIAL_VISIBLE_CONCEPT_CARDS,
      });
      setBaseCards((current) => [...current, ...nextPage.cards]);
      setHasMoreCards(nextPage.hasMore);
      setVisibleCardLimit(nextVisibleLimit);
    } finally {
      setLoadingMoreCards(false);
    }
  };

  const openGraphView = () => {
    setGraphError(null);
    if (graphSnapshot) {
      setViewMode('graph');
      return;
    }

    startOpeningGraph(async () => {
      try {
        const snapshot = await getKnowledgeGraphSnapshot({ locale });
        setGraphSnapshot(snapshot);
        setViewMode('graph');
      } catch {
        setGraphError(t('knowledge.graphLoadError'));
      }
    });
  };

  const applyWebMcpFilters = useCallback((nextFilters: KnowledgeSearchFilters) => {
    setFilter(nextFilters.query);
    setSelectedDomain(nextFilters.domain);
    setSelectedStatus(nextFilters.status);
    setAddedDateRange(nextFilters.addedWithin);
    setViewMode('grid');
  }, []);

  const filteredCards = useMemo(() => {
    return filterKnowledgeSearchCards(cards, {
      query: filter,
      domain: selectedDomain,
      status: selectedStatus,
      addedWithin: addedDateRange,
    });
  }, [addedDateRange, cards, filter, selectedDomain, selectedStatus]);

  const cardGroups = useMemo(
    () => groupConceptCards(filteredCards, groupBy, sort),
    [filteredCards, groupBy, sort]
  );
  const visibleCardGroups = useMemo(
    () => limitConceptCardGroups(cardGroups, visibleCardLimit),
    [cardGroups, visibleCardLimit],
  );
  const groupCardCounts = useMemo(
    () => new Map(cardGroups.map((group) => [group.key, group.cards.length])),
    [cardGroups],
  );

  useEffect(() => {
    setVisibleCardLimit(INITIAL_VISIBLE_CONCEPT_CARDS);
  }, [addedDateRange, filter, groupBy, includeGenerated, selectedDomain, selectedStatus, sort]);

  const activeFilterCount = Number(selectedDomain !== 'all')
    + Number(selectedStatus !== 'all')
    + Number(addedDateRange !== 'all')
    + Number(includeGenerated);

  const saveCard = useCallback(async (card: MapCard, values: EditableCardValues) => {
    const formData = new FormData();
    formData.set('title', values.title);
    formData.set('topic', values.topic);
    formData.set('summary', values.summary);
    formData.set('content', values.content);
    formData.set('tags', values.tags);

    if (card.personalItemId) {
      const currentItem = personalItemById.get(card.personalItemId);
      if (!currentItem) throw new Error('The private knowledge item is no longer available.');
      formData.set('id', card.personalItemId);
      formData.set('version', String(currentItem.version));
      const result = await updateKnowledgeItem(formData);
      if (!result.updated) throw new Error('The private knowledge item changed before this edit was saved.');
    } else {
      await createKnowledgeItem(formData);
    }

    setCurrentPersonalItems(await getUserKnowledgeItems());
  }, [personalItemById]);

  return (
    <div className="w-full h-full">
      {enableWebMcp ? (
        <KnowledgeMapWebMcpRegistration
          cards={cards}
          publicDomains={publicDomains}
          onApplyFilters={applyWebMcpFilters}
        />
      ) : null}
      {viewMode === 'graph' && graphSnapshot ? (
        <KnowledgeGraph3D
          access={graphSnapshot.access}
          cards={graphCards}
          edges={graphEdges}
          onClose={() => setViewMode('grid')}
        />
      ) : (
        <div className="w-full max-w-6xl mx-auto p-6">
          <div className="mb-8 flex flex-col gap-4 justify-between items-center xl:flex-row">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('nav.concepts')}</h1>
              <p className="mt-1 text-sm text-gray-600">
                {t('knowledge.showing', { filtered: filteredCards.length, total: cards.length })}
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
                onClick={openGraphView}
                disabled={isOpeningGraph}
                className="min-h-11 rounded bg-blue-600 px-4 py-2 font-medium text-white shadow transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
              >
                {isOpeningGraph ? t('knowledge.loadingGraph') : t('knowledge.graphView')}
              </button>

              <div className="min-w-[12rem] flex-1 xl:w-60 xl:flex-none">
                <input
                  id="concept-search"
                  type="text"
                  aria-label={t('knowledge.searchPlaceholder')}
                  placeholder={t('knowledge.searchPlaceholder')}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="min-h-11 w-full rounded border bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <select
                  id="concept-sort"
                  aria-label={t('knowledge.sort')}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ConceptSort)}
                  className="min-h-11 rounded border bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="newest">{t('knowledge.sortNewest')}</option>
                  <option value="updated">{t('knowledge.sortUpdated')}</option>
                  <option value="title">{t('knowledge.sortTitle')}</option>
                </select>
              </div>

              <div>
                <select
                  id="concept-group-by"
                  aria-label={t('knowledge.groupBy')}
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as ConceptGroupBy)}
                  className="min-h-11 rounded border bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="domain">{t('knowledge.groupByDomain')}</option>
                  <option value="tag">{t('knowledge.groupByTag')}</option>
                  <option value="none">{t('knowledge.groupByNone')}</option>
                </select>
              </div>

              <details className="w-full xl:relative xl:w-auto">
                <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-details-marker]:hidden">
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
                        onChange={(e) => setSelectedDomain(e.target.value)}
                        className="min-h-11 rounded border bg-white p-2 font-normal focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                        onChange={(e) => setSelectedStatus(e.target.value as CardStatus | 'all' | 'unstarted')}
                        className="min-h-11 rounded border bg-white p-2 font-normal focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                        onChange={(e) => setAddedDateRange(e.target.value as AddedDateRange)}
                        className="min-h-11 rounded border bg-white p-2 font-normal focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="all">{t('knowledge.allTime')}</option>
                        <option value="today">{t('knowledge.today')}</option>
                        <option value="week">{t('knowledge.pastDays', { days: 7 })}</option>
                        <option value="month">{t('knowledge.pastDays', { days: 30 })}</option>
                        <option value="quarter">{t('knowledge.pastDays', { days: 90 })}</option>
                        <option value="year">{t('knowledge.pastYear')}</option>
                      </select>
                    </label>

                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-gray-700" htmlFor="toggle-generated">
                      <input
                        id="toggle-generated"
                        type="checkbox"
                        checked={includeGenerated}
                        onChange={(e) => {
                          const next = e.target.checked;
                          if (next) {
                            void loadGenerated(generatedLimit);
                          } else {
                            setIncludeGenerated(false);
                            setGeneratedCards(null);
                            setGeneratedError(null);
                          }
                        }}
                      />
                      {t('knowledge.showGenerated')}
                    </label>

                    {includeGenerated ? (
                      <button
                        type="button"
                        onClick={() => void loadGenerated(Math.min(5000, generatedLimit + 250))}
                        disabled={loadingGenerated}
                        className="min-h-11 rounded-md border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        {loadingGenerated ? t('common.loading') : t('knowledge.loadMore')}
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
                        setGroupBy('domain');
                        setIncludeGenerated(false);
                        setGeneratedCards(null);
                        setGeneratedError(null);
                      }}
                      className="min-h-11 rounded border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {t('knowledge.resetAll')}
                    </button>
                  </div>
                </div>
              </details>
            </div>
          </div>

          {generatedError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {generatedError}
            </div>
          ) : null}

          {graphError ? (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {graphError}
            </div>
          ) : null}

          {/* Legend */}
          <div className="mb-6 flex flex-wrap gap-6 rounded-xl border bg-white px-4 py-3 text-xs">
            <div>
              <span className="mb-1.5 block font-semibold text-gray-500 uppercase tracking-wide">{t('common.status')}</span>
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-green-300 border border-green-400"></span>{t('common.canExplain')}</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-blue-300 border border-blue-400"></span>{t('common.unclear')}</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-gray-200 border border-gray-300"></span>{t('common.notStarted')}</span>
              </div>
            </div>
          </div>

          <div>
            {groupBy === 'tag' ? (
              <p className="mb-5 text-sm text-gray-600">{t('knowledge.tagGroupingHint')}</p>
            ) : null}

            {groupBy === 'none' ? (
              <ConceptCardGrid cards={visibleCardGroups[0]?.cards ?? []} testId="concept-grid" onSave={saveCard} />
            ) : (
              <div data-testid="concept-groups" className="space-y-10">
                {visibleCardGroups.map((group, index) => {
                  const heading = groupBy === 'domain'
                    ? formatDomainLabel(group.key)
                    : group.key === UNTAGGED_CONCEPT_GROUP_KEY
                      ? t('knowledge.untagged')
                      : `#${group.key}`;
                  const headingId = `concept-group-${index}`;

                  return (
                    <section
                      key={group.key}
                      data-testid="concept-group"
                      data-group-key={group.key}
                      aria-labelledby={headingId}
                    >
                      <div className="mb-4 flex items-center gap-2 border-b pb-2">
                        <h2 id={headingId} className="text-xl font-semibold text-gray-700">
                          {heading}
                        </h2>
                        <span
                          className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600"
                          aria-label={t('knowledge.groupCount', { count: groupCardCounts.get(group.key) ?? group.cards.length })}
                        >
                          {formatNumber(groupCardCounts.get(group.key) ?? group.cards.length)}
                        </span>
                      </div>
                      <ConceptCardGrid cards={group.cards} onSave={saveCard} />
                    </section>
                  );
                })}
              </div>
            )}

            {filteredCards.length === 0 && (
              <div className="text-center py-12 text-gray-600">
                {t('knowledge.noMatches')}
              </div>
            )}

            {filteredCards.length > visibleCardLimit || hasMoreCards ? (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMoreCards()}
                  disabled={loadingMoreCards}
                  className="min-h-11 rounded-md border bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                >
                  {loadingMoreCards ? t('common.loading') : t('knowledge.loadMore')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ConceptCardGrid({
  cards,
  testId,
  onSave,
}: {
  cards: MapCard[];
  testId?: string;
  onSave: (card: MapCard, values: EditableCardValues) => Promise<void>;
}) {
  return (
    <div data-testid={testId} className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <KnowledgeCardItem key={card.id} card={card} onSave={onSave} />
      ))}
    </div>
  );
}

function KnowledgeCardItem({
  card,
  onSave,
}: {
  card: MapCard;
  onSave: (card: MapCard, values: EditableCardValues) => Promise<void>;
}) {
  const levelMeta = getCardLevelMeta(card.level);
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorId = `concept-card-editor-${card.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  useEffect(() => {
    if (editing) titleInputRef.current?.focus();
  }, [editing]);

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values: EditableCardValues = {
      title: String(formData.get('title') ?? '').trim(),
      topic: String(formData.get('topic') ?? ''),
      summary: String(formData.get('summary') ?? ''),
      content: String(formData.get('content') ?? ''),
      tags: String(formData.get('tags') ?? ''),
    };

    if (!values.title) {
      setSaveError(t('knowledge.titleRequired'));
      return;
    }

    setSaveError(null);
    startSaving(async () => {
      try {
        await onSave(card, values);
        setEditing(false);
      } catch {
        setSaveError(t('knowledge.saveError'));
      }
    });
  };

  return (
    <div
      data-testid="concept-card"
      data-concept-id={card.id}
      className={`relative p-4 rounded-lg border shadow-sm transition-all hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 ${getStatusColor(card.status)}`}
    >
      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-expanded={false}
          aria-controls={editorId}
          aria-label={t('knowledge.editCardAria', { title: card.title })}
          className="absolute inset-0 z-0 rounded-lg focus:outline-none"
        />
      ) : null}
      <div className="relative z-10 pointer-events-none">
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
      </div>

      {card.wiki_url && (
        <a
          href={card.wiki_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 inline-flex min-h-11 min-w-11 items-center text-xs text-blue-700 transition-colors hover:text-blue-800 hover:underline"
        >
          {t('knowledge.wiki')}
        </a>
      )}
      {card.isPersonal && card.personalItemId ? (
        <form action={deleteKnowledgeItem} className="relative z-10 mt-3">
          <input type="hidden" name="id" value={card.personalItemId} />
          <ConfirmDeleteButton
            label={t('knowledge.moveTrash')}
            confirmMessage={t('knowledge.moveTrashConfirm', { title: card.title, days: 14 })}
            ariaLabel={t('knowledge.moveTrashAria', { title: card.title })}
            className="min-h-11 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          />
        </form>
      ) : null}
      {editing ? (
        <form
          id={editorId}
          data-testid="concept-card-editor"
          onSubmit={handleSubmit}
          className="relative z-10 mt-4 grid gap-3 border-t border-gray-200 pt-4"
        >
          <p className="text-xs leading-relaxed text-gray-600">
            {card.personalItemId ? t('knowledge.editPersonalHint') : t('knowledge.editCopyHint')}
          </p>
          <label className="grid gap-1 text-xs font-medium text-gray-700">
            {t('notes.titleLabel')}
            <input ref={titleInputRef} name="title" required defaultValue={card.title} className="min-h-11 rounded border bg-white px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-gray-700">
            {t('notes.newTopic')}
            <input name="topic" defaultValue={card.domains?.[0] ?? card.domain} className="min-h-11 rounded border bg-white px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-gray-700">
            {t('knowledge.summaryLabel')}
            <textarea name="summary" defaultValue={card.storedSummary ?? card.summary} maxLength={500} className="min-h-20 rounded border bg-white px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-gray-700">
            {t('notes.contentLabel')}
            <textarea name="content" defaultValue={card.explanation} className="min-h-28 rounded border bg-white px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-gray-700">
            {t('knowledge.tagsLabel')}
            <input name="tags" defaultValue={card.tags?.join(', ') ?? ''} maxLength={599} className="min-h-11 rounded border bg-white px-3 py-2 text-sm" />
          </label>
          {saveError ? <p role="alert" className="text-xs text-red-700">{saveError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-11 rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isSaving ? t('common.saving') : card.personalItemId ? t('notes.save') : t('knowledge.savePrivateCopy')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={isSaving}
              className="min-h-11 rounded border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
