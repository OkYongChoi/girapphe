import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const exportImported = await import('../src/lib/chatgpt-export.ts');
const exportModule = exportImported.default ?? exportImported;
const { parseChatGptExportText } = exportModule;
const importServerImported = await import('../src/lib/chatgpt-export-import.ts');
const importServerModule = importServerImported.default ?? importServerImported;
const {
  buildChatGptExportBatchInput,
  chatGptExportImportInputSchema,
  createChatGptExportDraftBatchForUser,
} = importServerModule;
const knowledgeImported = await import('../src/lib/knowledge-ingestion.ts');
const knowledgeModule = knowledgeImported.default ?? knowledgeImported;
const {
  approveKnowledgeDraftsForUser,
  deleteKnowledgeImportBatchForUser,
  getKnowledgeDraftBatchForUser,
  getKnowledgeDraftBatchesForUser,
  getMemoryKnowledgeItemsForUser,
} = knowledgeModule;

const importSessionId = '9208d321-4cc8-4a57-8f69-69b311c3ce42';

function message(id, role, text, createTime, metadata = {}) {
  return {
    id,
    message: {
      id,
      author: { role },
      create_time: createTime,
      content: { content_type: 'text', parts: [text] },
      metadata,
    },
  };
}

const fixture = [{
  id: 'conversation-1',
  title: 'Triton compiler architecture',
  create_time: 1_788_000_000,
  mapping: {
    hidden: message('hidden', 'assistant', 'Do not import me', 1_788_000_001, { is_visually_hidden_from_conversation: true }),
    user1: message('user-1', 'user', 'How does Triton relate to CUDA?', 1_788_000_002),
    assistant1: message('assistant-1', 'assistant', 'Triton compiles kernels through a backend-specific lowering path.', 1_788_000_003),
    tool1: message('tool-1', 'tool', 'private tool output', 1_788_000_004),
    user2: message('user-2', 'user', 'Can another accelerator add a backend?', 1_788_000_005),
    assistant2: message('assistant-2', 'assistant', 'A vendor can implement the compiler and runtime integration points.', 1_788_000_006),
  },
}];

test('parses only visible user and assistant exchanges from a ChatGPT export', () => {
  const parsed = parseChatGptExportText(JSON.stringify(fixture));
  assert.equal(parsed.conversationCount, 1);
  assert.equal(parsed.exchangeCount, 2);
  assert.equal(parsed.exchanges[0].question, 'Can another accelerator add a backend?');
  assert.equal(parsed.exchanges[1].answer, 'Triton compiles kernels through a backend-specific lowering path.');
  assert.doesNotMatch(JSON.stringify(parsed), /private tool output|Do not import me/);
  assert.equal(parsed.exchanges[0].topic, 'Triton compiler architecture');
});

test('follows the active ChatGPT branch and ignores abandoned regenerated responses', () => {
  const user = { ...message('branch-user', 'user', 'Which backend is active?', 1_788_000_010), parent: null };
  const abandoned = { ...message('branch-abandoned', 'assistant', 'The abandoned answer.', 1_788_000_011), parent: 'branch-user' };
  const active = { ...message('branch-active', 'assistant', 'The selected answer.', 1_788_000_012), parent: 'branch-user' };
  const followup = { ...message('branch-followup', 'user', 'What comes next?', 1_788_000_013), parent: 'branch-active' };
  const final = { ...message('branch-final', 'assistant', 'Continue with runtime integration.', 1_788_000_014), parent: 'branch-followup' };
  const parsed = parseChatGptExportText(JSON.stringify([{
    id: 'branched-conversation',
    title: 'Backend branch',
    current_node: 'branch-final',
    mapping: {
      'branch-user': user,
      'branch-abandoned': abandoned,
      'branch-active': active,
      'branch-followup': followup,
      'branch-final': final,
    },
  }]));
  assert.equal(parsed.exchangeCount, 2);
  assert.equal(parsed.exchanges.find((exchange) => exchange.messageId === 'branch-active')?.answer, 'The selected answer.');
  assert.doesNotMatch(JSON.stringify(parsed), /abandoned answer/i);
});

