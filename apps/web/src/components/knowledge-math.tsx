'use client';

import { useMemo } from 'react';
import { renderKnowledgeMath } from '@/lib/knowledge-katex';

type KnowledgeMathProps = {
  value: string;
  display: boolean;
  source: string;
};

export default function KnowledgeMath({ value, display, source }: KnowledgeMathProps) {
  const html = useMemo(() => renderKnowledgeMath(value, display), [display, value]);

  if (!html) {
    return (
      <code className="rounded bg-rose-50 px-1 py-0.5 font-mono text-[0.92em] text-rose-800" dir="ltr">
        {source}
      </code>
    );
  }

  return (
    <span
      className={display
        ? 'my-2 block max-w-full overflow-x-auto py-1'
        : 'inline-block max-w-full align-middle'}
      data-knowledge-notation="math"
      dir="ltr"
      // KaTeX generated this HTML with trust disabled, strict errors, and finite limits.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
