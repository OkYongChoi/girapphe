export const ADMIN_NODE_TYPES = ['concept', 'theorem', 'algorithm', 'model'] as const;

export const ADMIN_DOMAINS = [
  'ml',
  'dl',
  'nlp',
  'cv',
  'rl',
  'math',
  'stats',
  'systems',
  'general',
  'signal',
] as const;

export const ADMIN_EDGE_TYPES = [
  'prerequisite',
  'related',
  'generalizes',
  'derived_from',
  'equivalent_to',
] as const;