test('rejects malformed and content-free export files with stable error codes', () => {
  assert.throws(() => parseChatGptExportText('{'), (error) => error?.code === 'invalid');
  assert.throws(
    () => parseChatGptExportText(JSON.stringify([{ id: 'empty', mapping: {} }])),
    (error) => error?.code === 'empty',
  );
});

test('builds a bounded question bundle with hashed selectors and selected-export scope', () => {
  const exchange = parseChatGptExportText(JSON.stringify(fixture)).exchanges[0];
  const input = { source: 'chatgpt_export', consent: true, importSessionId, selections: [{
    conversationId: exchange.conversationId,
    messageId: exchange.messageId,
    title: exchange.title,
    question: exchange.question,
    answer: exchange.answer,
    createdAt: exchange.createdAt,
  }] };
  const parsed = chatGptExportImportInputSchema.parse(input);
  const batch = buildChatGptExportBatchInput(parsed);
  assert.equal(batch.scope, 'selected_export');
  assert.equal(batch.provider, 'chatgpt');
  assert.equal(batch.cards[0].knowledgeType, 'question');
  assert.equal(batch.cards[0].structuredContent?.type, 'question');
  assert.equal(batch.cards[0].structuredContent?.answer_summary, exchange.answer);
  assert.equal(batch.cards[0].observedAt, exchange.createdAt);
  assert.match(batch.conversationRef ?? '', /^chatgpt-export-selection:[0-9a-f]{48}$/);
  assert.match(batch.cards[0].proposedEvidence?.[0]?.messageRef ?? '', /^chatgpt-message:[0-9a-f]{48}$/);
  assert.match(batch.cards[0].proposedEvidence?.[0]?.sourceRef ?? '', /^chatgpt-conversation:[0-9a-f]{48}$/);
  assert.doesNotMatch(`${batch.conversationRef}${batch.cards[0].proposedEvidence?.[0]?.sourceRef}${batch.cards[0].proposedEvidence?.[0]?.messageRef}`, /conversation-1|assistant-2/);
});

test('proposes reviewable evidence-backed links within an imported topic', () => {
  const exchanges = parseChatGptExportText(JSON.stringify(fixture)).exchanges;
  const batch = buildChatGptExportBatchInput(chatGptExportImportInputSchema.parse({
    source: 'chatgpt_export',
    consent: true,
    importSessionId,
    selections: exchanges.map((exchange) => ({
      conversationId: exchange.conversationId,
      messageId: exchange.messageId,
      title: exchange.title,
      question: exchange.question,
      answer: exchange.answer,
      createdAt: exchange.createdAt,
    })),
  }));
  assert.equal(batch.cards[0].relations, undefined);
  assert.deepEqual(batch.cards[1].relations?.[0], {
    targetKind: 'draft',
    targetId: `draft:${batch.cards[0].clientCardId}`,
    type: 'related',
    direction: 'outgoing',
    weight: 0.72,
    relationOrigin: 'model_inferred',
    evidenceSelectorIndexes: [0],
  });
});

test('requires explicit consent, strict fields, and unique selections', () => {
  const selection = {
    conversationId: 'conversation-1', messageId: 'assistant-1', title: 'Title',
    question: 'Question?', answer: 'Answer.', createdAt: null,
  };
  assert.equal(chatGptExportImportInputSchema.safeParse({ source: 'chatgpt_export', consent: false, importSessionId, selections: [selection] }).success, false);
  assert.equal(chatGptExportImportInputSchema.safeParse({ source: 'chatgpt_export', consent: true, importSessionId, selections: [selection], archive: fixture }).success, false);
  assert.equal(chatGptExportImportInputSchema.safeParse({ source: 'chatgpt_export', consent: true, importSessionId, selections: [selection, selection] }).success, false);
  assert.equal(chatGptExportImportInputSchema.safeParse({ source: 'chatgpt_export', consent: true, selections: [selection] }).success, false);
});

