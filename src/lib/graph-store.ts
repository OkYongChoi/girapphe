import { GRAPH_NODES } from '@/data/graph-nodes';
import { GRAPH_EDGES } from '@/data/graph-edges';
import type {
  GraphNode,
  GraphEdge,
  UserKnowledgeState,
  GraphNodeWithKnowledge,
  ForceGraphData,
  KnowledgeLevel,
} from '@/lib/graph-types';
import { propagateQuizResult, runDiffusion } from '@/lib/diffusion-engine';

// ============================================================
// In-Memory Graph Store (MVP)
// In production, replace with PostgreSQL queries
// ============================================================

// Singleton store
const nodes: GraphNode[] = [...GRAPH_NODES];
const edges: GraphEdge[] = [...GRAPH_EDGES];

// Per-user knowledge states: Map<user_id, Map<node_id, UserKnowledgeState>>
const userStates = new Map<string, Map<string, UserKnowledgeState>>();

function toKnowledgeLevel(value: number): KnowledgeLevel {
  if (value >= 0.75) return 1;
  if (value >= 0.25) return 0.5;
  return 0;
}

function toRenderKnowledge(state: UserKnowledgeState | undefined): number {
  if (!state) return 0;

  if (state.knowledge_state === 1) {
    return Math.min(1, 0.85 + state.confidence * 0.15);
  }
  if (state.knowledge_state === 0.5) {
    return 0.35 + state.confidence * 0.3;
  }
  return state.confidence * 0.15;
}

// --- Node Access ---

export function getAllNodes(): GraphNode[] {
  return nodes;
}

export function getNodeById(id: string): GraphNode | undefined {
  return nodes.find((n) => n.id === id);
}

export function getNodesByDomain(domain: string): GraphNode[] {
  return nodes.filter((n) => n.domain === domain);
}

export function getNodesByLevel(level: number): GraphNode[] {
  return nodes.filter((n) => n.level === level);
}

// --- Edge Access ---

export function getAllEdges(): GraphEdge[] {
  return edges;
}

export function getEdgesForNode(nodeId: string): GraphEdge[] {
  return edges.filter((e) => e.source === nodeId || e.target === nodeId);
}

export function getPrerequisites(nodeId: string): GraphEdge[] {
  return edges.filter((e) => e.target === nodeId && e.type === 'prerequisite');
}

export function getDependents(nodeId: string): GraphEdge[] {
  return edges.filter((e) => e.source === nodeId && e.type === 'prerequisite');
}

// --- User Knowledge State ---

function getUserStates(userId: string): Map<string, UserKnowledgeState> {
  if (!userStates.has(userId)) {
    userStates.set(userId, new Map());
  }
  return userStates.get(userId)!;
}

export function getUserKnowledgeState(
  userId: string,
  nodeId: string
): UserKnowledgeState | undefined {
  return getUserStates(userId).get(nodeId);
}

export function setUserKnowledgeState(
  userId: string,
  nodeId: string,
  knowledgeState: number,
  confidence: number = 0.5
): UserKnowledgeState {
  const states = getUserStates(userId);
  const existing = states.get(nodeId);
  const now = new Date().toISOString();

  const normalizedState = toKnowledgeLevel(knowledgeState);
  const state: UserKnowledgeState = {
    user_id: userId,
    node_id: nodeId,
    knowledge_state: normalizedState,
    confidence: Math.max(0, Math.min(1, confidence)),
    last_updated: now,
    first_known_at:
      normalizedState === 1 && !existing?.first_known_at
        ? now
        : existing?.first_known_at,
  };

  states.set(nodeId, state);
  return state;
}

// --- Quiz Result Processing ---

export function processQuizResult(
  userId: string,
  nodeId: string,
  result: 0 | 0.5 | 1
): {
  directUpdate: UserKnowledgeState;
  propagatedUpdates: Map<string, number>;
} {
  // Update direct node
  const existingState = getUserKnowledgeState(userId, nodeId);
  const currentConfidence = existingState?.confidence ?? 0;

  // Confidence increases with consistent results, decreases with inconsistency
  const newConfidence =
    result === 1
      ? Math.min(1, currentConfidence + 0.15)
      : result === 0.5
        ? Math.max(0.3, currentConfidence)
        : Math.max(0, currentConfidence - 0.1);

  const directUpdate = setUserKnowledgeState(userId, nodeId, result, newConfidence);

  // Propagate through graph
  const states = getUserStates(userId);
  const propagatedUpdates = propagateQuizResult(
    nodes,
    edges,
    states,
    nodeId,
    result
  );

  // Apply propagated updates
  for (const [nId, newK] of propagatedUpdates) {
    if (nId === nodeId) continue; // Skip the direct node
    const existing = states.get(nId);
    setUserKnowledgeState(
      userId,
      nId,
      newK,
      existing?.confidence ?? 0.2
    );
  }

  return { directUpdate, propagatedUpdates };
}

