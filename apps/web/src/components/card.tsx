'use client';

import { KnowledgeCard } from '@/actions/card-actions';
import { getCardLevelMeta } from '@stem-brain/graph-engine';
import MathText from './math-text';

interface CardProps {
  card: KnowledgeCard;
  /** When false, hides the explanation (used for card-flip / self-test UX). Defaults to true. */
  revealed?: boolean;
}

const DOMAIN_COLORS: Record<string, string> = {
  signal: 'bg-orange-100 text-orange-800 border-orange-200',
  control: 'bg-teal-100 text-teal-800 border-teal-200',
  info: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ml: 'bg-violet-100 text-violet-800 border-violet-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function Card({ card, revealed = true }: CardProps) {
  const domainStyle = DOMAIN_COLORS[card.domain] ?? DOMAIN_COLORS.other;
  const levelMeta = getCardLevelMeta(card.level);
  const frontPrompts = [
    'Define it in one sentence',
    'Name the core formula or rule',
    'Connect it to one adjacent concept',
  ];

  return (
    <article
      aria-label={`Concept card: ${card.title}`}
      className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col gap-4"
    >
      <div className="flex justify-between items-start gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase border ${domainStyle}`}>
          {card.domain}
        </span>
        <span className="text-xs text-gray-500 shrink-0">
          Difficulty {levelMeta.rank} · {levelMeta.label}
        </span>
      </div>

      <h2 className="text-2xl font-bold text-gray-900">
        {card.title}
      </h2>

      {revealed ? (
        <p className="text-gray-600 leading-relaxed flex-grow">
          {card.summary}
        </p>
      ) : (
        <section
          aria-label="Recall prompts"
          className="rounded-lg border border-blue-100 bg-blue-50 p-4"
        >
          <h3 className="text-xs font-bold uppercase tracking-widest text-blue-800">
            Try from memory
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-blue-950">
            {frontPrompts.map((prompt) => (
              <li key={prompt} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
                <span>{prompt}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {card.explanation && revealed && (
        <section aria-label="Key facts and formulas" className="bg-amber-50 border border-amber-100 p-4 rounded-lg text-sm text-gray-800 overflow-y-auto max-h-48 custom-scrollbar">
           <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-2">
             Key facts and formulas
           </h3>
           <MathText text={card.explanation} className="text-sm leading-relaxed" />
        </section>
      )}

      {card.wiki_url && (
        <a
          href={card.wiki_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Read more about ${card.title} on Wikipedia (opens in new tab)`}
          className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1"
        >
          View on Wikipedia <span aria-hidden="true">↗</span>
        </a>
      )}

      {card.related_concepts && card.related_concepts.length > 0 && (
        <section aria-label="Connected concepts" className="pt-4 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            Connected Concepts
          </span>
          <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
            {card.related_concepts.map((concept, i) => (
              <li key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                {concept}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
