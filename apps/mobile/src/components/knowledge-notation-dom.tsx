'use dom';

/* eslint-disable @typescript-eslint/no-require-imports -- Expo DOM bundles local assets through static require calls. */

import type { CSSProperties, ReactNode } from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem';
import './knowledge-katex-layout.css';
import {
  knowledgeTextRequiresBlockContainer,
  parseKnowledgeText,
  type KnowledgeTextToken,
} from '@stem-brain/shared';
import type { KnowledgeBundleNotationBlock, KnowledgeBundleTextTone } from '@/knowledge-bundle-notation';

type Direction = 'ltr' | 'rtl';

type SerializedTextStyle = {
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: 'normal' | 'italic';
  fontWeight?: number | string;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'auto' | 'center' | 'justify' | 'left' | 'right' | 'start' | 'end';
  textTransform?: 'capitalize' | 'lowercase' | 'none' | 'uppercase';
};

type Props = {
  source?: string;
  bundleBlocks?: KnowledgeBundleNotationBlock[];
  prefix?: string;
  direction: Direction;
  inline?: boolean;
  legacyDollarMath?: boolean;
  numberOfLines?: number;
  textStyle?: SerializedTextStyle;
  dom: import('expo/dom').DOMProps;
};

const KATEX_OPTIONS = {
  errorColor: '#b91c1c',
  maxExpand: 100,
  maxSize: 20,
  output: 'htmlAndMathml',
  strict: 'error',
  throwOnError: true,
  trust: false,
} as const;

const KATEX_FONTS = [
  ['KaTeX_AMS', 'normal', 400, require('../../assets/katex-fonts/KaTeX_AMS-Regular.woff2')],
  ['KaTeX_Caligraphic', 'normal', 700, require('../../assets/katex-fonts/KaTeX_Caligraphic-Bold.woff2')],
  ['KaTeX_Caligraphic', 'normal', 400, require('../../assets/katex-fonts/KaTeX_Caligraphic-Regular.woff2')],
  ['KaTeX_Fraktur', 'normal', 700, require('../../assets/katex-fonts/KaTeX_Fraktur-Bold.woff2')],
  ['KaTeX_Fraktur', 'normal', 400, require('../../assets/katex-fonts/KaTeX_Fraktur-Regular.woff2')],
  ['KaTeX_Main', 'normal', 700, require('../../assets/katex-fonts/KaTeX_Main-Bold.woff2')],
  ['KaTeX_Main', 'italic', 700, require('../../assets/katex-fonts/KaTeX_Main-BoldItalic.woff2')],
  ['KaTeX_Main', 'italic', 400, require('../../assets/katex-fonts/KaTeX_Main-Italic.woff2')],
  ['KaTeX_Main', 'normal', 400, require('../../assets/katex-fonts/KaTeX_Main-Regular.woff2')],
  ['KaTeX_Math', 'italic', 700, require('../../assets/katex-fonts/KaTeX_Math-BoldItalic.woff2')],
  ['KaTeX_Math', 'italic', 400, require('../../assets/katex-fonts/KaTeX_Math-Italic.woff2')],
  ['KaTeX_SansSerif', 'normal', 700, require('../../assets/katex-fonts/KaTeX_SansSerif-Bold.woff2')],
  ['KaTeX_SansSerif', 'italic', 400, require('../../assets/katex-fonts/KaTeX_SansSerif-Italic.woff2')],
  ['KaTeX_SansSerif', 'normal', 400, require('../../assets/katex-fonts/KaTeX_SansSerif-Regular.woff2')],
  ['KaTeX_Script', 'normal', 400, require('../../assets/katex-fonts/KaTeX_Script-Regular.woff2')],
  ['KaTeX_Size1', 'normal', 400, require('../../assets/katex-fonts/KaTeX_Size1-Regular.woff2')],
  ['KaTeX_Size2', 'normal', 400, require('../../assets/katex-fonts/KaTeX_Size2-Regular.woff2')],
  ['KaTeX_Size3', 'normal', 400, require('../../assets/katex-fonts/KaTeX_Size3-Regular.woff2')],
  ['KaTeX_Size4', 'normal', 400, require('../../assets/katex-fonts/KaTeX_Size4-Regular.woff2')],
  ['KaTeX_Typewriter', 'normal', 400, require('../../assets/katex-fonts/KaTeX_Typewriter-Regular.woff2')],
] as const;

const KATEX_FONT_CSS = KATEX_FONTS.map(
  ([family, style, weight, source]) =>
    `@font-face { font-family: ${family}; font-style: ${style}; font-weight: ${weight}; font-display: block; src: url("${source}") format("woff2"); }`,
).join('\n');

