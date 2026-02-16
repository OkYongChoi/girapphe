'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KnowledgeCard, saveCardState, getNextCard, CardStatus } from '@/actions/card-actions';
import Card from './card';

interface CardViewerProps {
  initialCard: KnowledgeCard | null;
}

export default function CardViewer({ initialCard }: CardViewerProps) {
  const [card, setCard] = useState<KnowledgeCard | null>(initialCard);
  const [history, setHistory] = useState<KnowledgeCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<CardStatus | 'skip' | null>(null);

  const reviewedCount = useMemo(() => history.length, [history.length]);

  const handleAction = useCallback(async (status: CardStatus) => {
    if (!card) return;

    setLoading(true);
    setError(null);

    // Push current to history before moving
    setHistory(prev => [...prev, card]);

    try {
      // 1. Save state
      const saveResult = await saveCardState(card.id, status);
      if (!saveResult.success) {
        setError('Could not save your answer. Please try again.');
        return;
      }

      // 2. Load next card
      const next = await getNextCard();
      setCard(next);
      setLastAction(status);
    } catch (e) {
      console.error('handleAction failed:', e);
      setError('Something went wrong while loading the next card.');
    } finally {
      setLoading(false);
    }
  }, [card]);

  const handlePrevious = useCallback(() => {
    if (history.length === 0) return;
    
    const previousCard = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1)); // Pop from history
    setCard(previousCard);
  }, [history]);

  const handleSkip = useCallback(async () => {
    if (!card) return;
    setLoading(true);
    setError(null);

    // Push to history so we can go back
    setHistory(prev => [...prev, card]);

    try {
      // Load next without saving state
      const next = await getNextCard();
      setCard(next);
      setLastAction('skip');
    } catch (e) {
      console.error('handleSkip failed:', e);
      setError('Could not load the next card.');
    } finally {
      setLoading(false);
    }
  }, [card]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (loading || !card) return;
      if (event.key === '1') void handleAction('known');
      if (event.key === '2') void handleAction('saved');
      if (event.key === '3') void handleAction('unknown');
      if (event.key === 'ArrowRight') void handleSkip();
      if (event.key === 'ArrowLeft') handlePrevious();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, card, handleAction, handleSkip, handlePrevious]);

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-xl font-medium text-gray-500">No more cards for now!</p>
        <p className="text-gray-400 mt-2">Great job. Check back later.</p>
        <p className="text-xs text-gray-400 mt-3">Session reviewed: {reviewedCount}</p>
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
           Reviewed {reviewedCount}
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
          Known (1)
        </button>
        <button
          onClick={() => handleAction('saved')} // saved = "Want to learn"
          disabled={loading}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Save (2)
        </button>
        <button
          onClick={() => handleAction('unknown')}
          disabled={loading}
          className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Unknown (3)
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-400">Shortcuts: 1 known, 2 save, 3 unknown, ← previous, → next</p>
      {lastAction ? (
        <p className="mt-2 text-xs text-green-700">
          Last action: {lastAction === 'skip' ? 'Skipped' : lastAction}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {loading && <p className="mt-4 text-sm text-gray-400 animate-pulse">Loading next...</p>}
    </div>
  );
}
