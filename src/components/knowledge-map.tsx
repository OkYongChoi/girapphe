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
  const [viewMode, setViewMode] = useState<'grid' | 'graph'>('grid');

  // Group cards by domain
  const domains = Array.from(new Set(initialCards.map(c => c.domain)));
  
  const filteredCards = initialCards.filter(card => {
    const matchesFilter = card.title.toLowerCase().includes(filter.toLowerCase()) || 
                          card.summary.toLowerCase().includes(filter.toLowerCase());
    const matchesDomain = selectedDomain === 'all' || card.domain === selectedDomain;
    return matchesFilter && matchesDomain;
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
            <h1 className="text-3xl font-bold dark:text-white">Knowledge Map</h1>
            
            <div className="flex gap-4 w-full md:w-auto items-center">
              <button 
                  onClick={() => setViewMode('graph')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow font-medium transition-colors"
              >
                  3D Graph View
              </button>
              
              <select 
                value={selectedDomain} 
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="p-2 border rounded dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All Domains</option>
                {domains.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              
              <input 
                type="text" 
                placeholder="Search concepts..." 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="p-2 border rounded flex-grow dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-12">
            {Object.keys(cardsByDomain).sort().map(domain => (
              <div key={domain} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-semibold mb-4 capitalize text-gray-700 dark:text-gray-300 border-b pb-2">
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
      case 'known': return 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700';
      case 'saved': return 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700';
      case 'unknown': return 'bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700';
      default: return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
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
        <span className={`text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/30`}>
          {getStatusLabel(card.status)}
        </span>
      </div>
      <h3 className="font-bold text-lg mb-1 leading-tight dark:text-white">{card.title}</h3>
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
