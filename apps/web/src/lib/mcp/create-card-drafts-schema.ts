import { z } from 'zod';
import type { KnowledgeBundleContent, KnowledgeBundleType } from '@stem-brain/shared';
import { conceptBundleFromLegacyCard } from '@/lib/knowledge-bundle-runtime';

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

export const proposedRelationSchema = z
  .object({
    target_kind: z.enum(['public', 'private', 'draft']),
    target_id: opaqueIdentifier('relations[].target_id', 160),
    type: z.enum(['related', 'prerequisite', 'generalizes', 'derived_from', 'equivalent_to']),
    direction: z.enum(['outgoing', 'incoming']).optional(),
    weight: z.number().finite().positive().max(1).optional(),
  })
  .strict();

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
      type: 'related' | 'prerequisite' | 'generalizes' | 'derived_from' | 'equivalent_to';
      direction?: 'outgoing' | 'incoming';
      weight?: number;
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
        })),
        knowledgeType: bundle.knowledge_type,
        centralQuestion: bundle.central_question,
        structuredContent: bundle.structured_content,
        bundleSchemaVersion: bundle.bundle_schema_version,
      };
    }),
  };
}
