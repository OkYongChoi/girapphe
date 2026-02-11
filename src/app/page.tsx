import { getNextCard, getUserStats } from '@/actions/card-actions';
import CardViewer from '@/components/card-viewer';
import Navbar from '@/components/navbar';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const initialCard = await getNextCard();
  const stats = await getUserStats();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Navbar />
      
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <CardViewer initialCard={initialCard} />
        
        <div className="mt-12 w-full max-w-md flex justify-between text-sm text-gray-500 border-t pt-6">
          <div className="text-center">
            <span className="block font-bold text-gray-900 dark:text-white text-lg">{stats.known}</span>
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
    </main>
  );
}
