'use client';

import { useMemo, useState } from 'react';
import { getAllCardsWithStatus, type KnowledgeCard, type CardStatus } from '@/actions/card-actions';
import KnowledgeGraph3D from './knowledge-graph-3d';
import { getCardLevelMeta } from '@/lib/card-level';
import { formatDomainLabel } from '@/lib/domain-label';

type Props = {
  initialCards: (KnowledgeCard & { status: CardStatus | null })[];
};

export default function KnowledgeMap({ initialCards }: Props) {
  const [filter, setFilter] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<CardStatus | 'all' | 'unstarted'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'graph'>('graph');
  const [includeGenerated, setIncludeGenerated] = useState(false);
  const [generatedLimit, setGeneratedLimit] = useState(250);
  const [generatedCards, setGeneratedCards] = useState<(KnowledgeCard & { status: CardStatus | null })[] | null>(null);
  const [loadingGenerated, setLoadingGenerated] = useState(false);
  const [generatedError, setGeneratedError] = useState<string | null>(null);

  const cards = includeGenerated ? (generatedCards ?? initialCards) : initialCards;

  // Group cards by domain
  const domains = useMemo(() => Array.from(new Set(cards.map(c => c.domain))), [cards]);

  const coreCardCount = useMemo(() => cards.filter((c) => !c.id.startsWith('drill_')).length, [cards]);
  const generatedCardCount = useMemo(() => cards.filter((c) => c.id.startsWith('drill_')).length, [cards]);

  const loadGenerated = async (nextLimit: number) => {
    setIncludeGenerated(true);
    setGeneratedLimit(nextLimit);
    setLoadingGenerated(true);
    setGeneratedError(null);
    try {
      const next = await getAllCardsWithStatus({ includeGenerated: true, generatedLimit: nextLimit });
      setGeneratedCards(next);
    } catch {
      setGeneratedError('Could not load generated cards.');
    } finally {
      setLoadingGenerated(false);
    }
  };

  const filteredCards = cards.filter(card => {
    const matchesFilter = card.title.toLowerCase().includes(filter.toLowerCase()) || 
                          card.summary.toLowerCase().includes(filter.toLowerCase());
    const matchesDomain = selectedDomain === 'all' || card.domain === selectedDomain;
    const matchesStatus =
      selectedStatus === 'all'
        ? true
        : selectedStatus === 'unstarted'
          ? card.status === null
          : card.status === selectedStatus;
    return matchesFilter && matchesDomain && matchesStatus;
  });

  const cardsByDomain = filteredCards.reduce((acc, card) => {
    if (!acc[card.domain]) {
      acc[card.domain] = [];
    }
    acc[card.domain].push(card);
    return acc;
  }, {} as Record<string, typeof initialCards>);


  return (
    <div className="w-full h-full">
      {viewMode === 'graph' ? (
        <KnowledgeGraph3D cards={cards} onClose={() => setViewMode('grid')} />
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
              </p>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto items-center">
              <button 
                  onClick={() => setViewMode('graph')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow font-medium transition-colors"
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
                className="p-2 border rounded bg-white"
              >
                <option value="all">All Domains</option>
                {domains.map(d => (
                  <option key={d} value={d}>{formatDomainLabel(d)}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as CardStatus | 'all' | 'unstarted')}
                className="p-2 border rounded bg-white"
              >
                <option value="all">All Status</option>
                <option value="known">Known</option>
                <option value="saved">Saved</option>
                <option value="unknown">Unknown</option>
                <option value="unstarted">Not Started</option>
              </select>
              
              <input 
                type="text" 
                placeholder="Search concepts..." 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="p-2 border rounded flex-grow bg-white"
              />
              <button
                type="button"
                onClick={() => {
                  setFilter('');
                  setSelectedDomain('all');
                  setSelectedStatus('all');
                }}
                className="p-2 border rounded bg-white text-sm hover:bg-gray-50"
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

function KnowledgeCardItem({ card }: { card: KnowledgeCard & { status: CardStatus | null } }) {
  const levelMeta = getCardLevelMeta(card.level);

  const getStatusColor = (status: CardStatus | null) => {
    switch (status) {
      case 'known': return 'bg-green-100 border-green-300';
      case 'saved': return 'bg-blue-100 border-blue-300';
      default: return 'bg-gray-100 border-gray-200';
    }
  };

  const getStatusLabel = (status: CardStatus | null) => {
    switch (status) {
      case 'known': return 'Known';
      case 'saved': return 'Saved';
      default: return 'Not Started';
    }
  };

  return (
    <div className={`p-4 rounded-lg border shadow-sm transition-all hover:shadow-md ${getStatusColor(card.status)}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs tracking-wider text-gray-700 font-semibold">
          Difficulty {levelMeta.rank} · {levelMeta.label}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full bg-white/80 text-gray-700`}>
          {getStatusLabel(card.status)}
        </span>
      </div>
      <h3 className="font-bold text-lg mb-1 leading-tight text-gray-900">{card.title}</h3>
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
    </div>
  );
}
