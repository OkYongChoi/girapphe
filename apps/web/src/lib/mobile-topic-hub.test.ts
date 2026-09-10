import assert from 'node:assert/strict';
import test from 'node:test';
import { readMobileKnowledgeCapabilities } from './mobile-knowledge-capabilities';
import { toMobileTopicHub } from './mobile-topic-hub';
import type { TopicKnowledgeHub } from './topic-knowledge-hub';

test('mobile Topic Hub projects provenance without revision-history payloads', () => {
  const hub = {
    topic: 'HTTP caching',
    generated_at: '2026-09-10T00:00:00.000Z',
    items: [],
    sources: [{
      id: 'evidence-source-1',
      knowledge_item_id: 'item-1',
      source_type: 'conversation',
      provider: 'chatgpt',
      conversation_ref: 'conversation-1',
      source_url: null,
      source_locator: { message_ref: 'message-1' },
      discussed_at: null,
      relation_origin: 'explicit_user',
      confirmed_at: '2026-09-10T00:00:00.000Z',
      created_at: '2026-09-10T00:00:00.000Z',
    }],
    activity: [],
    relations: [],
    revisions: [{ sensitive: 'not-for-mobile' }],
    supersessions: [{ sensitive: 'not-for-mobile' }],
    evidence_selectors: [{
      id: 'evidence-1',
      knowledge_item_id: 'item-1',
      source_id: 'evidence-source-1',
      selector_type: 'message',
      selector: { message_ref: 'message-1' },
      polarity: 'supports',
      quality: 'high',
      relation_origin: 'explicit_user',
      confirmed_at: '2026-09-10T00:00:00.000Z',
      created_at: '2026-09-10T00:00:00.000Z',
    }],
  } as unknown as TopicKnowledgeHub;

  const projected = toMobileTopicHub(
    hub,
    readMobileKnowledgeCapabilities('expression-v1,event-chronology-v1,causal-relations-v1'),
  );

  assert.deepEqual(Object.keys(projected).sort(), [
    'activity',
    'evidence_selectors',
    'generated_at',
    'items',
    'relations',
    'sources',
    'topic',
  ]);
  assert.equal(projected.evidence_selectors[0]?.selector_type, 'message');
  assert.deepEqual(projected.evidence_selectors[0]?.selector, { message_ref: 'message-1' });
  assert.equal('revisions' in projected, false);
  assert.equal('supersessions' in projected, false);
});
