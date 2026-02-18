'use client';

import { useEffect, useMemo, useState } from 'react';
import { KnowledgeCard, NodeQuiz, generateQuizForNode } from '@/actions/card-actions';
import MathText from './math-text';

interface CardProps {
  card: KnowledgeCard;
  interactiveQuizMode?: boolean;
}

const DOMAIN_COLORS: Record<string, string> = {
  signal: 'bg-orange-100 text-orange-800 border-orange-200',
  control: 'bg-teal-100 text-teal-800 border-teal-200',
  info: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ml: 'bg-violet-100 text-violet-800 border-violet-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function Card({ card, interactiveQuizMode = true }: CardProps) {
  const domainStyle = DOMAIN_COLORS[card.domain] ?? DOMAIN_COLORS.other;
  const [quiz, setQuiz] = useState<NodeQuiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(interactiveQuizMode);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!interactiveQuizMode) return () => { active = false; };

    generateQuizForNode(card.id)
      .then((nextQuiz) => { if (active) setQuiz(nextQuiz); })
      .catch(() => { if (active) setQuizError('Quiz unavailable for this concept.'); })
      .finally(() => { if (active) setQuizLoading(false); });

    return () => { active = false; };
  }, [card.id, interactiveQuizMode]);

  const showExplanation = !interactiveQuizMode || !quiz || selectedAnswerIndex !== null;
  const isAnswerCorrect = useMemo(() => {
    if (!quiz || selectedAnswerIndex === null) return null;
    return selectedAnswerIndex === quiz.correctAnswerIndex;
  }, [quiz, selectedAnswerIndex]);

  return (
    <article
      aria-label={`Concept card: ${card.title}`}
      className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col gap-4"
    >
      <div className="flex justify-between items-start gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase border ${domainStyle}`}>
          {card.domain}
        </span>
        <span className="text-xs text-gray-400 uppercase tracking-wider shrink-0">{card.level}</span>
      </div>

      <h2 className="text-2xl font-bold text-gray-900">
        {card.title}
      </h2>

      {card.suggest_reason && (
        <div
          aria-label={`Suggested because: ${card.suggest_reason}`}
          className="text-[10px] font-bold text-blue-600 uppercase tracking-tight bg-blue-50 border border-blue-100 px-2 py-0.5 rounded w-fit"
        >
          ✨ {card.suggest_reason}
        </div>
      )}

      <p className="text-gray-600 leading-relaxed flex-grow">
        {card.summary}
      </p>

      {interactiveQuizMode && (
        <section aria-label="Quick quiz" className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-blue-700">
            Quick Quiz
          </h3>

          {quizLoading ? (
            <p className="mt-2 text-sm text-blue-800/80 animate-pulse">Generating question…</p>
          ) : quizError ? (
            <p className="mt-2 text-sm text-gray-500">{quizError}</p>
          ) : quiz ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-slate-800">{quiz.question}</p>
              <div className="grid gap-2" role="group" aria-label="Answer choices">
                {quiz.choices.map((choice, index) => {
                  const isSelected = selectedAnswerIndex === index;
                  const isCorrectChoice = quiz.correctAnswerIndex === index;
                  const answered = selectedAnswerIndex !== null;

                  let choiceStyle = 'border-slate-200 hover:border-blue-300 hover:bg-blue-50';
                  if (answered) {
                    if (isCorrectChoice) choiceStyle = 'border-emerald-400 bg-emerald-50 text-emerald-900 font-medium';
                    else if (isSelected) choiceStyle = 'border-red-300 bg-red-50 text-red-800';
                    else choiceStyle = 'border-slate-200 opacity-60';
                  }

                  return (
                    <button
                      key={`${card.id}-choice-${index}`}
                      type="button"
                      disabled={answered}
                      onClick={() => setSelectedAnswerIndex(index)}
                      aria-pressed={isSelected}
                      aria-describedby={answered ? `quiz-feedback-${card.id}` : undefined}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${choiceStyle} disabled:cursor-default`}
                    >
                      <span className="mr-2 font-semibold text-gray-500">{String.fromCharCode(65 + index)}.</span>
                      {choice}
                      {answered && isCorrectChoice && <span className="ml-2" aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isAnswerCorrect !== null ? (
            <p
              id={`quiz-feedback-${card.id}`}
              role="status"
              className={`mt-3 text-xs font-medium ${isAnswerCorrect ? 'text-emerald-700' : 'text-red-700'}`}
            >
              {isAnswerCorrect
                ? '✓ Correct! See explanation below.'
                : '✗ Not quite. Check the explanation below.'}
            </p>
          ) : null}
        </section>
      )}

      {card.explanation && showExplanation && (
        <section aria-label="Key facts and formulas" className="bg-amber-50 border border-amber-100 p-4 rounded-lg text-sm text-gray-800">
          <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-2">
            💡 Key Facts & Formulas
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
