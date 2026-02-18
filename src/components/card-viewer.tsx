'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KnowledgeCard, saveCardState, getNextCard, CardStatus } from '@/actions/card-actions';
import Card from './card';
import Link from 'next/link';

interface CardViewerProps {
  initialCard: KnowledgeCard | null;
}

const ACTION_LABELS: Record<CardStatus | 'skip', string> = {
  known: 'Marked as known ✓',
  saved: 'Saved for review ✓',
  unknown: 'Marked as unknown',
  skip: 'Skipped',
};

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
    setHistory(prev => [...prev, card]);

    try {
      const saveResult = await saveCardState(card.id, status);
      if (!saveResult.success) {
        setError('Could not save your answer. Please try again.');
        return;
      }

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
    setHistory(prev => prev.slice(0, -1));
    setCard(previousCard);
    setLastAction(null);
  }, [history]);

  const handleSkip = useCallback(async () => {
    if (!card) return;
    setLoading(true);
    setError(null);
    setHistory(prev => [...prev, card]);

    try {
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
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

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
      <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto">
        <div className="mb-4 text-5xl" aria-hidden="true">🎉</div>
        <p className="text-xl font-semibold text-gray-800">All caught up!</p>
        <p className="text-gray-500 mt-2 text-sm">
          You reviewed {reviewedCount} card{reviewedCount !== 1 ? 's' : ''} this session. Check back later for new ones.
        </p>
        <div className="mt-6 flex gap-2 flex-wrap justify-center">
          <Link
            href="/saved"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Review saved concepts
          </Link>
          <Link
            href="/knowledge"
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Explore knowledge graph
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <div className="w-full flex justify-between items-center mb-4">
        <button
          onClick={handlePrevious}
          disabled={history.length === 0}
          aria-label="Go to previous card"
          className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 flex items-center gap-1 transition-colors rounded-md px-2 py-1 hover:bg-gray-100 disabled:pointer-events-none"
        >
          ← Previous
        </button>
        <span className="text-xs text-gray-400" aria-live="polite" aria-atomic="true">
          {reviewedCount > 0 ? `${reviewedCount} reviewed` : 'Session started'}
        </span>
        <button
          onClick={handleSkip}
          disabled={loading}
          aria-label="Skip to next card"
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors rounded-md px-2 py-1 hover:bg-gray-100 disabled:opacity-50"
        >
          Skip →
        </button>
      </div>

      <Card key={card.id} card={card} />

      <div aria-live="polite" aria-atomic="true" className="mt-3 min-h-[1.25rem] text-center">
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : loading ? (
          <p className="text-xs text-gray-400 animate-pulse">Loading…</p>
        ) : lastAction ? (
          <p className="text-xs text-gray-500">{ACTION_LABELS[lastAction]}</p>
        ) : null}
      </div>

      <div className="flex w-full gap-3 mt-4" role="group" aria-label="Rate this card">
        <button
          onClick={() => handleAction('known')}
          disabled={loading}
          aria-label="Mark as known (shortcut: 1)"
          className="flex-1 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium rounded-lg transition-colors disabled:opacity-50 border border-emerald-200"
        >
          Known <kbd className="ml-1 text-xs font-mono opacity-60">1</kbd>
        </button>
        <button
          onClick={() => handleAction('saved')}
          disabled={loading}
          aria-label="Save for later review (shortcut: 2)"
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Save <kbd className="ml-1 text-xs font-mono opacity-60">2</kbd>
        </button>
        <button
          onClick={() => handleAction('unknown')}
          disabled={loading}
          aria-label="Mark as unknown (shortcut: 3)"
          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors disabled:opacity-50 border border-slate-200"
        >
          Unknown <kbd className="ml-1 text-xs font-mono opacity-60">3</kbd>
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-400 text-center">
        Keyboard: <kbd className="font-mono">1</kbd> known · <kbd className="font-mono">2</kbd> save · <kbd className="font-mono">3</kbd> unknown · <kbd className="font-mono">←</kbd> back · <kbd className="font-mono">→</kbd> skip
      </p>
    </div>
  );
}
