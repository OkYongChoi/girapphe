import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const exportImported = await import('../src/lib/chatgpt-export.ts');
const exportModule = exportImported.default ?? exportImported;
const { parseChatGptExportText } = exportModule;
const importServerImported = await import('../src/lib/chatgpt-export-import.ts');
const importServerModule = importServerImported.default ?? importServerImported;
const {
  buildSelectedConversationImportBatchInput,
  buildChatGptExportBatchInput,
  chatGptExportImportInputSchema,
  createChatGptExportDraftBatchForUser,
} = importServerModule;
const telemetryImported = await import('../src/lib/chatgpt-export-telemetry.ts');
const telemetryModule = telemetryImported.default ?? telemetryImported;
const { recordChatGptExportCompletionTelemetry } = telemetryModule;
const knowledgeImported = await import('../src/lib/knowledge-ingestion.ts');
const knowledgeModule = knowledgeImported.default ?? knowledgeImported;
const {
  approveKnowledgeDraftsForUser,
  createKnowledgeDraftBatchForUser,
  deleteKnowledgeImportBatchForUser,
  getKnowledgeDraftBatchForUser,
  getKnowledgeDraftBatchesForUser,
  getMemoryKnowledgeItemsForUser,
  resolveKnowledgeDraftForUser,
} = knowledgeModule;
const eventImported = await import('../src/lib/knowledge-product-events.ts');
const eventModule = eventImported.default ?? eventImported;
const {
  clearMemoryKnowledgeProductEventsForTesting,
  getMemoryKnowledgeProductEventsForTesting,
  recordKnowledgeProductEventsForUser,
} = eventModule;

const importSessionId = '9208d321-4cc8-4a57-8f69-69b311c3ce42';

function parentV1Digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function buildParentV1ChatGptBatchInput(value) {
  const input = chatGptExportImportInputSchema.parse(value);
  const current = buildChatGptExportBatchInput(input);
  const selectionKey = input.selections
    .map((selection) => `${selection.conversationId}:${selection.messageId}`)
    .toSorted()
    .join('|');
  const importKey = parentV1Digest(`chatgpt:${selectionKey}`).slice(0, 48);
  const base = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== 'legacyRequestId'),
  );
  return {
    ...base,
    requestId: `chatgpt-export:${importKey}`,
    conversationRef: `chatgpt-export-selection:${importKey}`,
    cards: current.cards.map((card, index) => {
      const selection = input.selections[index];
      const conversationKey = parentV1Digest(`chatgpt:${selection.conversationId}`).slice(0, 48);
      const messageKey = parentV1Digest(
        `chatgpt:${selection.conversationId}:${selection.messageId}`,
      ).slice(0, 48);
      const legacyCard = Object.fromEntries(
        Object.entries(card).filter(([key]) => key !== 'duplicateClientCardIds'),
      );
      return {
        ...legacyCard,
        clientCardId: `export-exchange:${messageKey}`,
        proposedEvidence: card.proposedEvidence?.map((evidence) => ({
          ...evidence,
          sourceRef: `chatgpt-conversation:${conversationKey}`,
          messageRef: `chatgpt-message:${messageKey}`,
        })),
      };
    }),
  };
}

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

test('keeps delimiter-shaped provider tuples independently selectable', () => {
  const parsed = parseChatGptExportText(JSON.stringify([
    {
      id: 'a:b',
      title: 'First tuple',
      mapping: {
        firstUser: message('first-user', 'user', 'Select only the first exchange.', 1_788_000_020),
        c: message('c', 'assistant', 'First answer.', 1_788_000_021),
      },
    },
    {
      id: 'a',
      title: 'Second tuple',
      mapping: {
        secondUser: message('second-user', 'user', 'Do not select the second exchange.', 1_788_000_022),
        'b:c': message('b:c', 'assistant', 'Second answer.', 1_788_000_023),
      },
    },
  ]));
  assert.equal(new Set(parsed.exchanges.map((exchange) => exchange.id)).size, 2);
  const selectedIds = new Set([
    parsed.exchanges.find((exchange) => exchange.conversationId === 'a:b')?.id,
  ]);
  const submitted = parsed.exchanges.filter((exchange) => selectedIds.has(exchange.id));
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].conversationId, 'a:b');
  const firstCompatibilityInput = {
    source: 'chatgpt_export', consent: true, importSessionId, selections: [{
      conversationId: submitted[0].conversationId,
      messageId: submitted[0].messageId,
      title: submitted[0].title,
      question: submitted[0].question,
      answer: submitted[0].answer,
      createdAt: submitted[0].createdAt,
    }],
  };
  const second = parsed.exchanges.find((exchange) => exchange.conversationId === 'a');
  assert.ok(second);
  const secondCompatibilityInput = {
    source: 'chatgpt_export', consent: true, importSessionId, selections: [{
      conversationId: second.conversationId,
      messageId: second.messageId,
      title: second.title,
      question: second.question,
      answer: second.answer,
      createdAt: second.createdAt,
    }],
  };
  const firstBatch = buildChatGptExportBatchInput(firstCompatibilityInput);
  const secondBatch = buildChatGptExportBatchInput(secondCompatibilityInput);
  assert.notEqual(firstBatch.requestId, secondBatch.requestId);
  assert.equal(firstBatch.legacyRequestId, undefined);
  assert.equal(secondBatch.legacyRequestId, undefined);
});

