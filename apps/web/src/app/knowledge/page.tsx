import { getAllCardsWithStatus } from '@/actions/card-actions';
import KnowledgeMap from '@/components/knowledge-map';
import Navbar from '@/components/navbar';
import { getCurrentActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  // Server component doesn't get searchParams by default; keep this page stable and let the
  // client component control query params by navigating to the same route.
  const [actor, cards] = await Promise.all([getCurrentActor(), getAllCardsWithStatus()]);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex-grow">
        <KnowledgeMap initialCards={cards} isGuest={actor.isGuest} />
      </div>
    </main>
  );
}
