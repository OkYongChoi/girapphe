import 'server-only';

import { createHash } from 'node:crypto';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { localizeDomain, localizeLevel, localizeType } from '@stem-brain/shared';
import pool from '@/lib/db';
import { getStaticCardContent, type StaticCardContent } from '@/lib/static-card-content';
import { selectContentCursorBatch } from '@/lib/content-localization-cursor';
import {
  type ContentLocale,
  type ContentTargetLocale,
  CONTENT_TARGET_LOCALES,
  maskProtectedContent,
  parseContentLocale,
  ProtectedContentError,
  restoreProtectedContent,
  splitContentForTranslation,
} from '@/lib/content-translation-guards';

export { parseContentLocale } from '@/lib/content-translation-guards';
export type { ContentLocale } from '@/lib/content-translation-guards';

export const CONTENT_TRANSLATION_MODEL = '@cf/meta/m2m100-1.2b' as const;
export const MAX_PUBLIC_CONTENT_IDS = 12;
export const MAX_BACKFILL_CARDS = 3;
export const MAX_BACKFILL_NODES = 8;

const TARGET_LANGUAGE_CODES: Record<ContentTargetLocale, string> = {
  ja: 'ja',
  'zh-CN': 'zh',
  es: 'es',
  ar: 'ar',
  hi: 'hi',
};

type StoredTranslationStatus = 'machine' | 'reviewed' | 'human' | 'failed';
export type TranslationResolutionStatus =
  | 'source'
  | StoredTranslationStatus
  | 'partial'
  | 'fallback';

export type TranslationMetadata = {
  source_locale: 'en';
  resolved_locale: ContentLocale;
  translation_status: TranslationResolutionStatus;
  translation_error_code?: string;
};

type LocalizablePrerequisite = {
  id: string;
  label: string;
};

export type LocalizableKnowledgeCard = {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  domain?: string;
  type?: string;
  domain_label?: string;
  type_label?: string;
  level?: string;
  level_label?: string;
  aliases?: string[];
  related_concepts?: string[] | null;
  prerequisites?: LocalizablePrerequisite[] | null;
};

export type LocalizedKnowledgeCardTaxonomy = {
  domain?: string;
  type?: string;
  domain_label: string;
  type_label: string;
  level_label?: string;
  aliases: string[];
};

export type LocalizableGraphNode = {
  id: string;
  label: string;
  domain?: string;
  type?: string;
};

type CardTranslationRow = {
  card_id: string;
  locale: string;
  title: string | null;
  summary: string | null;
  explanation?: string | null;
  source_hash: string;
  list_source_hash: string | null;
  status: StoredTranslationStatus;
  error_code: string | null;
};

type NodeTranslationRow = {
  node_id: string;
  locale: string;
  label: string | null;
  domain_label: string | null;
  type_label: string | null;
  aliases: unknown;
  source_hash: string;
  status: StoredTranslationStatus;
  error_code: string | null;
};

type TranslationFailureCode =
  | 'AI_BINDING_UNAVAILABLE'
  | 'AI_EMPTY_RESPONSE'
  | 'AI_TRANSLATION_FAILED'
  | 'DATABASE_UNAVAILABLE'
  | 'PROTECTED_CONTENT_MISMATCH';

class ContentTranslationError extends Error {
  constructor(readonly code: TranslationFailureCode, message: string) {
    super(message);
    this.name = 'ContentTranslationError';
  }
}

let localizationSchemaReady = false;

type StaticContent = typeof import('@/lib/content-localization-static');

async function getStaticContent(): Promise<StaticContent> {
  return import('@/lib/content-localization-static');
}

function logLocalizationError(
  code: TranslationFailureCode,
  details: { kind: 'card' | 'node' | 'schema'; id?: string; locale?: string }
) {
  console.error(JSON.stringify({ message: 'content_localization_failed', code, ...details }));
}

function sourceHash(parts: Array<string | null | undefined>): string {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(part ?? '');
    hash.update('\u0000');
  }
  return hash.digest('hex');
}

function cardSourceHash(card: LocalizableKnowledgeCard): string {
  return sourceHash([card.title, card.summary, card.explanation]);
}

function cardListSourceHash(card: LocalizableKnowledgeCard): string {
  return createHash('md5')
    .update(`${card.title}\u001f${card.summary}`)
    .digest('hex');
}

function nodeSourceHash(node: LocalizableGraphNode): string {
  return sourceHash([node.label, node.domain, node.type]);
}

function isTargetLocale(locale: ContentLocale): locale is ContentTargetLocale {
  return CONTENT_TARGET_LOCALES.includes(locale as ContentTargetLocale);
}

function sourceMetadata(): TranslationMetadata {
  return {
    source_locale: 'en',
    resolved_locale: 'en',
    translation_status: 'source',
  };
}

function fallbackMetadata(errorCode?: string, failed = false): TranslationMetadata {
  return {
    source_locale: 'en',
    resolved_locale: 'en',
    translation_status: failed ? 'failed' : 'fallback',
    ...(errorCode ? { translation_error_code: errorCode } : {}),
  };
}

