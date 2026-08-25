import 'server-only';

import { getUserCardDomainProgress, getUserStats } from '@/actions/card-actions';
import { getUserKnowledgeOverview } from '@/actions/user-knowledge-actions';
import { localizeGraphNodes } from '@/lib/content-localization';
import { getDbGraphDataForUser } from '@/lib/knowledge-graph-db';
import type { ForceGraphData } from '@stem-brain/graph-engine';
import type { Locale } from '@stem-brain/shared';

async function getHomeUserGraphData(
  userId: string,
  locale: Locale,
): Promise<ForceGraphData | null> {
  try {
    const graphData = await getDbGraphDataForUser(userId, { maxNodes: 120 });
    return {
      ...graphData,
      nodes: await localizeGraphNodes(graphData.nodes, locale, { generateMissing: false }),
    };
  } catch (error) {
    console.error('Error loading home user graph:', error);
    return null;
  }
}

export async function getHomePersonalization(userId: string, locale: Locale) {
  const [userStats, userKnowledge, domainProgress, userGraphData] = await Promise.all([
    getUserStats(),
    getUserKnowledgeOverview(),
    getUserCardDomainProgress(locale),
    getHomeUserGraphData(userId, locale),
  ]);

  return { userStats, userKnowledge, domainProgress, userGraphData };
}
