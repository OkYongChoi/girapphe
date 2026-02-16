import { getSavedCards } from '@/actions/card-actions';
import type { CardStatus, KnowledgeCard } from '@/actions/card-actions';
import { removeSavedCard } from '@/actions/card-actions';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  const savedCards = (await getSavedCards()) as (KnowledgeCard & {
    status: CardStatus;
    last_seen: string | Date;
  })[];

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="flex-grow w-full max-w-2xl mx-auto p-4 md:p-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Saved Concepts</h1>
            <p className="text-sm text-gray-500">{savedCards.length} saved for focused review</p>
          </div>
          <Link href="/practice" className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
            Continue practice
          </Link>
        </div>

        {savedCards.length === 0 ? (
          <div className="rounded-lg border bg-white p-6 text-center">
            <p className="text-gray-500">No saved cards yet.</p>
            <Link href="/practice" className="mt-3 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Go to practice
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {savedCards.map((card) => (
              <div key={card.id} className="bg-white border rounded-lg p-4 flex flex-col hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{card.title}</h3>
                  <span className="text-xs px-2 py-1 rounded-full capitalize bg-blue-100 text-blue-800">
                    {card.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{card.summary}</p>
                <div className="mt-auto flex justify-between items-center text-xs text-gray-400">
                  <span>{card.domain}</span>
                  <div className="flex items-center gap-3">
                    <span>Last seen: {new Date(card.last_seen).toISOString().split('T')[0]}</span>
                    <form
                      action={async () => {
                        'use server';
                        await removeSavedCard(card.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
