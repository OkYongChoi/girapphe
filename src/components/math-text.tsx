'use client';

import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Renders a string containing mixed prose and LaTeX math.
 *
 * Delimiters:
 *   $$...$$ — display (block) math, centered
 *   $...$   — inline math
 *
 * Everything else is rendered as escaped HTML prose.
 */
export default function MathText({ text, className }: MathTextProps) {
  const html = renderMixedContent(text);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Rendering pipeline ──────────────────────────────────────────────

function renderMixedContent(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  let inDisplayMath = false;
  let mathBuffer = '';

  for (const line of lines) {
    if (inDisplayMath) {
      // We're inside a multi-line $$...$$ block
      const closeIdx = line.indexOf('$$');
      if (closeIdx !== -1) {
        mathBuffer += line.substring(0, closeIdx);
        result.push(renderKatex(mathBuffer.trim(), true));
        inDisplayMath = false;
        mathBuffer = '';
        const remainder = line.substring(closeIdx + 2).trim();
        if (remainder) result.push(processLine(remainder));
      } else {
        mathBuffer += line + '\n';
      }
      continue;
    }

    // Check for display math on this line
    const openIdx = line.indexOf('$$');
    if (openIdx !== -1) {
      const before = line.substring(0, openIdx);
      if (before.trim()) result.push(processLine(before));

      const afterOpen = line.substring(openIdx + 2);
      const closeIdx = afterOpen.indexOf('$$');

      if (closeIdx !== -1) {
        // Opening and closing $$ on the same line
        const mathContent = afterOpen.substring(0, closeIdx);
        result.push(renderKatex(mathContent.trim(), true));
        const remainder = afterOpen.substring(closeIdx + 2).trim();
        if (remainder) result.push(processLine(remainder));
      } else {
        // Display math spans multiple lines
        inDisplayMath = true;
        mathBuffer = afterOpen + '\n';
      }
      continue;
    }

    // Regular line — only inline math possible
    result.push(processLine(line));
  }

  return result.join('');
}

/** Process a single line for inline $...$ math */
function processLine(line: string): string {
  if (!line.trim()) return '<br/>';

  const parts: string[] = [];
  const regex = /\$([^$]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(line.substring(lastIndex, match.index)));
    }
    parts.push(renderKatex(match[1].trim(), false));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    parts.push(escapeHtml(line.substring(lastIndex)));
  }

  return `<p style="margin:0.25em 0">${parts.join('')}</p>`;
}

/** Render a LaTeX string to HTML via KaTeX */
function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return `<code>${escapeHtml(latex)}</code>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
