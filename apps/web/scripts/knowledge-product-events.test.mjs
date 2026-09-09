import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const originalDatabaseUrl = process.env.DATABASE_URL;
before(() => { delete process.env.DATABASE_URL; });
after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

const imported = await import('../src/lib/knowledge-product-events.ts');
const events = imported.default ?? imported;

test('event persistence stores only a hashed subject and aggregate dimensions', async () => {
  const userId = 'event-owner';
  events.clearMemoryKnowledgeProductEventsForTesting(userId);
  await events.recordKnowledgeProductEventsForUser(userId, [{
    eventName: 'conversation_import_parsed',
    eventVersion: 1,
    subjectId: 'local-session-1',
    selectionCount: 43,
  }]);
  const stored = events.getMemoryKnowledgeProductEventsForTesting(userId);
  assert.equal(stored.length, 1);
  assert.match(stored[0].subjectId, /^[0-9a-f]{64}$/);
  assert.notEqual(stored[0].subjectId, 'local-session-1');
  assert.equal(stored[0].selectionCount, 43);
  assert.equal('title' in stored[0], false);
  assert.equal('topic' in stored[0], false);
  assert.equal('content' in stored[0], false);
});

test('consented import submission atomically records one deletable funnel across full retries', async () => {
  const userId = 'consented-import-event-owner';
  const sessionId = 'consented-import-session-1';
  const batchId = 'consented-import-batch-1';
  events.clearMemoryKnowledgeProductEventsForTesting(userId);

  assert.equal(await events.finalizeChatGptExportCompletionEventsForUser(userId, {
    importSessionId: sessionId,
    batchId,
    parsedExchangeCount: 4,
    selectionCount: 2,
    created: true,
    draftCount: 2,
  }, {
    memoryBatchExists: () => true,
  }), 4);
  assert.equal(await events.finalizeChatGptExportCompletionEventsForUser(userId, {
    importSessionId: sessionId,
    batchId,
    parsedExchangeCount: 4,
    selectionCount: 2,
    created: false,
    draftCount: 2,
  }, {
    memoryBatchExists: () => true,
  }), 0, 'the full same-session Server Action retry is idempotent');

  const stored = events.getMemoryKnowledgeProductEventsForTesting(userId);
  assert.deepEqual(stored.map((event) => event.eventName).toSorted(), [
    'conversation_import_candidates_ready',
    'conversation_import_confirmed',
    'conversation_import_parsed',
    'conversation_import_started',
  ]);
  assert.equal(new Set(stored.map((event) => event.subjectId)).size, 1);
  assert.equal(
    stored.find((event) => event.eventName === 'conversation_import_parsed')?.selectionCount,
    4,
  );
  assert.equal(events.getMemoryKnowledgeProductEventsForTesting(userId).length, 4);
  assert.equal(await events.deleteKnowledgeProductEventsForSubjectForUser(userId, batchId), 4);
});

test('consented import submission cannot leave session events without a live batch', async () => {
  const userId = 'deleted-consented-import-owner';
  events.clearMemoryKnowledgeProductEventsForTesting(userId);

  assert.equal(await events.finalizeChatGptExportCompletionEventsForUser(userId, {
    importSessionId: 'deleted-consented-import-session',
    batchId: 'deleted-consented-import-batch',
    parsedExchangeCount: 3,
    selectionCount: 2,
    created: true,
    draftCount: 2,
  }, {
    memoryBatchExists: () => false,
  }), 0);
  assert.deepEqual(events.getMemoryKnowledgeProductEventsForTesting(userId), []);
});

test('one local session keeps expanded-selection batches independently retryable and deletable', async () => {
  const userId = 'expanded-consented-import-owner';
  const sessionId = 'expanded-consented-import-session';
  const firstBatchId = 'expanded-consented-import-batch-a';
  const secondBatchId = 'expanded-consented-import-batch-b';
  events.clearMemoryKnowledgeProductEventsForTesting(userId);

  for (const [batchId, parsedExchangeCount, selectionCount] of [
    [firstBatchId, 3, 1],
    [secondBatchId, 4, 2],
  ]) {
    assert.equal(await events.finalizeChatGptExportCompletionEventsForUser(userId, {
      importSessionId: sessionId,
      batchId,
      parsedExchangeCount,
      selectionCount,
      created: true,
      draftCount: selectionCount,
    }, {
      memoryBatchExists: () => true,
    }), 4);
  }
  assert.equal(await events.finalizeChatGptExportCompletionEventsForUser(userId, {
    importSessionId: sessionId,
    batchId: secondBatchId,
    parsedExchangeCount: 4,
    selectionCount: 2,
    created: false,
    draftCount: 2,
  }, {
    memoryBatchExists: () => true,
  }), 0);

  const stored = events.getMemoryKnowledgeProductEventsForTesting(userId);
  assert.equal(stored.length, 8);
  assert.equal(new Set(stored.map((event) => event.subjectId)).size, 2);
  assert.equal(await events.deleteKnowledgeProductEventsForSubjectForUser(userId, firstBatchId), 4);
  assert.equal(events.getMemoryKnowledgeProductEventsForTesting(userId).length, 4);
  assert.equal(await events.deleteKnowledgeProductEventsForSubjectForUser(userId, secondBatchId), 4);
});

