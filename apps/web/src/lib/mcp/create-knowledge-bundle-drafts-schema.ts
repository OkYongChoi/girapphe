import { z } from 'zod';
import { KNOWLEDGE_BUNDLE_TYPES } from '@stem-brain/shared';
import { knowledgeBundleContentSchema } from '@/lib/knowledge-bundles';
import {
  MAX_CREATE_CARD_DRAFTS_INPUT_BYTES,
  MCP_DRAFT_CREATE_SCOPE,
  evidenceSelectorSchema,
  knowledgeSourceUrlSchema,
  proposedRelationSchema,
  type KnowledgeDraftBatchInput,
} from './create-card-drafts-schema';

export const CREATE_KNOWLEDGE_BUNDLE_DRAFTS_TOOL_NAME = 'create_knowledge_bundle_drafts';
export { MCP_DRAFT_CREATE_SCOPE };

const OPAQUE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]+$/;
const opaqueIdentifier = (field: string, maxLength: number) => z.string().trim().min(1, `${field} is required.`)
  .max(maxLength).regex(OPAQUE_IDENTIFIER_PATTERN, `${field} must be an opaque identifier, not transcript content.`);
const draftBundleSchema = z.object({
  client_bundle_id: opaqueIdentifier('bundles[].client_bundle_id', 160).optional(),
  title: z.string().trim().min(1).max(120),
  central_question: z.string().trim().min(1).max(500),
  knowledge_type: z.enum(KNOWLEDGE_BUNDLE_TYPES),
  summary: z.string().trim().min(1).max(500),
  structured_content: knowledgeBundleContentSchema,
  bundle_schema_version: z.literal(1),
  topic: z.string().trim().min(1).max(48),
  tags: z.array(z.string().trim().min(1).max(48)).max(12),
  relations: z.array(proposedRelationSchema).max(12).optional(),
  evidence_selectors: z.array(evidenceSelectorSchema).max(24).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.knowledge_type !== value.structured_content.type) {
    ctx.addIssue({ code: 'custom', path: ['structured_content', 'type'], message: 'structured_content.type must match knowledge_type.' });
  }
});

export const createKnowledgeBundleDraftsInputSchema = z.object({
  provider: z.enum(['chatgpt', 'claude', 'gemini', 'other']),
  request_id: opaqueIdentifier('request_id', 160),
  provenance: z.object({
    type: z.literal('current_conversation'),
    conversation_ref: opaqueIdentifier('provenance.conversation_ref', 240),
    source_url: knowledgeSourceUrlSchema.optional(),
    discussed_at: z.string().datetime({ offset: true }).optional(),
  }).strict(),
  bundles: z.array(draftBundleSchema).min(1).max(50),
}).strict().superRefine((value, ctx) => {
  const ids = new Set<string>();
  value.bundles.forEach((bundle, bundleIndex) => {
    const effectiveId = bundle.client_bundle_id ?? `card-${bundleIndex + 1}`;
    if (ids.has(effectiveId)) {
      ctx.addIssue({ code: 'custom', path: ['bundles', bundleIndex, 'client_bundle_id'], message: 'client_bundle_id values, including generated defaults, must be unique.' });
    }
    ids.add(effectiveId);
    const tags = new Set<string>();
    bundle.tags?.forEach((tag, tagIndex) => {
      const key = tag.toLocaleLowerCase();
      if (tags.has(key)) ctx.addIssue({ code: 'custom', path: ['bundles', bundleIndex, 'tags', tagIndex], message: 'tags must not contain duplicates.' });
      tags.add(key);
    });
    bundle.relations?.forEach((relation, relationIndex) => {
      if (relation.target_kind === 'draft' && effectiveId === relation.target_id) {
        ctx.addIssue({ code: 'custom', path: ['bundles', bundleIndex, 'relations', relationIndex, 'target_id'], message: 'A bundle cannot relate to itself.' });
      }
    });
  });
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (bytes > MAX_CREATE_CARD_DRAFTS_INPUT_BYTES) {
    ctx.addIssue({ code: 'custom', path: ['bundles'], message: `The draft request must be at most ${MAX_CREATE_CARD_DRAFTS_INPUT_BYTES} UTF-8 bytes.` });
  }
});

export type CreateKnowledgeBundleDraftsToolInput = z.infer<typeof createKnowledgeBundleDraftsInputSchema>;

export function toKnowledgeBundleDraftBatchInput(input: CreateKnowledgeBundleDraftsToolInput): KnowledgeDraftBatchInput {
  return {
    provider: input.provider,
    requestId: input.request_id,
    conversationRef: input.provenance.conversation_ref,
    ...(input.provenance.source_url ? { sourceUrl: input.provenance.source_url } : {}),
    ...(input.provenance.discussed_at ? { discussedAt: input.provenance.discussed_at } : {}),
    cards: input.bundles.map((bundle, bundleIndex) => ({
      clientCardId: bundle.client_bundle_id ?? `card-${bundleIndex + 1}`,
      title: bundle.title,
      summary: bundle.summary,
      topic: bundle.topic,
      tags: bundle.tags,
      relations: bundle.relations?.map((relation) => ({
        targetKind: relation.target_kind,
        targetId: relation.target_id,
        type: relation.type,
        direction: relation.direction,
        weight: relation.weight,
      })),
      ...(bundle.evidence_selectors ? { proposedEvidence: bundle.evidence_selectors.map((evidence) => ({
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
    })),
  };
}
