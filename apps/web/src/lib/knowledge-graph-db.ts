import pool from '@/lib/db';
import { GRAPH_EDGES, GRAPH_NODES } from '@stem-brain/graph-engine';
import {
  getGraphDataForUser,
  processQuizResult,
  propagateQuizResult,
  runDiffusion,
  runGlobalDiffusion,
} from '@stem-brain/graph-engine';
import type {
  ForceGraphData,
  GraphEdge,
  GraphNode,
  GraphNodeWithKnowledge,
  KnowledgeLevel,
  UserKnowledgeState,
} from '@stem-brain/graph-engine';

type GraphNodeRow = {
  id: string;
  label: string;
  domain: string;
  level: number;
  difficulty: number;
  type: GraphNode['type'];
};

type GraphEdgeRow = {
  source: string;
  target: string;
  type: GraphEdge['type'];
  weight: number;
};

type UserKnowledgeStateRow = {
  user_id: string;
  node_id: string;
  knowledge_state: number;
  confidence: number;
  last_updated: string;
  first_known_at: string | null;
};

type ProfileCardStateRow = {
  node_id: string;
  title: string;
  summary: string | null;
  status: string | null;
  progress_state: string | null;
  last_seen: string | null;
};

type DomainSummary = {
  total: number;
  mastered: number;
  reinforcing: number;
  not_started: number;
  avg: number;
};

type KnowledgeProfileNode = {
  id: string;
  label: string;
  domain: string;
  level: number;
  difficulty: number;
  type: GraphNode['type'];
  knowledge_state: KnowledgeLevel;
  confidence: number;
  first_known_at?: string;
  last_updated?: string;
  prerequisite_ids: string[];
  dependent_ids: string[];
};

export type KnowledgeProfile = {
  user_id: string;
  generated_at: string;
  summary: {
    total_nodes: number;
    mastered: number;
    reinforcing: number;
    not_started: number;
    avg_knowledge: number;
  };
  domains: Record<string, DomainSummary>;
  focus: {
    weak_foundations: KnowledgeProfileNode[];
    ready_to_learn: KnowledgeProfileNode[];
    strongest_concepts: KnowledgeProfileNode[];
  };
  nodes: KnowledgeProfileNode[];
  card_states: Array<{
    node_id: string;
    title: string;
    summary: string | null;
    status: string | null;
    progress_state: string | null;
    last_seen: string | null;
  }>;
};

export type KnowledgeContextExport = {
  generated_at: string;
  summary: string;
  prompt_block: string;
};

function ensureGraphDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Graph database access requires DATABASE_URL to be configured.');
  }
}

function toKnowledgeLevel(value: number): KnowledgeLevel {
  if (value >= 0.75) return 1;
  if (value >= 0.25) return 0.5;
  return 0;
}

function toRenderKnowledge(state: UserKnowledgeState | undefined): number {
  if (!state) return 0;
  if (state.knowledge_state === 1) return Math.min(1, 0.85 + state.confidence * 0.15);
  if (state.knowledge_state === 0.5) return 0.35 + state.confidence * 0.3;
  return state.confidence * 0.15;
}

function asUserKnowledgeState(row: UserKnowledgeStateRow): UserKnowledgeState {
  return {
    user_id: row.user_id,
    node_id: row.node_id,
    knowledge_state: row.knowledge_state as KnowledgeLevel,
    confidence: row.confidence,
    last_updated: row.last_updated,
    first_known_at: row.first_known_at ?? undefined,
  };
}

async function getGraphNodes(): Promise<GraphNode[]> {
  if (!process.env.DATABASE_URL) return [...GRAPH_NODES];
  ensureGraphDatabase();
  const { rows } = await pool.query<GraphNodeRow>(
    'SELECT id, label, domain, level, difficulty, type FROM graph_nodes ORDER BY domain, level, label'
  );
  return rows;
}

async function getGraphEdges(): Promise<GraphEdge[]> {
  if (!process.env.DATABASE_URL) return [...GRAPH_EDGES];
  ensureGraphDatabase();
  const { rows } = await pool.query<GraphEdgeRow>(
    'SELECT source, target, type, weight FROM graph_edges ORDER BY source, target, type'
  );
  return rows;
}

async function getUserStateMap(userId: string): Promise<Map<string, UserKnowledgeState>> {
  if (!process.env.DATABASE_URL) return new Map();
  ensureGraphDatabase();
  const { rows } = await pool.query<UserKnowledgeStateRow>(
    `SELECT user_id, node_id, knowledge_state, confidence, last_updated, first_known_at
     FROM user_knowledge_states
     WHERE user_id = $1`,
    [userId]
  );
  return new Map(rows.map((row) => [row.node_id, asUserKnowledgeState(row)]));
}

