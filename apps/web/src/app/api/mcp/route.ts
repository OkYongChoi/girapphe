import {
  authenticateMcpAccessToken,
  createKnowledgeDraftBatchForUser,
  McpDeletedAccountError,
  McpRequestRateLimitError,
  rateLimitMcpOAuthPrincipal,
  recordKnowledgeReuseForUser,
} from '@/lib/knowledge-ingestion';
import { hasValidClerkConfig } from '@/lib/clerk-env';
import {
  MAX_MCP_REQUEST_BYTES,
  MCP_DRAFT_CREATE_SCOPE,
} from '@/lib/mcp/create-card-drafts-schema';
import {
  createDraftMcpHandler,
  toMcpAuthInfo,
  type McpDraftPrincipal,
} from '@/lib/mcp/mcp-server';
import {
  MCP_CONTEXT_READ_SCOPE,
  type TopicContextPackInput,
} from '@/lib/mcp/get-topic-context-schema';
import {
  buildTopicKnowledgeContextPackForUser,
  MAX_CONTEXT_PACK_BYTES,
  serializeTopicKnowledgeHub,
} from '@/lib/topic-knowledge-hub';
import { isContextPackPayloadWithinLimit } from '@/lib/context-pack-request';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getContextPackForMcp(userId: string, input: TopicContextPackInput) {
  const explicitItemIds = input.selection.type === 'items' ? input.selection.itemIds : null;
  const pack = await buildTopicKnowledgeContextPackForUser(
    userId,
    input.topic,
    input.selection.type === 'items'
      ? { itemIds: input.selection.itemIds }
      : { maxItems: input.selection.limit },
  );
  if (pack.items.length === 0
    || (explicitItemIds && pack.items.length !== explicitItemIds.length)) {
    throw new Error('The selected confirmed knowledge is unavailable.');
  }
  const content = serializeTopicKnowledgeHub(pack, input.format);
  if (!isContextPackPayloadWithinLimit(content, MAX_CONTEXT_PACK_BYTES)) {
    throw new Error('The selected context pack exceeds the size limit.');
  }
  const reusedCount = await recordKnowledgeReuseForUser(
    userId,
    pack.items.map((item) => item.id),
    {
      topic: pack.topic,
      format: input.format,
      count: pack.items.length,
      selectionType: input.selection.type,
    },
  );
  if (reusedCount !== pack.items.length) {
    throw new Error('The selected confirmed knowledge changed before reuse was recorded.');
  }
  return { content, itemCount: pack.items.length };
}

const mcpHandler = createDraftMcpHandler(
  createKnowledgeDraftBatchForUser,
  getContextPackForMcp,
);

function appendVary(headers: Headers, value: string) {
  const current = headers.get('vary');

  if (!current) {
    headers.set('Vary', value);
    return;
  }

  if (current.trim() === '*') return;

  const values = current.split(',').map((entry) => entry.trim().toLowerCase());
  if (!values.includes(value.toLowerCase())) headers.set('Vary', `${current}, ${value}`);
}

function withMcpResponseHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate, Retry-After');
  appendVary(headers, 'Authorization');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonError(status: number, error: string, headers?: HeadersInit) {
  return withMcpResponseHeaders(
    new Response(JSON.stringify({ error }), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...headers,
      },
    })
  );
}

function unauthorized(request: Request) {
  const challenge = ['Bearer realm="girapphe-mcp"'];
  if (hasValidClerkConfig()) {
    const resourceMetadata = new URL('/.well-known/oauth-protected-resource/mcp', request.url);
    challenge.push('scope="profile"');
    challenge.push(`resource_metadata="${resourceMetadata.toString()}"`);
  }
  return jsonError(401, 'unauthorized', {
    'WWW-Authenticate': challenge.join(', '),
  });
}

function getBearerToken(value: string | null) {
  const match = value ? /^Bearer\s+([^\s]+)$/i.exec(value) : null;
  return match?.[1] ?? null;
}

async function authenticateMcpPrincipal(bearerToken: string): Promise<McpDraftPrincipal | null> {
  if (bearerToken.startsWith('girapphe_mcp_')) {
    const principal = await authenticateMcpAccessToken(`Bearer ${bearerToken}`, MCP_DRAFT_CREATE_SCOPE)
      ?? await authenticateMcpAccessToken(`Bearer ${bearerToken}`, MCP_CONTEXT_READ_SCOPE);
    return principal
      ? {
          userId: principal.userId,
          tokenId: principal.tokenId,
          sourceTokenId: principal.tokenId,
          scopes: principal.scopes,
        }
      : null;
  }

  if (!hasValidClerkConfig()) return null;
  const [{ verifyClerkToken }, { auth }] = await Promise.all([
    import('@clerk/mcp-tools/server'),
    import('@clerk/nextjs/server'),
  ]);
  const clerkAuth = await auth({ acceptsToken: 'oauth_token' });
  const verified = verifyClerkToken(clerkAuth, bearerToken);
  const userId = verified?.extra?.userId;
  const clientId = verified?.clientId;
  if (typeof userId !== 'string' || typeof clientId !== 'string'
    || !verified?.scopes.includes('profile')) return null;

  const credentialId = await rateLimitMcpOAuthPrincipal(userId, clientId);
  return {
    userId,
    tokenId: credentialId,
    sourceTokenId: null,
    scopes: [MCP_DRAFT_CREATE_SCOPE],
  };
}

async function requestBodyExceedsLimit(request: Request) {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const declaredLength = Number(contentLength);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MCP_REQUEST_BYTES) return true;
  }

  // Content-Length can be absent or inaccurate. Read a clone in bounded chunks
  // so a chunked request cannot bypass the endpoint's hard request-size limit.
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  try {
    reader = request.clone().body?.getReader();
    if (!reader) return false;

    let bytesRead = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) return false;

      bytesRead += value?.byteLength ?? 0;
      if (bytesRead > MAX_MCP_REQUEST_BYTES) {
        // A cloned Request body is a tee. Awaiting cancellation of this branch
        // can wait forever while the original branch remains unread, preventing
        // the already-final 413 response from being returned.
        void reader.cancel().catch(() => undefined);
        return true;
      }
    }
  } catch {
    // Let the MCP transport return its protocol-level parse/read error for a
    // malformed body instead of turning it into a misleading size error.
    return false;
  } finally {
    reader?.releaseLock();
  }
}

async function handleMcpRequest(request: Request) {
  const authorization = request.headers.get('authorization');
  const bearerToken = getBearerToken(authorization);
  if (!bearerToken) return unauthorized(request);

  let principal: McpDraftPrincipal | null;
  try {
    principal = await authenticateMcpPrincipal(bearerToken);
  } catch (error) {
    if (error instanceof McpDeletedAccountError) return unauthorized(request);
    if (error instanceof McpRequestRateLimitError) {
      return jsonError(429, 'rate_limited', { 'Retry-After': '60' });
    }
    return jsonError(503, 'service_unavailable');
  }

  if (!principal) return unauthorized(request);

  // Authenticate before cloning or reading a request body. This prevents an
  // unauthenticated caller from using a large POST to consume the bounded body
  // reader, while still enforcing the exact same limit for every valid token.
  if (request.method.toUpperCase() === 'POST' && (await requestBodyExceedsLimit(request))) {
    return jsonError(413, 'payload_too_large');
  }

  try {
    return withMcpResponseHeaders(await mcpHandler.fetch(request, { authInfo: toMcpAuthInfo(principal) }));
  } catch {
    return jsonError(500, 'internal_server_error');
  }
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
