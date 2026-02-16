'use client';

import { useState } from 'react';
import type { KnowledgeCard, CardStatus } from '@/actions/card-actions';
import KnowledgeGraph3D from './knowledge-graph-3d';

type Props = {
  initialCards: (KnowledgeCard & { status: CardStatus | null })[];
};

export default function KnowledgeMap({ initialCards }: Props) {
  const [filter, setFilter] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<CardStatus | 'all' | 'unstarted'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'graph'>('grid');

  // Group cards by domain
  const domains = Array.from(new Set(initialCards.map(c => c.domain)));
  
  const filteredCards = initialCards.filter(card => {
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
        <KnowledgeGraph3D cards={initialCards} onClose={() => setViewMode('grid')} />
      ) : (
        <div className="w-full max-w-6xl mx-auto p-6">
          <div className="mb-8 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Knowledge Map</h1>
              <p className="mt-1 text-sm text-gray-500">
                Showing {filteredCards.length} of {initialCards.length} concepts
              </p>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto items-center">
              <button 
                  onClick={() => setViewMode('graph')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow font-medium transition-colors"
              >
                  3D Graph View
              </button>
              
              <select 
                value={selectedDomain} 
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="p-2 border rounded bg-white"
              >
                <option value="all">All Domains</option>
                {domains.map(d => (
                  <option key={d} value={d}>{d}</option>
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
            </div>
          </div>

          <div className="space-y-12">
            {Object.keys(cardsByDomain).sort().map(domain => (
              <div key={domain} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-semibold mb-4 capitalize text-gray-700 border-b pb-2">
                  {domain}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {cardsByDomain[domain].map(card => (
                    <KnowledgeCardItem key={card.id} card={card} />
                  ))}
                </div>
              </div>
            ))}

            {filteredCards.length === 0 && (
              <div className="text-center py-12 text-gray-500">
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
  const getStatusColor = (status: CardStatus | null) => {
    switch (status) {
      case 'known': return 'bg-green-100 border-green-300';
      case 'saved': return 'bg-blue-100 border-blue-300';
      case 'unknown': return 'bg-red-100 border-red-300';
      default: return 'bg-gray-100 border-gray-200';
    }
  };

  const getStatusLabel = (status: CardStatus | null) => {
    switch (status) {
      case 'known': return 'Known';
      case 'saved': return 'Saved';
      case 'unknown': return 'To Review';
      default: return 'Not Started';
    }
  };

  return (
    <div className={`p-4 rounded-lg border shadow-sm transition-all hover:shadow-md ${getStatusColor(card.status)}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs uppercase tracking-wider opacity-70 font-semibold">
          {card.level}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full bg-white/60`}>
          {getStatusLabel(card.status)}
        </span>
      </div>
      <h3 className="font-bold text-lg mb-1 leading-tight text-gray-900">{card.title}</h3>
      <p className="text-sm opacity-80 line-clamp-2 mb-3">{card.summary}</p>
      
      {card.wiki_url && (
        <a 
          href={card.wiki_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs hover:underline opacity-60 hover:opacity-100 transition-opacity"
        >
          Wiki &rarr;
        </a>
      )}
    </div>
  );
}
