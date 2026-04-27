'use client';

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import {
  KnowledgeCard,
  saveCardState,
  getNextCard,
  CardStatus,
  getUserStats,
  type PrerequisiteInfo,
} from '@/actions/card-actions';
import Card from './card';
import Link from 'next/link';
import { getCardStatusLabel } from '@/lib/card-status';

interface CardViewerProps {
  initialCard: KnowledgeCard | null;
  initialStats: { explainable: number; unclear: number };
  mode: 'new' | 'review';
  isGuest?: boolean;
  guestLimit?: number;
}

type HistoryEntry = {
  card: KnowledgeCard;
  action: 'skip' | CardStatus;
};

export default function CardViewer({
  initialCard,
  initialStats,
  mode,
  isGuest = false,
  guestLimit = 0,
}: CardViewerProps) {
  const [card, setCard] = useState<KnowledgeCard | null>(initialCard);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState(initialStats);
  // cards skipped this round — cleared once all remaining unrated cards are also skipped
  const skippedIds = useRef<Set<string>>(new Set());
  // cards rated this round — excluded when fetching next card, cleared when all cards cycled
  const ratedIds = useRef<Set<string>>(new Set());
  // review mode: snapshot of how many unclear cards existed at session start
  const initialReviewPool = useRef(initialStats.unclear);
  // card-flip state: false = front only, true = answer revealed
  const [revealed, setRevealed] = useState(false);
  // undo state: shown after rating, cleared on undo/skip/next-rating
  const [undoVisible, setUndoVisible] = useState(false);
  // flag so the revealed-reset effect knows to keep the card revealed after undo
  const keepRevealedOnBack = useRef(false);
  // remember prior rating per card to show when navigating back
  const [lastChoiceByCardId, setLastChoiceByCardId] = useState<Record<string, CardStatus>>({});
  const [reviewedThisRound, setReviewedThisRound] = useState(0);
  const [reviewRoundCompleted, setReviewRoundCompleted] = useState(false);
  const [backNavigatedCardId, setBackNavigatedCardId] = useState<string | null>(null);

  // Reset session state on mount only.
  // key={mode} on CardViewer (in practice/page.tsx) causes a full unmount+remount on mode
  // switch, so this effect correctly fires on initial load AND mode changes.
  // We intentionally do NOT include initialCard/initialStats in deps: Next.js re-renders
  // server components after every server action, which would update these props and
  // re-trigger this effect mid-session — resetting the card and wiping ratedIds/history.
  useEffect(() => {
    setCard(initialCard);
    setHistory([]);
    setLoading(false);
    setError(null);
    setStats(initialStats);
    skippedIds.current.clear();
    ratedIds.current.clear();
    initialReviewPool.current = initialStats.unclear;
    setRevealed(false);
    setUndoVisible(false);
    keepRevealedOnBack.current = false;
    setLastChoiceByCardId({});
    setReviewedThisRound(0);
    setReviewRoundCompleted(false);
    setBackNavigatedCardId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reviewedCount = useMemo(() => {
    const reviewed = history
      .filter((entry) => entry.action !== 'skip')
      .map((entry) => entry.card.id);
    return new Set(reviewed).size;
  }, [history]);
  const reviewPool = initialReviewPool.current;
  const previousChoice = card ? lastChoiceByCardId[card.id] : undefined;

  const handleAction = useCallback(async (status: CardStatus) => {
    if (!card || loading) return;
    setLoading(true);
    setError(null);
    setBackNavigatedCardId(null);
    setUndoVisible(false); // previous card's undo is no longer relevant
    setHistory(prev => [...prev, { card, action: status }]);
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
      setLastChoiceByCardId((prev) => ({ ...prev, [card.id]: status }));
      // Exclude rated card from pool until the cycle resets.
      ratedIds.current.add(card.id);
      let completedRound = false;
      let reviewedCountNow = ratedIds.current.size;
      const getNext = async () => {
        let next = await getNextCard(mode, [...ratedIds.current]);
        if (!next) {
          // All available cards have been rated this round → reset and cycle again
          if (mode === 'review' && reviewPool > 0) {
            completedRound = true;
            reviewedCountNow = reviewPool;
          }
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
      if (mode === 'review') {
        setReviewedThisRound(reviewedCountNow);
        setReviewRoundCompleted(completedRound);
      }
      setCard(next);
      setStats(newStats);
      setUndoVisible(true); // stays until undo is clicked or next action
    } catch (e) {
      console.error('handleAction failed:', e);
      setError('Something went wrong.');
      setHistory(prev => prev.slice(0, -1));
      ratedIds.current.delete(card.id); // restore on failure
      if (wasSkipped) skippedIds.current.add(card.id); // restore skip state
    } finally {
      setLoading(false);
    }
  }, [card, loading, mode, reviewPool]);

  const handlePrevious = useCallback(() => {
    if (history.length === 0) return;
    const previousEntry = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCard(previousEntry.card);
    setBackNavigatedCardId(previousEntry.card.id);
    setError(null);
  }, [history]);

  // Undo last rating: go back to the previous card (already revealed) so the
  // user can re-rate it. saveCardState uses ON CONFLICT DO UPDATE, so re-rating
  // correctly overwrites the previous DB entry.
  const handleUndo = useCallback(() => {
    setUndoVisible(false);
    keepRevealedOnBack.current = true; // keep the card in revealed state
    handlePrevious();
  }, [handlePrevious]);

  const handleSkip = useCallback(async () => {
    if (!card || loading) return;
    setLoading(true);
    setError(null);
    setBackNavigatedCardId(null);
    setUndoVisible(false); // previous rating's undo is no longer relevant
    setReviewRoundCompleted(false); // clear previous round-complete banner
    setHistory(prev => [...prev, { card, action: 'skip' }]);
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
        if (mode === 'review' && reviewPool > 0) {
          setReviewRoundCompleted(true);
        }
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
  }, [card, loading, mode, reviewPool]);

  // Reset flip state whenever the displayed card changes.
  // Exception: when going back via Undo, keep the card revealed.
  useEffect(() => {
    if (keepRevealedOnBack.current) {
      keepRevealedOnBack.current = false;
      setRevealed(true);
    } else {
      setRevealed(false);
    }
  }, [card?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (loading || !card) return;
      // Space / Enter reveals the answer; rating keys only work after reveal
      if ((event.key === ' ' || event.key === 'Enter') && !revealed) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      // Z for undo — works regardless of reveal state
      if ((event.key === 'z' || event.key === 'Z') && undoVisible && !loading) {
        event.preventDefault();
        handleUndo();
        return;
      }
      if (!revealed) return; // block rating keys until answer is shown
      if (event.key === '1') void handleAction('known');
      if (event.key === '2') void handleAction('saved');
      if (event.key === 'ArrowRight') void handleSkip();
      if (event.key === 'ArrowLeft') handlePrevious();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, card, revealed, undoVisible, handleAction, handleSkip, handlePrevious, handleUndo]);

  // ── All done ─────────────────────────────────────────────────
  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center max-w-sm mx-auto bg-white border border-gray-100 rounded-2xl shadow-sm mt-4">
        <div className="mb-4 text-5xl" aria-hidden="true">🎉</div>
        <p className="text-xl font-bold text-gray-900">
          {mode === 'review' ? "You're all caught up on review queue items!" : "All caught up on new/unclear cards!"}
        </p>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          {isGuest && mode === 'new'
            ? `Guests can practice ${guestLimit} sample cards.`
            : `You reviewed ${reviewedCount} card${reviewedCount !== 1 ? 's' : ''} this session.`}
        </p>

        <div className="mt-6 w-full grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 py-3">
            <span className="block text-2xl font-bold text-emerald-700">{stats.explainable}</span>
            <span className="text-xs text-emerald-600">Explainable</span>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 py-3">
            <span className="block text-2xl font-bold text-blue-600">{stats.unclear}</span>
            <span className="text-xs text-blue-500">Unclear</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 w-full">
          {isGuest && (
            <Link
              href="/signup"
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors text-center focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              Create account for full practice
            </Link>
          )}
          <Link
            href="/practice?mode=review"
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Review learning queue
          </Link>
          <Link
            href="/saved"
            className="w-full rounded-xl border px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            View review queue
          </Link>
          <Link
            href="/knowledge"
            className="w-full rounded-xl border px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      {isGuest && mode === 'new' && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Guest sample: {guestLimit} practice cards.{' '}
          <Link href="/signup" className="font-semibold underline underline-offset-2">
            Create an account
          </Link>{' '}
          for the full set.
        </div>
      )}

      {/* Stats / progress header — layout differs per mode */}
      <div className="mb-4 rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-2.5">
        {mode === 'new' ? (
          /* ── Learn New: global stats, no bar ── */
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="text-emerald-600">✓ {stats.explainable} explainable</span>
              <span className="text-amber-600">◐ {stats.unclear} unclear</span>
            </div>
            <span className="text-xs text-gray-500" aria-live="polite">
              {reviewedCount > 0 ? `${reviewedCount} this session` : 'Learning new'}
            </span>
          </div>
        ) : (
          /* ── Review: session progress bar ── */
          <>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-blue-600">
                🔄 Reviewing learning queue
              </span>
              <span className="text-xs text-gray-500" aria-live="polite">
                {Math.min(reviewedThisRound, reviewPool)} / {reviewPool} reviewed
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
              role="progressbar"
              aria-label={`${Math.min(reviewedThisRound, reviewPool)} of ${reviewPool} reviewed`}
              aria-valuenow={Math.min(reviewedThisRound, reviewPool)}
              aria-valuemin={0}
              aria-valuemax={reviewPool}
            >
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: reviewPool > 0 ? `${Math.min(100, Math.round((Math.min(reviewedThisRound, reviewPool) / reviewPool) * 100))}%` : '0%' }}
              />
            </div>
            {reviewRoundCompleted && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2" role="status" aria-live="polite">
                <span className="text-base" aria-hidden="true">🎉</span>
                <p className="text-xs font-semibold text-emerald-700">
                  Round complete! You went through all {reviewPool} card{reviewPool !== 1 ? 's' : ''} — starting next round.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Prev / Skip nav */}
      <div className="flex justify-between items-center mb-3">
        <button
          onClick={handlePrevious}
          disabled={history.length === 0 || loading}
          aria-label="Go to previous card"
          className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30 flex items-center gap-1 transition-colors rounded-lg px-2 py-1 hover:bg-gray-100 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          ← Prev
        </button>
        <button
          onClick={handleSkip}
          disabled={loading}
          aria-label="Skip this card"
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {loading ? '…' : 'Skip →'}
        </button>
      </div>
      {mode === 'new' && backNavigatedCardId === card.id && previousChoice && (
        <p className="mb-3 text-xs text-gray-500" aria-live="polite">
          Previous choice on this card: <span className="font-semibold text-gray-700">{getCardStatusLabel(previousChoice)}</span>
        </p>
      )}

      {/* Card — explanation hidden until revealed */}
      <Card key={card.id} card={card} revealed={revealed} />

      {/* Prerequisites strip */}
      {card.prerequisites && card.prerequisites.length > 0 && (
        <div className="mt-2 px-3 py-2.5 bg-white border border-gray-100 rounded-xl shadow-sm">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Prerequisites
          </p>
          <div className="flex flex-wrap gap-1.5">
            {card.prerequisites.map((prereq: PrerequisiteInfo) => (
              <span
                key={prereq.id}
                title={prereq.status === 'known' ? 'Can explain' : prereq.status === 'saved' ? 'Still unclear' : 'Not yet learned'}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${
                  prereq.status === 'known'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : prereq.status === 'saved'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}
              >
                <span aria-hidden="true">
                  {prereq.status === 'known' ? '✓' : prereq.status === 'saved' ? '◐' : '○'}
                </span>
                {prereq.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error / loading feedback */}
      <div aria-live="polite" aria-atomic="true" className="mt-2 min-h-[1rem] text-center">
        {error && <p className="text-xs text-red-600">{error}</p>}
        {loading && !error && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
      </div>

      {/* Answer visibility toggle */}
      <button
        onClick={() => setRevealed((prev) => !prev)}
        disabled={loading}
        aria-label={revealed ? 'Hide answer' : 'Show answer'}
        className="mt-3 w-full py-4 bg-gray-900 hover:bg-gray-700 active:scale-95 text-white font-semibold rounded-2xl transition-all text-sm tracking-wide disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700"
      >
        {revealed ? 'Hide Answer ↑' : 'Show Answer ↓'}
      </button>

      {/* ── AFTER reveal: Unclear | Can Explain + Undo ── */}
      {revealed && (
        <>
          <div className="mt-3 flex w-full gap-3" role="group" aria-label="Rate this card">
            {/* Unclear */}
            <button
              onClick={() => void handleAction('saved')}
              disabled={loading}
              aria-label={mode === 'review' ? 'Still unclear on this concept (shortcut: 2)' : 'This concept is still unclear (shortcut: 2)'}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-5 text-amber-700 font-semibold rounded-2xl transition-colors disabled:opacity-50 border active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 ${
                previousChoice === 'saved'
                  ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300'
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-200'
              }`}
            >
              <span className="text-xl">◐</span>
              <span className="text-sm font-bold">Unclear</span>
              <span className="text-[10px] font-normal opacity-60">{mode === 'review' ? 'still needs review' : 'not stable yet'}</span>
            </button>

            {/* Can Explain */}
            <button
              onClick={() => void handleAction('known')}
              disabled={loading}
              aria-label="Mark as can explain (shortcut: 1)"
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-5 text-emerald-700 font-semibold rounded-2xl transition-colors disabled:opacity-50 border active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 ${
                previousChoice === 'known'
                  ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-300'
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
              }`}
            >
              <span className="text-xl">✓</span>
              <span className="text-sm font-bold">Can Explain</span>
              <span className="text-[10px] font-normal opacity-60">{mode === 'review' ? 'feels solid now' : 'self-reported strong'}</span>
            </button>
          </div>

          {/* Undo — visible for 3 s after rating */}
          <div className="mt-3 min-h-[2.5rem] flex items-center justify-center">
            {undoVisible && !loading && (
              <button
                onClick={handleUndo}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-5 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                ↩ Undo last rating
              </button>
            )}
          </div>
        </>
      )}

      {/* Action hint */}
      <p className="mt-1 text-xs text-gray-400 text-center">
        <span className="sm:hidden">
          {!revealed ? 'Tap "Show Answer" to reveal' : 'Tap Unclear or Can Explain to rate'}
        </span>
        <span className="hidden sm:inline">
          {!revealed
            ? <><kbd className="font-mono">Space</kbd> or <kbd className="font-mono">Enter</kbd> to reveal · <kbd className="font-mono">→</kbd> skip</>
            : <><kbd className="font-mono">1</kbd> can explain · <kbd className="font-mono">2</kbd> unclear · {undoVisible && <><kbd className="font-mono">Z</kbd> undo · </>}<kbd className="font-mono">←</kbd> back · <kbd className="font-mono">→</kbd> skip</>
          }
        </span>
      </p>
    </div>
  );
}
