export type KnowledgeTextToken =
  | { type: 'text'; value: string }
  | { type: 'math'; value: string; display: boolean; source: string }
  | { type: 'code'; value: string; block: boolean; language?: string };

export type ParseKnowledgeTextOptions = {
  legacyDollarMath?: boolean;
};

type ParsedToken = {
  token: Exclude<KnowledgeTextToken, { type: 'text' }>;
  end: number;
};

type ExplicitMathCloseIndexes = {
  display: Int32Array;
  inline: Int32Array;
};

const FENCE = '```';
const FENCE_LANGUAGE = /^[A-Za-z0-9_+.-]+$/;

function appendText(tokens: KnowledgeTextToken[], value: string) {
  if (!value) return;
  const previous = tokens[tokens.length - 1];
  if (previous?.type === 'text') {
    previous.value += value;
    return;
  }
  tokens.push({ type: 'text', value });
}

function isLineStart(source: string, index: number) {
  return index === 0 || source[index - 1] === '\n';
}

function lineEnd(source: string, start: number) {
  const newline = source.indexOf('\n', start);
  const end = newline === -1 ? source.length : newline;
  return {
    end: end > start && source[end - 1] === '\r' ? end - 1 : end,
    newline,
  };
}

function parseFencedCode(source: string, start: number): ParsedToken | null {
  if (!isLineStart(source, start) || !source.startsWith(FENCE, start)) return null;

  const header = lineEnd(source, start + FENCE.length);
  if (header.newline === -1) return null;
  const language = source.slice(start + FENCE.length, header.end).trim();
  if (language && !FENCE_LANGUAGE.test(language)) return null;

  const contentStart = header.newline + 1;
  let closingStart = contentStart;
  while (closingStart <= source.length) {
    const closingLine = lineEnd(source, closingStart);
    if (source.startsWith(FENCE, closingStart)) {
      const suffix = source.slice(closingStart + FENCE.length, closingLine.end);
      if (/^[ \t]*$/.test(suffix)) {
        return {
          token: {
            type: 'code',
            value: source.slice(contentStart, closingStart),
            block: true,
            ...(language ? { language } : {}),
          },
          end: closingLine.end,
        };
      }
    }
    if (closingLine.newline === -1) break;
    closingStart = closingLine.newline + 1;
  }

  return null;
}

function backtickRunLength(source: string, start: number) {
  let end = start;
  while (source[end] === '`') end += 1;
  return end - start;
}

function findInlineCodeEnd(source: string, start: number, delimiterLength: number) {
  const delimiter = '`'.repeat(delimiterLength);
  let candidate = source.indexOf(delimiter, start);
  while (candidate !== -1) {
    if (backtickRunLength(source, candidate) === delimiterLength) return candidate;
    candidate = source.indexOf(delimiter, candidate + delimiterLength);
  }
  return -1;
}

function parseInlineCode(source: string, start: number): ParsedToken | null {
  const delimiterLength = backtickRunLength(source, start);
  if (delimiterLength < 1 || delimiterLength > 2) return null;
  const contentStart = start + delimiterLength;
  const end = findInlineCodeEnd(source, contentStart, delimiterLength);
  if (end === -1) return null;
  return {
    token: { type: 'code', value: source.slice(contentStart, end), block: false },
    end: end + delimiterLength,
  };
}

function indexExplicitMathClosers(source: string): ExplicitMathCloseIndexes {
  const display = new Int32Array(source.length + 1);
  const inline = new Int32Array(source.length + 1);
  display.fill(-1);
  inline.fill(-1);

  let nextDisplay = -1;
  let nextInline = -1;
  for (let index = source.length - 1; index >= 0; index -= 1) {
    if (source[index] === '\\') {
      if (source[index + 1] === ']') nextDisplay = index;
      if (source[index + 1] === ')') nextInline = index;
    }
    display[index] = nextDisplay;
    inline[index] = nextInline;
  }

  return { display, inline };
}

function parseExplicitMath(
  source: string,
  start: number,
  closeIndexes: ExplicitMathCloseIndexes,
): ParsedToken | null {
  const display = source.startsWith('\\[', start);
  const inline = source.startsWith('\\(', start);
  if (!display && !inline) return null;

  const close = display ? '\\]' : '\\)';
  const contentStart = start + 2;
  const end = (display ? closeIndexes.display : closeIndexes.inline)[contentStart] ?? -1;
  if (end === -1) return null;
  return {
    token: {
      type: 'math',
      value: source.slice(contentStart, end),
      display,
      source: source.slice(start, end + close.length),
    },
    end: end + close.length,
  };
}

function findSingleDollarEnd(source: string, start: number) {
  let end = source.indexOf('$', start);
  while (end !== -1) {
    if (source[end - 1] !== '$' && source[end + 1] !== '$') return end;
    end = source.indexOf('$', end + 1);
  }
  return -1;
}

function parseLegacyDollarMath(source: string, start: number): ParsedToken | null {
  if (source[start] !== '$') return null;
  const display = source.startsWith('$$', start);
  const delimiter = display ? '$$' : '$';
  const contentStart = start + delimiter.length;
  const end = display
    ? source.indexOf(delimiter, contentStart)
    : findSingleDollarEnd(source, contentStart);
  if (end === -1) return null;
  if (!display && source.slice(contentStart, end).includes('\n')) return null;
  return {
    token: {
      type: 'math',
      value: source.slice(contentStart, end),
      display,
      source: source.slice(start, end + delimiter.length),
    },
    end: end + delimiter.length,
  };
}

export function parseKnowledgeText(
  source: string,
  options: ParseKnowledgeTextOptions = {},
): KnowledgeTextToken[] {
  const tokens: KnowledgeTextToken[] = [];
  const explicitMathCloseIndexes = source.includes('\\(') || source.includes('\\[')
    ? indexExplicitMathClosers(source)
    : null;
  let index = 0;

  while (index < source.length) {
    if (source[index] === '`') {
      const fenced = parseFencedCode(source, index);
      if (fenced) {
        tokens.push(fenced.token);
        index = fenced.end;
        continue;
      }

      const inline = parseInlineCode(source, index);
      if (inline) {
        tokens.push(inline.token);
        index = inline.end;
        continue;
      }

      const runLength = backtickRunLength(source, index);
      appendText(tokens, source.slice(index, index + runLength));
      index += runLength;
      continue;
    }

    const explicitMath = explicitMathCloseIndexes
      ? parseExplicitMath(source, index, explicitMathCloseIndexes)
      : null;
    if (explicitMath) {
      tokens.push(explicitMath.token);
      index = explicitMath.end;
      continue;
    }

    if (options.legacyDollarMath && source[index] === '$') {
      const legacyMath = parseLegacyDollarMath(source, index);
      if (legacyMath) {
        tokens.push(legacyMath.token);
        index = legacyMath.end;
        continue;
      }
      const delimiterLength = source.startsWith('$$', index) ? 2 : 1;
      appendText(tokens, source.slice(index, index + delimiterLength));
      index += delimiterLength;
      continue;
    }

    appendText(tokens, source[index] ?? '');
    index += 1;
  }

  return tokens;
}

export function hasKnowledgeNotation(
  source: string,
  options: ParseKnowledgeTextOptions = {},
) {
  return parseKnowledgeText(source, options).some((token) => token.type !== 'text');
}

export function knowledgeTextRequiresBlockContainer(tokens: readonly KnowledgeTextToken[]) {
  return tokens.some((token) => (
    token.type === 'math' ? token.display : token.type === 'code' && token.block
  ));
}
