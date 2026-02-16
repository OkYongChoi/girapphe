'use server';

import {
  getGraphDataForUser,
  processQuizResult,
  getUserGraphStats,
  getAllNodes,
  getAllEdges,
  getUserKnowledgeState,
  setUserKnowledgeState,
  runGlobalDiffusion,
} from '@/lib/graph-store';
import type { ForceGraphData, GraphNodeWithKnowledge } from '@/lib/graph-types';
import { revalidatePath } from 'next/cache';
import { requireCurrentUser } from '@/lib/auth';

async function getUserId() {
  const user = await requireCurrentUser();
  return user.id;
}

export async function getGraphData(): Promise<ForceGraphData> {
  return getGraphDataForUser(await getUserId());
}

export async function submitQuizResult(
  nodeId: string,
  result: 0 | 0.5 | 1
): Promise<{
  success: boolean;
  node: GraphNodeWithKnowledge | null;
  propagated_count: number;
}> {
  const userId = await getUserId();

  try {
    const { propagatedUpdates } = processQuizResult(userId, nodeId, result);
    runGlobalDiffusion(userId, 0.3);

    revalidatePath('/knowledge');

    const graphData = getGraphDataForUser(userId);
    const updatedNode = graphData.nodes.find((n) => n.id === nodeId) ?? null;

    return {
      success: true,
      node: updatedNode,
      propagated_count: propagatedUpdates.size,
    };
  } catch (error) {
    console.error('Error in submitQuizResult:', error);
    return {
      success: false,
      node: null,
      propagated_count: 0,
    };
  }
}

export async function getKnowledgeStats() {
  return getUserGraphStats(await getUserId());
}

export async function batchUpdateKnowledge(
  updates: { nodeId: string; knowledge: number; confidence?: number }[]
): Promise<{ success: boolean; count: number }> {
  const userId = await getUserId();

  try {
    for (const { nodeId, knowledge, confidence } of updates) {
      setUserKnowledgeState(userId, nodeId, knowledge, confidence ?? 0.5);
    }

    revalidatePath('/knowledge');

    return { success: true, count: updates.length };
  } catch (error) {
    console.error('Error in batchUpdateKnowledge:', error);
    return { success: false, count: 0 };
  }
}

export async function triggerDiffusion(alpha?: number): Promise<{ success: boolean }> {
  const userId = await getUserId();

  try {
    runGlobalDiffusion(userId, alpha ?? 0.3);
    revalidatePath('/knowledge');
    return { success: true };
  } catch (error) {
    console.error('Error in triggerDiffusion:', error);
    return { success: false };
  }
}

export async function getNodeKnowledge(
  nodeId: string
): Promise<{ knowledge: number; confidence: number } | null> {
  const state = getUserKnowledgeState(await getUserId(), nodeId);

  if (!state) return { knowledge: 0, confidence: 0 };

  return {
    knowledge: state.knowledge_state,
    confidence: state.confidence,
  };
}

export async function getGraphSummary() {
  const nodes = getAllNodes();
  const edges = getAllEdges();
  const domains = [...new Set(nodes.map((n) => n.domain))];

  return {
    total_nodes: nodes.length,
    total_edges: edges.length,
    domains: domains.length,
    domain_list: domains,
    level_distribution: {
      0: nodes.filter((n) => n.level === 0).length,
      1: nodes.filter((n) => n.level === 1).length,
      2: nodes.filter((n) => n.level === 2).length,
    },
  };
}
