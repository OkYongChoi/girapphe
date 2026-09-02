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

type FencedCodeResult = ParsedToken | { unclosed: true } | null;

type CodePartition =
  | { type: 'source'; value: string; parseMath: boolean }
  | Exclude<KnowledgeTextToken, { type: 'text' }>;

type LegacyMathDelimiter = '$' | '$$';

type ParsedMathSource = {
  tokens: KnowledgeTextToken[];
  unmatchedLegacyDelimiters: Set<LegacyMathDelimiter>;
  blockedLegacyDelimiters: Set<LegacyMathDelimiter>;
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

function appendCodeSource(
  partitions: CodePartition[],
  value: string,
  parseMath: boolean,
) {
  if (!value) return;
  const previous = partitions[partitions.length - 1];
  if (previous?.type === 'source' && previous.parseMath === parseMath) {
    previous.value += value;
    return;
  }
  partitions.push({ type: 'source', value, parseMath });
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

function parseFencedCode(source: string, start: number): FencedCodeResult {
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

  return { unclosed: true };
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
    const candidateRunLength = backtickRunLength(source, candidate);
    if (candidateRunLength === delimiterLength) return candidate;
    candidate = source.indexOf(delimiter, candidate + candidateRunLength);
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

function partitionKnowledgeCode(source: string): CodePartition[] {
  const partitions: CodePartition[] = [];
  let index = 0;

  while (index < source.length) {
    if (source[index] !== '`') {
      appendCodeSource(partitions, source[index] ?? '', true);
      index += 1;
      continue;
    }

    const fenced = parseFencedCode(source, index);
    if (fenced) {
      if ('unclosed' in fenced) {
        appendCodeSource(partitions, source.slice(index), false);
        break;
      }
      partitions.push(fenced.token);
      index = fenced.end;
      continue;
    }

    const inline = parseInlineCode(source, index);
    if (inline) {
      partitions.push(inline.token);
      index = inline.end;
      continue;
    }

    const runLength = backtickRunLength(source, index);
    if (runLength <= 2) {
      appendCodeSource(partitions, source.slice(index), false);
      break;
    }
    appendCodeSource(partitions, source.slice(index, index + runLength), true);
    index += runLength;
  }

  return partitions;
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

function legacyDelimiterMatchesAt(
  source: string,
  index: number,
  delimiter: LegacyMathDelimiter,
) {
  if (delimiter === '$$') return source.startsWith('$$', index);
  return source[index] === '$' && source[index - 1] !== '$' && source[index + 1] !== '$';
}

function sourceContainsLegacyDelimiter(source: string, delimiter: LegacyMathDelimiter) {
  return delimiter === '$$'
    ? source.includes('$$')
    : findSingleDollarEnd(source, 0) !== -1;
}

function advanceLegacyDelimiterState(
  source: string,
  delimiters: Set<LegacyMathDelimiter>,
) {
  for (const delimiter of delimiters) {
    if (
      sourceContainsLegacyDelimiter(source, delimiter)
      || (delimiter === '$' && source.includes('\n'))
    ) {
      delimiters.delete(delimiter);
    }
  }
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

function parseMathSource(
  source: string,
  options: ParseKnowledgeTextOptions,
  initialBlockedLegacyDelimiters: ReadonlySet<LegacyMathDelimiter>,
): ParsedMathSource {
  const tokens: KnowledgeTextToken[] = [];
  const explicitMathCloseIndexes = source.includes('\\(') || source.includes('\\[')
    ? indexExplicitMathClosers(source)
    : null;
  const blockedLegacyDelimiters = new Set(initialBlockedLegacyDelimiters);
  const unmatchedLegacyDelimiters = new Set<LegacyMathDelimiter>();
  let index = 0;

  while (index < source.length) {
    const explicitMath = explicitMathCloseIndexes
      ? parseExplicitMath(source, index, explicitMathCloseIndexes)
      : null;
    if (explicitMath) {
      const explicitSource = source.slice(index, explicitMath.end);
      advanceLegacyDelimiterState(explicitSource, blockedLegacyDelimiters);
      advanceLegacyDelimiterState(explicitSource, unmatchedLegacyDelimiters);
      tokens.push(explicitMath.token);
      index = explicitMath.end;
      continue;
    }

    if (options.legacyDollarMath && source[index] === '$') {
      const delimiter: LegacyMathDelimiter = source.startsWith('$$', index) ? '$$' : '$';
      if (blockedLegacyDelimiters.has(delimiter)) {
        const closesBlockedPair = legacyDelimiterMatchesAt(
          source,
          index,
          delimiter,
        );
        appendText(tokens, source.slice(index, index + delimiter.length));
        index += delimiter.length;
        if (closesBlockedPair) blockedLegacyDelimiters.delete(delimiter);
        continue;
      }
      const legacyMath = parseLegacyDollarMath(source, index);
      if (legacyMath) {
        const legacySource = source.slice(index, legacyMath.end);
        advanceLegacyDelimiterState(legacySource, blockedLegacyDelimiters);
        advanceLegacyDelimiterState(legacySource, unmatchedLegacyDelimiters);
        unmatchedLegacyDelimiters.delete(delimiter);
        tokens.push(legacyMath.token);
        index = legacyMath.end;
        continue;
      }
      unmatchedLegacyDelimiters.add(delimiter);
      appendText(tokens, source.slice(index, index + delimiter.length));
      index += delimiter.length;
      continue;
    }

    appendText(tokens, source[index] ?? '');
    if (source[index] === '\n') {
      blockedLegacyDelimiters.delete('$');
      unmatchedLegacyDelimiters.delete('$');
    }
    index += 1;
  }

  return { tokens, unmatchedLegacyDelimiters, blockedLegacyDelimiters };
}

export function parseKnowledgeText(
  source: string,
  options: ParseKnowledgeTextOptions = {},
): KnowledgeTextToken[] {
  const tokens: KnowledgeTextToken[] = [];
  // A legacy opener split from its greedy closer by code keeps ownership of one
  // compatible closer, but both delimiters remain literal across that boundary.
  let blockedLegacyDelimiters = new Set<LegacyMathDelimiter>();
  let unmatchedLegacyDelimiters = new Set<LegacyMathDelimiter>();

  for (const partition of partitionKnowledgeCode(source)) {
    if (partition.type !== 'source') {
      for (const delimiter of unmatchedLegacyDelimiters) {
        blockedLegacyDelimiters.add(delimiter);
      }
      unmatchedLegacyDelimiters = new Set();
      if (partition.type === 'code') {
        if (partition.block) blockedLegacyDelimiters.delete('$');
        advanceLegacyDelimiterState(partition.value, blockedLegacyDelimiters);
      }
      tokens.push(partition);
      continue;
    }
    if (!partition.parseMath) {
      appendText(tokens, partition.value);
      continue;
    }
    const parsed = parseMathSource(partition.value, options, blockedLegacyDelimiters);
    blockedLegacyDelimiters = parsed.blockedLegacyDelimiters;
    unmatchedLegacyDelimiters = parsed.unmatchedLegacyDelimiters;
    for (const token of parsed.tokens) {
      if (token.type === 'text') appendText(tokens, token.value);
      else tokens.push(token);
    }
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
