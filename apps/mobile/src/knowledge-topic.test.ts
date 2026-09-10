import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_LOCALES } from '@stem-brain/shared';
import type {
  MobileProvenancePosition,
  MobileTopicHubEvidenceSelector,
  MobileTopicHubItem,
} from './api';
import {
  eventTimelineDate,
  eventTimelineSortKey,
  primitiveProvenanceEntries,
  TOPIC_EVIDENCE_TOKEN_KEYS,
  TOPIC_EVIDENCE_TOKEN_LABELS,
  TOPIC_PROVENANCE_POSITION_KEYS,
  TOPIC_PROVENANCE_POSITION_LABELS,
  topicEvidenceTokenLabel,
  topicProvenancePositionLabel,
} from './knowledge-topic';

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
    source_ref: 'https://example.com/evidence',
    message_ref: 'm-7',
    start: 0,
    end: 10_000_000,
    line_start: 4,
    line_end: 1_000_000,
    exact: true,
    transcript: 'must not render',
    nested: { transcript: 'must not render' },
    absent: null,
  }), [
    ['source_ref', 'https://example.com/evidence'],
    ['message_ref', 'm-7'],
    ['start', '0'],
    ['end', '10000000'],
    ['line_start', '4'],
    ['line_end', '1000000'],
  ]);
  assert.deepEqual(primitiveProvenanceEntries({
    source_ref: 'https://user:secret@example.com/evidence?token=secret',
    message_ref: 'raw transcript words',
    start: '0',
    end: 1,
    line_start: 5,
    line_end: 4,
  }), []);
  assert.deepEqual(
    primitiveProvenanceEntries({ message_ref: 'a'.repeat(240) }),
    [['message_ref', 'a'.repeat(240)]],
  );
  assert.deepEqual(primitiveProvenanceEntries(null), []);
});

test('Topic Hub DTO fixes provenance keys and discriminates selector positions', () => {
  const sourcePosition = {
    message_ref: 'message-1', start: 0, end: 1,
  } satisfies MobileProvenancePosition;
  const metadata = {
    id: 'evidence-1',
    knowledge_item_id: 'item-1',
    source_id: 'source-1',
    polarity: 'supports',
    quality: 'high',
    relation_origin: 'explicit_user',
    confirmed_at: null,
    created_at: '2026-09-10T00:00:00.000Z',
  } as const;
  const selectors = [
    { ...metadata, selector_type: 'message', selector: { message_ref: 'message-1', source_ref: 'source-1' } },
    { ...metadata, selector_type: 'external_ref', selector: { source_ref: 'https://example.com/evidence' } },
    { ...metadata, selector_type: 'text_position', selector: { start: 0, end: 1 } },
    { ...metadata, selector_type: 'line_range', selector: { line_start: 1, line_end: 2 } },
  ] satisfies MobileTopicHubEvidenceSelector[];
  const unsupportedPosition: MobileProvenancePosition = {
    // @ts-expect-error Mobile provenance rejects unknown position keys.
    exact: true,
  };

  assert.equal(sourcePosition.message_ref, 'message-1');
  assert.equal(selectors.length, 4);
  assert.deepEqual(primitiveProvenanceEntries(unsupportedPosition), []);
});

test('Topic Hub evidence and source-position labels cover every supported locale', () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.deepEqual(Object.keys(TOPIC_EVIDENCE_TOKEN_LABELS[locale]).sort(), [...TOPIC_EVIDENCE_TOKEN_KEYS].sort());
    assert.deepEqual(Object.keys(TOPIC_PROVENANCE_POSITION_LABELS[locale]).sort(), [...TOPIC_PROVENANCE_POSITION_KEYS].sort());
    assert.ok(TOPIC_EVIDENCE_TOKEN_KEYS.every((key) => topicEvidenceTokenLabel(locale, key)));
    assert.ok(TOPIC_PROVENANCE_POSITION_KEYS.every((key) => topicProvenancePositionLabel(locale, key)));
  }
  assert.equal(topicEvidenceTokenLabel('ja', 'text_position'), 'テキスト位置');
  assert.equal(topicEvidenceTokenLabel('ar', 'high'), 'عالية');
  assert.equal(topicProvenancePositionLabel('ja', 'message_ref'), 'メッセージ参照');
  assert.equal(topicProvenancePositionLabel('ar', 'line_start'), 'سطر البداية');
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

  assert.match(mobileApi, /source_locator: MobileProvenancePosition \| null/);
  assert.match(mobileApi, /evidence_selectors: MobileTopicHubEvidenceSelector\[\]/);
  assert.match(topicScreen, /primitiveProvenanceEntries\(source\.source_locator\)/);
  assert.match(topicScreen, /evidenceBySource\.get\(source\.id\)/);
  assert.match(topicScreen, /primitiveProvenanceEntries\(evidence\.selector\)/);
  assert.match(topicScreen, /topicProvenancePositionLabel\(locale, key\)/);
  assert.match(topicScreen, /evidence\.polarity[\s\S]*?evidence\.selector_type[\s\S]*?evidence\.quality/);
  assert.match(topicScreen, /evidence\.relation_origin[\s\S]*?evidence\.confirmed_at/);
  assert.match(topicScreen, /technicalText: \{ writingDirection: 'ltr', textAlign: 'left' \}/);
  assert.ok((topicScreen.match(/styles\.technicalText/g) ?? []).length >= 2);
  assert.match(mobileRoute, /toMobileTopicHub\(hub, capabilities\)/);
});
