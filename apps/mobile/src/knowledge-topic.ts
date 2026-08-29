import type { MobileTopicHubItem } from './api';
import { historicalTimePointKey } from '@stem-brain/shared';

type TimelineEventItem = Pick<MobileTopicHubItem, 'created_at' | 'observed_at' | 'structured_content'>;

export function eventTimelineDate(item: TimelineEventItem) {
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
