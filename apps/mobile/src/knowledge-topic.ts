import type { MobileTopicHubItem } from './api';

type TimelineEventItem = Pick<MobileTopicHubItem, 'created_at' | 'observed_at' | 'structured_content'>;

export function eventTimelineDate(item: TimelineEventItem) {
  if (item.structured_content?.type === 'event' && item.structured_content.occurred_at) {
    const occurred = new Date(item.structured_content.occurred_at);
    if (!Number.isNaN(occurred.getTime())) return occurred.toISOString();
  }
  return item.observed_at ?? item.created_at;
}
