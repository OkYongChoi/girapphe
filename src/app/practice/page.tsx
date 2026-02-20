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

  const [initialCard, stats] = await Promise.all([getNextCard(), getUserStats()]);

  return (
    <main id="main-content" className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="mx-auto w-full max-w-lg flex-grow px-4 py-4 md:py-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Practice</h1>
            <p className="text-sm text-gray-400">Review concepts and track what you know.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/saved"
              className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Saved
            </Link>
            <Link
              href="/my-knowledge"
              className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              My knowledge
            </Link>
            <form
              action={async () => {
                'use server';
                await resetUserCardProgress();
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Reset
              </button>
            </form>
          </div>
        </div>

        {/* Card viewer — stats are shown inside */}
        <CardViewer initialCard={initialCard} initialStats={stats} />
      </div>
    </main>
  );
}