function tokenSource(token: KnowledgeTextToken) {
  if (token.type === 'text') return token.value;
  if (token.type === 'math') return token.source;
  if (!token.block) return `\`${token.value}\``;
  return `\`\`\`${token.language ?? ''}\n${token.value}\n\`\`\``;
}

function MathToken({ token }: { token: Extract<KnowledgeTextToken, { type: 'math' }> }) {
  try {
    let rejectedTrustCommand = false;
    const markup = katex.renderToString(token.value, {
      ...KATEX_OPTIONS,
      displayMode: token.display,
      trust: () => {
        rejectedTrustCommand = true;
        return false;
      },
    });
    if (rejectedTrustCommand) throw new Error('KaTeX command requires trust.');
    const Tag = token.display ? 'div' : 'span';
    return (
      <Tag
        className={token.display ? 'knowledge-math-display' : 'knowledge-math-inline'}
        dir="ltr"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  } catch {
    return <code className={token.display ? 'knowledge-error knowledge-block' : 'knowledge-error'}>{tokenSource(token)}</code>;
  }
}

function Token({ token }: { token: KnowledgeTextToken }) {
  if (token.type === 'text') return token.value;
  if (token.type === 'math') return <MathToken token={token} />;
  if (token.block) {
    return (
      <pre className="knowledge-code-block" dir="ltr">
        <code>{token.value}</code>
      </pre>
    );
  }
  return <code className="knowledge-code-inline" dir="ltr">{token.value}</code>;
}

function KnowledgeSource({ source, className = '', inline = false, legacyDollarMath = false }: { source: string; className?: string; inline?: boolean; legacyDollarMath?: boolean }) {
  const tokens = parseKnowledgeText(source, { legacyDollarMath });
  const containsBlockToken = knowledgeTextRequiresBlockContainer(tokens);
  const Tag = inline && !containsBlockToken ? 'span' : 'div';
  return (
    <Tag className={`knowledge-source-value ${className}`}>
      {tokens.map((token, index) => <Token key={`${token.type}-${index}`} token={token} />)}
    </Tag>
  );
}

function textToneClass(tone: KnowledgeBundleTextTone) {
  return `bundle-${tone}`;
}

function BundleBlock({ block }: { block: KnowledgeBundleNotationBlock }) {
  switch (block.kind) {
    case 'text':
      return (
        <div style={lineClampStyle(block.numberOfLines)}>
          <KnowledgeSource source={block.source} className={textToneClass(block.tone)} inline={block.tone === 'language' || block.tone === 'status'} legacyDollarMath={block.legacyDollarMath} />
        </div>
      );
    case 'lines':
      return (
        <ul className={`bundle-lines bundle-${block.tone}`}>
          {block.values.map((value, index) => (
            <li key={`${index}-${value}`}>
              <span aria-hidden="true" className="bundle-bullet">•</span>
              <KnowledgeSource source={value} />
            </li>
          ))}
        </ul>
      );
    case 'pairs':
      return (
        <dl className="bundle-pairs">
          {block.values.map((value, index) => (
            <div className="bundle-pair" key={`${index}-${value.first}`}>
              <dt><KnowledgeSource source={value.first} className="bundle-pair-title" /></dt>
              <dd><KnowledgeSource source={value.second} className="bundle-detail" /></dd>
            </div>
          ))}
        </dl>
      );
    case 'steps':
      return (
        <ol className="bundle-steps">
          {block.values.map((value) => (
            <li key={`${value.number}-${value.title}`}>
              <span aria-hidden="true" className="bundle-step-number">{value.number}</span>
              <div className="bundle-grow">
                <KnowledgeSource source={value.title} className="bundle-pair-title" />
                {value.detail ? <KnowledgeSource source={value.detail} className="bundle-detail" /> : null}
              </div>
            </li>
          ))}
        </ol>
      );
    case 'chips':
      return (
        <div className="bundle-chips">
          {block.values.map((value, index) => <KnowledgeSource key={`${index}-${value}`} source={value} className="bundle-chip" inline />)}
        </div>
      );
    case 'comparison':
      return (
        <div className="bundle-comparisons">
          {block.values.map((value, index) => (
            <section className="bundle-compare" key={`${index}-${value.name}`}>
              <KnowledgeSource source={value.name} className="bundle-compare-name" />
              <div className="bundle-compare-values">
                {value.values.map((item, valueIndex) => <KnowledgeSource key={`${valueIndex}-${item}`} source={item} className="bundle-compare-value" />)}
              </div>
            </section>
          ))}
        </div>
      );
    case 'stages':
      return (
        <ol className="bundle-stages">
          {block.values.map((value, index) => (
            <li key={`${index}-${value.title}`}>
              <div className="bundle-stage">
                <KnowledgeSource source={value.title} className="bundle-pair-title" />
                {value.detail ? <KnowledgeSource source={value.detail} className="bundle-detail" /> : null}
              </div>
              {index < block.values.length - 1 ? <span aria-hidden="true" className="bundle-arrow">↓</span> : null}
            </li>
          ))}
        </ol>
      );
    case 'components':
      return (
        <div className="bundle-components">
          {block.values.map((value, index) => (
            <section className="bundle-component" key={`${index}-${value.label}`} style={{ marginInlineStart: `${value.depth * 18}px` }}>
              <KnowledgeSource source={value.label} className="bundle-pair-title" />
              {value.role ? <KnowledgeSource source={value.role} className="bundle-detail" /> : null}
            </section>
          ))}
        </div>
      );
    case 'expression-hero':
      return (
        <section className="bundle-expression-hero">
          <KnowledgeSource source={block.expression} className="bundle-expression" />
          {block.pronunciation ? <KnowledgeSource source={block.pronunciation} className="bundle-pronunciation" /> : null}
          <KnowledgeSource source={block.language} className="bundle-language" inline />
        </section>
      );
    case 'evidence':
      return (
        <div className="bundle-evidence-list">
          {block.values.map((value, index) => (
            <section className="bundle-evidence" key={`${index}-${value.statement}`}>
              <KnowledgeSource source={value.statement} className="bundle-pair-title" />
              {value.details.map((detail, detailIndex) => (
                <KnowledgeSource key={`${detailIndex}-${detail.source}`} source={detail.source} className={textToneClass(detail.tone)} />
              ))}
            </section>
          ))}
        </div>
      );
  }
}

function toCssStyle(style: SerializedTextStyle | undefined): CSSProperties {
  if (!style) return {};
  return {
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
    fontWeight: style.fontWeight as CSSProperties['fontWeight'],
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight === undefined ? undefined : `${style.lineHeight}px`,
    textAlign: style.textAlign === 'auto' ? undefined : style.textAlign,
    textTransform: style.textTransform,
  };
}

function lineClampStyle(numberOfLines: number | undefined): CSSProperties {
  if (!numberOfLines || numberOfLines < 1) return {};
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: numberOfLines,
    overflow: 'hidden',
  };
}

