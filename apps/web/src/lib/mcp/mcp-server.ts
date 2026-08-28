import { createMcpHandler, McpServer, type AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  CREATE_CARD_DRAFTS_TOOL_NAME,
  createCardDraftsInputSchema,
  MCP_DRAFT_CREATE_SCOPE,
  toKnowledgeDraftBatchInput,
  type KnowledgeDraftBatchInput,
} from './create-card-drafts-schema';
import {
  CREATE_KNOWLEDGE_BUNDLE_DRAFTS_TOOL_NAME,
  createKnowledgeBundleDraftsInputSchema,
  toKnowledgeBundleDraftBatchInput,
} from './create-knowledge-bundle-drafts-schema';
import {
  GET_TOPIC_CONTEXT_TOOL_NAME,
  getTopicContextInputSchema,
  MAX_MCP_CONTEXT_PACK_BYTES,
  MCP_CONTEXT_READ_SCOPE,
  toTopicContextPackInput,
  type TopicContextPackInput,
} from './get-topic-context-schema';

export type McpDraftPrincipal = {
  userId: string;
  /** Opaque PAT record ID or OAuth user/client fingerprint used by MCP state. */
  tokenId: string;
  /** Only Girapphe-issued PATs are persisted as batch token provenance. */
  sourceTokenId: string | null;
  scopes: string[];
};

export type DraftBatchResult = {
  batchId: string;
  created: boolean;
  draftCount: number;
  reviewPath: string;
};

export type CreateDraftBatch = (
  userId: string,
  input: KnowledgeDraftBatchInput,
  sourceTokenId: string | null
) => Promise<DraftBatchResult>;

export type TopicContextPackResult = {
  /** Serialized canonical Topic Hub context in the requested format. */
  content: string;
  /** Number of confirmed, active knowledge items included in content. */
  itemCount: number;
};

/**
 * The route-provided dependency must build this result from the owner-scoped
 * canonical Topic Hub only, then persist `reused` activity before resolving.
 * It must never include source transcripts or unconfirmed draft content.
 */
export type GetContextPack = (
  userId: string,
  input: TopicContextPackInput,
) => Promise<TopicContextPackResult>;

const createCardDraftsOutputSchema = z
  .object({
    status: z.literal('pending'),
    batch_id: z.string().trim().min(1).max(160),
    created: z.boolean(),
    draft_count: z.number().int().min(0).max(50),
    review_path: z.string().startsWith('/').max(512),
  })
  .strict();

const createKnowledgeBundleDraftsOutputSchema = z.object({
  status: z.literal('pending'),
  batch_id: z.string().trim().min(1).max(160),
  created: z.boolean(),
  bundle_count: z.number().int().min(0).max(50),
  review_path: z.string().startsWith('/').max(512),
}).strict();

const topicContextPackResultSchema = z
  .object({
    content: z.string().min(1).superRefine((content, context) => {
      if (new TextEncoder().encode(content).byteLength > MAX_MCP_CONTEXT_PACK_BYTES) {
        context.addIssue({
          code: 'custom',
          message: `The context pack must be at most ${MAX_MCP_CONTEXT_PACK_BYTES} UTF-8 bytes.`,
        });
      }
    }),
    itemCount: z.number().int().min(1).max(100),
  })
  .strict();

const getTopicContextOutputSchema = z
  .object({
    status: z.literal('confirmed_context'),
    topic: z.string().trim().min(1).max(120),
    format: z.enum(['json', 'markdown', 'yaml']),
    selection_type: z.enum(['items', 'recent_topic']),
    item_count: z.number().int().min(1).max(100),
  })
  .strict();

/**
 * Converts the already-validated, user-scoped token record into the shape the
 * MCP SDK carries through its request factory. The token value is deliberately
 * the token identifier rather than the bearer secret, so a raw credential is
 * never retained by the SDK or made available to a tool callback.
 */
export function toMcpAuthInfo(principal: McpDraftPrincipal): AuthInfo {
  return {
    token: principal.tokenId,
    clientId: `girapphe:${principal.userId}`,
    scopes: principal.scopes,
    extra: {
      userId: principal.userId,
      tokenId: principal.tokenId,
      sourceTokenId: principal.sourceTokenId,
    },
  };
}

function principalFromAuthInfo(authInfo: AuthInfo | undefined): McpDraftPrincipal | null {
  const extra = authInfo?.extra;
  const userId = extra?.userId;
  const tokenId = extra?.tokenId;
  const sourceTokenId = extra?.sourceTokenId;

  if (typeof userId !== 'string' || typeof tokenId !== 'string'
    || (sourceTokenId !== null && typeof sourceTokenId !== 'string')) return null;

  return {
    userId,
    tokenId,
    sourceTokenId,
    scopes: authInfo?.scopes ?? [],
  };
}

