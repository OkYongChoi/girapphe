'use client';

import { useEffect, useMemo, useState } from 'react';
import { KnowledgeCard, NodeQuiz, generateQuizForNode } from '@/actions/card-actions';
import MathText from './math-text';

interface CardProps {
  card: KnowledgeCard;
  interactiveQuizMode?: boolean;
}

export default function Card({ card, interactiveQuizMode = true }: CardProps) {
  const domainColors: Record<string, string> = {
    signal: 'bg-red-100 text-red-800 border-red-200',
    control: 'bg-blue-100 text-blue-800 border-blue-200',
    info: 'bg-green-100 text-green-800 border-green-200',
    ml: 'bg-purple-100 text-purple-800 border-purple-200',
    other: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const domainStyle = domainColors[card.domain] || domainColors.other;
  const [quiz, setQuiz] = useState<NodeQuiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(interactiveQuizMode);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    if (!interactiveQuizMode) return () => { active = false; };

    generateQuizForNode(card.id)
      .then((nextQuiz) => {
        if (!active) return;
        setQuiz(nextQuiz);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Failed to generate quiz for card:', error);
        setQuizError('Quiz unavailable for this concept.');
      })
      .finally(() => {
        if (!active) return;
        setQuizLoading(false);
      });

    return () => {
      active = false;
    };
  }, [card.id, interactiveQuizMode]);

  const showExplanation = !interactiveQuizMode || !quiz || selectedAnswerIndex !== null;
  const isAnswerCorrect = useMemo(() => {
    if (!quiz || selectedAnswerIndex === null) return null;
    return selectedAnswerIndex === quiz.correctAnswerIndex;
  }, [quiz, selectedAnswerIndex]);

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

      {card.suggest_reason && (
        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-tight bg-blue-50 px-2 py-0.5 rounded w-fit">
          ✨ {card.suggest_reason}
        </div>
      )}
      
      <p className="text-gray-600 dark:text-gray-300 leading-relaxed flex-grow">
        {card.summary}
      </p>

      {interactiveQuizMode && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-blue-700">
            Quick Quiz
          </h3>

          {quizLoading ? (
            <p className="mt-2 text-sm text-blue-800/80">Generating question...</p>
          ) : quizError ? (
            <p className="mt-2 text-sm text-red-700">{quizError}</p>
          ) : quiz ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-slate-800">{quiz.question}</p>
              <div className="grid gap-2">
                {quiz.choices.map((choice, index) => {
                  const isSelected = selectedAnswerIndex === index;
                  const isCorrectChoice = quiz.correctAnswerIndex === index;
                  const resolvedStyle =
                    selectedAnswerIndex === null
                      ? 'border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                      : isCorrectChoice
                        ? 'border-green-300 bg-green-50 text-green-900'
                        : isSelected
                          ? 'border-red-300 bg-red-50 text-red-800'
                          : 'border-slate-200 opacity-80';

                  return (
                    <button
                      key={`${card.id}-choice-${index}`}
                      type="button"
                      disabled={selectedAnswerIndex !== null}
                      onClick={() => setSelectedAnswerIndex(index)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${resolvedStyle}`}
                    >
                      <span className="mr-2 font-semibold">{String.fromCharCode(65 + index)}.</span>
                      {choice}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isAnswerCorrect !== null ? (
            <p className={`mt-3 text-xs font-medium ${isAnswerCorrect ? 'text-green-700' : 'text-red-700'}`}>
              {isAnswerCorrect
                ? 'Correct. Explanation unlocked below.'
                : 'Not quite. Check the explanation below and retry next round.'}
            </p>
          ) : null}
        </div>
      )}

      {card.explanation && showExplanation && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 p-4 rounded-lg text-sm text-gray-800 dark:text-gray-200 mt-2">
           <h3 className="text-xs font-bold text-yellow-800 dark:text-yellow-500 uppercase tracking-widest mb-2">
             💡 Key Facts & Formulas
           </h3>
           <MathText text={card.explanation} className="text-sm leading-relaxed" />
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

      {card.related_concepts && card.related_concepts.length > 0 && (
         <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
           <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
             Connected Concepts
           </span>
           <div className="flex flex-wrap gap-2">
             {card.related_concepts.map((concept, i) => (
               <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs rounded-md">
                 {concept}
               </span>
             ))}
           </div>
         </div>
      )}
    </div>
  );
}