async function persistUserStates(userId: string, states: UserKnowledgeState[]): Promise<void> {
  if (states.length === 0) return;
  ensureGraphDatabase();

  const values: unknown[] = [];
  const tuples: string[] = [];

  for (const state of states) {
    const base = values.length;
    tuples.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
    );
    values.push(
      userId,
      state.node_id,
      state.knowledge_state,
      state.confidence,
      state.last_updated,
      state.first_known_at ?? null
    );
  }

  await pool.query(
    `
    INSERT INTO user_knowledge_states (
      user_id,
      node_id,
      knowledge_state,
      confidence,
      last_updated,
      first_known_at
    )
    VALUES ${tuples.join(',\n')}
    ON CONFLICT (user_id, node_id)
    DO UPDATE SET
      knowledge_state = EXCLUDED.knowledge_state,
      confidence = EXCLUDED.confidence,
      last_updated = EXCLUDED.last_updated,
      first_known_at = CASE
        WHEN EXCLUDED.knowledge_state = 1
          THEN COALESCE(user_knowledge_states.first_known_at, EXCLUDED.first_known_at, EXCLUDED.last_updated)
        ELSE user_knowledge_states.first_known_at
      END
    `,
    values
  );
}

export async function getDbGraphDataForUser(userId: string): Promise<ForceGraphData> {
  const [nodes, edges, states] = await Promise.all([
    getGraphNodes(),
    getGraphEdges(),
    getUserStateMap(userId),
  ]);
  const now = Date.now();

  const nodesWithKnowledge: GraphNodeWithKnowledge[] = nodes.map((node) => {
    const state = states.get(node.id);
    const knowledge = toRenderKnowledge(state);
    const confidence = state?.confidence ?? 0;
    const firstKnownAt = state?.first_known_at ? new Date(state.first_known_at).getTime() : null;

    let growth_daily = 0;
    let growth_weekly = 0;
    let growth_monthly = 0;

    if (firstKnownAt) {
      const ageMs = now - firstKnownAt;
      const day = 86400000;
      if (ageMs < day) growth_daily = knowledge;
      if (ageMs < 7 * day) growth_weekly = knowledge;
      if (ageMs < 30 * day) growth_monthly = knowledge;
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

export async function getDbUserGraphStats(userId: string): Promise<{
  total_nodes: number;
  mastered: number;
  reinforcing: number;
  not_started: number;
  avg_knowledge: number;
  domains: Record<string, DomainSummary>;
}> {
  const [nodes, states] = await Promise.all([getGraphNodes(), getUserStateMap(userId)]);

  let mastered = 0;
  let reinforcing = 0;
  let totalK = 0;
  const domains: Record<string, { total: number; mastered: number; reinforcing: number; sumK: number }> = {};

  for (const node of nodes) {
    const state = states.get(node.id);
    const k = state?.knowledge_state ?? 0;
    totalK += k;
    if (k === 1) mastered += 1;
    else if (k === 0.5) reinforcing += 1;

    if (!domains[node.domain]) {
      domains[node.domain] = { total: 0, mastered: 0, reinforcing: 0, sumK: 0 };
    }
    domains[node.domain].total += 1;
    domains[node.domain].sumK += k;
    if (k === 1) domains[node.domain].mastered += 1;
    if (k === 0.5) domains[node.domain].reinforcing += 1;
  }

  const totalNodes = nodes.length;
  const notStarted = totalNodes - mastered - reinforcing;

  return {
    total_nodes: totalNodes,
    mastered,
    reinforcing,
    not_started: notStarted,
    avg_knowledge: totalNodes > 0 ? totalK / totalNodes : 0,
    domains: Object.fromEntries(
      Object.entries(domains).map(([domain, stats]) => [
        domain,
        {
          total: stats.total,
          mastered: stats.mastered,
          reinforcing: stats.reinforcing,
          not_started: stats.total - stats.mastered - stats.reinforcing,
          avg: stats.total > 0 ? stats.sumK / stats.total : 0,
        },
      ])
    ),
  };
}

export async function getDbNodeKnowledge(
  userId: string,
  nodeId: string
): Promise<{ knowledge: number; confidence: number } | null> {
  const states = await getUserStateMap(userId);
  const state = states.get(nodeId);
  if (!state) return { knowledge: 0, confidence: 0 };
  return {
    knowledge: state.knowledge_state,
    confidence: state.confidence,
  };
}

export async function submitDbQuizResult(
  userId: string,
  nodeId: string,
  result: 0 | 0.5 | 1
): Promise<{
  success: boolean;
  node: GraphNodeWithKnowledge | null;
  propagated_count: number;
}> {
  if (!process.env.DATABASE_URL) {
    const { propagatedUpdates } = processQuizResult(userId, nodeId, result);
    runGlobalDiffusion(userId, 0.3);
    const graphData = getGraphDataForUser(userId);

    return {
      success: true,
      node: graphData.nodes.find((node) => node.id === nodeId) ?? null,
      propagated_count: Math.max(0, propagatedUpdates.size - 1),
    };
  }

  ensureGraphDatabase();

  const [nodes, edges, states] = await Promise.all([
    getGraphNodes(),
    getGraphEdges(),
    getUserStateMap(userId),
  ]);

  const now = new Date().toISOString();
  const existingState = states.get(nodeId);
  const currentConfidence = existingState?.confidence ?? 0;
  const newConfidence =
    result === 1
      ? Math.min(1, currentConfidence + 0.15)
      : result === 0.5
        ? Math.max(0.3, currentConfidence)
        : Math.max(0, currentConfidence - 0.1);

  const directUpdate: UserKnowledgeState = {
    user_id: userId,
    node_id: nodeId,
    knowledge_state: result,
    confidence: newConfidence,
    last_updated: now,
    first_known_at:
      result === 1 ? existingState?.first_known_at ?? now : existingState?.first_known_at,
  };
  states.set(nodeId, directUpdate);

  const propagatedUpdates = propagateQuizResult(nodes, edges, states, nodeId, result);
  for (const [nextNodeId, nextKnowledge] of propagatedUpdates) {
    if (nextNodeId === nodeId) continue;
    const existing = states.get(nextNodeId);
    states.set(nextNodeId, {
      user_id: userId,
      node_id: nextNodeId,
      knowledge_state: toKnowledgeLevel(nextKnowledge),
      confidence: existing?.confidence ?? 0.2,
      last_updated: now,
      first_known_at:
        toKnowledgeLevel(nextKnowledge) === 1
          ? existing?.first_known_at ?? now
          : existing?.first_known_at,
    });
  }

  const diffused = runDiffusion({
    nodes,
    edges,
    knowledgeStates: states,
    alpha: 0.3,
  });

  for (const [nextNodeId, nextKnowledge] of diffused.updatedStates) {
    const existing = states.get(nextNodeId);
    if (!existing) continue;
    const nextLevel = toKnowledgeLevel(nextKnowledge);
    states.set(nextNodeId, {
      ...existing,
      knowledge_state: nextLevel,
      last_updated: now,
      first_known_at: nextLevel === 1 ? existing.first_known_at ?? now : existing.first_known_at,
    });
  }

  await persistUserStates(userId, [...states.values()]);
  const graphData = await getDbGraphDataForUser(userId);

  return {
    success: true,
    node: graphData.nodes.find((node) => node.id === nodeId) ?? null,
    propagated_count: Math.max(0, propagatedUpdates.size - 1),
  };
}

export async function buildKnowledgeProfile(userId: string): Promise<KnowledgeProfile> {
  const [nodes, edges, states, summary] = await Promise.all([
    getGraphNodes(),
    getGraphEdges(),
    getUserStateMap(userId),
    getDbUserGraphStats(userId),
  ]);

  const prereqByTarget = new Map<string, string[]>();
  const dependentBySource = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type !== 'prerequisite') continue;
    const prereqs = prereqByTarget.get(edge.target) ?? [];
    prereqs.push(edge.source);
    prereqByTarget.set(edge.target, prereqs);

    const dependents = dependentBySource.get(edge.source) ?? [];
    dependents.push(edge.target);
    dependentBySource.set(edge.source, dependents);
  }

  const profileNodes: KnowledgeProfileNode[] = nodes.map((node) => {
    const state = states.get(node.id);
    return {
      id: node.id,
      label: node.label,
      domain: node.domain,
      level: node.level,
      difficulty: node.difficulty,
      type: node.type,
      knowledge_state: state?.knowledge_state ?? 0,
      confidence: state?.confidence ?? 0,
      first_known_at: state?.first_known_at,
      last_updated: state?.last_updated,
      prerequisite_ids: prereqByTarget.get(node.id) ?? [],
      dependent_ids: dependentBySource.get(node.id) ?? [],
    };
  });

  const weakFoundations = profileNodes
    .filter((node) => node.level <= 2 && node.knowledge_state < 1)
    .sort((a, b) => {
      const dependentGap = b.dependent_ids.length - a.dependent_ids.length;
      if (dependentGap !== 0) return dependentGap;
      return a.knowledge_state - b.knowledge_state;
    })
    .slice(0, 12);

  const readyToLearn = profileNodes
    .filter((node) => node.knowledge_state < 1)
    .filter((node) => {
      if (node.prerequisite_ids.length === 0) return false;
      return node.prerequisite_ids.every((prereqId) => {
        const prereq = states.get(prereqId);
        return (prereq?.knowledge_state ?? 0) >= 0.5;
      });
    })
    .sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return b.confidence - a.confidence;
    })
    .slice(0, 12);

  const strongestConcepts = profileNodes
    .filter((node) => node.knowledge_state === 1)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return b.dependent_ids.length - a.dependent_ids.length;
    })
    .slice(0, 12);

  const { rows: cardRows } = process.env.DATABASE_URL
    ? await pool.query<ProfileCardStateRow>(
        `
        SELECT
          REPLACE(kc.id, 'graph_', '') AS node_id,
          kc.title,
          kc.summary,
          ucs.status,
          ucs.progress_state,
          ucs.last_seen::text AS last_seen
        FROM knowledge_cards kc
        LEFT JOIN user_card_states ucs
          ON kc.id = ucs.card_id AND ucs.user_id = $1
        WHERE kc.id NOT LIKE 'drill_%'
        ORDER BY kc.domain, kc.level, kc.title
        `,
        [userId]
      )
    : { rows: [] as ProfileCardStateRow[] };

  return {
    user_id: userId,
    generated_at: new Date().toISOString(),
    summary: {
      total_nodes: summary.total_nodes,
      mastered: summary.mastered,
      reinforcing: summary.reinforcing,
      not_started: summary.not_started,
      avg_knowledge: summary.avg_knowledge,
    },
    domains: summary.domains,
    focus: {
      weak_foundations: weakFoundations,
      ready_to_learn: readyToLearn,
      strongest_concepts: strongestConcepts,
    },
    nodes: profileNodes,
    card_states: cardRows,
  };
}

