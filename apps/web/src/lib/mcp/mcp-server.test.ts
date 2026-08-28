import assert from 'node:assert/strict';
import test from 'node:test';
import { CREATE_CARD_DRAFTS_TOOL_NAME, MCP_DRAFT_CREATE_SCOPE } from './create-card-drafts-schema';
import { CREATE_KNOWLEDGE_BUNDLE_DRAFTS_TOOL_NAME } from './create-knowledge-bundle-drafts-schema';
import { createDraftMcpHandler, toMcpAuthInfo } from './mcp-server';

const authInfo = toMcpAuthInfo({
  userId: 'user_123',
  tokenId: 'token_123',
  sourceTokenId: 'token_123',
  scopes: [MCP_DRAFT_CREATE_SCOPE],
});

function jsonRpcRequest(id: number, method: string, params: Record<string, unknown>) {
  return new Request('https://girapphe.example/api/mcp', {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

async function callMcp(
  handler: ReturnType<typeof createDraftMcpHandler>,
  id: number,
  method: string,
  params: Record<string, unknown>
) {
  const response = await handler.fetch(jsonRpcRequest(id, method, params), { authInfo });
  assert.equal(response.status, 200);
  const responseText = await response.text();

  if (response.headers.get('content-type')?.includes('application/json')) {
    return JSON.parse(responseText) as Record<string, unknown>;
  }

  const sseData = responseText
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n');

  return JSON.parse(sseData) as Record<string, unknown>;
}

test('serves initialize, tools/list, and a pending-only create_card_drafts call', async () => {
  const received: Array<{ userId: string; tokenId: string | null; input: Record<string, unknown> }> = [];
  const handler = createDraftMcpHandler(async (userId, input, tokenId) => {
    received.push({ userId, tokenId, input: input as unknown as Record<string, unknown> });
    return {
      batchId: 'batch_123',
      created: true,
      draftCount: input.cards.length,
      reviewPath: '/knowledge-inbox/batch_123',
    };
  });

  const initialized = await callMcp(handler, 1, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  });
  assert.equal((initialized.result as { protocolVersion?: string }).protocolVersion, '2025-06-18');
  assert.match(
    (initialized.result as { instructions?: string }).instructions ?? '',
    /explicitly selects.*current conversation/i,
  );

  const listed = await callMcp(handler, 2, 'tools/list', {});
  const tools = (listed.result as { tools?: Array<{ name?: string }> }).tools ?? [];
  assert.deepEqual(tools.map((tool) => tool.name), [
    CREATE_CARD_DRAFTS_TOOL_NAME,
    CREATE_KNOWLEDGE_BUNDLE_DRAFTS_TOOL_NAME,
  ]);

  const called = await callMcp(handler, 3, 'tools/call', {
    name: CREATE_CARD_DRAFTS_TOOL_NAME,
    arguments: {
      provider: 'chatgpt',
      request_id: 'request-123',
      provenance: {
        type: 'current_conversation',
        conversation_ref: 'conversation-123',
      },
      cards: [
        {
          client_card_id: 'draft-1',
          title: 'Bayes theorem',
          summary: 'A probability update rule.',
          relations: [
            {
              target_kind: 'public',
              target_id: 'conditional_probability',
              type: 'prerequisite',
            },
          ],
        },
      ],
    },
  });

  const result = called.result as { structuredContent?: Record<string, unknown> };
  assert.deepEqual(result.structuredContent, {
    status: 'pending',
    batch_id: 'batch_123',
    created: true,
    draft_count: 1,
    review_path: '/knowledge-inbox/batch_123',
  });
  assert.deepEqual(received, [
    {
      userId: 'user_123',
      tokenId: 'token_123',
      input: {
        provider: 'chatgpt',
        requestId: 'request-123',
        conversationRef: 'conversation-123',
        cards: [
          {
            clientCardId: 'draft-1',
            title: 'Bayes theorem',
            summary: 'A probability update rule.',
            explanation: undefined,
            topic: undefined,
            tags: undefined,
            relations: [
              {
                targetKind: 'public',
                targetId: 'conditional_probability',
                type: 'prerequisite',
                direction: undefined,
                weight: undefined,
              },
            ],
            knowledgeType: 'concept',
            centralQuestion: 'Bayes theorem',
            structuredContent: {
              type: 'concept',
              definition: 'A probability update rule.',
              key_points: [],
              examples: [],
              non_examples: [],
              misconceptions: [],
            },
            bundleSchemaVersion: 1,
          },
        ],
      },
    },
  ]);

  await handler.close();
});

test('does not create a draft when the input has a transcript field', async () => {
  let createCalls = 0;
  const handler = createDraftMcpHandler(async () => {
    createCalls += 1;
    return {
      batchId: 'batch_should_not_exist',
      created: true,
      draftCount: 1,
      reviewPath: '/knowledge-inbox/batch_should_not_exist',
    };
  });

  const response = await callMcp(handler, 4, 'tools/call', {
    name: CREATE_CARD_DRAFTS_TOOL_NAME,
    arguments: {
      provider: 'chatgpt',
      request_id: 'request-456',
      provenance: {
        type: 'current_conversation',
        conversation_ref: 'conversation-456',
      },
      cards: [{ title: 'Valid card' }],
      transcript: 'This field must not be accepted.',
    },
  });

  const result = response.result as { isError?: boolean };
  assert.equal(result.isError, true);
  assert.equal(createCalls, 0);

  await handler.close();
});

test('creates only pending structured bundles through create_knowledge_bundle_drafts', async () => {
  const received: Array<Record<string, unknown>> = [];
  const handler = createDraftMcpHandler(async (_userId, input) => {
    received.push(input as unknown as Record<string, unknown>);
    return { batchId: 'bundle_batch_123', created: true, draftCount: input.cards.length, reviewPath: '/knowledge-inbox/bundle_batch_123' };
  });

  const response = await callMcp(handler, 5, 'tools/call', {
    name: CREATE_KNOWLEDGE_BUNDLE_DRAFTS_TOOL_NAME,
    arguments: {
      provider: 'chatgpt', request_id: 'bundle-request-123',
      provenance: { type: 'current_conversation', conversation_ref: 'conversation-123' },
      bundles: [{
        client_bundle_id: 'mechanism-1', title: 'Rain formation',
        central_question: 'How does rain form?', knowledge_type: 'mechanism',
        summary: 'Moist air cools and condenses.', topic: 'weather', tags: ['rain'], bundle_schema_version: 1,
        structured_content: { type: 'mechanism', causes: ['Moist air'], stages: [{ title: 'Condense', detail: 'Water cools.' }], results: ['Rain'], conditions: [], exceptions: [] },
      }],
    },
  });

  assert.deepEqual((response.result as { structuredContent?: Record<string, unknown> }).structuredContent, {
    status: 'pending', batch_id: 'bundle_batch_123', created: true, bundle_count: 1, review_path: '/knowledge-inbox/bundle_batch_123',
  });
  assert.equal(received.length, 1);
  const card = (received[0]?.cards as Array<Record<string, unknown>>)[0];
  assert.equal(card?.knowledgeType, 'mechanism');
  assert.equal(card?.centralQuestion, 'How does rain form?');
  assert.equal(card?.bundleSchemaVersion, 1);

  await handler.close();
});
