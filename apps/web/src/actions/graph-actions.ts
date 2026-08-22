'use server';

import type { ForceGraphData, GraphNodeWithKnowledge } from '@stem-brain/graph-engine';
import { revalidatePath } from 'next/cache';
import { requireCurrentActor } from '@/lib/auth';
import pool from '@/lib/db';
import {
  QuizRateLimitError,
  UnknownGraphNodeError,
  getDbGraphDataForUser,
  getDbNodeKnowledge,
  getDbUserGraphStats,
  getLeaderboardFromStates,
  getStaticGraphSummary,
  submitDbQuizResult,
} from '@/lib/knowledge-graph-db';
import type { AssessmentSubmission } from '@/lib/assessment-retry';
import { localizeGraphNodes } from '@/lib/content-localization';

async function getUserId() {
  const user = await requireCurrentActor();
  return user.id;
}

export async function getGraphData(locale?: string): Promise<ForceGraphData> {
  const graph = await getDbGraphDataForUser(await getUserId());
  if (!locale) return graph;
  return {
    ...graph,
    nodes: await localizeGraphNodes(graph.nodes, locale, { generateMissing: false }),
  };
}

export async function submitQuizResult(
  nodeId: string,
  result: 0 | 0.5 | 1
): Promise<AssessmentSubmission<GraphNodeWithKnowledge>> {
  const userId = await getUserId();

  try {
    const response = await submitDbQuizResult(userId, nodeId, result);
    revalidatePath('/knowledge');
    return response;
  } catch (error) {
    if (error instanceof QuizRateLimitError) {
      return {
        success: false,
        node: null,
        propagated_count: 0,
        error: 'rate_limited',
        retry_after_ms: error.retryAfterMs,
      };
    }
    if (error instanceof UnknownGraphNodeError) {
      return {
        success: false,
        node: null,
        propagated_count: 0,
        error: 'unknown_node',
      };
    }
    console.error('Error in submitQuizResult:', error);
    return {
      success: false,
      node: null,
      propagated_count: 0,
      error: 'save_failed',
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
    if (updates.length === 0) return { success: true, count: 0 };
    const normalizedUpdates = [...new Map(updates.map((update) => [update.nodeId, update])).values()];

    await pool.query(
      `
      INSERT INTO user_knowledge_states (
        user_id, node_id, knowledge_state, confidence, last_updated, first_known_at
      )
      SELECT
        $1,
        input.node_id,
        CASE WHEN input.knowledge >= 0.75 THEN 1 WHEN input.knowledge >= 0.25 THEN 0.5 ELSE 0 END,
        input.confidence,
        NOW(),
        CASE WHEN input.knowledge >= 0.75 THEN NOW() ELSE NULL END
      FROM UNNEST($2::text[], $3::double precision[], $4::double precision[])
        AS input(node_id, knowledge, confidence)
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
      [
        userId,
        normalizedUpdates.map(({ nodeId }) => nodeId),
        normalizedUpdates.map(({ knowledge }) => knowledge),
        normalizedUpdates.map(({ confidence }) => confidence ?? 0.5),
      ],
    );
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