function partialFallbackMetadata(
  locale: ContentTargetLocale,
  errorCode?: string,
  failed = false
): TranslationMetadata {
  return {
    source_locale: 'en',
    resolved_locale: locale,
    translation_status: failed ? 'failed' : 'partial',
    ...(errorCode ? { translation_error_code: errorCode } : {}),
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function getAiBinding(): Ai | null {
  try {
    return getCloudflareContext().env.AI ?? null;
  } catch {
    return null;
  }
}

export async function ensureContentLocalizationSchema(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  if (localizationSchemaReady) return true;

  try {
    // Migrations own DDL. Keep request handlers read-only with respect to schema
    // and do not retain request-scoped database promises in module globals.
    await pool.query(`
      SELECT card_translation.list_source_hash, node_translation.node_id
      FROM knowledge_card_translations AS card_translation
      CROSS JOIN graph_node_translations AS node_translation
      LIMIT 0
    `);
    localizationSchemaReady = true;
    return true;
  } catch {
    logLocalizationError('DATABASE_UNAVAILABLE', { kind: 'schema' });
    return false;
  }
}

async function runTranslation(text: string, locale: ContentTargetLocale, ai: Ai): Promise<string> {
  if (!text.trim()) return text;

  const maskedSource = maskProtectedContent(text);
  const protectedTokens = maskedSource.placeholders.map((placeholder) => placeholder.token);
  const translatableText = protectedTokens.reduce(
    (value, token) => value.replace(token, ''),
    maskedSource.masked
  );
  if (!translatableText.trim()) return text;

  const translatedChunks: string[] = [];
  for (const chunk of splitContentForTranslation(maskedSource.masked, 1_600, protectedTokens)) {
    if (!chunk.trim()) {
      translatedChunks.push(chunk);
      continue;
    }

    const leadingWhitespace = chunk.match(/^\s*/)?.[0] ?? '';
    const trailingWhitespace = chunk.match(/\s*$/)?.[0] ?? '';
    const bodyEnd = trailingWhitespace ? chunk.length - trailingWhitespace.length : chunk.length;
    const body = chunk.slice(leadingWhitespace.length, bodyEnd);
    if (!body) {
      translatedChunks.push(chunk);
      continue;
    }

    const output = await ai.run(CONTENT_TRANSLATION_MODEL, {
      text: body,
      source_lang: 'en',
      target_lang: TARGET_LANGUAGE_CODES[locale],
    });
    const translatedText = output && typeof output === 'object' && 'translated_text' in output
      ? output.translated_text
      : undefined;
    if (typeof translatedText !== 'string' || !translatedText.trim()) {
      throw new ContentTranslationError('AI_EMPTY_RESPONSE', 'Workers AI returned no translated text.');
    }

    translatedChunks.push(
      `${leadingWhitespace}${translatedText}${trailingWhitespace}`
    );
  }

  return restoreProtectedContent(translatedChunks.join(''), maskedSource);
}

async function readCardTranslations(
  cards: LocalizableKnowledgeCard[],
  locale: ContentTargetLocale,
  includeExplanation = true,
): Promise<Map<string, CardTranslationRow>> {
  if (cards.length === 0) return new Map();
  const columns = includeExplanation
    ? 'card_id, locale, title, summary, explanation, source_hash, list_source_hash, status, error_code'
    : 'card_id, locale, title, summary, source_hash, list_source_hash, status, error_code';
  const result = await pool.query<CardTranslationRow>(
    `SELECT ${columns}
     FROM knowledge_card_translations
     WHERE locale = $1 AND card_id = ANY($2::text[])`,
    [locale, cards.map((card) => card.id)]
  );
  return new Map(result.rows.map((row) => [row.card_id, row]));
}

async function readNodeTranslations(
  nodes: LocalizableGraphNode[],
  locale: ContentTargetLocale
): Promise<Map<string, NodeTranslationRow>> {
  if (nodes.length === 0) return new Map();
  const result = await pool.query<NodeTranslationRow>(
    `SELECT node_id, locale, label, domain_label, type_label, aliases, source_hash, status, error_code
     FROM graph_node_translations
     WHERE locale = $1 AND node_id = ANY($2::text[])`,
    [locale, nodes.map((node) => node.id)]
  );
  return new Map(result.rows.map((row) => [row.node_id, row]));
}

async function saveCardTranslation(
  card: LocalizableKnowledgeCard,
  locale: ContentTargetLocale,
  translated: { title: string; summary: string; explanation: string }
): Promise<void> {
  await pool.query(
    `INSERT INTO knowledge_card_translations (
       card_id, locale, title, summary, explanation, source_hash, list_source_hash, status, error_code
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'machine', NULL)
     ON CONFLICT (card_id, locale) DO UPDATE SET
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       explanation = EXCLUDED.explanation,
       source_hash = EXCLUDED.source_hash,
       list_source_hash = EXCLUDED.list_source_hash,
       status = 'machine',
       error_code = NULL,
       updated_at = NOW()
     WHERE knowledge_card_translations.status = 'failed'
        OR knowledge_card_translations.status = 'machine'`,
    [
      card.id,
      locale,
      translated.title,
      translated.summary,
      translated.explanation,
      cardSourceHash(card),
      cardListSourceHash(card),
    ]
  );
}

async function saveNodeTranslation(
  node: LocalizableGraphNode,
  locale: ContentTargetLocale,
  translated: { label: string; domainLabel: string; typeLabel: string }
): Promise<void> {
  const aliases = Array.from(new Set([
    translated.label,
    node.label,
    translated.domainLabel,
    localizeDomain('en', node.domain ?? ''),
    translated.typeLabel,
    localizeType('en', node.type ?? ''),
  ].filter(Boolean)));
  await pool.query(
    `INSERT INTO graph_node_translations (
       node_id, locale, label, domain_label, type_label, aliases, source_hash, status, error_code
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'machine', NULL)
     ON CONFLICT (node_id, locale) DO UPDATE SET
       label = EXCLUDED.label,
       domain_label = EXCLUDED.domain_label,
       type_label = EXCLUDED.type_label,
       aliases = EXCLUDED.aliases,
       source_hash = EXCLUDED.source_hash,
       status = 'machine',
       error_code = NULL,
       updated_at = NOW()
     WHERE graph_node_translations.status = 'failed'
        OR graph_node_translations.status = 'machine'`,
    [
      node.id,
      locale,
      translated.label,
      translated.domainLabel,
      translated.typeLabel,
      JSON.stringify(aliases),
      nodeSourceHash(node),
    ]
  );
}

async function saveCardFailure(
  card: LocalizableKnowledgeCard,
  locale: ContentTargetLocale,
  errorCode: TranslationFailureCode
): Promise<void> {
  await pool.query(
    `INSERT INTO knowledge_card_translations (
       card_id, locale, source_hash, list_source_hash, status, error_code
     ) VALUES ($1, $2, $3, $4, 'failed', $5)
     ON CONFLICT (card_id, locale) DO UPDATE SET
       title = NULL,
       summary = NULL,
       explanation = NULL,
       source_hash = EXCLUDED.source_hash,
       list_source_hash = EXCLUDED.list_source_hash,
       status = 'failed',
       error_code = EXCLUDED.error_code,
       updated_at = NOW()
     WHERE knowledge_card_translations.status = 'failed'
        OR (
          knowledge_card_translations.status = 'machine'
          AND knowledge_card_translations.source_hash <> EXCLUDED.source_hash
        )`,
    [card.id, locale, cardSourceHash(card), cardListSourceHash(card), errorCode]
  );
}

async function saveNodeFailure(
  node: LocalizableGraphNode,
  locale: ContentTargetLocale,
  errorCode: TranslationFailureCode
): Promise<void> {
  await pool.query(
    `INSERT INTO graph_node_translations (
       node_id, locale, aliases, source_hash, status, error_code
     ) VALUES ($1, $2, '[]'::jsonb, $3, 'failed', $4)
     ON CONFLICT (node_id, locale) DO UPDATE SET
       label = NULL,
       domain_label = NULL,
       type_label = NULL,
       aliases = '[]'::jsonb,
       source_hash = EXCLUDED.source_hash,
       status = 'failed',
       error_code = EXCLUDED.error_code,
       updated_at = NOW()
     WHERE graph_node_translations.status = 'failed'
        OR (
          graph_node_translations.status = 'machine'
          AND graph_node_translations.source_hash <> EXCLUDED.source_hash
        )`,
    [node.id, locale, nodeSourceHash(node), errorCode]
  );
}

function translationErrorCode(error: unknown): TranslationFailureCode {
  if (error instanceof ProtectedContentError) return 'PROTECTED_CONTENT_MISMATCH';
  if (error instanceof ContentTranslationError) return error.code;
  return 'AI_TRANSLATION_FAILED';
}

function successfulCardRow(
  card: LocalizableKnowledgeCard,
  row: CardTranslationRow | undefined,
  includeExplanation = true,
): row is CardTranslationRow & { title: string; summary: string; explanation?: string } {
  const expectedSourceHash = includeExplanation ? cardSourceHash(card) : cardListSourceHash(card);
  const rowSourceHash = includeExplanation ? row?.source_hash : row?.list_source_hash;
  return Boolean(
    row
    && rowSourceHash === expectedSourceHash
    && row.status !== 'failed'
    && typeof row.title === 'string'
    && typeof row.summary === 'string'
    && (!includeExplanation || typeof row.explanation === 'string')
  );
}

function successfulNodeRow(
  node: LocalizableGraphNode,
  row: NodeTranslationRow | undefined
): row is NodeTranslationRow & { label: string; domain_label: string; type_label: string } {
  return Boolean(
    row
    && row.source_hash === nodeSourceHash(node)
    && row.status !== 'failed'
    && typeof row.label === 'string'
    && typeof row.domain_label === 'string'
    && typeof row.type_label === 'string'
  );
}

function staticNodeForCard(card: LocalizableKnowledgeCard, staticContent: StaticContent): LocalizableGraphNode | undefined {
  let nodeId = card.id;
  if (nodeId.startsWith('drill_')) {
    nodeId = nodeId.slice('drill_'.length).split('__')[0] ?? nodeId;
  } else if (nodeId.startsWith('graph_')) {
    nodeId = nodeId.slice('graph_'.length);
  }

  return staticContent.STATIC_NODE_BY_ID.get(nodeId)
    ?? staticContent.STATIC_NODE_BY_ID.get(staticContent.STATIC_NODE_ID_BY_LABEL.get(card.title) ?? '');
}

function relatedNodeIdForLabel(card: LocalizableKnowledgeCard, label: string, staticContent: StaticContent): string | undefined {
  const candidates = staticContent.STATIC_NODE_IDS_BY_LABEL.get(label);
  if (!candidates?.length) return undefined;
  if (candidates.length === 1) return candidates[0];

  // Duplicate display labels exist in the graph. Prefer a candidate connected
  // to this card's primary node instead of whichever duplicate happened to be
  // inserted last in a label map.
  const primaryNode = staticNodeForCard(card, staticContent);
  const relatedIds = primaryNode ? new Set(staticContent.RELATED_NODE_IDS.get(primaryNode.id) ?? []) : null;
  return relatedIds
    ? candidates.find((candidate) => relatedIds.has(candidate)) ?? candidates[0]
    : candidates[0];
}

function sourceCardTaxonomy(
  card: LocalizableKnowledgeCard,
  locale: ContentLocale,
  staticContent: StaticContent,
): LocalizedKnowledgeCardTaxonomy {
  const node = staticNodeForCard(card, staticContent);
  const stableDomain = card.domain ?? node?.domain;
  const stableType = card.type ?? node?.type;
  const canonicalDomain = node?.domain ?? stableDomain ?? '';
  const canonicalType = node?.type ?? stableType ?? '';
  const domainLabel = localizeDomain(locale, canonicalDomain);
  const typeLabel = localizeType(locale, canonicalType);
  const levelLabel = card.level ? localizeLevel(locale, card.level) : undefined;
  const aliases = Array.from(new Set([
    ...(card.aliases ?? []),
    card.title,
    node?.label,
    domainLabel,
    localizeDomain('en', canonicalDomain),
    typeLabel,
    localizeType('en', canonicalType),
  ].filter((value): value is string => Boolean(value))));

  return {
    ...(stableDomain ? { domain: stableDomain } : {}),
    ...(stableType ? { type: stableType } : {}),
    domain_label: domainLabel,
    type_label: typeLabel,
    ...(levelLabel ? { level_label: levelLabel } : {}),
    aliases,
  };
}

function fallbackNodeTaxonomy(node: LocalizableGraphNode, locale: ContentLocale) {
  const canonicalDomain = node.domain ?? '';
  const canonicalType = node.type ?? '';
  const domainLabel = localizeDomain(locale, canonicalDomain);
  const typeLabel = localizeType(locale, canonicalType);
  return {
    domain_label: domainLabel,
    type_label: typeLabel,
    aliases: Array.from(new Set([
      node.label,
      domainLabel,
      localizeDomain('en', canonicalDomain),
      typeLabel,
      localizeType('en', canonicalType),
    ].filter(Boolean))),
  };
}

function hasResolvedTranslation(content: TranslationMetadata, locale: ContentLocale): boolean {
  return content.resolved_locale === locale
    && (content.translation_status === 'source'
      || content.translation_status === 'machine'
      || content.translation_status === 'reviewed'
      || content.translation_status === 'human');
}

export async function localizeGraphNodes<T extends LocalizableGraphNode>(
  nodes: T[],
  requestedLocale: string | null | undefined,
  options?: { generateMissing?: boolean; maxGenerations?: number; retryFailed?: boolean }
): Promise<Array<T & TranslationMetadata & { aliases: string[]; domain_label: string; type_label: string }>> {
  const locale = parseContentLocale(requestedLocale) ?? 'en';
  if (locale === 'en') {
    return nodes.map((node) => ({
      ...node,
      ...fallbackNodeTaxonomy(node, locale),
      ...sourceMetadata(),
    }));
  }

  const schemaAvailable = await ensureContentLocalizationSchema();
  if (!schemaAvailable || !isTargetLocale(locale)) {
    return nodes.map((node) => ({
      ...node,
      ...fallbackNodeTaxonomy(node, locale),
      ...partialFallbackMetadata(locale, 'DATABASE_UNAVAILABLE'),
    }));
  }

  let cached: Map<string, NodeTranslationRow>;
  try {
    cached = await readNodeTranslations(nodes, locale);
  } catch {
    return nodes.map((node) => ({
      ...node,
      ...fallbackNodeTaxonomy(node, locale),
      ...partialFallbackMetadata(locale, 'DATABASE_UNAVAILABLE'),
    }));
  }

  const generateMissing = options?.generateMissing ?? false;
  let remainingGenerations = Math.max(0, options?.maxGenerations ?? (generateMissing ? 1 : 0));
  const ai = generateMissing ? getAiBinding() : null;

  for (const node of nodes) {
    const row = cached.get(node.id);
    if (successfulNodeRow(node, row)) continue;
    // Reviewed and human translations are operator-owned. If the English source
    // changes, fall back until a reviewer updates the row instead of silently
    // replacing curated work with machine output.
    if (row?.status === 'reviewed' || row?.status === 'human') continue;
    const matchingFailure = row?.source_hash === nodeSourceHash(node) && row.status === 'failed';
    if (
      !generateMissing
      || !ai
      || remainingGenerations <= 0
      || (matchingFailure && !options?.retryFailed)
    ) continue;

    remainingGenerations -= 1;
    try {
      const label = await runTranslation(node.label, locale, ai);
      const domainLabel = localizeDomain(locale, node.domain ?? '');
      const typeLabel = localizeType(locale, node.type ?? '');
      const translated = { label, domainLabel, typeLabel };
      try {
        await saveNodeTranslation(node, locale, translated);
      } catch {
        throw new ContentTranslationError('DATABASE_UNAVAILABLE', 'The translated node could not be cached.');
      }
      cached.set(node.id, {
        node_id: node.id,
        locale,
        label: translated.label,
        domain_label: translated.domainLabel,
        type_label: translated.typeLabel,
        aliases: [
          translated.label,
          node.label,
          translated.domainLabel,
          localizeDomain('en', node.domain ?? ''),
          translated.typeLabel,
          localizeType('en', node.type ?? ''),
        ].filter(Boolean),
        source_hash: nodeSourceHash(node),
        status: 'machine',
        error_code: null,
      });
    } catch (error) {
      const code = translationErrorCode(error);
      try {
        await saveNodeFailure(node, locale, code);
      } catch {
        logLocalizationError('DATABASE_UNAVAILABLE', { kind: 'node', id: node.id, locale });
      }
      cached.set(node.id, {
        node_id: node.id,
        locale,
        label: null,
        domain_label: null,
        type_label: null,
        aliases: [],
        source_hash: nodeSourceHash(node),
        status: 'failed',
        error_code: code,
      });
      logLocalizationError(code, { kind: 'node', id: node.id, locale });
    }
  }

  return nodes.map((node) => {
    const row = cached.get(node.id);
    if (!successfulNodeRow(node, row)) {
      const errorCode = row?.source_hash === nodeSourceHash(node) ? row.error_code ?? undefined : undefined;
      const missingAiCode = generateMissing && !ai ? 'AI_BINDING_UNAVAILABLE' : undefined;
      return {
        ...node,
        ...fallbackNodeTaxonomy(node, locale),
        ...partialFallbackMetadata(
          locale,
          errorCode ?? missingAiCode,
          row?.status === 'failed'
        ),
      };
    }
    return {
      ...node,
      label: row.label,
      domain_label: row.domain_label,
      type_label: row.type_label,
      aliases: asStringArray(row.aliases).length > 0
        ? asStringArray(row.aliases)
        : Array.from(new Set([
            row.label,
            node.label,
            row.domain_label,
            localizeDomain('en', node.domain ?? ''),
            row.type_label,
            localizeType('en', node.type ?? ''),
          ].filter(Boolean))),
      source_locale: 'en' as const,
      resolved_locale: locale,
      translation_status: row.status,
    };
  });
}

export async function localizeKnowledgeCards<T extends LocalizableKnowledgeCard>(
  cards: T[],
  requestedLocale: string | null | undefined,
  options?: {
    generateMissing?: boolean;
    maxGenerations?: number;
    maxRelatedGenerations?: number;
    includeExplanation?: boolean;
    includeRelationshipMetadata?: boolean;
    retryFailed?: boolean;
  }
): Promise<Array<T & TranslationMetadata & LocalizedKnowledgeCardTaxonomy>> {
  const staticContent = await getStaticContent();
  const includeExplanation = options?.includeExplanation ?? true;
  const locale = parseContentLocale(requestedLocale) ?? 'en';
  const includeRelationshipMetadata = options?.includeRelationshipMetadata ?? true;
  if (locale === 'en') {
    return cards.map((card) => ({
      ...card,
      ...sourceCardTaxonomy(card, locale, staticContent),
      ...sourceMetadata(),
    }));
  }

  const schemaAvailable = await ensureContentLocalizationSchema();
  if (!schemaAvailable || !isTargetLocale(locale)) {
    return cards.map((card) => ({
      ...card,
      ...sourceCardTaxonomy(card, locale, staticContent),
      ...partialFallbackMetadata(locale, 'DATABASE_UNAVAILABLE'),
    }));
  }

  let cached: Map<string, CardTranslationRow>;
  try {
    cached = await readCardTranslations(cards, locale, includeExplanation);
  } catch {
    return cards.map((card) => ({
      ...card,
      ...sourceCardTaxonomy(card, locale, staticContent),
      ...partialFallbackMetadata(locale, 'DATABASE_UNAVAILABLE'),
    }));
  }

  const generateMissing = options?.generateMissing ?? false;
  let remainingGenerations = Math.max(0, options?.maxGenerations ?? (generateMissing ? 1 : 0));
  const ai = generateMissing ? getAiBinding() : null;

  for (const card of cards) {
    const row = cached.get(card.id);
    if (successfulCardRow(card, row, includeExplanation)) continue;
    // Preserve curated translations even when their source hash becomes stale.
    // They remain stored for an explicit reviewer decision and are not served as
    // current until their source hash is updated.
    if (row?.status === 'reviewed' || row?.status === 'human') continue;
    const expectedSourceHash = includeExplanation ? cardSourceHash(card) : cardListSourceHash(card);
    const rowSourceHash = includeExplanation ? row?.source_hash : row?.list_source_hash;
    const matchingFailure = rowSourceHash === expectedSourceHash && row?.status === 'failed';
    if (
      !includeExplanation
      || !ai
      || remainingGenerations <= 0
      || (matchingFailure && !options?.retryFailed)
    ) continue;

    remainingGenerations -= 1;
    try {
      const [title, summary, explanation] = await Promise.all([
        runTranslation(card.title, locale, ai),
        runTranslation(card.summary, locale, ai),
        runTranslation(card.explanation, locale, ai),
      ]);
      const translated = { title, summary, explanation };
      try {
        await saveCardTranslation(card, locale, translated);
      } catch {
        throw new ContentTranslationError('DATABASE_UNAVAILABLE', 'The translated card could not be cached.');
      }
      cached.set(card.id, {
        card_id: card.id,
        locale,
        ...translated,
        source_hash: cardSourceHash(card),
        list_source_hash: cardListSourceHash(card),
        status: 'machine',
        error_code: null,
      });
    } catch (error) {
      const code = translationErrorCode(error);
      try {
        await saveCardFailure(card, locale, code);
      } catch {
        logLocalizationError('DATABASE_UNAVAILABLE', { kind: 'card', id: card.id, locale });
      }
      cached.set(card.id, {
        card_id: card.id,
        locale,
        title: null,
        summary: null,
        explanation: null,
        source_hash: cardSourceHash(card),
        list_source_hash: cardListSourceHash(card),
        status: 'failed',
        error_code: code,
      });
      logLocalizationError(code, { kind: 'card', id: card.id, locale });
    }
  }

  const relatedById = new Map<string, Awaited<ReturnType<typeof localizeGraphNodes>>[number]>();
  if (includeRelationshipMetadata) {
    const relatedNodesById = new Map<string, LocalizableGraphNode>();
    // Insert primary nodes first so a bounded single-card request always prioritizes
    // the card's own label/domain/type before optional related labels.
    for (const card of cards) {
      const node = staticNodeForCard(card, staticContent);
      if (node) relatedNodesById.set(node.id, node);
    }
    for (const card of cards) {
      for (const label of card.related_concepts ?? []) {
        const nodeId = relatedNodeIdForLabel(card, label, staticContent);
        const node = nodeId ? staticContent.STATIC_NODE_BY_ID.get(nodeId) : undefined;
        if (node) relatedNodesById.set(node.id, node);
      }
      for (const prerequisite of card.prerequisites ?? []) {
        const node = staticContent.STATIC_NODE_BY_ID.get(prerequisite.id);
        if (node) relatedNodesById.set(node.id, node);
      }
    }

    const localizedRelated = await localizeGraphNodes([...relatedNodesById.values()], locale, {
      generateMissing,
      maxGenerations: options?.maxRelatedGenerations
        ?? Math.min(10, Math.max(0, options?.maxGenerations ?? (generateMissing ? 1 : 0)) * 5),
      retryFailed: options?.retryFailed,
    });
    for (const node of localizedRelated) {
      relatedById.set(node.id, node);
    }
  }

  return cards.map((card) => {
    const row = cached.get(card.id);
    const contentResolved = successfulCardRow(card, row, includeExplanation);
    const sourceTaxonomy = sourceCardTaxonomy(card, locale, staticContent);
    const primaryNode = staticNodeForCard(card, staticContent);
    const translatedPrimary = includeRelationshipMetadata && primaryNode ? relatedById.get(primaryNode.id) : undefined;
    const primaryResolved = Boolean(
      primaryNode && translatedPrimary && hasResolvedTranslation(translatedPrimary, locale)
    );
    const taxonomy = translatedPrimary
      ? {
          ...sourceTaxonomy,
          domain_label: translatedPrimary.domain_label,
          type_label: translatedPrimary.type_label,
          aliases: translatedPrimary.aliases,
          ...(sourceTaxonomy.type ? {} : { type: translatedPrimary.type }),
        }
      : sourceTaxonomy;

    let relatedFallback = false;
    let translatedRelatedCount = 0;
    let relatedErrorCode: string | undefined;
    const relatedConcepts = includeRelationshipMetadata ? (card.related_concepts ?? []).map((label) => {
      const nodeId = relatedNodeIdForLabel(card, label, staticContent);
      const translatedNode = nodeId ? relatedById.get(nodeId) : undefined;
      if (!translatedNode || !hasResolvedTranslation(translatedNode, locale)) {
        relatedFallback = true;
        relatedErrorCode ??= translatedNode?.translation_error_code;
        return label;
      }
      translatedRelatedCount += 1;
      return translatedNode.label;
    }) : (card.related_concepts ?? []);
    const prerequisites = includeRelationshipMetadata ? (card.prerequisites ?? []).map((prerequisite) => {
      const translatedNode = relatedById.get(prerequisite.id);
      if (!translatedNode || !hasResolvedTranslation(translatedNode, locale)) {
        relatedFallback = true;
        relatedErrorCode ??= translatedNode?.translation_error_code;
        return prerequisite;
      }
      translatedRelatedCount += 1;
      return { ...prerequisite, label: translatedNode.label };
    }) : (card.prerequisites ?? []);

    const taxonomyFallback = includeRelationshipMetadata && Boolean(
      (primaryNode || sourceTaxonomy.domain_label || sourceTaxonomy.type_label) && !primaryResolved
    );
    const translatedAny = contentResolved || primaryResolved || translatedRelatedCount > 0;
    const expectedSourceHash = includeExplanation ? cardSourceHash(card) : cardListSourceHash(card);
    const rowSourceHash = includeExplanation ? row?.source_hash : row?.list_source_hash;
    const contentErrorCode = rowSourceHash === expectedSourceHash
      ? row?.error_code ?? undefined
      : undefined;
    const missingAiCode = generateMissing && !ai ? 'AI_BINDING_UNAVAILABLE' : undefined;
    const errorCode = contentErrorCode
      ?? (includeRelationshipMetadata ? translatedPrimary?.translation_error_code : undefined)
      ?? (includeRelationshipMetadata ? relatedErrorCode : undefined)
      ?? missingAiCode;
    const metadata: TranslationMetadata = contentResolved
      ? {
          source_locale: 'en',
          resolved_locale: locale,
          translation_status: taxonomyFallback || relatedFallback ? 'partial' : row.status,
          ...(errorCode ? { translation_error_code: errorCode } : {}),
        }
      : translatedAny
        ? {
            source_locale: 'en',
            resolved_locale: locale,
            translation_status: 'partial',
            ...(errorCode ? { translation_error_code: errorCode } : {}),
          }
        : fallbackMetadata(errorCode, row?.status === 'failed');

    return {
      ...card,
      ...taxonomy,
      aliases: contentResolved
        ? Array.from(new Set([...taxonomy.aliases, row.title]))
        : taxonomy.aliases,
      ...(contentResolved
        ? {
            title: row.title,
            summary: row.summary,
            ...(includeExplanation ? { explanation: row.explanation ?? card.explanation } : {}),
          }
        : {}),
      ...(includeRelationshipMetadata && card.related_concepts ? { related_concepts: relatedConcepts } : {}),
      ...(includeRelationshipMetadata && card.prerequisites ? { prerequisites } : {}),
      ...metadata,
    };
  });
}

export type PublicLocalizedContentItem = TranslationMetadata & {
  id: string;
  card_id: string | null;
  label: string;
  aliases: string[];
  domain: string;
  domain_label: string;
  type: string;
  type_label: string;
  title: string;
  summary: string | null;
  explanation: string | null;
  related_concepts: string[];
  related_nodes: Array<{ id: string; label: string }>;
};

export async function getApprovedPublicNodeId(value: string): Promise<string | null> {
  const { STATIC_NODE_BY_ID } = await getStaticContent();
  // Some canonical graph ids genuinely begin with `graph_`. Prefer the exact
  // allowlisted id before accepting the `graph_<nodeId>` card-id form.
  if (STATIC_NODE_BY_ID.has(value)) return value;
  if (!value.startsWith('graph_')) return null;
  const cardNodeId = value.slice('graph_'.length);
  return STATIC_NODE_BY_ID.has(cardNodeId) ? cardNodeId : null;
}

function publicCardSource(
  nodeId: string,
  staticContent: StaticContent,
  cardContent: StaticCardContent,
): LocalizableKnowledgeCard | null {
  const { RELATED_NODE_IDS, STATIC_NODE_BY_ID } = staticContent;
  const node = STATIC_NODE_BY_ID.get(nodeId);
  const content = cardContent[nodeId];
  if (!node || !content?.summary || !content?.explanation) return null;
  const relatedLabels = (RELATED_NODE_IDS.get(nodeId) ?? [])
    .map((relatedId) => STATIC_NODE_BY_ID.get(relatedId)?.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 4);
  return {
    id: `graph_${nodeId}`,
    title: node.label,
    summary: content.summary,
    explanation: content.explanation,
    related_concepts: relatedLabels,
  };
}

export async function getLocalizedPublicContent(
  ids: string[],
  requestedLocale: ContentLocale
): Promise<PublicLocalizedContentItem[]> {
  const staticContent = await getStaticContent();
  const cardContent = await getStaticCardContent();
  const { RELATED_NODE_IDS, STATIC_NODE_BY_ID } = staticContent;
  const approvedIds = await Promise.all(ids.map(getApprovedPublicNodeId));
  const nodeIds = Array.from(new Set(approvedIds.filter((id): id is string => Boolean(id))));
  const nodes = nodeIds.map((id) => STATIC_NODE_BY_ID.get(id)).filter((node): node is NonNullable<typeof node> => Boolean(node));
  const cards = nodeIds.map((id) => publicCardSource(id, staticContent, cardContent)).filter((card): card is LocalizableKnowledgeCard => Boolean(card));
  // Public reads are deliberately cache-only. Only the authenticated admin
  // backfill route may invoke Workers AI, preventing untrusted requests from
  // turning cache misses into translation spend.
  const localizedNodes = await localizeGraphNodes(nodes, requestedLocale, {
    generateMissing: false,
    maxGenerations: 0,
  });
  const localizedCards = await localizeKnowledgeCards(cards, requestedLocale, {
    generateMissing: false,
    maxGenerations: 0,
    maxRelatedGenerations: 0,
  });
  const nodeById = new Map(localizedNodes.map((node) => [node.id, node]));
  const cardByNodeId = new Map(localizedCards.map((card) => [card.id.slice('graph_'.length), card]));

  return nodeIds.map((nodeId) => {
    const node = nodeById.get(nodeId);
    const card = cardByNodeId.get(nodeId);
    const relatedIds = (RELATED_NODE_IDS.get(nodeId) ?? []).slice(0, 4);
    const relatedNodes = relatedIds.map((relatedId, index) => {
      const englishNode = STATIC_NODE_BY_ID.get(relatedId);
      const relatedLabel = card?.related_concepts?.[index];
      return { id: relatedId, label: relatedLabel ?? englishNode?.label ?? relatedId };
    });
    const resolvedCard = card && hasResolvedTranslation(card, requestedLocale) ? card : undefined;
    const resolvedNode = node && hasResolvedTranslation(node, requestedLocale) ? node : undefined;
    const metadata: TranslationMetadata = resolvedCard
      ? {
          source_locale: 'en',
          resolved_locale: requestedLocale,
          translation_status: resolvedNode ? resolvedCard.translation_status : 'partial',
          ...(resolvedCard.translation_error_code
            ? { translation_error_code: resolvedCard.translation_error_code }
            : {}),
        }
      : resolvedNode
        ? {
            source_locale: 'en',
            resolved_locale: requestedLocale,
            translation_status: card ? 'partial' : resolvedNode.translation_status,
            ...(card?.translation_error_code
              ? { translation_error_code: card.translation_error_code }
              : resolvedNode.translation_error_code
                ? { translation_error_code: resolvedNode.translation_error_code }
                : {}),
          }
        : card
          ? {
              source_locale: card.source_locale,
              resolved_locale: card.resolved_locale,
              translation_status: card.translation_status,
              ...(card.translation_error_code ? { translation_error_code: card.translation_error_code } : {}),
            }
          : node
            ? {
                source_locale: node.source_locale,
                resolved_locale: node.resolved_locale,
                translation_status: node.translation_status,
                ...(node.translation_error_code ? { translation_error_code: node.translation_error_code } : {}),
              }
            : fallbackMetadata();

    return {
      id: nodeId,
      card_id: card ? card.id : null,
      label: node?.label ?? STATIC_NODE_BY_ID.get(nodeId)?.label ?? nodeId,
      aliases: node?.aliases ?? [],
      domain: STATIC_NODE_BY_ID.get(nodeId)?.domain ?? 'other',
      domain_label: node?.domain_label
        ?? localizeDomain(requestedLocale, STATIC_NODE_BY_ID.get(nodeId)?.domain ?? 'other'),
      type: STATIC_NODE_BY_ID.get(nodeId)?.type ?? 'concept',
      type_label: node?.type_label
        ?? localizeType(requestedLocale, STATIC_NODE_BY_ID.get(nodeId)?.type ?? 'concept'),
      title: card?.title ?? node?.label ?? STATIC_NODE_BY_ID.get(nodeId)?.label ?? nodeId,
      summary: card?.summary ?? null,
      explanation: card?.explanation ?? null,
      related_concepts: card?.related_concepts ?? relatedNodes.map((related) => related.label),
      related_nodes: relatedNodes,
      ...metadata,
    };
  });
}

export type LocalizationBackfillKind = 'cards' | 'nodes';

export async function backfillLocalizedContentBatch(options: {
  kind: LocalizationBackfillKind;
  locale: ContentTargetLocale;
  after?: string;
  limit: number;
  retryFailed?: boolean;
}) {
  const staticContent = await getStaticContent();
  const { STATIC_NODE_BY_ID } = staticContent;
  if (!await ensureContentLocalizationSchema()) {
    throw new ContentTranslationError('DATABASE_UNAVAILABLE', 'The translation database is unavailable.');
  }
  if (!getAiBinding()) {
    throw new ContentTranslationError('AI_BINDING_UNAVAILABLE', 'The Workers AI binding is unavailable.');
  }

  const after = options.after ?? '';
  if (options.kind === 'nodes') {
    const batch = selectContentCursorBatch(STATIC_NODE_BY_ID.values(), after, options.limit);
    const nodes = batch.items;
    const localized = await localizeGraphNodes(nodes, options.locale, {
      generateMissing: true,
      maxGenerations: options.limit,
      retryFailed: options.retryFailed,
    });
    return {
      kind: options.kind,
      locale: options.locale,
      items: localized.map((node) => ({ id: node.id, status: node.translation_status })),
      next_cursor: batch.nextCursor,
      complete: batch.complete,
    };
  }

  const cardContent = await getStaticCardContent();
  const approvedCards = [...STATIC_NODE_BY_ID.keys()]
    .map((id) => publicCardSource(id, staticContent, cardContent))
    .filter((card): card is LocalizableKnowledgeCard => Boolean(card));
  const batch = selectContentCursorBatch(approvedCards, after, options.limit);
  const cards = batch.items;
  const localized = await localizeKnowledgeCards(cards, options.locale, {
    generateMissing: true,
    maxGenerations: options.limit,
    maxRelatedGenerations: Math.min(8, options.limit * 2),
    retryFailed: options.retryFailed,
  });
  return {
    kind: options.kind,
    locale: options.locale,
    items: localized.map((card) => ({ id: card.id, status: card.translation_status })),
    next_cursor: batch.nextCursor,
    complete: batch.complete,
  };
}
