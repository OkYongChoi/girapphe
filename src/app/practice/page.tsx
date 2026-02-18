import { getNextCard, getUserStats, resetUserCardProgress } from '@/actions/card-actions';
import CardViewer from '@/components/card-viewer';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PracticePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const initialCard = await getNextCard();
  const stats = await getUserStats();
  const total = stats.known + stats.saved + stats.unknown;
  const knownPercent = total > 0 ? Math.round((stats.known / total) * 100) : 0;

  return (
    <main id="main-content" className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="mx-auto w-full max-w-5xl flex-grow p-4 md:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Practice</h1>
            <p className="text-sm text-gray-500">Answer quickly and keep momentum.</p>
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
                className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"
              >
                Reset progress
              </button>
            </form>
            <Link href="/saved" className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
              Saved queue
            </Link>
            <Link href="/my-knowledge" className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
              My knowledge
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          <CardViewer initialCard={initialCard} />

          <div
            aria-label="Session knowledge stats"
            className="mt-8 w-full max-w-md rounded-xl border bg-white shadow-sm overflow-hidden"
          >
            <div className="grid grid-cols-3 divide-x">
              <div className="px-4 py-3 text-center">
                <span className="block text-xl font-bold text-emerald-700">{stats.known}</span>
                <span className="text-xs text-gray-500">Known</span>
              </div>
              <div className="px-4 py-3 text-center">
                <span className="block text-xl font-bold text-blue-600">{stats.saved}</span>
                <span className="text-xs text-gray-500">Saved</span>
              </div>
              <div className="px-4 py-3 text-center">
                <span className="block text-xl font-bold text-red-500">{stats.unknown}</span>
                <span className="text-xs text-gray-500">Unknown</span>
              </div>
            </div>
            {total > 0 && (
              <div className="px-4 pb-3">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
                  role="progressbar"
                  aria-label={`${knownPercent}% of reviewed concepts marked as known`}
                  aria-valuenow={knownPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${knownPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-gray-400">{knownPercent}% known</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