export async function buildKnowledgeContext(userId: string): Promise<KnowledgeContextExport> {
  const profile = await buildKnowledgeProfile(userId);

  const listToLine = (label: string, nodes: KnowledgeProfileNode[]) =>
    `${label}: ${
      nodes.length > 0
        ? nodes.map((node) => `${node.label} [${node.knowledge_state}, c=${node.confidence.toFixed(2)}]`).join('; ')
        : 'none'
    }`;

  const domainLine = Object.entries(profile.domains)
    .sort((a, b) => b[1].avg - a[1].avg)
    .map(([domain, stats]) => `${domain}: avg=${stats.avg.toFixed(2)}, mastered=${stats.mastered}, reinforcing=${stats.reinforcing}, not_started=${stats.not_started}`)
    .join(' | ');

  const summary = [
    `User knowledge summary: ${profile.summary.mastered} mastered, ${profile.summary.reinforcing} reinforcing, ${profile.summary.not_started} not_started out of ${profile.summary.total_nodes} nodes.`,
    `Domain strengths: ${domainLine || 'none'}.`,
    listToLine('Strongest concepts', profile.focus.strongest_concepts),
    listToLine('Weak foundations', profile.focus.weak_foundations),
    listToLine('Ready to learn next', profile.focus.ready_to_learn),
  ].join(' ');

  const promptBlock = [
    'Use this user knowledge map to adapt explanation depth and examples.',
    'Prefer short reminders for mastered concepts, compact refreshers for reinforcing concepts, and first-principles explanations for not_started concepts.',
    'Do not assume mastery outside the strongest concepts listed below.',
    `Mastery summary: ${profile.summary.mastered}/${profile.summary.total_nodes} nodes mastered, ${profile.summary.reinforcing} reinforcing.`,
    listToLine('Strongest concepts', profile.focus.strongest_concepts),
    listToLine('Weak foundations', profile.focus.weak_foundations),
    listToLine('Ready to learn next', profile.focus.ready_to_learn),
  ].join('\n');

  return {
    generated_at: profile.generated_at,
    summary,
    prompt_block: promptBlock,
  };
}

export function getStaticGraphSummary() {
  const nodes = [...GRAPH_NODES];
  const edges = [...GRAPH_EDGES];
  const domains = [...new Set(nodes.map((node) => node.domain))];

  return {
    total_nodes: nodes.length,
    total_edges: edges.length,
    domains: domains.length,
    domain_list: domains,
    level_distribution: {
      0: nodes.filter((node) => node.level === 0).length,
      1: nodes.filter((node) => node.level === 1).length,
      2: nodes.filter((node) => node.level === 2).length,
    },
  };
}

export function getLeaderboardFromStates(rows: Array<{ user_id: string; avg_knowledge: number; known: number }>) {
  return rows.map((entry) => ({
    userId: entry.user_id,
    mastered: entry.known,
    avgScore: entry.avg_knowledge,
  }));
}
