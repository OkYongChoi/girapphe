import type { MobileTopicHubItem } from './api';
import { historicalTimePointKey, type Locale } from '@stem-brain/shared';
import { eventChronologyLabel } from './knowledge-bundle-ui';

export const TOPIC_EVIDENCE_TOKEN_KEYS = [
  'message',
  'text_position',
  'line_range',
  'external_ref',
  'unknown',
  'low',
  'medium',
  'high',
] as const;

type TopicEvidenceToken = typeof TOPIC_EVIDENCE_TOKEN_KEYS[number];

export const TOPIC_EVIDENCE_TOKEN_LABELS: Record<Locale, Record<TopicEvidenceToken, string>> = {
  en: { message: 'Message', text_position: 'Text position', line_range: 'Line range', external_ref: 'External reference', unknown: 'Unknown', low: 'Low', medium: 'Medium', high: 'High' },
  ja: { message: 'メッセージ', text_position: 'テキスト位置', line_range: '行範囲', external_ref: '外部参照', unknown: '不明', low: '低', medium: '中', high: '高' },
  'zh-CN': { message: '消息', text_position: '文本位置', line_range: '行范围', external_ref: '外部引用', unknown: '未知', low: '低', medium: '中', high: '高' },
  es: { message: 'Mensaje', text_position: 'Posición de texto', line_range: 'Rango de líneas', external_ref: 'Referencia externa', unknown: 'Desconocida', low: 'Baja', medium: 'Media', high: 'Alta' },
  ar: { message: 'رسالة', text_position: 'موضع النص', line_range: 'نطاق الأسطر', external_ref: 'مرجع خارجي', unknown: 'غير معروفة', low: 'منخفضة', medium: 'متوسطة', high: 'عالية' },
  hi: { message: 'संदेश', text_position: 'पाठ की स्थिति', line_range: 'पंक्ति सीमा', external_ref: 'बाहरी संदर्भ', unknown: 'अज्ञात', low: 'निम्न', medium: 'मध्यम', high: 'उच्च' },
};

export const TOPIC_PROVENANCE_POSITION_KEYS = [
  'source_ref',
  'message_ref',
  'start',
  'end',
  'line_start',
  'line_end',
] as const;

type TopicProvenancePositionKey = typeof TOPIC_PROVENANCE_POSITION_KEYS[number];

const MAX_TOPIC_MESSAGE_REFERENCE_LENGTH = 240;
const MAX_TOPIC_SOURCE_REFERENCE_LENGTH = 2_048;
const MAX_TOPIC_TEXT_POSITION = 10_000_000;
const MAX_TOPIC_LINE_POSITION = 1_000_000;
const TOPIC_URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//u;
const TOPIC_OPAQUE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u;

export const TOPIC_PROVENANCE_POSITION_LABELS: Record<Locale, Record<TopicProvenancePositionKey, string>> = {
  en: { source_ref: 'Source reference', message_ref: 'Message reference', start: 'Start', end: 'End', line_start: 'Starting line', line_end: 'Ending line' },
  ja: { source_ref: '出典参照', message_ref: 'メッセージ参照', start: '開始位置', end: '終了位置', line_start: '開始行', line_end: '終了行' },
  'zh-CN': { source_ref: '来源引用', message_ref: '消息引用', start: '起始位置', end: '结束位置', line_start: '起始行', line_end: '结束行' },
  es: { source_ref: 'Referencia de origen', message_ref: 'Referencia del mensaje', start: 'Inicio', end: 'Fin', line_start: 'Línea inicial', line_end: 'Línea final' },
  ar: { source_ref: 'مرجع المصدر', message_ref: 'مرجع الرسالة', start: 'البداية', end: 'النهاية', line_start: 'سطر البداية', line_end: 'سطر النهاية' },
  hi: { source_ref: 'स्रोत संदर्भ', message_ref: 'संदेश संदर्भ', start: 'आरंभ', end: 'अंत', line_start: 'आरंभिक पंक्ति', line_end: 'अंतिम पंक्ति' },
};

