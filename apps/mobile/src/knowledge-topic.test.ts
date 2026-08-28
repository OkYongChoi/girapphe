import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { MobileTopicHubItem } from './api';
import { eventTimelineDate } from './knowledge-topic';

function eventItem(occurredAt: string, observedAt: string | null = '2026-08-28T08:00:00.000Z') {
  return {
    created_at: '2026-08-27T08:00:00.000Z',
    observed_at: observedAt,
    structured_content: {
      type: 'event',
      event: 'Event',
      occurred_at: occurredAt,
      context: '',
      changes: [],
      causes: [],
      consequences: [],
    },
  } satisfies Pick<MobileTopicHubItem, 'created_at' | 'observed_at' | 'structured_content'>;
}

test('event timeline dates use valid occurrence timestamps and fall back safely', () => {
  assert.equal(eventTimelineDate(eventItem('2026-08-28T09:30:00.000Z')), '2026-08-28T09:30:00.000Z');
  assert.equal(eventTimelineDate(eventItem('sometime after the launch')), '2026-08-28T08:00:00.000Z');
  assert.equal(eventTimelineDate(eventItem('not-a-date', null)), '2026-08-27T08:00:00.000Z');
});

test('empty topic routes clear loading and cannot restore a stale private hub', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const topicScreen = readFileSync(join(sourceDir, '../app/knowledge-topic/[topic].tsx'), 'utf8');

  assert.match(
    topicScreen,
    /const request = \+\+loadRequest\.current;\s*if \(!topic\) \{\s*setHub\(null\);\s*setError\(null\);\s*setLoading\(false\);\s*return;/,
  );
  assert.match(topicScreen, /if \(request === loadRequest\.current\) setHub\(nextHub\)/);
  assert.match(topicScreen, /if \(request === loadRequest\.current\) setLoading\(false\)/);
});
