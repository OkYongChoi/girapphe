import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMcpAccessTokenForUser,
  getKnowledgeDraftBatchesForUser,
} from '@/lib/knowledge-ingestion';
import {
  createCardDraftsInputSchema,
  MAX_MCP_REQUEST_BYTES,
} from '@/lib/mcp/create-card-drafts-schema';
import { OPTIONS, POST } from './route';

function mcpRequest(token: string, id: number, method: string, params: Record<string, unknown>) {
  return new Request('https://girapphe.example/api/mcp', {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

async function readMcpResponse(response: Response) {
  const body = await response.text();
  if (response.headers.get('content-type')?.includes('application/json')) {
    return JSON.parse(body) as Record<string, unknown>;
  }
  const data = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n');
  return JSON.parse(data) as Record<string, unknown>;
}

test('returns a bearer challenge and an unauthenticated CORS preflight', async () => {
  const unauthorized = await POST(new Request('https://girapphe.example/api/mcp', {
    method: 'POST',
  }));
  assert.equal(unauthorized.status, 401);
  assert.match(unauthorized.headers.get('www-authenticate') ?? '', /^Bearer /);
  assert.equal(unauthorized.headers.get('access-control-allow-origin'), '*');

  const preflight = await OPTIONS();
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers') ?? '', /authorization/i);
});

test('returns 413 without waiting for an open oversized request stream to close', async () => {
  const userId = `user_oversized_route_${crypto.randomUUID()}`;
  const { token } = await createMcpAccessTokenForUser(userId, 'Oversized route');
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(800 * 1024));
    },
  });
  const request = new Request('https://girapphe.example/api/mcp', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  const responsePromise = POST(request);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const response = await Promise.race([
      responsePromise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Oversized MCP request did not return a bounded response.')),
          1_000,
        );
      }),
    ]);
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: 'payload_too_large' });
  } finally {
    if (timeout) clearTimeout(timeout);
    await request.body?.cancel().catch(() => undefined);
    await responsePromise.catch(() => undefined);
  }
});

test('accepts a large multibyte tool input that remains inside the shared transport boundary', async () => {
  const userId = `user_large_utf8_route_${crypto.randomUUID()}`;
  const { token } = await createMcpAccessTokenForUser(userId, 'Large UTF-8 route');
  const input = {
    provider: 'chatgpt' as const,
    request_id: 'large-utf8-route-request',
    provenance: { type: 'current_conversation' as const, conversation_ref: 'large-current-conversation' },
    cards: Array.from({ length: 40 }, (_, index) => ({
      client_card_id: `large-card-${index}`,
      title: `큰 개념 ${index}`,
      explanation: '가'.repeat(6000),
    })),
  };
  assert.equal(createCardDraftsInputSchema.safeParse(input).success, true);

  const request = mcpRequest(token, 3, 'tools/call', {
    name: 'create_card_drafts',
    arguments: input,
  });
  assert.ok((await request.clone().arrayBuffer()).byteLength < MAX_MCP_REQUEST_BYTES);

  const response = await POST(request);
  assert.equal(response.status, 200);
  const payload = await readMcpResponse(response);
  const structured = (payload.result as { structuredContent?: Record<string, unknown> }).structuredContent;
  assert.equal(structured?.status, 'pending');
  assert.equal(structured?.draft_count, 40);
});

test('accepts a cookie-less scoped token and creates only a pending review batch', async () => {
  const userId = `user_route_${crypto.randomUUID()}`;
  const { token } = await createMcpAccessTokenForUser(userId, 'Route integration');

  const initialize = await POST(mcpRequest(token, 1, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'route-test', version: '1.0.0' },
  }));
  assert.equal(initialize.status, 200);
  assert.equal(initialize.headers.get('cache-control'), 'no-store');
  assert.match(initialize.headers.get('vary') ?? '', /authorization/i);

  const called = await POST(mcpRequest(token, 2, 'tools/call', {
    name: 'create_card_drafts',
    arguments: {
      provider: 'gemini',
      request_id: 'route-integration-request',
      provenance: { type: 'current_conversation', conversation_ref: 'route-conversation' },
      cards: [{ client_card_id: 'route-card', title: 'Pending route concept' }],
    },
  }));
  assert.equal(called.status, 200);
  const payload = await readMcpResponse(called);
  const structured = (payload.result as { structuredContent?: Record<string, unknown> }).structuredContent;
  assert.equal(structured?.status, 'pending');
  assert.equal(structured?.draft_count, 1);

  const batches = await getKnowledgeDraftBatchesForUser(userId);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].status, 'pending');
  assert.equal(batches[0].approved_count, 0);
});
