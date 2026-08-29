import { z } from 'zod';
import type { KnowledgeBundleContent, KnowledgeBundleType } from '@stem-brain/shared';
import { conceptBundleFromLegacyCard } from '@/lib/knowledge-bundle-runtime';
import {
  MAX_KNOWLEDGE_SOURCE_URL_LENGTH,
  normalizeKnowledgeEvidenceSourceReference,
  normalizeKnowledgeSourceUrl,
} from '@/lib/knowledge-source-url';

export const CREATE_CARD_DRAFTS_TOOL_NAME = 'create_card_drafts';
export const MCP_DRAFT_CREATE_SCOPE = 'knowledge:drafts:create';
export const MAX_MCP_REQUEST_BYTES = 768 * 1024;
export const MAX_CREATE_CARD_DRAFTS_INPUT_BYTES = MAX_MCP_REQUEST_BYTES - 8 * 1024;

const OPAQUE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]+$/;

const opaqueIdentifier = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required.`)
    .max(maxLength, `${field} must be at most ${maxLength} characters.`)
    .regex(OPAQUE_IDENTIFIER_PATTERN, `${field} must be an opaque identifier, not transcript content.`);

const optionalText = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${field} cannot be blank when provided.`)
    .max(maxLength, `${field} must be at most ${maxLength} characters.`)
    .optional();

export const knowledgeSourceUrlSchema = z.string().trim().url().max(MAX_KNOWLEDGE_SOURCE_URL_LENGTH)
  .transform((value, ctx) => {
    const normalized = normalizeKnowledgeSourceUrl(value);
    if (normalized) return normalized;
    ctx.addIssue({
      code: 'custom',
      message: 'provenance.source_url must be credential-free HTTPS; query strings and fragments are not retained.',
    });
    return z.NEVER;
  });
const optionalHttpsUrl = knowledgeSourceUrlSchema.optional();
const optionalIsoTimestamp = z.string().datetime({ offset: true }).optional();

const evidenceSourceReferenceSchema = z.string().trim().min(1).max(MAX_KNOWLEDGE_SOURCE_URL_LENGTH)
  .transform((value, ctx) => {
    const normalized = normalizeKnowledgeEvidenceSourceReference(value);
    if (normalized) return normalized;
    ctx.addIssue({
      code: 'custom',
      message: 'evidence_selectors[].source_ref must be an opaque reference or credential-free HTTPS URL.',
    });
    return z.NEVER;
  });

export const proposedRelationSchema = z
  .object({
    target_kind: z.enum(['public', 'private', 'draft']),
    target_id: opaqueIdentifier('relations[].target_id', 160),
    type: z.enum([
      'related', 'prerequisite', 'generalizes', 'derived_from', 'equivalent_to',
      'supersedes', 'answers', 'supports', 'contradicts',
      'causes', 'contributes_to', 'enables', 'inhibits',
    ]),
    direction: z.enum(['outgoing', 'incoming']).optional(),
    weight: z.number().finite().positive().max(1).optional(),
    evidence_selector_indexes: z.array(z.number().int().min(0).max(23)).max(24).optional(),
  })
  .strict();

const evidenceMetadata = {
  polarity: z.enum(['supports', 'contradicts']).default('supports'),
  quality: z.enum(['unknown', 'low', 'medium', 'high']).default('unknown'),
  relation_origin: z.enum(['explicit_user', 'extracted_from_source', 'model_inferred']).default('model_inferred'),
};

export const evidenceSelectorSchema = z.discriminatedUnion('selector_type', [
  z.object({
    selector_type: z.literal('message'),
    message_ref: opaqueIdentifier('evidence_selectors[].message_ref', 240),
    ...evidenceMetadata,
  }).strict(),
  z.object({
    selector_type: z.literal('external_ref'),
    source_ref: evidenceSourceReferenceSchema,
    ...evidenceMetadata,
  }).strict(),
  z.object({
    selector_type: z.literal('text_position'),
    start: z.number().int().min(0).max(9_999_999),
    end: z.number().int().min(1).max(10_000_000),
    ...evidenceMetadata,
  }).strict().refine((value) => value.end > value.start, 'text_position end must be after start.'),
  z.object({
    selector_type: z.literal('line_range'),
    line_start: z.number().int().min(1).max(1_000_000),
    line_end: z.number().int().min(1).max(1_000_000),
    ...evidenceMetadata,
  }).strict().refine((value) => value.line_end >= value.line_start, 'line_range end must not be before start.'),
]);

