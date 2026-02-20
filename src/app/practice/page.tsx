import { getNextCard, getUserStats, resetUserCardProgress } from '@/actions/card-actions';
import CardViewer from '@/components/card-viewer';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PracticePage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const searchParams = await props.searchParams;
  const mode = searchParams?.mode === 'review' ? 'review' : 'new';

  const [initialCard, stats] = await Promise.all([getNextCard(mode), getUserStats()]);

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

        {/* Mode Toggle */}
        <div className="mb-6 flex w-full max-w-lg bg-gray-200 p-1 rounded-lg">
          <Link 
            href="/practice?mode=new" 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 text-center ${mode === 'new' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Learn New
          </Link>
          <Link 
            href="/practice?mode=review" 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 text-center ${mode === 'review' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Review Saved
          </Link>
        </div>

        {/* Card viewer — stats are shown inside */}
        <CardViewer initialCard={initialCard} initialStats={stats} mode={mode} />
      </div>
    </main>
  );
}
