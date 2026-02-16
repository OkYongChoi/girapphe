import { getAllCardsWithStatus } from '@/actions/card-actions';
import KnowledgeMap from '@/components/knowledge-map';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  const cards = await getAllCardsWithStatus();

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex-grow">
        <KnowledgeMap initialCards={cards} />
      </div>
    </main>
  );
}