const draftCardSchema = z
  .object({
    client_card_id: opaqueIdentifier('cards[].client_card_id', 160).optional(),
    title: z
      .string()
      .trim()
      .min(1, 'cards[].title is required.')
      .max(120, 'cards[].title must be at most 120 characters.'),
    summary: optionalText('cards[].summary', 500),
    explanation: optionalText('cards[].explanation', 6000),
    topic: optionalText('cards[].topic', 48),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'cards[].tags[] cannot be blank.')
          .max(48, 'cards[].tags[] must be at most 48 characters.')
      )
      .max(12, 'cards[].tags may contain at most 12 tags.')
      .optional(),
    relations: z
      .array(proposedRelationSchema)
      .max(12, 'cards[].relations may contain at most 12 relations.')
      .optional(),
    evidence_selectors: z.array(evidenceSelectorSchema)
      .max(24, 'cards[].evidence_selectors may contain at most 24 selectors.')
      .optional(),
  })
  .strict();

/**
 * The MCP-facing schema intentionally accepts only concise, user-approved
 * draft fields. It has no transcript/messages/history field and every object
 * is strict so raw conversation payloads cannot be smuggled through extras.
 */
export const createCardDraftsInputSchema = z
  .object({
    provider: z.enum(['chatgpt', 'claude', 'gemini', 'other']),
    request_id: opaqueIdentifier('request_id', 160),
    provenance: z
      .object({
        type: z.literal('current_conversation'),
        conversation_ref: opaqueIdentifier('provenance.conversation_ref', 240),
        source_url: optionalHttpsUrl,
        discussed_at: optionalIsoTimestamp,
      })
      .strict(),
    cards: z.array(draftCardSchema).min(1, 'At least one draft card is required.').max(50, 'At most 50 draft cards may be created per request.'),
  })
  .strict()
  .superRefine((value, ctx) => {
    const clientCardIds = new Set<string>();
    const tagKeys = new Set<string>();

    for (const [cardIndex, card] of value.cards.entries()) {
      if (card.client_card_id) {
        if (clientCardIds.has(card.client_card_id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['cards', cardIndex, 'client_card_id'],
            message: 'cards[].client_card_id values must be unique within a request.',
          });
        }
        clientCardIds.add(card.client_card_id);
      }

      tagKeys.clear();
      for (const [tagIndex, tag] of (card.tags ?? []).entries()) {
        const key = tag.toLocaleLowerCase();
        if (tagKeys.has(key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['cards', cardIndex, 'tags', tagIndex],
            message: 'cards[].tags must not contain duplicates.',
          });
        }
        tagKeys.add(key);
      }

      for (const [relationIndex, relation] of (card.relations ?? []).entries()) {
        if (
          relation.target_kind === 'draft' &&
          card.client_card_id &&
          relation.target_id === card.client_card_id
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['cards', cardIndex, 'relations', relationIndex, 'target_id'],
            message: 'A draft card cannot relate to itself.',
          });
        }
        const indexes = relation.evidence_selector_indexes ?? [];
        if (new Set(indexes).size !== indexes.length || indexes.some((index) => index >= (card.evidence_selectors?.length ?? 0))) {
          ctx.addIssue({
            code: 'custom',
            path: ['cards', cardIndex, 'relations', relationIndex, 'evidence_selector_indexes'],
            message: 'Relation evidence indexes must be unique and reference this card evidence_selectors array.',
          });
        }
        if (['causes', 'contributes_to', 'enables', 'inhibits'].includes(relation.type) && indexes.length === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['cards', cardIndex, 'relations', relationIndex, 'evidence_selector_indexes'],
            message: 'Conversation-derived causal relations require at least one evidence selector.',
          });
        }
      }
    }

    const serializedBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (serializedBytes > MAX_CREATE_CARD_DRAFTS_INPUT_BYTES) {
      ctx.addIssue({
        code: 'custom',
        path: ['cards'],
        message: `The draft request must be at most ${MAX_CREATE_CARD_DRAFTS_INPUT_BYTES} UTF-8 bytes.`,
      });
    }
  });

