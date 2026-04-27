'use server';

import type { ForceGraphData, GraphNodeWithKnowledge } from '@stem-brain/graph-engine';
import { revalidatePath } from 'next/cache';
import { requireCurrentActor } from '@/lib/auth';
import pool from '@/lib/db';
import {
  getDbGraphDataForUser,
  getDbNodeKnowledge,
  getDbUserGraphStats,
  getLeaderboardFromStates,
  getStaticGraphSummary,
  submitDbQuizResult,
} from '@/lib/knowledge-graph-db';

async function getUserId() {
  const user = await requireCurrentActor();
  return user.id;
}

export async function getGraphData(): Promise<ForceGraphData> {
  return getDbGraphDataForUser(await getUserId());
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
    const response = await submitDbQuizResult(userId, nodeId, result);
    revalidatePath('/knowledge');
    return response;
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
  return getDbUserGraphStats(await getUserId());
}

export async function getUserGraphStats() {
  return getDbUserGraphStats(await getUserId());
}

export async function batchUpdateKnowledge(
  updates: { nodeId: string; knowledge: number; confidence?: number }[]
): Promise<{ success: boolean; count: number }> {
  const userId = await getUserId();

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for graph persistence.');
    }
    for (const { nodeId, knowledge, confidence } of updates) {
      await pool.query(
        `
        INSERT INTO user_knowledge_states (user_id, node_id, knowledge_state, confidence, last_updated, first_known_at)
        VALUES ($1, $2, $3, $4, NOW(), CASE WHEN $3 = 1 THEN NOW() ELSE NULL END)
        ON CONFLICT (user_id, node_id)
        DO UPDATE SET
          knowledge_state = EXCLUDED.knowledge_state,
          confidence = EXCLUDED.confidence,
          last_updated = NOW(),
          first_known_at = CASE
            WHEN EXCLUDED.knowledge_state = 1
              THEN COALESCE(user_knowledge_states.first_known_at, NOW())
            ELSE user_knowledge_states.first_known_at
          END
        `,
        [userId, nodeId, knowledge >= 0.75 ? 1 : knowledge >= 0.25 ? 0.5 : 0, confidence ?? 0.5]
      );
    }
    revalidatePath('/knowledge');

    return { success: true, count: updates.length };
  } catch (error) {
    console.error('Error in batchUpdateKnowledge:', error);
    return { success: false, count: 0 };
  }
}

export async function triggerDiffusion(alpha?: number): Promise<{ success: boolean }> {
  try {
    void alpha;
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
  return getDbNodeKnowledge(await getUserId(), nodeId);
}

export async function getGraphSummary() {
  return getStaticGraphSummary();
}

export type LeaderboardData = {
  userId: string;
  mastered: number;
  avgScore: number;
};

export async function getLeaderboardData(): Promise<LeaderboardData[]> {
  if (!process.env.DATABASE_URL) return [];
  const { rows } = await pool.query<{ user_id: string; avg_knowledge: number; known: number }>(
    `
    SELECT
      user_id,
      COUNT(*) FILTER (WHERE knowledge_state = 1)::int AS known,
      AVG(knowledge_state)::float8 AS avg_knowledge
    FROM user_knowledge_states
    GROUP BY user_id
    ORDER BY AVG(knowledge_state) DESC, COUNT(*) FILTER (WHERE knowledge_state = 1) DESC
    LIMIT 50
    `
  );
  return getLeaderboardFromStates(rows);
}
