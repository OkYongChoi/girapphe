import { z } from 'zod';

export const GET_TOPIC_CONTEXT_TOOL_NAME = 'get_topic_context';
export const MCP_CONTEXT_READ_SCOPE = 'knowledge:context:read';
export const MAX_MCP_CONTEXT_PACK_BYTES = 256 * 1024;

const OPAQUE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]+$/;

const knowledgeItemIdSchema = z
  .string()
  .trim()
  .min(1, 'selection.item_ids[] cannot be blank.')
  .max(160, 'selection.item_ids[] must be at most 160 characters.')
  .regex(
    OPAQUE_IDENTIFIER_PATTERN,
    'selection.item_ids[] must be an opaque identifier, not transcript content.',
  );

const explicitItemSelectionSchema = z
  .object({
    type: z.literal('items'),
    item_ids: z
      .array(knowledgeItemIdSchema)
      .min(1, 'selection.item_ids must contain at least one item ID.')
      .max(100, 'selection.item_ids may contain at most 100 item IDs.'),
  })
  .strict()
  .superRefine((selection, context) => {
    const seen = new Set<string>();
    selection.item_ids.forEach((itemId, index) => {
      if (seen.has(itemId)) {
        context.addIssue({
          code: 'custom',
          path: ['item_ids', index],
          message: 'selection.item_ids must not contain duplicates.',
        });
      }
      seen.add(itemId);
    });
  });

const recentTopicSelectionSchema = z
  .object({
    type: z.literal('recent_topic'),
    limit: z
      .number()
      .int('selection.limit must be an integer.')
      .min(1, 'selection.limit must be at least 1.')
      .max(50, 'selection.limit may be at most 50.'),
  })
  .strict();

export const getTopicContextInputSchema = z
  .object({
    topic: z
      .string()
      .trim()
      .min(1, 'topic is required.')
      .max(120, 'topic must be at most 120 characters.'),
    format: z.enum(['json', 'markdown', 'yaml']),
    selection: z.union([
      explicitItemSelectionSchema,
      recentTopicSelectionSchema,
    ]),
  })
  .strict();

export type GetTopicContextToolInput = z.infer<typeof getTopicContextInputSchema>;

export type TopicContextPackInput = {
  topic: string;
  format: 'json' | 'markdown' | 'yaml';
  selection:
    | { type: 'items'; itemIds: string[] }
    | { type: 'recent_topic'; limit: number };
};

export function toTopicContextPackInput(
  input: GetTopicContextToolInput,
): TopicContextPackInput {
  return {
    topic: input.topic,
    format: input.format,
    selection: input.selection.type === 'items'
      ? { type: 'items', itemIds: input.selection.item_ids }
      : { type: 'recent_topic', limit: input.selection.limit },
  };
}
