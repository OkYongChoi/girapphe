import { SUPPORTED_LOCALES, type Locale } from '@stem-brain/shared';

export const CONTENT_LOCALES = SUPPORTED_LOCALES;
export const CONTENT_TARGET_LOCALES = ['ja', 'zh-CN', 'es', 'ar', 'hi'] as const;

export type ContentLocale = Locale;
export type ContentTargetLocale = (typeof CONTENT_TARGET_LOCALES)[number];

const CONTENT_LOCALE_ALIASES: Record<string, ContentLocale> = {
  en: 'en',
  ja: 'ja',
  jp: 'ja',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  es: 'es',
  ar: 'ar',
  hi: 'hi',
};

export function parseContentLocale(value: string | null | undefined): ContentLocale | null {
  const normalized = value?.trim().replace(/_/g, '-').toLowerCase();
  if (!normalized) return null;
  return CONTENT_LOCALE_ALIASES[normalized]
    ?? CONTENT_LOCALE_ALIASES[normalized.split('-')[0]]
    ?? null;
}

export class ProtectedContentError extends Error {
  readonly code = 'PROTECTED_CONTENT_MISMATCH';

  constructor(message: string) {
    super(message);
    this.name = 'ProtectedContentError';
  }
}

export type ProtectedPlaceholder = {
  token: string;
  value: string;
};

export type MaskedProtectedContent = {
  masked: string;
  placeholders: ProtectedPlaceholder[];
  tokenPrefix: string;
  sourceNewlines: string[];
};

// Protect content that must survive a STEM translation byte-for-byte. Natural-language
// prose remains visible to the translation model; formulas, code, URLs and line breaks do not.
const PROTECTED_SEGMENT_PATTERN = /```[\s\S]*?```|`[^`\r\n]+`|https?:\/\/[^\s<>{}\[\]]+|\b[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+\b|(?<![\p{L}\p{N}_])--[a-z0-9][a-z0-9-]*(?:=[^\s,;]+)?|(?:\.\.?\/|\/)(?:[A-Za-z0-9_@.+~-]+\/)*[A-Za-z0-9_@.+~-]+|(?:[A-Za-z0-9_@.+~-]+\/)+[A-Za-z0-9_@.+~-]+|[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s]+|\b[A-Za-z0-9_@-]+\.(?:[A-Za-z0-9_-]+\.)*(?:ts|tsx|js|jsx|mjs|cjs|json|jsonc|md|sql|css|scss|html|py|go|rs|java|kt|swift|sh|yaml|yml|toml|env)\b|\b(?:npm|pnpm|npx|yarn|bun)\s+(?:install|add|remove|run|exec|dlx|test|build|dev)(?:\s+[A-Za-z0-9_@./:=~-]+)*|\b(?:git|docker|wrangler)\s+(?:clone|pull|push|checkout|switch|merge|rebase|commit|status|diff|log|build|run|deploy|dev)(?:\s+[A-Za-z0-9_@./:=~-]+)*|\$\$[\s\S]*?\$\$|\$[^$\r\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|[\p{L}\p{N}_()\[\]{}.+*\/^\u2070-\u209f-]{1,80}(?:[ \t]+[\p{L}\p{N}_()\[\]{}.+*\/^\u2070-\u209f-]{1,80}){0,4}[ \t]*(?:=|≈|≠|≤|≥|<|>)[ \t]*[\p{L}\p{N}_()\[\]{}.+*\/^\u2070-\u209f-]{1,80}(?:[ \t]+[\p{L}\p{N}_()\[\]{}.+*\/^\u2070-\u209f-]{1,80}){0,12}|@[a-z0-9._/-]+|\b[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+\b|\b[a-z]+[A-Z][A-Za-z0-9]*\b|\b[A-Z]{2,}(?:_[A-Z0-9]+)*\b|[A-Za-z][A-Za-z0-9_.-]*\([^\r\n)]{0,120}\)|[^\s,;:()]{0,32}[=≈≠≤≥∑∫√±×÷^][^\s,;:()]{0,48}|\b\d+(?:\.\d+)?\s?(?:%|ms|s|kg|g|km|cm|mm|nm|Hz|kHz|MHz|GHz|KB|MB|GB|TB)\b|\b[^\s]+[\u2070-\u209f][^\s]*\b|(?:\r\n|\r|\n)[\t ]*/gu;

function chooseTokenPrefix(source: string): string {
  let prefix = '__GPH_TRANSLATION_';
  while (source.includes(prefix)) prefix = `_${prefix}`;
  return prefix;
}

export function maskProtectedContent(source: string): MaskedProtectedContent {
  const tokenPrefix = chooseTokenPrefix(source);
  const placeholders: ProtectedPlaceholder[] = [];
  const masked = source.replace(PROTECTED_SEGMENT_PATTERN, (value) => {
    const token = `${tokenPrefix}${String(placeholders.length).padStart(4, '0')}__`;
    placeholders.push({ token, value });
    return token;
  });

  return {
    masked,
    placeholders,
    tokenPrefix,
    sourceNewlines: source.match(/\r\n|\r|\n/g) ?? [],
  };
}

function occurrenceCount(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

export function restoreProtectedContent(
  translated: string,
  maskedSource: MaskedProtectedContent
): string {
  let restored = translated;

  for (const placeholder of maskedSource.placeholders) {
    if (occurrenceCount(restored, placeholder.token) !== 1) {
      throw new ProtectedContentError('A protected placeholder was removed or duplicated.');
    }
    restored = restored.replace(placeholder.token, placeholder.value);
  }

  if (restored.includes(maskedSource.tokenPrefix)) {
    throw new ProtectedContentError('An unknown protected placeholder remained in the translation.');
  }

  const translatedNewlines = restored.match(/\r\n|\r|\n/g) ?? [];
  if (
    translatedNewlines.length !== maskedSource.sourceNewlines.length
    || translatedNewlines.some((newline, index) => newline !== maskedSource.sourceNewlines[index])
  ) {
    throw new ProtectedContentError('The translated content changed the source line structure.');
  }

  return restored;
}

export function splitContentForTranslation(
  source: string,
  maxChunkLength = 1_600,
  protectedTokens: string[] = []
): string[] {
  if (source.length <= maxChunkLength) return [source];

  const chunks: string[] = [];
  let remaining = source;
  const minimumNaturalCut = Math.floor(maxChunkLength * 0.45);
  const delimiters = ['\n\n', '\n', '. ', '; ', ', ', ' '];

  while (remaining.length > maxChunkLength) {
    const window = remaining.slice(0, maxChunkLength + 1);
    let cut = -1;

    for (const delimiter of delimiters) {
      const candidate = window.lastIndexOf(delimiter);
      if (candidate >= minimumNaturalCut) {
        cut = candidate + delimiter.length;
        break;
      }
    }

    if (cut < 1) cut = maxChunkLength;

    for (const token of protectedTokens) {
      const tokenStart = remaining.indexOf(token);
      if (tokenStart < 0) continue;
      const tokenEnd = tokenStart + token.length;
      if (tokenStart < cut && cut < tokenEnd) {
        cut = tokenStart > 0 ? tokenStart : tokenEnd;
        break;
      }
    }
    // Do not split a UTF-16 surrogate pair.
    const trailingCodeUnit = remaining.charCodeAt(cut - 1);
    if (trailingCodeUnit >= 0xd800 && trailingCodeUnit <= 0xdbff) cut -= 1;

    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}
