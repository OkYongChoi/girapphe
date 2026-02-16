import { getNextCard, getUserStats } from '@/actions/card-actions';
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

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="mx-auto w-full max-w-5xl flex-grow p-4 md:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Practice</h1>
            <p className="text-sm text-gray-500">Answer quickly and keep momentum.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/saved" className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
              Saved queue
            </Link>
            <Link href="/my-knowledge" className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
              My knowledge
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
        <CardViewer initialCard={initialCard} />

        <div className="mt-8 w-full max-w-md flex justify-between rounded-lg border bg-white px-4 py-3 text-sm text-gray-500">
          <div className="text-center">
            <span className="block font-bold text-gray-900 text-lg">{stats.known}</span>
            <span>Known</span>
          </div>
          <div className="text-center">
            <span className="block font-bold text-blue-600 text-lg">{stats.saved}</span>
            <span>Saved</span>
          </div>
          <div className="text-center">
            <span className="block font-bold text-red-500 text-lg">{stats.unknown}</span>
            <span>Unknown</span>
          </div>
        </div>
        </div>
      </div>
    </main>
  );
}
