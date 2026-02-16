// ============================================================
// Knowledge Graph Type Definitions
// ============================================================

// --- Node Types ---

export type NodeType = 'concept' | 'theorem' | 'algorithm' | 'model' | 'advertisement';

export interface GraphNode {
  id: string;
  label: string;
  domain: string;
  level: number; // depth 0~5
  difficulty: number; // 1~5
  type: NodeType;
}

// --- Edge Types ---

export type EdgeType =
  | 'prerequisite'   // directed: source is prerequisite of target
  | 'related'        // bidirectional
  | 'generalizes'    // directed: source generalizes target
  | 'derived_from'   // directed: source is derived from target
  | 'equivalent_to'; // bidirectional

export interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
  weight: number; // 0.0 ~ 1.0
}

// --- User Knowledge State ---

export type KnowledgeLevel = 0 | 0.5 | 1; // unknown | partial | known

export interface UserKnowledgeState {
  user_id: string;
  node_id: string;
  knowledge_state: KnowledgeLevel; // 0 = unknown, 0.5 = partial, 1 = known
  confidence: number; // 0.0 ~ 1.0
  last_updated: string; // ISO timestamp
  first_known_at?: string; // ISO timestamp, set when knowledge_state first reaches 1
}

// --- Graph Data for Frontend ---

export interface GraphNodeWithKnowledge extends GraphNode {
  knowledge: number; // 0.0 ~ 1.0
  confidence: number;
  growth_daily: number;
  growth_weekly: number;
  growth_monthly: number;
}

export interface ForceGraphData {
  nodes: GraphNodeWithKnowledge[];
  links: GraphEdge[];
}

// --- API Types ---

export interface QuizResultPayload {
  user_id: string;
  node_id: string;
  result: 0 | 0.5 | 1; // unknown | partial | known
}

export interface DiffusionConfig {
  alpha: number; // diffusion rate (0.0 ~ 1.0), default 0.3
}

// --- Domain Color Mapping ---

export const DOMAIN_COLORS: Record<string, string> = {
  mathematics: '#f59e0b',
  'computer_science': '#3b82f6',
  'machine_learning': '#a855f7',
  'artificial_intelligence': '#ec4899',
  'linear_algebra': '#f59e0b',
  'probability_statistics': '#f97316',
  optimization: '#eab308',
  calculus: '#d97706',
  algorithms: '#3b82f6',
  'data_structures': '#06b6d4',
  'complexity_theory': '#0ea5e9',
  'supervised_learning': '#a855f7',
  'unsupervised_learning': '#8b5cf6',
  'reinforcement_learning': '#7c3aed',
  'deep_learning': '#ec4899',
  'theoretical_ml': '#f43f5e',
  chemistry: '#10b981',
  biology: '#22c55e',
  misc: '#6b7280',
};

export function getDomainColor(domain: string): string {
  // Try exact match first
  const key = domain.toLowerCase().replace(/\s+/g, '_');
  if (DOMAIN_COLORS[key]) return DOMAIN_COLORS[key];

  // Try parent domain
  const parentMap: Record<string, string> = {
    linear_algebra: 'mathematics',
    probability_statistics: 'mathematics',
    optimization: 'mathematics',
    calculus: 'mathematics',
    algorithms: 'computer_science',
    data_structures: 'computer_science',
    complexity_theory: 'computer_science',
    supervised_learning: 'machine_learning',
    unsupervised_learning: 'machine_learning',
    reinforcement_learning: 'machine_learning',
    deep_learning: 'artificial_intelligence',
    theoretical_ml: 'machine_learning',
  };

  const parent = parentMap[key];
  if (parent && DOMAIN_COLORS[parent]) return DOMAIN_COLORS[parent];

  return '#6b7280'; // default gray
}
