import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { MobileTopicHubItem } from './api';
import { eventTimelineDate, eventTimelineSortKey, primitiveProvenanceEntries } from './knowledge-topic';

function eventItem(occurredAt: string, observedAt: string | null = '2026-08-28T08:00:00.000Z'): Pick<MobileTopicHubItem, 'created_at' | 'observed_at' | 'structured_content'> {
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
  };
}

test('event timeline dates use valid occurrence timestamps and fall back safely', () => {
  assert.equal(eventTimelineDate(eventItem('2026-08-28T09:30:00.000Z')), '2026-08-28T09:30:00.000Z');
  assert.equal(eventTimelineDate(eventItem('sometime after the launch')), '2026-08-28T08:00:00.000Z');
  assert.equal(eventTimelineDate(eventItem('not-a-date', null)), '2026-08-27T08:00:00.000Z');
  const historical = eventItem('2026-08-28T09:30:00.000Z');
  assert.equal(historical.structured_content?.type, 'event');
  if (historical.structured_content?.type === 'event') {
    historical.structured_content.chronology = { precision: 'century', start: { era: 'bce', year: 5 } };
  }
  assert.equal(eventTimelineDate(historical), 'BCE 5');
});

test('event timeline sort keys place BCE chronology before CE chronology', () => {
  const bce = eventItem('');
  assert.equal(bce.structured_content?.type, 'event');
  if (bce.structured_content?.type !== 'event') return;
  bce.structured_content.chronology = { precision: 'century', start: { era: 'bce', year: 5 } };
  const ce = eventItem('');
  if (ce.structured_content?.type !== 'event') return;
  ce.structured_content.chronology = { precision: 'year', start: { era: 'ce', year: 2026 } };
  assert.ok(eventTimelineSortKey(bce)! < eventTimelineSortKey(ce)!);
  assert.equal(eventTimelineSortKey(eventItem('sometime later')), null);
});

test('provenance details render only primitive source positions', () => {
  assert.deepEqual(primitiveProvenanceEntries({
    message_ref: 'm-7',
    line_start: 4,
    exact: true,
    nested: { transcript: 'must not render' },
    absent: null,
  }), [
    ['message_ref', 'm-7'],
    ['line_start', '4'],
    ['exact', 'true'],
  ]);
  assert.deepEqual(primitiveProvenanceEntries(null), []);
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
  assert.match(
    topicScreen,
    /useFocusEffect\(useCallback\(\(\) => \{\s*void load\(\);\s*return \(\) => \{ loadRequest\.current \+= 1; \};\s*\}, \[load\]\)\)/,
  );
});

test('native Topic Hub renders source locators and evidence selector metadata', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const topicScreen = readFileSync(join(sourceDir, '../app/knowledge-topic/[topic].tsx'), 'utf8');
  const mobileApi = readFileSync(join(sourceDir, 'api.ts'), 'utf8');
  const mobileRoute = readFileSync(join(sourceDir, '../../web/src/app/api/mobile/route.ts'), 'utf8');

  assert.match(mobileApi, /evidence_selectors: Array<\{/);
  assert.match(topicScreen, /primitiveProvenanceEntries\(source\.source_locator\)/);
  assert.match(topicScreen, /evidenceBySource\.get\(source\.id\)/);
  assert.match(topicScreen, /primitiveProvenanceEntries\(evidence\.selector\)/);
  assert.match(topicScreen, /evidence\.polarity[\s\S]*?evidence\.selector_type[\s\S]*?evidence\.quality/);
  assert.match(topicScreen, /evidence\.relation_origin[\s\S]*?evidence\.confirmed_at/);
  assert.match(mobileRoute, /toMobileTopicHub\(hub, capabilities\)/);
});
