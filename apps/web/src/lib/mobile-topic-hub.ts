import type { TopicKnowledgeHub } from '@/lib/topic-knowledge-hub';
import {
  type MobileKnowledgeCapabilities,
  withMobileKnowledgeCompatibility,
  withMobileRelationCompatibility,
} from '@/lib/mobile-knowledge-capabilities';

export type MobileTopicHubProjection = Pick<
  TopicKnowledgeHub,
  'topic' | 'generated_at' | 'sources' | 'activity' | 'evidence_selectors'
> & {
  items: TopicKnowledgeHub['items'];
  relations: TopicKnowledgeHub['relations'];
};

export function toMobileTopicHub(
  hub: TopicKnowledgeHub,
  capabilities: MobileKnowledgeCapabilities,
): MobileTopicHubProjection {
  return {
    topic: hub.topic,
    generated_at: hub.generated_at,
    items: hub.items.map((item) => withMobileKnowledgeCompatibility(item, capabilities)),
    sources: hub.sources,
    activity: hub.activity,
    relations: withMobileRelationCompatibility(hub.relations, capabilities),
    evidence_selectors: hub.evidence_selectors,
  };
}
