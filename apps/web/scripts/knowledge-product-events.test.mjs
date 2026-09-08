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
  const batchId = 'batch-confirmed-1';
  events.clearMemoryKnowledgeProductEventsForTesting(userId);
  await events.recordKnowledgeProductEventsForUser(userId, [{
    eventName: 'conversation_import_started', eventVersion: 1, subjectId: batchId,
  }, {
    eventName: 'conversation_import_parsed', eventVersion: 1, subjectId: batchId, selectionCount: 4,
  }]);
  await events.recordKnowledgeProductEventForUser(userId, {
    eventName: 'conversation_import_confirmed', eventVersion: 1, subjectId: batchId, selectionCount: 2,
  });
  const stored = events.getMemoryKnowledgeProductEventsForTesting(userId);
  assert.equal(new Set(stored.map((event) => event.subjectId)).size, 1);
  assert.equal(await events.deleteKnowledgeProductEventsForSubjectForUser(userId, batchId), 3);
  assert.deepEqual(events.getMemoryKnowledgeProductEventsForTesting(userId), []);
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