function createMcpServer(
  principal: McpDraftPrincipal,
  createDraftBatch: CreateDraftBatch,
  getContextPack?: GetContextPack,
) {
  const canCreateDrafts = principal.scopes.includes(MCP_DRAFT_CREATE_SCOPE);
  const canReadContext = principal.scopes.includes(MCP_CONTEXT_READ_SCOPE)
    && getContextPack !== undefined;
  const contextPackReader = canReadContext ? getContextPack : undefined;
  const server = new McpServer({
    name: 'girapphe-knowledge-drafts',
    version: '1.0.0',
  }, {
    instructions: [
      canCreateDrafts
        ? 'Call create_knowledge_bundle_drafts or the compatible create_card_drafts only after the user explicitly selects concise knowledge from this current conversation. Never send a transcript, message history, or knowledge inferred from older conversations. Every result stays pending until the user reviews and approves it in Girapphe.'
        : null,
      canReadContext
        ? 'Call get_topic_context only for confirmed canonical knowledge in the requested Topic Hub. It never returns source transcripts or pending candidates, and every successful retrieval records reuse activity.'
        : null,
    ].filter((instruction): instruction is string => instruction !== null).join(' '),
  });

  if (canCreateDrafts) server.registerTool(
    CREATE_CARD_DRAFTS_TOOL_NAME,
    {
      title: 'Create knowledge-card drafts',
      description:
        'Create pending, user-owned knowledge-card drafts from an explicitly approved selection in the current conversation. This tool never accepts raw transcripts or historical-conversation data, and it cannot approve, publish, or modify public knowledge cards.',
      inputSchema: createCardDraftsInputSchema,
      outputSchema: createCardDraftsOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const created = await createDraftBatch(
          principal.userId,
          toKnowledgeDraftBatchInput(input),
          principal.sourceTokenId
        );
        const output = createCardDraftsOutputSchema.parse({
          status: 'pending',
          batch_id: created.batchId,
          created: created.created,
          draft_count: created.draftCount,
          review_path: created.reviewPath,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: output.created
                ? `${output.draft_count} knowledge-card draft(s) are pending review.`
                : `The existing draft batch has ${output.draft_count} pending knowledge-card draft(s).`,
            },
          ],
          structuredContent: output,
        };
      } catch {
        // Do not expose database details or user-provided card content through
        // the tool result. The caller can safely retry the idempotent request.
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Unable to create the draft batch. No drafts were approved or published.',
            },
          ],
        };
      }
    }
  );

  if (canCreateDrafts) server.registerTool(
    CREATE_KNOWLEDGE_BUNDLE_DRAFTS_TOOL_NAME,
    {
      title: 'Create structured knowledge-bundle drafts',
      description:
        'Create pending, user-owned concept, procedure, comparison, mechanism, structure, claim/evidence, question, decision, or event drafts from an explicitly approved selection in the current conversation. It cannot approve drafts, retain transcripts, or modify public knowledge.',
      inputSchema: createKnowledgeBundleDraftsInputSchema,
      outputSchema: createKnowledgeBundleDraftsOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const created = await createDraftBatch(
          principal.userId,
          toKnowledgeBundleDraftBatchInput(input),
          principal.sourceTokenId,
        );
        const output = createKnowledgeBundleDraftsOutputSchema.parse({
          status: 'pending',
          batch_id: created.batchId,
          created: created.created,
          bundle_count: created.draftCount,
          review_path: created.reviewPath,
        });
        return {
          content: [{
            type: 'text' as const,
            text: output.created
              ? `${output.bundle_count} structured knowledge bundle draft(s) are pending review.`
              : `The existing draft batch has ${output.bundle_count} structured knowledge bundle draft(s).`,
          }],
          structuredContent: output,
        };
      } catch {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: 'Unable to create the bundle draft batch. No knowledge was approved or published.' }],
        };
      }
    },
  );

  if (contextPackReader) server.registerTool(
    GET_TOPIC_CONTEXT_TOOL_NAME,
    {
      title: 'Get confirmed topic context',
      description:
        'Retrieve an owner-scoped Agent Context Pack made only from confirmed canonical knowledge in one Topic Hub. Select either 1 to 100 explicit knowledge item IDs or 1 to 50 recent confirmed topic items. This tool never returns raw conversation transcripts, pending candidates, archived items, or superseded items. Every successful retrieval records a reused activity event.',
      inputSchema: getTopicContextInputSchema,
      outputSchema: getTopicContextOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const contextInput = toTopicContextPackInput(input);
        const result = topicContextPackResultSchema.parse(
          await contextPackReader(principal.userId, contextInput),
        );
        const expectedMaximum = contextInput.selection.type === 'items'
          ? contextInput.selection.itemIds.length
          : contextInput.selection.limit;
        if (result.itemCount > expectedMaximum
          || (contextInput.selection.type === 'items'
            && result.itemCount !== contextInput.selection.itemIds.length)) {
          throw new Error('The context-pack dependency returned an inconsistent item count.');
        }
        const output = getTopicContextOutputSchema.parse({
          status: 'confirmed_context',
          topic: contextInput.topic,
          format: contextInput.format,
          selection_type: contextInput.selection.type,
          item_count: result.itemCount,
        });

        return {
          content: [{ type: 'text' as const, text: result.content }],
          structuredContent: output,
        };
      } catch {
        return {
          isError: true,
          content: [{
            type: 'text' as const,
            text: 'Unable to retrieve the confirmed topic context. No conversation transcript was returned.',
          }],
        };
      }
    },
  );

  return server;
}

/**
 * A stateless Streamable HTTP MCP handler. Authentication happens in the
 * Next.js route before this handler is called; the SDK only receives the
 * already-validated user principal via authInfo.
 */
export function createDraftMcpHandler(
  createDraftBatch: CreateDraftBatch,
  getContextPack?: GetContextPack,
) {
  return createMcpHandler(
    (context) => {
      const principal = principalFromAuthInfo(context.authInfo);

      const hasDraftScope = principal?.scopes.includes(MCP_DRAFT_CREATE_SCOPE) ?? false;
      const hasContextScope = principal?.scopes.includes(MCP_CONTEXT_READ_SCOPE) ?? false;
      if (!principal || (!hasDraftScope && !(hasContextScope && getContextPack))) {
        // This should be unreachable because the route validates the bearer
        // token and scope first. Throwing here keeps the MCP surface fail-closed
        // if another caller accidentally bypasses that route boundary.
        throw new Error('A scoped MCP knowledge principal is required.');
      }

      return createMcpServer(principal, createDraftBatch, getContextPack);
    },
    {
      legacy: 'stateless',
    }
  );
}
