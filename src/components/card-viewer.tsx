'use client';

import { useState } from 'react';
import { KnowledgeCard, saveCardState, getNextCard, CardStatus } from '@/actions/card-actions';
import Card from './card';

interface CardViewerProps {
  initialCard: KnowledgeCard | null;
}

export default function CardViewer({ initialCard }: CardViewerProps) {
  const [card, setCard] = useState<KnowledgeCard | null>(initialCard);
  const [history, setHistory] = useState<KnowledgeCard[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAction = async (status: CardStatus) => {
    if (!card) return;
    
    setLoading(true);
    
    // Push current to history before moving
    setHistory(prev => [...prev, card]);

    // 1. Save state
    await saveCardState(card.id, status);
    
    // 2. Load next card
    const next = await getNextCard();
    setCard(next);
    
    setLoading(false);
  };

  const handlePrevious = () => {
    if (history.length === 0) return;
    
    const previousCard = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1)); // Pop from history
    setCard(previousCard);
  };

  const handleSkip = async () => {
    if (!card) return;
    setLoading(true);
    
    // Push to history so we can go back
    setHistory(prev => [...prev, card]);
    
    // Load next without saving state
    const next = await getNextCard();
    setCard(next);
    setLoading(false);
  };

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-xl font-medium text-gray-500">No more cards for now!</p>
        <p className="text-gray-400 mt-2">Great job. Check back later.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      {/* Navigation Controls (Top) */}
      <div className="w-full flex justify-between items-center mb-4">
         <button 
           onClick={handlePrevious} 
           disabled={history.length === 0}
           className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30 flex items-center gap-1 transition-colors"
         >
           &larr; Previous
         </button>
         <span className="text-xs text-gray-400 font-mono">
           Stream
         </span>
         <button 
           onClick={handleSkip}
           disabled={loading}
           className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
         >
           Next &rarr;
         </button>
      </div>

      <Card card={card} />
      
      <div className="flex w-full gap-3 mt-8">
        <button
          onClick={() => handleAction('known')}
          disabled={loading}
          className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Known
        </button>
        <button
          onClick={() => handleAction('saved')} // saved = "Want to learn"
          disabled={loading}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => handleAction('unknown')}
          disabled={loading}
          className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Unknown
        </button>
      </div>
      
      {loading && <p className="mt-4 text-sm text-gray-400 animate-pulse">Loading next...</p>}
    </div>
  );
}
