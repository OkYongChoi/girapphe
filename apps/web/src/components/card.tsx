'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { KnowledgeCard } from '@/actions/card-actions';
import { getCardLevelMeta } from '@stem-brain/graph-engine';
import { localizeDomain, localizeLevel } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';
import TranslationFallbackBadge from '@/components/translation-fallback-badge';
import KnowledgeBundleView from '@/components/knowledge-bundle-view';
import KnowledgeText from '@/components/knowledge-text';

const MathText = dynamic(() => import('./math-text'), {
  loading: () => <div className="h-12 animate-pulse rounded bg-amber-100/70" aria-hidden="true" />,
});

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
  const { locale, t } = useI18n();
  const [expressionDirection, setExpressionDirection] = useState<'forward' | 'reverse'>('forward');
  useEffect(() => setExpressionDirection('forward'), [card.id]);
  const domainStyle = DOMAIN_COLORS[card.domain] ?? DOMAIN_COLORS.other;
  const levelMeta = getCardLevelMeta(card.level);
  const frontPrompts = [
    t('card.promptDefine'),
    t('card.promptFormula'),
    t('card.promptConnect'),
  ];
  const expression = card.structured_content?.type === 'expression' ? card.structured_content : null;
  const preferredTranslation = expression?.translations.find((item) => (
    item.language.toLocaleLowerCase() === locale.toLocaleLowerCase()
    || item.language.split('-')[0]?.toLocaleLowerCase() === locale.split('-')[0]?.toLocaleLowerCase()
  )) ?? expression?.translations[0];
  const reverseCue = preferredTranslation?.text || expression?.meanings[0] || '';
  const canReverseExpression = Boolean(reverseCue);
  const expressionCue = expressionDirection === 'reverse' && canReverseExpression
    ? reverseCue
    : expression?.expression || card.title;

  return (
    <article
      aria-label={t('card.aria', { title: card.title })}
      className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col gap-4"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase border ${domainStyle}`}>
            {card.domain_label ?? localizeDomain(locale, card.domain)}
          </span>
          <TranslationFallbackBadge resolvedLocale={card.resolved_locale} status={card.translation_status} />
        </div>
        <span className="text-xs text-gray-500 shrink-0">
          {t('common.difficulty', {
            rank: levelMeta.rank,
            label: card.level_label ?? localizeLevel(locale, card.level),
          })}
        </span>
      </div>

      <h2 className="text-2xl font-bold text-gray-900">
        {!revealed && expressionDirection === 'reverse' && canReverseExpression
          ? t('bundle.type.expression')
          : <KnowledgeText text={card.title} />}
      </h2>

      {revealed ? (
        <div className="space-y-3 text-gray-600 leading-relaxed flex-grow">
          <p><KnowledgeText text={card.summary} /></p>
          {card.knowledge_type && card.central_question && card.structured_content ? (
            <KnowledgeBundleView type={card.knowledge_type} centralQuestion={card.central_question} content={card.structured_content} compact />
          ) : null}
        </div>
      ) : (
        <section
          aria-label={t('card.recallAria')}
          className="rounded-lg border border-blue-100 bg-blue-50 p-4"
        >
          <h3 className="text-xs font-bold uppercase tracking-widest text-blue-800">
            {t('card.recallTitle')}
          </h3>
          {expression ? <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={expressionDirection === 'forward'} onClick={() => setExpressionDirection('forward')} className={`min-h-10 rounded-lg px-3 text-xs font-bold ${expressionDirection === 'forward' ? 'bg-blue-700 text-white' : 'border border-blue-200 bg-white text-blue-800'}`}>{t('bundle.recall.expressionForward')}</button>
              <button type="button" disabled={!canReverseExpression} aria-pressed={expressionDirection === 'reverse'} onClick={() => setExpressionDirection('reverse')} className={`min-h-10 rounded-lg px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${expressionDirection === 'reverse' ? 'bg-blue-700 text-white' : 'border border-blue-200 bg-white text-blue-800'}`}>{t('bundle.recall.expressionReverse')}</button>
            </div>
            <p className="text-lg font-semibold text-blue-950"><KnowledgeText text={expressionCue} /></p>
            <p className="text-sm text-blue-800">{t('bundle.recall.expression')}</p>
          </div> : card.central_question && card.knowledge_type ? <div className="mt-3 space-y-2"><p className="text-base font-semibold text-blue-950"><KnowledgeText text={card.central_question} /></p><p className="text-sm text-blue-800">{t(`bundle.recall.${card.knowledge_type}`)}</p></div> : <ul className="mt-3 space-y-2 text-sm text-blue-950">
            {frontPrompts.map((prompt) => (
              <li key={prompt} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
                <span>{prompt}</span>
              </li>
            ))}
          </ul>}
        </section>
      )}

      {card.explanation && revealed && !card.structured_content && (
        <section aria-label={t('card.factsAria')} className="bg-amber-50 border border-amber-100 p-4 rounded-lg text-sm text-gray-800 overflow-y-auto max-h-48 custom-scrollbar">
           <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-2">
             {t('card.factsTitle')}
           </h3>
           <MathText text={card.explanation} className="text-sm leading-relaxed" />
        </section>
      )}

      {card.wiki_url && (
        <a
          href={card.wiki_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('card.wikipediaAria', { title: card.title })}
          className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1"
        >
          {t('card.wikipedia')} <span aria-hidden="true">↗</span>
        </a>
      )}

      {card.related_concepts && card.related_concepts.length > 0 && (
        <section aria-label={t('card.connectedAria')} className="pt-4 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            {t('card.connectedTitle')}
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