export default function KnowledgeNotationDom({ source = '', bundleBlocks, prefix = '', direction, inline = false, legacyDollarMath = false, numberOfLines, textStyle }: Props) {
  const tokens = parseKnowledgeText(source, { legacyDollarMath });
  const children: ReactNode[] = tokens.map((token, index) => <Token key={`${token.type}-${index}`} token={token} />);
  const documentSizingCss = bundleBlocks || !inline
    ? 'html, body, #root { width: 100%; }'
    : 'html, body, #root { width: max-content; max-width: 100vw; }';

  return (
    <>
      <style>{`
        ${KATEX_FONT_CSS}
        :root { color-scheme: light; }
        html, body, #root { margin: 0; padding: 0; background: transparent; }
        ${documentSizingCss}
        html, body { max-width: 100%; }
        body { -webkit-text-size-adjust: 100%; }
        .knowledge-root { box-sizing: border-box; overflow-wrap: anywhere; white-space: pre-wrap; }
        .knowledge-root.block { display: block; width: 100%; }
        .knowledge-root.inline { display: inline-block; width: max-content; max-width: 100%; }
        .knowledge-math-inline { display: inline; direction: ltr; unicode-bidi: isolate; }
        .knowledge-math-display { display: block; direction: ltr; margin: 0.35em 0; max-width: 100%; overflow-x: auto; overflow-y: hidden; unicode-bidi: isolate; -webkit-overflow-scrolling: touch; }
        .knowledge-math-display .katex-display { margin: 0; text-align: start; }
        .knowledge-code-inline { border: 1px solid #d1d5db; border-radius: 0.3em; background: #f3f4f6; padding: 0.08em 0.28em; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; unicode-bidi: isolate; }
        .knowledge-code-block { box-sizing: border-box; margin: 0.35em 0; max-width: 100%; overflow-x: auto; border: 1px solid #d1d5db; border-radius: 0.45em; background: #111827; color: #f9fafb; padding: 0.65em 0.75em; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.88em; line-height: 1.45; white-space: pre; -webkit-overflow-scrolling: touch; }
        .knowledge-error { color: #b91c1c; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; }
        .knowledge-error.knowledge-block { display: block; overflow-x: auto; }
        .bundle-root { box-sizing: border-box; display: flex; width: 100%; flex-direction: column; gap: 9px; color: #374151; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; line-height: 19px; overflow-wrap: anywhere; }
        .knowledge-source-value { min-width: 0; white-space: pre-wrap; }
        .bundle-hero { border-radius: 8px; background: #eef2ff; color: #312e81; padding: 10px; font-size: 14px; font-weight: 700; line-height: 21px; }
        .bundle-title { color: #111827; font-size: 17px; font-weight: 900; line-height: 23px; }
        .bundle-question { color: #1e3a8a; font-size: 15px; font-weight: 800; line-height: 22px; }
        .bundle-summary, .bundle-body { color: #4b5563; font-size: 14px; line-height: 21px; }
        .bundle-meta { color: #607080; font-size: 14px; line-height: 21px; }
        .bundle-lines, .bundle-pairs, .bundle-steps, .bundle-stages { display: flex; margin: 0; padding: 0; flex-direction: column; list-style: none; }
        .bundle-lines { gap: 4px; }
        .bundle-lines li { display: grid; min-width: 0; grid-template-columns: auto minmax(0, 1fr); gap: 6px; align-items: start; }
        .bundle-bullet { color: currentColor; }
        .bundle-good { color: #166534; }
        .bundle-warn { color: #9f1239; }
        .bundle-pairs { gap: 7px; }
        .bundle-pair { border-inline-start: 3px solid #a78bfa; padding-inline-start: 9px; }
        .bundle-pair dt, .bundle-pair dd { margin: 0; }
        .bundle-pair-title { color: #111827; font-weight: 800; }
        .bundle-detail { margin-top: 2px; color: #4b5563; font-size: 13px; line-height: 18px; }
        .bundle-steps { gap: 9px; }
        .bundle-steps li { display: flex; align-items: flex-start; gap: 9px; border-radius: 8px; background: #f8fafc; padding: 9px; }
        .bundle-step-number { box-sizing: border-box; display: grid; width: 24px; height: 24px; flex: 0 0 24px; place-items: center; border-radius: 999px; background: #2563eb; color: white; font-size: 12px; font-weight: 900; direction: ltr; }
        .bundle-grow { min-width: 0; flex: 1; }
        .bundle-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .bundle-chip { border-radius: 999px; background: #dbeafe; color: #1e3a8a; padding: 5px 9px; font-size: 12px; font-weight: 800; }
        .bundle-comparisons { display: flex; flex-direction: column; gap: 9px; }
        .bundle-compare { overflow: hidden; border: 1px solid #e5e7eb; border-radius: 8px; }
        .bundle-compare-name { background: #f3f4f6; color: #111827; padding: 7px; font-weight: 800; }
        .bundle-compare-values { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
        .bundle-compare-value { padding: 7px; color: #374151; font-size: 12px; }
        .bundle-stage { border: 1px solid #bfdbfe; border-radius: 8px; background: #eff6ff; padding: 9px; }
        .bundle-arrow { display: block; color: #2563eb; text-align: center; font-weight: 900; direction: ltr; }
        .bundle-components, .bundle-evidence-list { display: flex; flex-direction: column; gap: 9px; }
        .bundle-component { border-inline-start: 3px solid #8b5cf6; border-radius: 6px; background: #faf5ff; padding: 8px; }
        .bundle-claim { border-inline-start: 4px solid #2563eb; background: #eff6ff; color: #111827; padding: 11px; font-size: 15px; line-height: 22px; font-weight: 800; }
        .bundle-evidence { border: 1px solid #bbf7d0; border-radius: 8px; background: #f0fdf4; padding: 9px; }
        .bundle-source { margin-top: 4px; color: #166534; font-size: 11px; }
        .bundle-answer { border-radius: 8px; background: #f0fdf4; color: #14532d; padding: 10px; font-size: 14px; line-height: 20px; font-weight: 700; }
        .bundle-status { display: inline-block; align-self: flex-start; border-radius: 999px; background: #ede9fe; color: #5b21b6; padding: 5px 9px; font-size: 11px; font-weight: 900; }
        .bundle-expression-hero { display: flex; flex-direction: column; gap: 3px; border: 1px solid #fed7aa; border-radius: 10px; background: #fff7ed; padding: 12px; }
        .bundle-expression { color: #9a3412; font-size: 20px; line-height: 27px; font-weight: 900; }
        .bundle-pronunciation { color: #7c2d12; font-size: 13px; font-style: italic; }
        .bundle-language { align-self: flex-start; color: #9a3412; font-size: 10px; font-weight: 900; text-transform: uppercase; }
      `}</style>
      {bundleBlocks ? (
        <div className="bundle-root" dir={direction}>
          {bundleBlocks.map((block, index) => <BundleBlock key={`${block.kind}-${index}`} block={block} />)}
        </div>
      ) : (
        <div
          className={`knowledge-root ${inline ? 'inline' : 'block'}`}
          dir={direction}
          style={{ ...toCssStyle(textStyle), ...lineClampStyle(numberOfLines) }}
        >
          {prefix}
          {children}
        </div>
      )}
    </>
  );
}