export type CreateCardDraftsToolInput = z.infer<typeof createCardDraftsInputSchema>;

export type KnowledgeDraftBatchInput = {
  provider: CreateCardDraftsToolInput['provider'];
  requestId: string;
  conversationRef: string;
  sourceUrl?: string;
  discussedAt?: string;
  cards: Array<{
    clientCardId?: string;
    title: string;
    summary?: string;
    explanation?: string;
    topic?: string;
    tags?: string[];
    relations?: Array<{
      targetKind: 'public' | 'private' | 'draft';
      targetId: string;
      type: 'related' | 'prerequisite' | 'generalizes' | 'derived_from' | 'equivalent_to' | 'supersedes' | 'answers' | 'supports' | 'contradicts' | 'causes' | 'contributes_to' | 'enables' | 'inhibits';
      direction?: 'outgoing' | 'incoming';
      weight?: number;
      evidenceSelectorIndexes?: number[];
    }>;
    proposedEvidence?: Array<{
      selectorType: 'message' | 'external_ref' | 'text_position' | 'line_range';
      sourceRef?: string;
      messageRef?: string;
      start?: number;
      end?: number;
      lineStart?: number;
      lineEnd?: number;
      polarity: 'supports' | 'contradicts';
      quality: 'unknown' | 'low' | 'medium' | 'high';
      relationOrigin: 'explicit_user' | 'extracted_from_source' | 'model_inferred';
    }>;
    knowledgeType?: KnowledgeBundleType;
    centralQuestion?: string;
    structuredContent?: KnowledgeBundleContent;
    bundleSchemaVersion?: 1;
  }>;
};

export function toKnowledgeDraftBatchInput(input: CreateCardDraftsToolInput): KnowledgeDraftBatchInput {
  return {
    provider: input.provider,
    requestId: input.request_id,
    conversationRef: input.provenance.conversation_ref,
    ...(input.provenance.source_url ? { sourceUrl: input.provenance.source_url } : {}),
    ...(input.provenance.discussed_at ? { discussedAt: input.provenance.discussed_at } : {}),
    cards: input.cards.map((card) => {
      const bundle = conceptBundleFromLegacyCard(card.title, card.summary, card.explanation);
      return {
        clientCardId: card.client_card_id,
        title: card.title,
        summary: card.summary,
        explanation: card.explanation,
        topic: card.topic,
        tags: card.tags,
        relations: card.relations?.map((relation) => ({
          targetKind: relation.target_kind,
          targetId: relation.target_id,
          type: relation.type,
          direction: relation.direction,
          weight: relation.weight,
          ...(relation.evidence_selector_indexes ? { evidenceSelectorIndexes: relation.evidence_selector_indexes } : {}),
        })),
        ...(card.evidence_selectors ? { proposedEvidence: card.evidence_selectors.map((evidence) => ({
          selectorType: evidence.selector_type,
          ...('source_ref' in evidence ? { sourceRef: evidence.source_ref } : {}),
          ...('message_ref' in evidence ? { messageRef: evidence.message_ref } : {}),
          ...('start' in evidence ? { start: evidence.start, end: evidence.end } : {}),
          ...('line_start' in evidence ? { lineStart: evidence.line_start, lineEnd: evidence.line_end } : {}),
          polarity: evidence.polarity,
          quality: evidence.quality,
          relationOrigin: evidence.relation_origin,
        })) } : {}),
        knowledgeType: bundle.knowledge_type,
        centralQuestion: bundle.central_question,
        structuredContent: bundle.structured_content,
        bundleSchemaVersion: bundle.bundle_schema_version,
      };
    }),
  };
}