test('persists only a pending selected-export batch through the existing owner-scoped lifecycle', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const exchange = parseChatGptExportText(JSON.stringify(fixture)).exchanges[0];
    const userId = `user_chatgpt_export_${crypto.randomUUID()}`;
    const sessionId = crypto.randomUUID();
    const created = await createChatGptExportDraftBatchForUser(userId, {
      source: 'chatgpt_export', consent: true, importSessionId: sessionId, selections: [{
        conversationId: exchange.conversationId,
        messageId: exchange.messageId,
        title: exchange.title,
        question: exchange.question,
        answer: exchange.answer,
        createdAt: exchange.createdAt,
      }],
    });
    assert.equal(created.batchId, sessionId);
    const loaded = await getKnowledgeDraftBatchForUser(userId, created.batchId);
    assert.equal(loaded?.batch.scope, 'selected_export');
    assert.equal(loaded?.batch.status, 'pending');
    assert.equal(loaded?.drafts[0].status, 'pending');
    assert.equal(loaded?.drafts[0].knowledge_item_id, null);
    assert.equal(loaded?.drafts[0].structured_content?.type, 'question');
    assert.equal(loaded?.drafts[0].observed_at, exchange.createdAt);
    assert.doesNotMatch(JSON.stringify(loaded), /Do not import me|private tool output/);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('schema sources agree on the selected-export scope', async () => {
  for (const source of [
    '../drizzle/schema.ts',
    '../schema.sql',
    '../src/lib/knowledge-ingestion.ts',
    '../drizzle/migrations/0019_selected_export_ingestion.sql',
  ]) {
    const text = await readFile(new URL(source, import.meta.url), 'utf8');
    assert.match(text, /current_conversation[\s\S]{0,80}selected_export/, source);
  }
});

test('permanently deletes an import job while preserving its approved private knowledge', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const exchange = parseChatGptExportText(JSON.stringify(fixture)).exchanges[0];
    const userId = `user_import_delete_${crypto.randomUUID()}`;
    const created = await createChatGptExportDraftBatchForUser(userId, {
      source: 'chatgpt_export', consent: true, importSessionId: crypto.randomUUID(), selections: [{
        conversationId: exchange.conversationId,
        messageId: exchange.messageId,
        title: exchange.title,
        question: exchange.question,
        answer: exchange.answer,
        createdAt: exchange.createdAt,
      }],
    });
    const loaded = await getKnowledgeDraftBatchForUser(userId, created.batchId);
    const draft = loaded?.drafts[0];
    assert.ok(draft);
    const approved = await approveKnowledgeDraftsForUser(userId, created.batchId, null, { [draft.id]: draft.version });
    assert.equal(approved.approved, 1);
    const approvedItemId = getMemoryKnowledgeItemsForUser(userId)[0]?.id;
    assert.ok(approvedItemId);
    const result = await deleteKnowledgeImportBatchForUser(userId, created.batchId);
    assert.deepEqual(result, { deleted: true, approvedKnowledgePreserved: 1 });
    assert.equal(await getKnowledgeDraftBatchForUser(userId, created.batchId), null);
    assert.equal(getMemoryKnowledgeItemsForUser(userId).some((item) => item.id === approvedItemId), true);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('schema sources preserve a per-draft observed timestamp', async () => {
  for (const source of [
    '../drizzle/schema.ts',
    '../schema.sql',
    '../src/lib/knowledge-ingestion.ts',
    '../drizzle/migrations/0019_selected_export_ingestion.sql',
  ]) {
    const text = await readFile(new URL(source, import.meta.url), 'utf8');
    assert.match(text, /observed_at/, source);
  }
});

test('data controls paginate beyond the newest 100 import jobs', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const userId = `user_import_pages_${crypto.randomUUID()}`;
    for (let index = 0; index < 101; index += 1) {
      await createChatGptExportDraftBatchForUser(userId, {
        source: 'chatgpt_export',
        consent: true,
        importSessionId: crypto.randomUUID(),
        selections: [{
          conversationId: `conversation-${index}`,
          messageId: `message-${index}`,
          title: `Import ${index}`,
          question: `Question ${index}?`,
          answer: `Answer ${index}.`,
          createdAt: null,
        }],
      });
    }
    const first = await getKnowledgeDraftBatchesForUser(userId, true, { limit: 50 });
    const third = await getKnowledgeDraftBatchesForUser(userId, true, { limit: 50, offset: 100 });
    assert.equal(first.length, 50);
    assert.equal(third.length, 1);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});
