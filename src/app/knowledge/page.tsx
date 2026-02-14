import { getAllCardsWithStatus } from '@/actions/card-actions';
import KnowledgeMap from '@/components/knowledge-map';
import Navbar from '@/components/navbar';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  const cards = await getAllCardsWithStatus();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Navbar />
      <div className="flex-grow">
        <KnowledgeMap initialCards={cards} />
      </div>
    </main>
  );
}
