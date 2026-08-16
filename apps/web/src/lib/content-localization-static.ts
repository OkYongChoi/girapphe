import 'server-only';

import { GRAPH_EDGES, GRAPH_NODES } from '@stem-brain/graph-engine';

export const STATIC_NODE_BY_ID = new Map(GRAPH_NODES.map((node) => [node.id, node]));
export const STATIC_NODE_IDS_BY_LABEL = new Map<string, string[]>();
for (const node of GRAPH_NODES) {
  const ids = STATIC_NODE_IDS_BY_LABEL.get(node.label) ?? [];
  ids.push(node.id);
  STATIC_NODE_IDS_BY_LABEL.set(node.label, ids);
}
export const STATIC_NODE_ID_BY_LABEL = new Map(
  [...STATIC_NODE_IDS_BY_LABEL].map(([label, ids]) => [label, ids[0]]),
);
export const RELATED_NODE_IDS = new Map<string, string[]>();
for (const edge of GRAPH_EDGES) {
  const sourceRelated = RELATED_NODE_IDS.get(edge.source) ?? [];
  sourceRelated.push(edge.target);
  RELATED_NODE_IDS.set(edge.source, sourceRelated);
  const targetRelated = RELATED_NODE_IDS.get(edge.target) ?? [];
  targetRelated.push(edge.source);
  RELATED_NODE_IDS.set(edge.target, targetRelated);
}
