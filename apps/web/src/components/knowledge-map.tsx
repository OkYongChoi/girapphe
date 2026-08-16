'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAllCardsWithStatus, type KnowledgeCard, type CardStatus, type KnowledgeMapEdge } from '@/actions/card-actions';
import KnowledgeGraph3D from './knowledge-graph-3d';
import type { KnowledgeGraphEdgeView } from './knowledge-graph-3d';
import { getCardLevelMeta } from '@stem-brain/graph-engine';
import { formatDomainLabel } from '@stem-brain/graph-engine';
import { getCardStatusShortLabel } from '@/lib/card-status';
import { deleteKnowledgeItem, type UserKnowledgeItem } from '@/actions/user-knowledge-actions';
import ConfirmDeleteButton from '@/components/confirm-delete-button';
import type { KnowledgeLinkTarget } from '@/actions/knowledge-ingestion-actions';
import type { Locale } from '@stem-brain/shared';

type MapCard = KnowledgeCard & {
  status: CardStatus | null;
  isPersonal?: boolean;
  personalItemId?: string;
  createdAt?: string;
  tags?: string[];
};

type Props = {
  initialCards: (KnowledgeCard & { status: CardStatus | null })[];
  personalItems?: UserKnowledgeItem[];
  publicEdges?: KnowledgeMapEdge[];
  privateGraph?: {
    nodes?: unknown[];
    edges?: unknown[];
  } | null;
  graphLinkTargets?: KnowledgeLinkTarget[];
  isGuest?: boolean;
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

function getCardDomains(card: KnowledgeCard) {
  const domains = card.domains && card.domains.length > 0 ? card.domains : [card.domain];
  return Array.from(new Set(domains.filter(Boolean)));
}

function getSearchTerms(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/^#/, ''))
    .filter(Boolean);
}

function fallbackEndpointLabel(id: string) {
  const raw = id.replace(/^graph_/, '').replace(/^personal:/, '');
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(raw)) return `Linked concept ${raw.slice(0, 8)}`;
  const readable = raw.replace(/[_-]+/g, ' ').trim();
  return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : 'Linked concept';
}

