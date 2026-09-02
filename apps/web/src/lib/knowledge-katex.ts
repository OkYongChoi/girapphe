import katex from 'katex';
import 'katex/contrib/mhchem';

const KATEX_OPTIONS = {
  output: 'htmlAndMathml',
  throwOnError: true,
  trust: false,
  strict: 'error',
  maxSize: 20,
  maxExpand: 1_000,
} as const;

export function knowledgeMathLiteral(value: string, displayMode: boolean): string {
  return displayMode ? `\\[${value}\\]` : `\\(${value}\\)`;
}

export function renderKnowledgeMath(value: string, displayMode: boolean): string | null {
  try {
    let rejectedTrustCommand = false;
    const markup = katex.renderToString(value, {
      ...KATEX_OPTIONS,
      displayMode,
      trust: () => {
        rejectedTrustCommand = true;
        return false;
      },
    });
    return rejectedTrustCommand ? null : markup;
  } catch {
    return null;
  }
}