test('fails closed before duplicate provider tuples can merge local selection state', () => {
  const duplicateTupleExport = [
    {
      id: 'duplicate-conversation',
      title: 'First body',
      mapping: {
        firstUser: message('first-user', 'user', 'First private question.', 1_788_000_030),
        sharedAssistant: message('shared-assistant', 'assistant', 'First private answer.', 1_788_000_031),
      },
    },
    {
      id: 'duplicate-conversation',
      title: 'Second body',
      mapping: {
        secondUser: message('second-user', 'user', 'Second private question.', 1_788_000_032),
        sharedAssistant: message('shared-assistant', 'assistant', 'Second private answer.', 1_788_000_033),
      },
    },
  ];
  assert.throws(() => parseChatGptExportText(JSON.stringify(duplicateTupleExport)), { code: 'invalid' });
});

test('fails closed when current-node traversal is malformed, dangling, or cyclic', () => {
  const root = { ...message('root', 'user', 'Do not recover this from an invalid branch.', 1_788_000_010), parent: null };
  const answer = { ...message('answer', 'assistant', 'Nor this answer.', 1_788_000_011), parent: 'root' };
  const malformed = [
    { current_node: { id: 'answer' }, mapping: { root, answer } },
    { current_node: null, mapping: { root, answer } },
    { current_node: 'missing', mapping: { root, answer } },
    { current_node: 'answer', mapping: { root, answer: { ...answer, parent: 'missing' } } },
    { mapping: { root, answer } },
    {
      current_node: 'cycle-a',
      mapping: {
        'cycle-a': { ...root, parent: 'cycle-b' },
        'cycle-b': { ...answer, parent: 'cycle-a' },
      },
    },
  ];
  for (const conversation of malformed) {
    assert.throws(
      () => parseChatGptExportText(JSON.stringify([conversation])),
      (error) => error?.code === 'invalid',
    );
  }
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

test('uses an order-independent collision-free encoding for the selection request hash', () => {
  const exchange = (conversationRef, messageRef) => ({
    conversationRef,
    messageRef,
    title: 'Delimiter test',
    prompt: 'Which source is this?',
    response: 'The tuple identity must remain distinct.',
    occurredAt: null,
  });
  const result = (selections) => ({
    schemaVersion: 1,
    provider: 'chatgpt',
    sourceKind: 'export',
    consent: true,
    selections,
  });
  const left = buildSelectedConversationImportBatchInput(result([exchange('a:b', 'c|d')]));
  const right = buildSelectedConversationImportBatchInput(result([exchange('a', 'b:c|d')]));
  assert.notEqual(left.requestId, right.requestId);
  assert.notEqual(left.cards[0].clientCardId, right.cards[0].clientCardId);
  assert.notEqual(
    left.cards[0].proposedEvidence?.[0]?.messageRef,
    right.cards[0].proposedEvidence?.[0]?.messageRef,
  );
  assert.deepEqual(left.cards[0].duplicateClientCardIds, []);
  assert.deepEqual(right.cards[0].duplicateClientCardIds, []);

  const legacyCompatible = buildSelectedConversationImportBatchInput(result([
    exchange('conversation-legacy', 'message-legacy'),
  ]));
  assert.equal(legacyCompatible.cards[0].duplicateClientCardIds?.length, 1);

  const first = exchange('conversation-z', 'message-2');
  const second = exchange('conversation-a', 'message-1');
  assert.equal(
    buildSelectedConversationImportBatchInput(result([first, second])).requestId,
    buildSelectedConversationImportBatchInput(result([second, first])).requestId,
  );
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
    assert.notEqual(created.batchId, sessionId);
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

test('creates only new owner-scoped candidates for overlapping selected exports', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const userId = `user_export_overlap_${crypto.randomUUID()}`;
    const otherUserId = `${userId}_other`;
    const legacyUserId = `${userId}_legacy`;
    const selection = (messageId, question) => ({
      conversationId: 'conversation-overlap',
      messageId,
      title: 'One topic',
      question,
      answer: `${question} Answered.`,
      createdAt: null,
    });
    const selectedA = selection('message-a', 'Question A?');
    const selectedB = selection('message-b', 'Question B?');
    const create = (owner, selections, sessionId = crypto.randomUUID()) => createChatGptExportDraftBatchForUser(owner, {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: sessionId,
      selections,
    });

    const first = await create(userId, [selectedA]);
    const firstLoaded = await getKnowledgeDraftBatchForUser(userId, first.batchId);
    assert.ok(firstLoaded);
    const firstDraft = firstLoaded.drafts[0];
    const firstResolution = await resolveKnowledgeDraftForUser(userId, {
      batchId: first.batchId,
      draftId: firstDraft.id,
      action: 'create',
      expectedDraftVersion: firstDraft.version,
      reviewed: {
        title: firstDraft.title,
        summary: firstDraft.summary,
        content: firstDraft.explanation,
        topic: firstDraft.topic,
        tags: firstDraft.tags,
        knowledgeType: firstDraft.knowledge_type,
        centralQuestion: firstDraft.central_question,
        structuredContent: firstDraft.structured_content,
        bundleSchemaVersion: firstDraft.bundle_schema_version,
        evidenceSelectors: [],
        relations: [],
      },
    });
    assert.equal(firstResolution.resolved, true);

    const deletion = await deleteKnowledgeImportBatchForUser(userId, first.batchId);
    assert.deepEqual(deletion, { deleted: true, approvedKnowledgePreserved: 1 });
    const detachedSessionId = crypto.randomUUID();
    clearMemoryKnowledgeProductEventsForTesting(userId);
    await recordKnowledgeProductEventsForUser(userId, [{
      eventName: 'conversation_import_started', eventVersion: 1, subjectId: detachedSessionId,
    }, {
      eventName: 'conversation_import_parsed', eventVersion: 1,
      subjectId: detachedSessionId, selectionCount: 1,
    }, {
      eventName: 'knowledge_context_created', eventVersion: 1,
      subjectId: detachedSessionId, selectionCount: 1,
    }]);
    const durableDuplicate = await create(userId, [selectedA], detachedSessionId);
    assert.equal(durableDuplicate.batchId, null);
    assert.equal(durableDuplicate.created, false);
    assert.equal(durableDuplicate.draftCount, 0);
    assert.equal(durableDuplicate.reviewPath, '/knowledge-inbox');
    await recordChatGptExportCompletionTelemetry(userId, {
      importSessionId: detachedSessionId,
      selectionCount: 1,
      result: durableDuplicate,
    });
    assert.deepEqual(
      getMemoryKnowledgeProductEventsForTesting(userId).map((event) => event.eventName),
      ['knowledge_context_created'],
    );

    const overlapping = await create(userId, [selectedA, selectedB]);
    assert.deepEqual({ created: overlapping.created, draftCount: overlapping.draftCount }, {
      created: true,
      draftCount: 1,
    });
    const overlappingLoaded = await getKnowledgeDraftBatchForUser(userId, overlapping.batchId);
    assert.equal(overlappingLoaded?.drafts.length, 1);
    assert.match(overlappingLoaded?.drafts[0].central_question ?? '', /Question B/);
    assert.deepEqual(overlappingLoaded?.drafts[0].relations, []);

    const retry = await create(userId, [selectedB, selectedA]);
    assert.equal(retry.created, false);
    assert.equal(retry.batchId, overlapping.batchId);
    assert.equal(retry.draftCount, 0);
    assert.equal(retry.reviewPath, '/knowledge-inbox');

    const otherOwner = await create(otherUserId, [selectedA, selectedB]);
    assert.equal(otherOwner.created, true);
    assert.equal(otherOwner.draftCount, 2);

    const selectedABatch = buildChatGptExportBatchInput(chatGptExportImportInputSchema.parse({
      source: 'chatgpt_export', consent: true, importSessionId, selections: [selectedA],
    }));
    const legacyClientCardId = selectedABatch.cards[0].duplicateClientCardIds?.[0];
    assert.ok(legacyClientCardId);
    await createKnowledgeDraftBatchForUser(legacyUserId, {
      provider: 'chatgpt',
      scope: 'selected_export',
      requestId: 'legacy-selection-request',
      cards: [{ clientCardId: legacyClientCardId, title: 'Legacy selected export source' }],
    });
    const legacyRetry = await create(legacyUserId, [selectedA]);
    assert.equal(legacyRetry.created, false);
    assert.equal(legacyRetry.draftCount, 0);
    assert.equal(legacyRetry.reviewPath, '/knowledge-inbox');
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('distinguishes transport retries from an explicit re-import after ignore', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const userId = `user_export_reselect_${crypto.randomUUID()}`;
    const selection = {
      conversationId: 'conversation-reselect',
      messageId: 'message-reselect',
      title: 'Reselect topic',
      question: 'Can an ignored source be selected again?',
      answer: 'A fresh explicit import can prepare it again.',
      createdAt: null,
    };
    const firstInput = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: crypto.randomUUID(),
      selections: [selection],
    };
    const first = await createChatGptExportDraftBatchForUser(userId, firstInput);
    const loaded = await getKnowledgeDraftBatchForUser(userId, first.batchId);
    assert.ok(loaded);
    const ignored = await resolveKnowledgeDraftForUser(userId, {
      batchId: first.batchId,
      draftId: loaded.drafts[0].id,
      action: 'ignore',
      expectedDraftVersion: loaded.drafts[0].version,
    });
    assert.equal(ignored.resolved, true);

    const transportRetry = await createChatGptExportDraftBatchForUser(userId, firstInput);
    assert.equal(transportRetry.created, false);
    assert.equal(transportRetry.batchId, first.batchId);

    const explicitReselection = await createChatGptExportDraftBatchForUser(userId, {
      ...firstInput,
      importSessionId: crypto.randomUUID(),
    });
    assert.equal(explicitReselection.created, true);
    assert.notEqual(explicitReselection.batchId, first.batchId);
    assert.equal(explicitReselection.draftCount, 1);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('keeps a pre-rollout import session idempotent after its draft is ignored', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const userId = `user_export_legacy_ignore_${crypto.randomUUID()}`;
    const input = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: crypto.randomUUID(),
      selections: [{
        conversationId: 'conversation-legacy-ignore',
        messageId: 'message-legacy-ignore',
        title: 'Legacy ignored retry topic',
        question: 'Can a delayed pre-rollout tab restore ignored text?',
        answer: 'The existing legacy batch remains the session authority.',
        createdAt: null,
      }],
    };
    const currentBatch = buildChatGptExportBatchInput(chatGptExportImportInputSchema.parse(input));
    const legacyBatch = buildParentV1ChatGptBatchInput(input);
    assert.equal(legacyBatch.requestId, 'chatgpt-export:ff54daf0f3f08fa17859caa396883c540e4d16cafdb2fb50');
    assert.equal(currentBatch.legacyRequestId, legacyBatch.requestId);
    const legacy = await createKnowledgeDraftBatchForUser(
      userId,
      legacyBatch,
      null,
      input.importSessionId,
    );
    const loaded = await getKnowledgeDraftBatchForUser(userId, legacy.batchId);
    assert.ok(loaded);
    assert.equal((await resolveKnowledgeDraftForUser(userId, {
      batchId: legacy.batchId,
      draftId: loaded.drafts[0].id,
      action: 'ignore',
      expectedDraftVersion: loaded.drafts[0].version,
    })).resolved, true);

    const delayedLegacyTab = await createChatGptExportDraftBatchForUser(userId, input);
    assert.deepEqual(delayedLegacyTab, {
      batchId: legacy.batchId,
      created: false,
      draftCount: 1,
      reviewPath: `/knowledge-inbox/${encodeURIComponent(legacy.batchId)}`,
    });
    const afterRetry = await getKnowledgeDraftBatchForUser(userId, legacy.batchId);
    assert.equal(afterRetry?.drafts.length, 1);
    assert.equal(afterRetry?.drafts[0].status, 'rejected');

    const freshSession = await createChatGptExportDraftBatchForUser(userId, {
      ...input,
      importSessionId: crypto.randomUUID(),
    });
    assert.equal(freshSession.created, true);
    assert.equal(freshSession.draftCount, 1);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('lets a pre-rollout session expand its selection without reusing a different legacy fingerprint', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const userId = `user_export_legacy_expand_${crypto.randomUUID()}`;
    const importSessionId = crypto.randomUUID();
    const selectedA = {
      conversationId: 'conversation-legacy-expand',
      messageId: 'message-legacy-expand-a',
      title: 'Legacy expansion topic',
      question: 'What was selected before rollout?',
      answer: 'Source A was selected first.',
      createdAt: null,
    };
    const selectedB = {
      ...selectedA,
      messageId: 'message-legacy-expand-b',
      question: 'What was added after a lost response?',
      answer: 'Source B was added to the same local session.',
    };
    const legacyInput = {
      source: 'chatgpt_export', consent: true, importSessionId, selections: [selectedA],
    };
    const legacyBatch = buildParentV1ChatGptBatchInput(legacyInput);
    const legacy = await createKnowledgeDraftBatchForUser(
      userId,
      legacyBatch,
      null,
      importSessionId,
    );

    const exactRetry = await createChatGptExportDraftBatchForUser(userId, legacyInput);
    assert.equal(exactRetry.created, false);
    assert.equal(exactRetry.batchId, legacy.batchId);

    const expanded = await createChatGptExportDraftBatchForUser(userId, {
      ...legacyInput,
      selections: [selectedA, selectedB],
    });
    assert.equal(expanded.created, true);
    assert.notEqual(expanded.batchId, legacy.batchId);
    assert.equal(expanded.draftCount, 1);
    const loadedExpanded = await getKnowledgeDraftBatchForUser(userId, expanded.batchId);
    assert.equal(loadedExpanded?.drafts.length, 1);
    assert.equal(loadedExpanded?.drafts[0].central_question, selectedB.question);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('does not reuse a legacy session when a delimiter collision represents different selected exchanges', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const userId = `user_export_legacy_reverse_collision_${crypto.randomUUID()}`;
    const importSessionId = crypto.randomUUID();
    const legacyInput = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId,
      selections: [{
        conversationId: 'a',
        messageId: 'b|c:d',
        title: 'Legacy ambiguous tuple',
        question: 'Which single legacy tuple was selected?',
        answer: 'One delimiter-shaped tuple was selected before v2.',
        createdAt: null,
      }],
    };
    const currentInput = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId,
      selections: [{
        conversationId: 'a',
        messageId: 'b',
        title: 'First current tuple',
        question: 'Which first current tuple was selected?',
        answer: 'The first current tuple is independent.',
        createdAt: null,
      }, {
        conversationId: 'c',
        messageId: 'd',
        title: 'Second current tuple',
        question: 'Which second current tuple was selected?',
        answer: 'The second current tuple is independent.',
        createdAt: null,
      }],
    };
    const legacyBatchInput = buildParentV1ChatGptBatchInput(legacyInput);
    const currentBatchInput = buildChatGptExportBatchInput(
      chatGptExportImportInputSchema.parse(currentInput),
    );
    assert.equal(currentBatchInput.legacyRequestId, legacyBatchInput.requestId);

    const legacy = await createKnowledgeDraftBatchForUser(
      userId,
      legacyBatchInput,
      null,
      importSessionId,
    );
    const current = await createChatGptExportDraftBatchForUser(userId, currentInput);
    assert.equal(current.created, true);
    assert.notEqual(current.batchId, legacy.batchId);
    assert.equal(current.draftCount, 2);
    assert.deepEqual(
      (await getKnowledgeDraftBatchForUser(userId, current.batchId))?.drafts
        .map((draft) => draft.central_question)
        .toSorted(),
      currentInput.selections.map((selection) => selection.question).toSorted(),
    );
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('uses independent batch identities when one local session expands its selection after a lost response', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const userId = `user_export_expanded_retry_${crypto.randomUUID()}`;
    const sessionId = crypto.randomUUID();
    const selectedA = {
      conversationId: 'conversation-expanded-retry',
      messageId: 'message-expanded-a',
      title: 'Expanded retry',
      question: 'What was selected before the response was lost?',
      answer: 'Only source A.',
      createdAt: null,
    };
    const selectedB = {
      ...selectedA,
      messageId: 'message-expanded-b',
      question: 'What did the user add before retrying?',
      answer: 'Source B.',
    };
    const input = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: sessionId,
      selections: [selectedA],
    };
    const first = await createChatGptExportDraftBatchForUser(userId, input);
    const expanded = await createChatGptExportDraftBatchForUser(userId, {
      ...input,
      selections: [selectedA, selectedB],
    });
    assert.equal(expanded.created, true);
    assert.equal(expanded.draftCount, 1);
    assert.notEqual(expanded.batchId, first.batchId);
    assert.notEqual(first.batchId, sessionId);
    const loaded = await getKnowledgeDraftBatchForUser(userId, expanded.batchId);
    assert.equal(loaded?.drafts[0].central_question, selectedB.question);
    assert.deepEqual(loaded?.drafts[0].relations, []);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('keeps identical provider request ids independent across ingestion scopes', async () => {
  const userId = 'selected-export-cross-scope-owner';
  const input = {
    source: 'chatgpt_export',
    consent: true,
    importSessionId: crypto.randomUUID(),
    selections: [{
      conversationId: 'selected-export-cross-scope-conversation',
      messageId: 'selected-export-cross-scope-message',
      title: 'Selected export cross-scope identity',
      question: 'Can ingestion scopes share an opaque request ID safely?',
      answer: 'They can when scope participates in the idempotency key.',
      createdAt: '2026-09-09T00:00:00.000Z',
    }],
  };
  const selectedInput = buildChatGptExportBatchInput(chatGptExportImportInputSchema.parse(input));
  const current = await createKnowledgeDraftBatchForUser(userId, {
    provider: 'chatgpt',
    scope: 'current_conversation',
    requestId: selectedInput.requestId,
    cards: [{ title: 'Current-conversation candidate with a colliding opaque request ID.' }],
  });
  const selected = await createChatGptExportDraftBatchForUser(userId, input);
  assert.equal(current.created, true);
  assert.equal(selected.created, true);
  assert.notEqual(selected.batchId, current.batchId);
  assert.deepEqual(
    (await getKnowledgeDraftBatchesForUser(userId)).map((batch) => batch.scope).toSorted(),
    ['current_conversation', 'selected_export'],
  );
});

test('keeps an exact delayed retry content-free after its pending import job is deleted', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const userId = `user_export_deleted_retry_${crypto.randomUUID()}`;
    const input = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: crypto.randomUUID(),
      selections: [{
        conversationId: 'conversation-deleted-retry',
        messageId: 'message-deleted-retry',
        title: 'Deleted retry topic',
        question: 'Can a delayed request restore deleted selected text?',
        answer: 'The content-free request tombstone rejects that retry.',
        createdAt: null,
      }],
    };
    const first = await createChatGptExportDraftBatchForUser(userId, input);
    assert.deepEqual(await deleteKnowledgeImportBatchForUser(userId, first.batchId), {
      deleted: true,
      approvedKnowledgePreserved: 0,
    });

    const delayedRetry = await createChatGptExportDraftBatchForUser(userId, input);
    assert.equal(delayedRetry.batchId, null);
    assert.equal(delayedRetry.created, false);
    assert.equal(delayedRetry.draftCount, 0);
    assert.equal(delayedRetry.reviewPath, '/knowledge-inbox');

    const deletedSelectedRequestId = buildChatGptExportBatchInput(
      chatGptExportImportInputSchema.parse(input),
    ).requestId;
    const sameRequestOtherScope = await createKnowledgeDraftBatchForUser(userId, {
      provider: 'chatgpt',
      scope: 'current_conversation',
      requestId: deletedSelectedRequestId,
      cards: [{ title: 'A current-conversation request is not a selected-export tombstone retry.' }],
    });
    assert.equal(sameRequestOtherScope.created, true);
    const retryAfterOtherScope = await createChatGptExportDraftBatchForUser(userId, input);
    assert.equal(retryAfterOtherScope.batchId, null);
    assert.equal(retryAfterOtherScope.created, false);
    assert.equal(retryAfterOtherScope.draftCount, 0);

    const explicitReselection = await createChatGptExportDraftBatchForUser(userId, {
      ...input,
      importSessionId: crypto.randomUUID(),
    });
    assert.equal(explicitReselection.created, true);
    assert.equal(explicitReselection.draftCount, 1);

    const currentConversationUser = `user_current_conversation_delete_${crypto.randomUUID()}`;
    const rawClientRequestId = 'client-owned-current-conversation-request';
    const currentConversation = await createKnowledgeDraftBatchForUser(currentConversationUser, {
      provider: 'chatgpt',
      scope: 'current_conversation',
      requestId: rawClientRequestId,
      cards: [{ title: 'Current conversation candidate' }],
    });
    await deleteKnowledgeImportBatchForUser(currentConversationUser, currentConversation.batchId);
    const recreatedCurrentConversation = await createKnowledgeDraftBatchForUser(currentConversationUser, {
      provider: 'chatgpt',
      scope: 'current_conversation',
      requestId: rawClientRequestId,
      cards: [{ title: 'Current conversation candidate' }],
    });
    assert.equal(recreatedCurrentConversation.created, true);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('tombstones a pre-rollout import session before switching request identities', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const userId = `user_export_legacy_deleted_retry_${crypto.randomUUID()}`;
    const input = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: crypto.randomUUID(),
      selections: [{
        conversationId: 'conversation-legacy-deleted-retry',
        messageId: 'message-legacy-deleted-retry',
        title: 'Legacy deleted retry topic',
        question: 'Can a pre-rollout tab restore a deleted selection?',
        answer: 'The session compatibility tombstone rejects it after rollout.',
        createdAt: null,
      }],
    };
    const legacyBatch = buildParentV1ChatGptBatchInput(input);
    const legacy = await createKnowledgeDraftBatchForUser(
      userId,
      legacyBatch,
      null,
      input.importSessionId,
    );
    assert.equal(legacy.batchId, input.importSessionId);
    assert.deepEqual(await deleteKnowledgeImportBatchForUser(userId, legacy.batchId), {
      deleted: true,
      approvedKnowledgePreserved: 0,
    });

    const delayedLegacyTab = await createChatGptExportDraftBatchForUser(userId, input);
    assert.equal(delayedLegacyTab.batchId, null);
    assert.deepEqual({
      created: delayedLegacyTab.created,
      draftCount: delayedLegacyTab.draftCount,
      reviewPath: delayedLegacyTab.reviewPath,
    }, {
      created: false,
      draftCount: 0,
      reviewPath: '/knowledge-inbox',
    });

    const explicitReselection = await createChatGptExportDraftBatchForUser(userId, {
      ...input,
      importSessionId: crypto.randomUUID(),
    });
    assert.equal(explicitReselection.created, true);
    assert.equal(explicitReselection.draftCount, 1);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('keeps completion telemetry best-effort, rehomes every resolved import, and emits candidates-ready only for creation', async () => {
  const calls = [];
  const dependencies = {
    deletePreConfirmationEvents: async (userId, subjectId) => {
      calls.push({ type: 'delete-pre-confirmation', userId, subjectId });
      return 2;
    },
    finalizeEvents: async (userId, completion) => {
      calls.push({ type: 'finalize', userId, completion });
      return completion.result.created ? 2 : 1;
    },
  };
  await recordChatGptExportCompletionTelemetry('telemetry-owner', {
    importSessionId: 'first-session',
    selectionCount: 2,
    result: { batchId: 'first-batch', created: true, draftCount: 2 },
  }, dependencies);
  await recordChatGptExportCompletionTelemetry('telemetry-owner', {
    importSessionId: 'retry-session',
    selectionCount: 2,
    result: { batchId: 'first-batch', created: false, draftCount: 0 },
  }, dependencies);

  assert.deepEqual(calls.filter((call) => call.type === 'finalize'), [{
    type: 'finalize', userId: 'telemetry-owner',
    completion: {
      importSessionId: 'first-session', selectionCount: 2,
      result: { batchId: 'first-batch', created: true, draftCount: 2 },
    },
  }, {
    type: 'finalize', userId: 'telemetry-owner',
    completion: {
      importSessionId: 'retry-session', selectionCount: 2,
      result: { batchId: 'first-batch', created: false, draftCount: 0 },
    },
  }]);

  await recordChatGptExportCompletionTelemetry('telemetry-owner', {
    importSessionId: 'detached-session',
    selectionCount: 1,
    result: { batchId: null, created: false, draftCount: 0 },
  }, dependencies);
  assert.deepEqual(calls.filter((call) => call.type === 'delete-pre-confirmation'), [{
    type: 'delete-pre-confirmation', userId: 'telemetry-owner', subjectId: 'detached-session',
  }]);
  assert.equal(calls.filter((call) => call.type === 'finalize').length, 2);

  await assert.doesNotReject(() => recordChatGptExportCompletionTelemetry('telemetry-owner', {
    importSessionId: 'failed-telemetry-session',
    selectionCount: 1,
    result: { batchId: 'persisted-batch', created: true, draftCount: 1 },
  }, {
    deletePreConfirmationEvents: async () => { throw new Error('telemetry cleanup unavailable'); },
    finalizeEvents: async () => { throw new Error('telemetry finalization unavailable'); },
  }));
  await assert.doesNotReject(() => recordChatGptExportCompletionTelemetry('telemetry-owner', {
    importSessionId: 'failed-detached-session',
    selectionCount: 1,
    result: { batchId: null, created: false, draftCount: 0 },
  }, {
    deletePreConfirmationEvents: async () => { throw new Error('telemetry cleanup unavailable'); },
    finalizeEvents: async () => { throw new Error('finalize should not run'); },
  }));
});

test('memory import deletion and a stale completion cannot leave orphan batch telemetry', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const userId = `telemetry-delete-owner-${crypto.randomUUID()}`;
  const importSessionId = crypto.randomUUID();
  try {
    clearMemoryKnowledgeProductEventsForTesting(userId);
    await recordKnowledgeProductEventsForUser(userId, [{
      eventName: 'conversation_import_started', eventVersion: 1, subjectId: importSessionId,
    }, {
      eventName: 'conversation_import_parsed', eventVersion: 1,
      subjectId: importSessionId, selectionCount: 1,
    }, {
      eventName: 'knowledge_context_created', eventVersion: 1,
      subjectId: importSessionId, selectionCount: 1,
    }]);
    const created = await createChatGptExportDraftBatchForUser(userId, {
      source: 'chatgpt_export',
      consent: true,
      importSessionId,
      selections: [{
        conversationId: `telemetry-delete-conversation-${crypto.randomUUID()}`,
        messageId: `telemetry-delete-message-${crypto.randomUUID()}`,
        title: 'Deletion telemetry serialization',
        question: 'Can stale completion recreate deleted import telemetry?',
        answer: 'No. Completion verifies the exact selected-export batch under the deletion locks.',
        createdAt: null,
      }],
    });
    assert.equal(created.created, true);
    await recordChatGptExportCompletionTelemetry(userId, {
      importSessionId,
      selectionCount: 1,
      result: created,
    });
    assert.equal(
      getMemoryKnowledgeProductEventsForTesting(userId)
        .filter((event) => event.eventName.startsWith('conversation_import_')).length,
      4,
    );

    assert.deepEqual(await deleteKnowledgeImportBatchForUser(userId, created.batchId), {
      deleted: true,
      approvedKnowledgePreserved: 0,
    });
    await recordChatGptExportCompletionTelemetry(userId, {
      importSessionId,
      selectionCount: 1,
      result: created,
    });
    assert.deepEqual(
      getMemoryKnowledgeProductEventsForTesting(userId).map((event) => event.eventName),
      ['knowledge_context_created'],
    );
  } finally {
    clearMemoryKnowledgeProductEventsForTesting(userId);
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

  const drizzleSchema = await readFile(new URL('../drizzle/schema.ts', import.meta.url), 'utf8');
  assert.match(
    drizzleSchema,
    /idx_knowledge_ingestion_batches_user_provider_scope_request[\s\S]{0,100}t\.userId, t\.provider, t\.scope, t\.requestId/,
  );
  for (const source of [
    '../schema.sql',
    '../src/lib/knowledge-ingestion.ts',
    '../drizzle/migrations/0023_knowledge_ingestion_request_tombstones.sql',
  ]) {
    const text = await readFile(new URL(source, import.meta.url), 'utf8');
    assert.match(
      text,
      /idx_knowledge_ingestion_batches_user_provider_scope_request[\s\S]{0,120}(?:user_id|"user_id")[,\s]+(?:provider|"provider")[,\s]+(?:scope|"scope")[,\s]+(?:request_id|"request_id")/,
      source,
    );
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
