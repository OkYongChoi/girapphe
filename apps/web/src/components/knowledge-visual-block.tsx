'use client';

import type { ReactNode } from 'react';
import type { KnowledgeTextToken } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';

type VisualToken = Extract<KnowledgeTextToken, { type: 'flow' | 'timeline' }>;

type KnowledgeVisualBlockProps = {
  token: VisualToken;
  renderValue: (value: string) => ReactNode;
};

const valueBox = 'min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm';

export default function KnowledgeVisualBlock({ token, renderValue }: KnowledgeVisualBlockProps) {
  const { direction, t } = useI18n();

  if (token.type === 'flow') {
    return (
      <span
        role="group"
        aria-label={t('bundle.visual.flow')}
        className="my-3 block w-full max-w-full min-w-0 overflow-hidden whitespace-normal rounded-xl border border-blue-200 bg-blue-50/60 p-3 [contain:inline-size]"
        data-knowledge-visual="flow"
      >
        <span className="block text-xs font-bold uppercase tracking-wide text-blue-800">
          {t('bundle.visual.flow')}
        </span>
        <span role="list" className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
          {token.edges.map((edge, index) => (
            <span
              key={index}
              role="listitem"
              className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 overflow-hidden rounded-lg border border-blue-100 bg-white/80 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(5rem,0.7fr)_minmax(0,1fr)] sm:items-center"
              data-knowledge-visual-row={index + 1}
              data-flow-row={index + 1}
            >
              <span className={valueBox} data-flow-source>
                <span className="block text-[0.68rem] font-bold uppercase tracking-wide text-slate-500">
                  {t('bundle.visual.source')}
                </span>
                <span className="mt-1 block min-w-0 overflow-x-auto text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]" dir="auto">
                  {renderValue(edge.from)}
                </span>
              </span>
              <span className="flex min-w-0 flex-col items-center justify-center gap-1 text-center">
                <span className="sr-only">{t('bundle.visual.relationship')}: </span>
                <span
                  className="max-w-full rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 [overflow-wrap:anywhere]"
                  data-flow-relationship
                  dir="auto"
                >
                  {renderValue(edge.relation)}
                </span>
                <span aria-hidden="true" className="font-black leading-none text-blue-600" data-knowledge-visual-arrow>
                  <span className="sm:hidden" data-knowledge-visual-arrow-vertical>↓</span>
                  <span className="hidden sm:inline" data-knowledge-visual-arrow-horizontal>{direction === 'rtl' ? '←' : '→'}</span>
                </span>
              </span>
              <span className={valueBox} data-flow-target>
                <span className="block text-[0.68rem] font-bold uppercase tracking-wide text-slate-500">
                  {t('bundle.visual.target')}
                </span>
                <span className="mt-1 block min-w-0 overflow-x-auto text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]" dir="auto">
                  {renderValue(edge.to)}
                </span>
              </span>
            </span>
          ))}
        </span>
      </span>
    );
  }

  return (
    <span
      role="group"
      aria-label={t('bundle.visual.timeline')}
      className="my-3 block w-full max-w-full min-w-0 overflow-hidden whitespace-normal rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 [contain:inline-size]"
      data-knowledge-visual="timeline"
    >
      <span className="block text-xs font-bold uppercase tracking-wide text-cyan-900">
        {t('bundle.visual.timeline')}
      </span>
      <span role="list" className="relative mt-3 block min-w-0 border-s-2 border-cyan-200 ps-5">
        {token.entries.map((entry, index) => (
          <span
            key={index}
            role="listitem"
            className="relative mb-3 block min-w-0 rounded-lg border border-cyan-100 bg-white px-3 py-2.5 shadow-sm last:mb-0"
            data-knowledge-visual-row={index + 1}
            data-timeline-row={index + 1}
          >
            <span
              aria-hidden="true"
              className="absolute -start-[1.72rem] top-4 h-3 w-3 rounded-full bg-cyan-600 ring-4 ring-cyan-100"
            />
            <span className="block min-w-0 text-xs font-bold text-cyan-800 [overflow-wrap:anywhere]" data-timeline-when dir="auto">
              <span className="sr-only">{t('bundle.visual.when')}: </span>
              {renderValue(entry.when)}
            </span>
            <span className="mt-1 block min-w-0 overflow-x-auto text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]" data-timeline-title dir="auto">
              {renderValue(entry.title)}
            </span>
            {entry.detail ? (
              <span className="mt-1 block min-w-0 overflow-x-auto text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]" data-timeline-detail dir="auto">
                {renderValue(entry.detail)}
              </span>
            ) : null}
          </span>
        ))}
      </span>
    </span>
  );
}
