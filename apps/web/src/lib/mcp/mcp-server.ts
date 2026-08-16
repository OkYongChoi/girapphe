import { createMcpHandler, McpServer, type AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  CREATE_CARD_DRAFTS_TOOL_NAME,
  createCardDraftsInputSchema,
  MCP_DRAFT_CREATE_SCOPE,
  toKnowledgeDraftBatchInput,
  type KnowledgeDraftBatchInput,
} from './create-card-drafts-schema';

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

const createCardDraftsOutputSchema = z
  .object({
    status: z.literal('pending'),
    batch_id: z.string().trim().min(1).max(160),
    created: z.boolean(),
    draft_count: z.number().int().min(0).max(50),
    review_path: z.string().startsWith('/').max(512),
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

function createMcpServer(principal: McpDraftPrincipal, createDraftBatch: CreateDraftBatch) {
  const server = new McpServer({
    name: 'girapphe-knowledge-drafts',
    version: '1.0.0',
  }, {
    instructions:
      'Call create_card_drafts only after the user explicitly selects concise concepts from this current conversation. Never send a transcript, message history, or concepts inferred from older conversations. Every result stays pending until the user reviews and approves it in Girapphe.',
  });

  server.registerTool(
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

  return server;
}

/**
 * A stateless Streamable HTTP MCP handler. Authentication happens in the
 * Next.js route before this handler is called; the SDK only receives the
 * already-validated user principal via authInfo.
 */
export function createDraftMcpHandler(createDraftBatch: CreateDraftBatch) {
  return createMcpHandler(
    (context) => {
      const principal = principalFromAuthInfo(context.authInfo);

      if (!principal || !principal.scopes.includes(MCP_DRAFT_CREATE_SCOPE)) {
        // This should be unreachable because the route validates the bearer
        // token and scope first. Throwing here keeps the MCP surface fail-closed
        // if another caller accidentally bypasses that route boundary.
        throw new Error('A scoped MCP draft principal is required.');
      }

      return createMcpServer(principal, createDraftBatch);
    },
    {
      legacy: 'stateless',
    }
  );
}