export function topicEvidenceTokenLabel(locale: Locale, value: string): string | null {
  return (TOPIC_EVIDENCE_TOKEN_LABELS[locale] as Record<string, string>)[value] ?? null;
}

export function topicProvenancePositionLabel(
  locale: Locale,
  key: TopicProvenancePositionKey,
): string {
  return TOPIC_PROVENANCE_POSITION_LABELS[locale][key];
}

function nativeOpaqueReference(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.normalize('NFKC').trim();
  if (!candidate
    || Array.from(candidate).length > MAX_TOPIC_MESSAGE_REFERENCE_LENGTH
    || TOPIC_URL_SCHEME_PATTERN.test(candidate)
    || !TOPIC_OPAQUE_REFERENCE_PATTERN.test(candidate)) return null;
  return candidate;
}

function nativeSourceReference(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.normalize('NFKC').trim();
  const hasControlCharacter = Array.from(candidate).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
  if (!candidate || hasControlCharacter) return null;
  if (!TOPIC_URL_SCHEME_PATTERN.test(candidate)) return nativeOpaqueReference(candidate);
  if (Array.from(candidate).length > MAX_TOPIC_SOURCE_REFERENCE_LENGTH) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:'
      && Boolean(parsed.hostname)
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash
      ? candidate
      : null;
  } catch {
    return null;
  }
}

type TimelineEventItem = Pick<MobileTopicHubItem, 'created_at' | 'observed_at' | 'structured_content'>;

export function primitiveProvenanceEntries(
  value: Record<string, unknown> | null,
): Array<readonly [TopicProvenancePositionKey, string]> {
  if (!value) return [];
  const projected: Partial<Record<TopicProvenancePositionKey, string | number>> = {};
  const sourceRef = nativeSourceReference(value.source_ref);
  const messageRef = nativeOpaqueReference(value.message_ref);
  if (sourceRef) projected.source_ref = sourceRef;
  if (messageRef) projected.message_ref = messageRef;

  const { start, end, line_start: lineStart, line_end: lineEnd } = value;
  if (Number.isSafeInteger(start) && Number.isSafeInteger(end)
    && Number(start) >= 0 && Number(end) > Number(start)
    && Number(end) <= MAX_TOPIC_TEXT_POSITION) {
    projected.start = Number(start);
    projected.end = Number(end);
  }
  if (Number.isSafeInteger(lineStart) && Number.isSafeInteger(lineEnd)
    && Number(lineStart) >= 1 && Number(lineEnd) >= Number(lineStart)
    && Number(lineEnd) <= MAX_TOPIC_LINE_POSITION) {
    projected.line_start = Number(lineStart);
    projected.line_end = Number(lineEnd);
  }

  return TOPIC_PROVENANCE_POSITION_KEYS.flatMap((key) => {
    const entry = projected[key];
    return entry === undefined ? [] : [[key, String(entry)] as const];
  });
}

export function eventTimelineDate(item: TimelineEventItem) {
  if (item.structured_content?.type === 'event' && item.structured_content.chronology) {
    return eventChronologyLabel(item.structured_content.chronology);
  }
  if (item.structured_content?.type === 'event' && item.structured_content.occurred_at) {
    const occurred = new Date(item.structured_content.occurred_at);
    if (!Number.isNaN(occurred.getTime())) return occurred.toISOString();
  }
  return item.observed_at ?? item.created_at;
}

export function eventTimelineSortKey(item: TimelineEventItem): number | null {
  if (item.structured_content?.type !== 'event') return null;
  if (item.structured_content.chronology) return historicalTimePointKey(item.structured_content.chronology.start);
  if (!item.structured_content.occurred_at) return null;
  const occurred = new Date(item.structured_content.occurred_at);
  return Number.isNaN(occurred.getTime())
    ? null
    : occurred.getUTCFullYear() * 372 + occurred.getUTCMonth() * 31 + occurred.getUTCDate() - 1;
}