// --- Run Global Diffusion ---

export function runGlobalDiffusion(userId: string, alpha: number = 0.3): void {
  const states = getUserStates(userId);

  const result = runDiffusion({
    nodes,
    edges,
    knowledgeStates: states,
    alpha,
  });

  for (const [nodeId, newK] of result.updatedStates) {
    const existing = states.get(nodeId);
    if (existing) {
      const nextState = toKnowledgeLevel(newK);
      existing.knowledge_state = nextState;
      existing.last_updated = new Date().toISOString();
      if (nextState === 1 && !existing.first_known_at) {
        existing.first_known_at = existing.last_updated;
      }
    }
  }
}

// --- Graph Data for Frontend ---

export function getGraphDataForUser(userId: string): ForceGraphData {
  const states = getUserStates(userId);
  const now = Date.now();

  const nodesWithKnowledge: GraphNodeWithKnowledge[] = nodes.map((node) => {
    const state = states.get(node.id);
    const knowledge = toRenderKnowledge(state);
    const confidence = state?.confidence ?? 0;

    // Calculate growth metrics
    const firstKnownAt = state?.first_known_at
      ? new Date(state.first_known_at).getTime()
      : null;

    let growth_daily = 0;
    let growth_weekly = 0;
    let growth_monthly = 0;

    if (firstKnownAt) {
      const ageMs = now - firstKnownAt;
      const DAY = 86400000;
      if (ageMs < DAY) growth_daily = knowledge;
      if (ageMs < 7 * DAY) growth_weekly = knowledge;
      if (ageMs < 30 * DAY) growth_monthly = knowledge;
    }

    return {
      ...node,
      knowledge,
      confidence,
      growth_daily,
      growth_weekly,
      growth_monthly,
    };
  });

  return {
    nodes: nodesWithKnowledge,
    links: edges,
  };
}

// --- Statistics ---

export function getUserGraphStats(userId: string): {
  total_nodes: number;
  known: number;
  partial: number;
  unknown: number;
  avg_knowledge: number;
  domains: Record<string, { total: number; known: number; avg: number }>;
} {
  const states = getUserStates(userId);

  let known = 0;
  let partial = 0;
  let totalK = 0;
  const domainStats: Record<string, { total: number; known: number; sumK: number }> = {};

  for (const node of nodes) {
    const k = states.get(node.id)?.knowledge_state ?? 0;
    totalK += k;

    if (k === 1) known++;
    else if (k === 0.5) partial++;

    if (!domainStats[node.domain]) {
      domainStats[node.domain] = { total: 0, known: 0, sumK: 0 };
    }
    domainStats[node.domain].total++;
    domainStats[node.domain].sumK += k;
    if (k === 1) domainStats[node.domain].known++;
  }

  const domains: Record<string, { total: number; known: number; avg: number }> = {};
  for (const [d, s] of Object.entries(domainStats)) {
    domains[d] = {
      total: s.total,
      known: s.known,
      avg: s.total > 0 ? s.sumK / s.total : 0,
    };
  }

  return {
    total_nodes: nodes.length,
    known,
    partial,
    unknown: nodes.length - known - partial,
    avg_knowledge: nodes.length > 0 ? totalK / nodes.length : 0,
    domains,
  };
}

export function getLeaderboard(): {
  userId: string;
  known: number;
  avgKnowledge: number;
}[] {
  const leaderboard: { userId: string; known: number; avgKnowledge: number }[] = [];

  for (const [userId] of userStates) {
    const stats = getUserGraphStats(userId);
    leaderboard.push({
      userId,
      known: stats.known,
      avgKnowledge: stats.avg_knowledge,
    });
  }

  return leaderboard.sort((a, b) => b.known - a.known || b.avgKnowledge - a.avgKnowledge);
}

// --- Get unique domains ---

export function getAllDomains(): string[] {
  return [...new Set(nodes.map((n) => n.domain))];
}