test('dismissed signal lookup is owner scoped', async () => {
  const owner = 'dismiss-owner';
  const other = 'dismiss-other';
  events.clearMemoryKnowledgeProductEventsForTesting(owner);
  events.clearMemoryKnowledgeProductEventsForTesting(other);
  await events.recordKnowledgeProductEventForUser(owner, {
    eventName: 'knowledge_signal_dismissed',
    eventVersion: 1,
    subjectId: 'kis_abc123',
    signalType: 'contradiction',
    outcome: 'incorrect',
  });
  assert.deepEqual([...await events.getDismissedKnowledgeSignalIdsForUser(owner, ['kis_abc123'])], ['kis_abc123']);
  assert.deepEqual([...await events.getDismissedKnowledgeSignalIdsForUser(other, ['kis_abc123'])], []);
});

test('confirmed import lifecycle events share one deletable batch subject', async () => {
  const userId = 'import-event-owner';
  const sessionId = 'import-session-1';
  const batchId = 'batch-confirmed-1';
  events.clearMemoryKnowledgeProductEventsForTesting(userId);
  await events.recordKnowledgeProductEventsForUser(userId, [{
    eventName: 'conversation_import_started', eventVersion: 1, subjectId: sessionId,
  }, {
    eventName: 'conversation_import_parsed', eventVersion: 1, subjectId: sessionId, selectionCount: 4,
  }, {
    eventName: 'knowledge_context_created', eventVersion: 1, subjectId: sessionId, selectionCount: 1,
  }]);
  assert.equal(await events.reassignKnowledgeProductEventsSubjectForUser(userId, sessionId, batchId), 2);
  await events.recordKnowledgeProductEventForUser(userId, {
    eventName: 'conversation_import_confirmed', eventVersion: 1, subjectId: batchId, selectionCount: 2,
  });
  const stored = events.getMemoryKnowledgeProductEventsForTesting(userId);
  assert.equal(new Set(stored.map((event) => event.subjectId)).size, 2);
  assert.equal(await events.deleteKnowledgeProductEventsForSubjectForUser(userId, sessionId), 1);
  assert.equal(await events.deleteKnowledgeProductEventsForSubjectForUser(userId, batchId), 3);
  assert.deepEqual(events.getMemoryKnowledgeProductEventsForTesting(userId), []);
});

test('no-batch cleanup removes only pre-confirmation import events', async () => {
  const userId = 'detached-import-event-owner';
  const sessionId = 'detached-import-session-1';
  events.clearMemoryKnowledgeProductEventsForTesting(userId);
  await events.recordKnowledgeProductEventsForUser(userId, [{
    eventName: 'conversation_import_started', eventVersion: 1, subjectId: sessionId,
  }, {
    eventName: 'conversation_import_parsed', eventVersion: 1, subjectId: sessionId, selectionCount: 2,
  }, {
    eventName: 'knowledge_context_created', eventVersion: 1, subjectId: sessionId, selectionCount: 1,
  }]);
  assert.equal(
    await events.deletePreConfirmationImportEventsForSubjectForUser(userId, sessionId),
    2,
  );
  assert.deepEqual(
    events.getMemoryKnowledgeProductEventsForTesting(userId).map((event) => event.eventName),
    ['knowledge_context_created'],
  );
});

test('event persistence rejects content-bearing and unbounded payloads', async () => {
  await assert.rejects(() => events.recordKnowledgeProductEventForUser('event-owner', {
    eventName: 'knowledge_context_created', eventVersion: 1,
    subjectId: 'item-1', selectionCount: 1, context: 'private authored content',
  }));
  await assert.rejects(() => events.recordKnowledgeProductEventsForUser('event-owner', Array.from({ length: 11 }, (_, index) => ({
    eventName: 'knowledge_context_created', eventVersion: 1,
    subjectId: `item-${index}`, selectionCount: 1,
  }))));
});
