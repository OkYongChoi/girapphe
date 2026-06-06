#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { neon } from '@neondatabase/serverless';
import 'tsx/cjs';

const CHUNK_SIZE = 250;

function loadEnvFile(filePath) {
  const absolute = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolute)) return;

  const lines = fs.readFileSync(absolute, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] ?? '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeDomainKey(domain) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cardDomainForNode(node) {
  const key = normalizeDomainKey(node.domain);

  if (
    key.includes('learning') ||
    key === 'deep_learning' ||
    key === 'nlp' ||
    key === 'computer_vision' ||
    key === 'ai_safety'
  ) {
    return 'ml';
  }

  if (
    key.includes('probability') ||
    key.includes('statistics') ||
    key === 'information_theory' ||
    key.includes('entropy')
  ) {
    return 'info';
  }

  if (
    key.includes('control') ||
    key.includes('systems') ||
    key.includes('networks') ||
    key.includes('distributed') ||
    key.includes('operating')
  ) {
    return 'control';
  }

  if (
    key.includes('circuits') ||
    key.includes('semiconductor') ||
    key.includes('signal') ||
    key.includes('electronics')
  ) {
    return 'signal';
  }

  return 'other';
}

function cardLevelForDifficulty(difficulty) {
  if (difficulty <= 1) return 'memorize';
  if (difficulty <= 2) return 'understand';
  if (difficulty <= 3) return 'connect';
  return 'apply';
}

function hasSubstantiveContent(content) {
  if (!content) return false;
  const summary = content.summary?.trim() ?? '';
  const explanation = content.explanation?.trim() ?? '';
  return summary.length >= 20 && explanation.length >= 80;
}

function wikiUrlForLabel(label) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(label.replace(/\s+/g, '_'))}`;
}

function chunks(items, size = CHUNK_SIZE) {
  const out = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function dedupeEdges(edges) {
  const byKey = new Map();
  for (const edge of edges) {
    byKey.set(`${edge.source}\u0000${edge.target}\u0000${edge.type}`, edge);
  }
  return [...byKey.values()];
}

async function upsertNodes(sql, nodes) {
  for (const chunk of chunks(nodes)) {
    const params = [];
    const tuples = [];
    for (const node of chunk) {
      const base = params.length;
      tuples.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, NOW())`);
      params.push(node.id, node.label, node.domain, node.level, node.difficulty, node.type);
    }
    await sql.query(
      `
      INSERT INTO graph_nodes (id, label, domain, level, difficulty, type, updated_at)
      VALUES ${tuples.join(',\n')}
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        domain = EXCLUDED.domain,
        level = EXCLUDED.level,
        difficulty = EXCLUDED.difficulty,
        type = EXCLUDED.type,
        updated_at = NOW()
      `,
      params,
    );
  }
}

async function upsertEdges(sql, edges) {
  for (const chunk of chunks(edges)) {
    const params = [];
    const tuples = [];
    for (const edge of chunk) {
      const base = params.length;
      tuples.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
      params.push(edge.source, edge.target, edge.type, edge.weight);
    }
    await sql.query(
      `
      INSERT INTO graph_edges (source, target, type, weight)
      VALUES ${tuples.join(',\n')}
      ON CONFLICT (source, target, type) DO UPDATE SET
        weight = EXCLUDED.weight
      `,
      params,
    );
  }
}

async function upsertCards(sql, cards) {
  for (const chunk of chunks(cards)) {
    const params = [];
    const tuples = [];
    for (const card of chunk) {
      const base = params.length;
      tuples.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
      params.push(card.id, card.title, card.summary, card.explanation, card.wiki_url, card.domain, card.level);
    }
    await sql.query(
      `
      INSERT INTO knowledge_cards (id, title, summary, explanation, wiki_url, domain, level)
      VALUES ${tuples.join(',\n')}
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        explanation = EXCLUDED.explanation,
        wiki_url = EXCLUDED.wiki_url,
        domain = EXCLUDED.domain,
        level = EXCLUDED.level
      `,
      params,
    );
  }
}

loadEnvFile(process.argv[2] ?? 'apps/web/.env.local');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Pass an env file path or set DATABASE_URL.');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { GRAPH_NODES, GRAPH_EDGES, CARD_CONTENT } = require('../packages/graph-engine/src');

const nodeIds = new Set(GRAPH_NODES.map((node) => node.id));
const rawValidEdges = GRAPH_EDGES.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
const validEdges = dedupeEdges(rawValidEdges);
const skippedEdges = GRAPH_EDGES.filter((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target));
const cards = GRAPH_NODES
  .filter((node) => node.level > 0 && hasSubstantiveContent(CARD_CONTENT[node.id]))
  .map((node) => ({
    id: `graph_${node.id}`,
    title: node.label,
    summary: CARD_CONTENT[node.id].summary,
    explanation: CARD_CONTENT[node.id].explanation,
    wiki_url: wikiUrlForLabel(node.label),
    domain: cardDomainForNode(node),
    level: cardLevelForDifficulty(node.difficulty),
  }));

const sql = neon(process.env.DATABASE_URL);

await sql.query('BEGIN');
try {
  await upsertNodes(sql, GRAPH_NODES);
  await upsertEdges(sql, validEdges);
  await upsertCards(sql, cards);
  await sql.query('COMMIT');
} catch (error) {
  await sql.query('ROLLBACK');
  throw error;
}

const counts = await sql.query(
  `
  SELECT
    (SELECT COUNT(*)::int FROM graph_nodes WHERE id = ANY($1)) AS graph_nodes,
    (SELECT COUNT(*)::int FROM graph_edges WHERE source = ANY($1) AND target = ANY($1)) AS graph_edges,
    (SELECT COUNT(*)::int FROM knowledge_cards WHERE id = ANY($2)) AS knowledge_cards
  `,
  [GRAPH_NODES.map((node) => node.id), cards.map((card) => card.id)],
);

console.log(JSON.stringify({
  upserted: {
    graph_nodes: GRAPH_NODES.length,
    graph_edges: validEdges.length,
    knowledge_cards: cards.length,
  },
  skipped: {
    graph_edges_missing_endpoints: skippedEdges.length,
    duplicate_valid_graph_edges: rawValidEdges.length - validEdges.length,
    graph_edge_examples: skippedEdges.slice(0, 10),
  },
  db_counts: counts[0],
}, null, 2));