export default function KnowledgeMap({
  initialCards,
  personalItems = [],
  publicEdges = [],
  privateGraph = null,
  graphLinkTargets = [],
  isGuest = false,
  locale,
}: Props) {
  const [baseCards, setBaseCards] = useState(initialCards);
  const [filter, setFilter] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<CardStatus | 'all' | 'unstarted'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'graph'>('graph');
  const [includeGenerated, setIncludeGenerated] = useState(false);
  const [generatedLimit, setGeneratedLimit] = useState(250);
  const [generatedCards, setGeneratedCards] = useState<(KnowledgeCard & { status: CardStatus | null })[] | null>(null);
  const [loadingGenerated, setLoadingGenerated] = useState(false);
  const [generatedError, setGeneratedError] = useState<string | null>(null);

  useEffect(() => {
    if (isGuest) return;

    let active = true;

    getAllCardsWithStatus({ locale })
      .then((freshCards) => {
        if (active) setBaseCards(freshCards);
      })
      .catch(() => {
        // Keep server-rendered cards if the refresh fails.
      });

    return () => {
      active = false;
    };
  }, [isGuest, locale]);

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

    return [{
      id,
      personalItemId: personalItemId || undefined,
      isPersonal: true,
      title: personalItem?.title || readString(record, 'title', 'label') || 'Private concept',
      summary: personalItem?.summary || personalItem?.content || readString(record, 'summary', 'content') || 'Private personal card',
      explanation: personalItem?.content || readString(record, 'explanation', 'content'),
      wiki_url: '',
      domain: topic,
      domains: [topic],
      tags: personalItem?.tags ?? tags,
      level: 'understand' as const,
      status: null,
      createdAt: readString(record, 'created_at'),
    }];
  }), [personalItemById, privateGraph?.nodes]);

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
    summary: item.summary || item.content || 'Private personal card',
    explanation: item.content,
    wiki_url: '',
    domain: 'personal',
    domains: [item.topic || 'personal'],
    tags: item.tags,
    level: 'understand',
    status: null,
    createdAt: item.created_at,
  })), [graphPersonalItemIds, personalItems]);
  const personalCards = useMemo<MapCard[]>(
    () => [...graphPrivateCards, ...legacyPersonalCards],
    [graphPrivateCards, legacyPersonalCards]
  );
  const publicCards = useMemo(
    () => includeGenerated ? (generatedCards ?? baseCards) : baseCards,
    [baseCards, generatedCards, includeGenerated]
  );
  const cards = useMemo<MapCard[]>(() => [...publicCards, ...personalCards], [publicCards, personalCards]);
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
    const visibleIds = new Set(cards.map((card) => card.id));
    const targetById = new Map(graphLinkTargets.map((target) => [target.id, target]));
    // Public card limits remain intentional (especially for guests). Only
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
      endpointCards.push({
        id,
        isPersonal: target?.scope === 'private' || id.startsWith('personal:'),
        title: target?.label || fallbackEndpointLabel(id),
        summary: 'Included because this concept is the endpoint of a saved graph relationship.',
        explanation: '',
        wiki_url: '',
        domain: topic,
        domains: [topic],
        tags: [],
        level: 'understand',
        status: null,
      });
    }

    return [...cards, ...endpointCards];
  }, [cards, graphEdges, graphLinkTargets]);

  // Cards can live in multiple taxonomy domains.
  const domains = useMemo(
    () => Array.from(new Set(cards.flatMap(getCardDomains))).sort(),
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
      setGeneratedError('Could not load generated cards.');
    } finally {
      setLoadingGenerated(false);
    }
  };

  const filteredCards = cards.filter(card => {
    const searchableText = [card.id, card.title, card.summary, card.explanation, ...getCardDomains(card), ...(card.tags ?? [])]
      .join(' ')
      .toLowerCase();
    const matchesFilter = getSearchTerms(filter).every((term) => searchableText.includes(term));
    const matchesDomain = selectedDomain === 'all' || getCardDomains(card).includes(selectedDomain);
    const matchesStatus =
      selectedStatus === 'all'
        ? true
        : selectedStatus === 'unstarted'
          ? card.status === null
          : card.status === selectedStatus;
    return matchesFilter && matchesDomain && matchesStatus;
  });

  const cardsByDomain = filteredCards.reduce((acc, card) => {
    const groupingDomains = selectedDomain === 'all' ? getCardDomains(card) : [selectedDomain];
    for (const domain of groupingDomains) {
      if (!acc[domain]) {
        acc[domain] = [];
      }
      acc[domain].push(card);
    }
    return acc;
  }, {} as Record<string, typeof initialCards>);

  return (
    <div className="w-full h-full">
      {viewMode === 'graph' ? (
        <KnowledgeGraph3D cards={graphCards} edges={graphEdges} onClose={() => setViewMode('grid')} />
      ) : (
        <div className="w-full max-w-6xl mx-auto p-6">
          <div className="mb-8 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Knowledge Map</h1>
              <p className="mt-1 text-sm text-gray-600">
                Showing {filteredCards.length} of {cards.length} concepts
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Core: {coreCardCount} · Generated: {generatedCardCount}{includeGenerated ? ` (showing up to ${generatedLimit})` : ' (hidden)'}
                {personalCards.length > 0 ? ` · Private: ${personalCards.length}` : ''}
              </p>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto items-center">
              <button 
                  onClick={() => setViewMode('graph')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                  3D Graph View
              </button>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 select-none" htmlFor="toggle-generated">
                  Show generated
                </label>
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
              </div>

              {includeGenerated ? (
                <button
                  type="button"
                  onClick={() => void loadGenerated(Math.min(5000, generatedLimit + 250))}
                  disabled={loadingGenerated}
                  className="rounded-md border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {loadingGenerated ? 'Loading…' : 'Load more'}
                </button>
              ) : null}

              <select 
                value={selectedDomain} 
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="p-2 border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">All Domains</option>
                {domains.map(d => (
                  <option key={d} value={d}>{formatDomainLabel(d)}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as CardStatus | 'all' | 'unstarted')}
                className="p-2 border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">All Status</option>
                <option value="known">Can Explain</option>
                <option value="saved">Unclear</option>
                <option value="unstarted">Not Started</option>
              </select>
              
              <input 
                type="text" 
                placeholder="Search concepts, terms, or #tags..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="p-2 border rounded flex-grow bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={() => {
                  setFilter('');
                  setSelectedDomain('all');
                  setSelectedStatus('all');
                }}
                className="p-2 border rounded bg-white text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                Reset
              </button>
            </div>
          </div>

          {generatedError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {generatedError}
            </div>
          ) : null}

          {/* Legend */}
          <div className="mb-6 flex flex-wrap gap-6 rounded-xl border bg-white px-4 py-3 text-xs">
            <div>
              <span className="mb-1.5 block font-semibold text-gray-500 uppercase tracking-wide">Status</span>
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-green-300 border border-green-400"></span>Can Explain</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-blue-300 border border-blue-400"></span>Unclear</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-gray-200 border border-gray-300"></span>Not Started</span>
              </div>
            </div>
          </div>

          <div className="space-y-12">
            {Object.keys(cardsByDomain).sort().map(domain => (
              <div key={domain} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-semibold mb-4 capitalize text-gray-700 border-b pb-2">
                  {formatDomainLabel(domain)}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {cardsByDomain[domain].map(card => (
                    <KnowledgeCardItem key={card.id} card={card} />
                  ))}
                </div>
              </div>
            ))}

            {filteredCards.length === 0 && (
              <div className="text-center py-12 text-gray-600">
                No concepts found matching your criteria.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeCardItem({ card }: { card: MapCard }) {
  const levelMeta = getCardLevelMeta(card.level);

  const getStatusColor = (status: CardStatus | null) => {
    switch (status) {
      case 'known': return 'bg-green-100 border-green-300';
      case 'saved': return 'bg-blue-100 border-blue-300';
      default: return 'bg-gray-100 border-gray-200';
    }
  };

  const getStatusLabel = (status: CardStatus | null) => {
    return getCardStatusShortLabel(status);
  };

  return (
    <div className={`p-4 rounded-lg border shadow-sm transition-all hover:shadow-md ${getStatusColor(card.status)}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs tracking-wider text-gray-700 font-semibold">
          {card.isPersonal ? 'Private card' : `Difficulty ${levelMeta.rank} · ${levelMeta.label}`}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full bg-white/80 text-gray-700`}>
          {getStatusLabel(card.status)}
        </span>
      </div>
      <h3 className="font-bold text-lg mb-1 leading-tight text-gray-900">{card.title}</h3>
      {card.isPersonal && card.createdAt ? <p className="mb-2 text-xs text-gray-500">Added {new Date(card.createdAt).toLocaleDateString()}</p> : null}
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
      
      {card.wiki_url && (
        <a 
          href={card.wiki_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-blue-700 hover:text-blue-800 hover:underline transition-colors"
        >
          Wiki &rarr;
        </a>
      )}
      {card.isPersonal && card.personalItemId ? (
        <form action={deleteKnowledgeItem} className="mt-3">
          <input type="hidden" name="id" value={card.personalItemId} />
          <ConfirmDeleteButton
            label="Move to trash"
            confirmMessage={`Move "${card.title}" to trash? You can restore it for 14 days.`}
            ariaLabel={`Move ${card.title} to trash`}
            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          />
        </form>
      ) : null}
    </div>
  );
}
