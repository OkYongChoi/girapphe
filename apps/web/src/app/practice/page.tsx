import { getNextCard, getUserStats } from '@/actions/card-actions';
import CardViewer from '@/components/card-viewer';
import Navbar from '@/components/navbar';
import Link from 'next/link';
import { getCurrentActor } from '@/lib/auth';
import { GUEST_PRACTICE_CARD_LIMIT } from '@/lib/guest';

export const dynamic = 'force-dynamic';

export default async function PracticePage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const actor = await getCurrentActor();
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
            <p className="text-sm text-gray-400">Memorize first, then use AI to deepen understanding.</p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="mb-2 flex w-full max-w-lg bg-gray-200 p-1 rounded-lg">
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
            Review
          </Link>
        </div>
        <p className="mb-6 text-xs text-gray-500">
          {mode === 'new'
            ? 'Learn New: unseen/unknown cards first'
            : 'Review: cards still in learning queue'}
        </p>

        {/* Card viewer — stats are shown inside */}
        <CardViewer
          key={mode}
          initialCard={initialCard}
          initialStats={stats}
          mode={mode}
          isGuest={actor.isGuest}
          guestLimit={GUEST_PRACTICE_CARD_LIMIT}
        />
      </div>
    </main>
  );
}
