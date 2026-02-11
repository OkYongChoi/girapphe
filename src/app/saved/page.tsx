import { getSavedCards } from '@/actions/card-actions';
import Navbar from '@/components/navbar';

export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  const savedCards = await getSavedCards();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Navbar />
      
      <div className="flex-grow w-full max-w-2xl mx-auto p-4 md:p-8">
        <h1 className="text-2xl font-bold mb-6">Saved Concepts</h1>
        
        {savedCards.length === 0 ? (
          <p className="text-gray-500">No saved cards yet. Go practice!</p>
        ) : (
          <div className="grid gap-4">
            {savedCards.map((card: any) => ( // Using any for simplicity with mixed query result
              <div key={card.id} className="bg-white dark:bg-gray-900 border rounded-lg p-4 flex flex-col hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{card.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                    card.status === 'unknown' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {card.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{card.summary}</p>
                <div className="mt-auto flex justify-between items-center text-xs text-gray-400">
                    <span>{card.domain}</span>
                    <span>Last seen: {new Date(card.last_seen).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
