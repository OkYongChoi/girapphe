'use client';

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { KnowledgeCard, saveCardState, getNextCard, CardStatus, getUserStats } from '@/actions/card-actions';
import Card from './card';
import Link from 'next/link';

interface CardViewerProps {
  initialCard: KnowledgeCard | null;
  initialStats: { known: number; saved: number; unknown: number };
  mode: 'new' | 'review';
}

export default function CardViewer({ initialCard, initialStats, mode }: CardViewerProps) {
  const [card, setCard] = useState<KnowledgeCard | null>(initialCard);
  const [history, setHistory] = useState<KnowledgeCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState(initialStats);
  // cards skipped this round — cleared once all remaining unrated cards are also skipped
  const skippedIds = useRef<Set<string>>(new Set());
  // cards rated this round — excluded when fetching next card, cleared when all cards cycled
  const ratedIds = useRef<Set<string>>(new Set());

  const reviewedCount = useMemo(() => new Set(history.map(c => c.id)).size, [history]);
  const total = stats.known + stats.saved + stats.unknown;
  const knownPercent = total > 0 ? Math.round((stats.known / total) * 100) : 0;

  const handleAction = useCallback(async (status: CardStatus) => {
    if (!card || loading) return;
    setLoading(true);
    setError(null);
    setHistory(prev => [...prev, card]);
    const wasSkipped = skippedIds.current.has(card.id);
    skippedIds.current.delete(card.id); // rated → no longer needs cycling back

    try {
      const saveResult = await saveCardState(card.id, status);
      if (!saveResult.success) {
        setError('Could not save. Please try again.');
        setHistory(prev => prev.slice(0, -1));
        if (wasSkipped) skippedIds.current.add(card.id); // restore skip state
        return;
      }
      // Accumulate rated cards so they don't reappear until the full pool is cycled through
      ratedIds.current.add(card.id);
      const getNext = async () => {
        let next = await getNextCard(mode, [...ratedIds.current]);
        if (!next) {
          // All available cards have been rated this round → reset and cycle again
          ratedIds.current.clear();
          next = await getNextCard(mode);
        }
        return next;
      };
      const fetchWithRetry = async () => {
        try { return await getNext(); }
        catch { await new Promise(r => setTimeout(r, 600)); return getNext(); }
      };
      const [next, newStats] = await Promise.all([fetchWithRetry(), getUserStats()]);
      setCard(next);
      setStats(newStats);
    } catch (e) {
      console.error('handleAction failed:', e);
      setError('Something went wrong.');
      setHistory(prev => prev.slice(0, -1));
      ratedIds.current.delete(card.id); // restore on failure
      if (wasSkipped) skippedIds.current.add(card.id); // restore skip state
    } finally {
      setLoading(false);
    }
  }, [card, loading, mode]);

  const handlePrevious = useCallback(() => {
    if (history.length === 0) return;
    const previousCard = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCard(previousCard);
    setError(null);
  }, [history]);

  const handleSkip = useCallback(async () => {
    if (!card || loading) return;
    setLoading(true);
    setError(null);
    setHistory(prev => [...prev, card]);
    skippedIds.current.add(card.id);

    try {
      // Prefer cards not yet skipped this round; auto-retry once on transient failure
      let next: KnowledgeCard | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          next = await getNextCard(mode, [...skippedIds.current]);
          break;
        } catch {
          if (attempt === 1) throw new Error('retry_exhausted');
          await new Promise(r => setTimeout(r, 600));
        }
      }

      if (!next) {
        // Every remaining card has been skipped → full cycle reset, no exclusions
        skippedIds.current.clear();
        next = await getNextCard(mode);
      }

      setCard(next);
    } catch (e) {
      console.error('handleSkip failed:', e);
      setError('Could not load the next card.');
      setHistory(prev => prev.slice(0, -1));
      skippedIds.current.delete(card.id);
    } finally {
      setLoading(false);
    }
  }, [card, loading, mode]);

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

  // ── All done ─────────────────────────────────────────────────
  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center max-w-sm mx-auto bg-white border border-gray-100 rounded-2xl shadow-sm mt-4">
        <div className="mb-4 text-5xl" aria-hidden="true">🎉</div>
        <p className="text-xl font-bold text-gray-900">
          {mode === 'review' ? "You're all caught up on saved items!" : "All caught up on new cards!"}
        </p>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          You reviewed {reviewedCount} card{reviewedCount !== 1 ? 's' : ''} this session.
        </p>

        <div className="mt-6 w-full grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 py-3">
            <span className="block text-2xl font-bold text-emerald-700">{stats.known}</span>
            <span className="text-xs text-emerald-600">Known</span>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 py-3">
            <span className="block text-2xl font-bold text-blue-600">{stats.saved}</span>
            <span className="text-xs text-blue-500">Saved</span>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 py-3">
            <span className="block text-2xl font-bold text-slate-500">{stats.unknown}</span>
            <span className="text-xs text-slate-400">Again</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 w-full">
          <Link
            href="/practice?mode=review"
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors text-center"
          >
            Practice saved & again cards
          </Link>
          <Link
            href="/saved"
            className="w-full rounded-xl border px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-center"
          >
            View saved list
          </Link>
          <Link
            href="/knowledge"
            className="w-full rounded-xl border px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-center"
          >
            Explore knowledge graph
          </Link>
        </div>
      </div>
    );
  }

  // ── Active card ──────────────────────────────────────────────
  return (
    <div className="flex flex-col w-full max-w-md mx-auto">

      {/* Progress bar + stats */}
      <div className="mb-4 rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="text-emerald-600">✓ {stats.known}</span>
            <span className="text-blue-500">🔖 {stats.saved}</span>
            <span className="text-slate-400">↩ {stats.unknown}</span>
          </div>
          <span className="text-xs text-gray-400" aria-live="polite">
            {reviewedCount > 0 ? `${reviewedCount} reviewed` : 'Start reviewing'}
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-label={`${knownPercent}% known`}
          aria-valuenow={knownPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${knownPercent}%` }}
          />
        </div>
      </div>

      {/* Prev / Skip nav */}
      <div className="flex justify-between items-center mb-3">
        <button
          onClick={handlePrevious}
          disabled={history.length === 0 || loading}
          aria-label="Go to previous card"
          className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30 flex items-center gap-1 transition-colors rounded-lg px-2 py-1 hover:bg-gray-100 disabled:pointer-events-none"
        >
          ← Prev
        </button>
        <button
          onClick={handleSkip}
          disabled={loading}
          aria-label="Skip this card"
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-50"
        >
          {loading ? '…' : 'Skip →'}
        </button>
      </div>

      {/* Card */}
      <Card key={card.id} card={card} interactiveQuizMode={false} />

      {/* Error / loading feedback */}
      <div aria-live="polite" aria-atomic="true" className="mt-2 min-h-[1rem] text-center">
        {error && <p className="text-xs text-red-500">{error}</p>}
        {loading && !error && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex w-full gap-2" role="group" aria-label="Rate this card">
        <button
          onClick={() => void handleAction('unknown')}
          disabled={loading}
          aria-label="Again — mark as unknown (shortcut: 3)"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold rounded-2xl transition-colors disabled:opacity-50 border border-slate-200 active:scale-95"
        >
          <span className="text-lg">↩</span>
          <span className="text-xs">Again</span>
        </button>
        <button
          onClick={() => void handleAction('saved')}
          disabled={loading}
          aria-label="Save for later (shortcut: 2)"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-2xl transition-colors disabled:opacity-50 border border-blue-200 active:scale-95"
        >
          <span className="text-lg">🔖</span>
          <span className="text-xs">Save</span>
        </button>
        <button
          onClick={() => void handleAction('known')}
          disabled={loading}
          aria-label="Mark as known (shortcut: 1)"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-2xl transition-colors disabled:opacity-50 border border-emerald-200 active:scale-95"
        >
          <span className="text-lg">✓</span>
          <span className="text-xs">Known</span>
        </button>
      </div>

      {/* Keyboard hint — desktop only */}
      <p className="mt-3 text-xs text-gray-300 text-center hidden sm:block">
        <kbd className="font-mono">1</kbd> known · <kbd className="font-mono">2</kbd> save · <kbd className="font-mono">3</kbd> again · <kbd className="font-mono">←</kbd> back · <kbd className="font-mono">→</kbd> skip
      </p>
    </div>
  );
}
