'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import {
  parseKnowledgeText,
  type KnowledgeTextToken,
} from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';
import KnowledgeVisualBlock from './knowledge-visual-block';

const KnowledgeMath = dynamic(() => import('./knowledge-math'));

type KnowledgeTextProps = {
  text: string;
  className?: string;
  legacyDollarMath?: boolean;
  allowCodeCopy?: boolean;
  allowVisualBlocks?: boolean;
};

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand('copy')) throw new Error('Copy was rejected.');
  } finally {
    textarea.remove();
  }
}

function CodeToken({ token, allowCopy }: { token: Extract<KnowledgeTextToken, { type: 'code' }>; allowCopy: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  if (!token.block) {
    return (
      <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.92em] text-slate-900" dir="ltr">
        {token.value}
      </code>
    );
  }

  async function copyCode() {
    try {
      await copyToClipboard(token.value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span
      className="my-2 block overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
      data-knowledge-notation="code"
      role="group"
    >
      <span className="flex min-h-9 items-center justify-between gap-3 border-b border-slate-700 px-3 py-1 text-xs text-slate-300">
        <span className="truncate font-mono" dir="ltr">{token.language || t('bundle.notationCode')}</span>
        {allowCopy ? (
          <button
            type="button"
            className="min-h-8 shrink-0 rounded px-2 font-semibold text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            onBlur={() => setCopied(false)}
            onClick={() => void copyCode()}
          >
            {copied ? t('bundle.codeCopied') : t('bundle.copyCode')}
          </button>
        ) : null}
      </span>
      <span className="block overflow-x-auto p-3 text-start">
        <code className="block whitespace-pre font-mono text-xs leading-relaxed" dir="ltr">{token.value}</code>
      </span>
    </span>
  );
}

function renderToken(
  token: KnowledgeTextToken,
  index: number,
  allowCodeCopy: boolean,
  allowVisualBlocks: boolean,
  legacyDollarMath: boolean,
) {
  const key = `${index}-${token.type}`;
  switch (token.type) {
    case 'text':
      return <span key={key}>{token.value}</span>;
    case 'math':
      return <KnowledgeMath key={key} value={token.value} display={token.display} source={token.source} />;
    case 'code':
      return <CodeToken key={key} token={token} allowCopy={allowCodeCopy} />;
    case 'flow':
    case 'timeline':
      return allowVisualBlocks ? (
        <KnowledgeVisualBlock
          key={key}
          token={token}
          renderValue={(value) => (
            <KnowledgeText
              text={value}
              legacyDollarMath={legacyDollarMath}
              allowCodeCopy={false}
              allowVisualBlocks={false}
            />
          )}
        />
      ) : <span key={key}>{token.source}</span>;
  }
}

export default function KnowledgeText({
  text,
  className = '',
  legacyDollarMath = false,
  allowCodeCopy = true,
  allowVisualBlocks = true,
}: KnowledgeTextProps) {
  const tokens = useMemo<KnowledgeTextToken[]>(() => {
    return parseKnowledgeText(text, { legacyDollarMath });
  }, [legacyDollarMath, text]);

  return (
    <span className={`min-w-0 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] ${className}`.trim()}>
      {tokens.map((token, index) => renderToken(
        token,
        index,
        allowCodeCopy,
        allowVisualBlocks,
        legacyDollarMath,
      ))}
    </span>
  );
}
