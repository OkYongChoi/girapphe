import { getSavedCards } from '@/actions/card-actions';
import type { CardStatus, KnowledgeCard } from '@/actions/card-actions';
import { removeSavedCard, resetUserCardProgress } from '@/actions/card-actions';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type SavedPageProps = {
  searchParams?: Promise<{
    q?: string;
    domain?: string;
  }>;
};

function formatDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_STYLES: Record<string, string> = {
  saved: 'bg-blue-100 text-blue-800 border-blue-200',
  known: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  unknown: 'bg-red-100 text-red-800 border-red-200',
};

export default async function SavedPage({ searchParams }: SavedPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  const params = (await searchParams) ?? {};
  const query = (params.q ?? '').trim().toLowerCase();
  const domainFilter = (params.domain ?? 'all').trim().toLowerCase();

  const savedCards = (await getSavedCards()) as (KnowledgeCard & {
    status: CardStatus;
    last_seen: string | Date;
  })[];
  const allDomains = Array.from(new Set(savedCards.map((card) => card.domain))).sort();
  const filteredCards = savedCards.filter((card) => {
    const matchesDomain = domainFilter === 'all' || card.domain.toLowerCase() === domainFilter;
    const haystack = `${card.title} ${card.summary} ${card.domain}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesDomain && matchesQuery;
  });

  const hasActiveFilter = query || domainFilter !== 'all';

  return (
    <main id="main-content" className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="flex-grow w-full max-w-2xl mx-auto p-4 md:p-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Saved Concepts</h1>
            <p className="text-sm text-gray-500">
              {hasActiveFilter
                ? `${filteredCards.length} of ${savedCards.length} saved concepts`
                : `${savedCards.length} concept${savedCards.length !== 1 ? 's' : ''} saved for review`}
            </p>
          </div>
          <div className="flex gap-2">
            <form
              action={async () => {
                'use server';
                await resetUserCardProgress();
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors shrink-0"
              >
                Reset progress
              </button>
            </form>
            <Link href="/practice" className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 transition-colors shrink-0">
              Continue practice →
            </Link>
          </div>
        </div>

        <form className="mb-4 rounded-lg border bg-white p-3 shadow-sm" role="search" aria-label="Filter saved concepts">
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <label className="sr-only" htmlFor="saved-search">Search concepts</label>
            <input
              id="saved-search"
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search title, summary, or domain…"
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex gap-2 flex-wrap">
              <label className="sr-only" htmlFor="saved-domain">Filter by domain</label>
              <select
                id="saved-domain"
                name="domain"
                defaultValue={domainFilter}
                className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">All domains</option>
                {allDomains.map((domain) => (
                  <option key={domain} value={domain.toLowerCase()}>
                    {domain}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors">
                Search
              </button>
              {hasActiveFilter && (
                <Link href="/saved" className="rounded-md border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Clear
                </Link>
              )}
            </div>
          </div>
        </form>

        {savedCards.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <p className="text-2xl mb-2" aria-hidden="true">📌</p>
            <p className="font-semibold text-gray-800">No saved concepts yet</p>
            <p className="text-sm text-gray-500 mt-1">Save concepts during practice to build your review queue.</p>
            <Link href="/practice" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              Start practicing
            </Link>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-center text-gray-500 shadow-sm">
            <p className="font-medium">No matches found</p>
            <p className="text-sm mt-1">Try adjusting your search or filter.</p>
            <Link href="/saved" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
              Clear filters
            </Link>
          </div>
        ) : (
          <ol className="grid gap-3 list-none p-0" aria-label="Saved concept cards">
            {filteredCards.map((card) => {
              const statusStyle = STATUS_STYLES[card.status] ?? STATUS_STYLES.saved;
              return (
                <li key={card.id} className="bg-white border rounded-xl p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h2 className="font-semibold text-gray-900 text-base leading-snug">{card.title}</h2>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full capitalize border ${statusStyle}`}>
                      {card.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">{card.summary}</p>
                  <div className="mt-auto flex justify-between items-center text-xs text-gray-400">
                    <span className="font-medium text-gray-500">{card.domain}</span>
                    <div className="flex items-center gap-3">
                      <span>Last seen: {formatDate(card.last_seen)}</span>
                      <form
                        action={async () => {
                          'use server';
                          await removeSavedCard(card.id);
                        }}
                      >
                        <button
                          type="submit"
                          aria-label={`Remove "${card.title}" from saved`}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
