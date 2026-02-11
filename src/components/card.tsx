import { KnowledgeCard } from '@/actions/card-actions';

interface CardProps {
  card: KnowledgeCard;
}

export default function Card({ card }: CardProps) {
  const domainColors: Record<string, string> = {
    signal: 'bg-red-100 text-red-800 border-red-200',
    control: 'bg-blue-100 text-blue-800 border-blue-200',
    info: 'bg-green-100 text-green-800 border-green-200',
    ml: 'bg-purple-100 text-purple-800 border-purple-200',
    other: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const domainStyle = domainColors[card.domain] || domainColors.other;

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6 flex flex-col gap-4 min-h-[300px]">
      <div className="flex justify-between items-start">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${domainStyle}`}>
          {card.domain}
        </span>
        <span className="text-xs text-gray-500 uppercase tracking-wider">{card.level}</span>
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
        {card.title}
      </h2>
      
      <p className="text-gray-600 dark:text-gray-300 leading-relaxed flex-grow">
        {card.summary}
      </p>

      {card.explanation && (
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-sm text-gray-600 dark:text-gray-400">
           {card.explanation}
        </div>
      )}

      {card.wiki_url && (
        <a 
          href={card.wiki_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline mt-2 inline-block"
        >
          View on Wikipedia &rarr;
        </a>
      )}
    </div>
  );
}
