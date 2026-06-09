#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { neon } from '@neondatabase/serverless';
import 'tsx/cjs';

const args = new Set(process.argv.slice(2));
const envArgIndex = process.argv.findIndex((arg) => arg === '--env');
const envFile = envArgIndex >= 0 ? process.argv[envArgIndex + 1] : 'apps/web/.env.local';
const shouldDelete = args.has('--delete');
const deleteOrphans = args.has('--delete-orphans');
const confirmed = args.has('--confirm');
const sampleLimit = 50;

function loadEnvFile(filePath) {
  const absolute = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolute)) return { found: false, absolute };

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
  return { found: true, absolute };
}

function hasSubstantiveContent(content) {
  if (!content) return false;
  const summary = content.summary?.trim() ?? '';
  const explanation = content.explanation?.trim() ?? '';
  return summary.length >= 20 && explanation.length >= 80;
}

function environmentHint() {
  const appEnv = process.env.APP_ENV;
  const baseUrl = process.env.APP_BASE_URL ?? '';
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  if (appEnv === 'prod' || baseUrl.includes('girapphe.com') || clerkKey.startsWith('pk_live_')) return 'prod-like';
  if (appEnv === 'dev' || baseUrl.includes('localhost') || clerkKey.startsWith('pk_test_')) return 'dev-like';
  return 'unknown';
}

function summarizeRows(rows) {
  return rows.slice(0, sampleLimit).map((row) => ({
    id: row.id,
    title: row.title ?? row.label ?? null,
    domain: row.domain ?? null,
    level: row.level ?? null,
    is_generated: row.is_generated ?? null,
    created_at: row.created_at ?? null,
  }));
}

const env = loadEnvFile(envFile);
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Pass --env <file> or set DATABASE_URL.');
  process.exit(1);
}

if (shouldDelete && !confirmed) {
  console.error('Refusing to delete without --confirm. Run dry-run first, then add --delete --confirm.');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { GRAPH_NODES, CARD_CONTENT } = require('../../../../packages/graph-engine/src');

const canonicalNodeIds = GRAPH_NODES.map((node) => node.id);
const canonicalCardIds = GRAPH_NODES
  .filter((node) => node.level > 0 && hasSubstantiveContent(CARD_CONTENT[node.id]))
  .map((node) => `graph_${node.id}`);

const sql = neon(process.env.DATABASE_URL);

const suspiciousCardWhere = `
  (
    id ~* '^(test|testcard|test_card|dummy|dummycard|dummy_card|sample_card|placeholder|placeholder_card)([_-]?[0-9]+)?$'
    OR id LIKE 'drill_%'
    OR id LIKE 'graph_adv_%'
    OR id ~ '^[0-9]+$'
    OR lower(trim(title)) IN ('test', 'test card', 'dummy', 'dummy card', 'sample card', 'placeholder', 'placeholder card')
    OR title ILIKE 'Sponsored Content %'
    OR title ~ '^[0-9]+$'
    OR COALESCE(summary, '') ~ '^[0-9]+$'
    OR COALESCE(explanation, '') ~ '^[0-9]+$'
    OR COALESCE(is_generated, FALSE) = TRUE
  )
`;

const suspiciousNodeWhere = `
  (
    id ~* '^(test|testnode|test_node|dummy|dummy_node|sample_node|placeholder|placeholder_node)([_-]?[0-9]+)?$'
    OR id ~ '^[0-9]+$'
    OR lower(trim(label)) IN ('test', 'test node', 'dummy', 'dummy node', 'sample node', 'placeholder', 'placeholder node')
    OR label ~ '^[0-9]+$'
  )
`;

const [
  suspiciousCards,
  orphanCards,
  suspiciousNodes,
  orphanNodes,
  counts,
] = await Promise.all([
  sql.query(
    `SELECT id, title, domain, level, is_generated, created_at
     FROM knowledge_cards
     WHERE ${suspiciousCardWhere}
       AND NOT (id = ANY($1))
     ORDER BY created_at DESC NULLS LAST, id
     LIMIT ${sampleLimit};`,
    [canonicalCardIds],
  ),
  sql.query(
    `SELECT id, title, domain, level, is_generated, created_at
     FROM knowledge_cards
     WHERE NOT (id = ANY($1))
       AND NOT (id IN ('burg_method', 'kalman_filter'))
     ORDER BY created_at DESC NULLS LAST, id
     LIMIT ${sampleLimit};`,
    [canonicalCardIds],
  ),
  sql.query(
    `SELECT id, label, domain, level, created_at
     FROM graph_nodes
     WHERE ${suspiciousNodeWhere}
       AND NOT (id = ANY($1))
     ORDER BY created_at DESC NULLS LAST, id
     LIMIT ${sampleLimit};`,
    [canonicalNodeIds],
  ),
  sql.query(
    `SELECT id, label, domain, level, created_at
     FROM graph_nodes
     WHERE NOT (id = ANY($1))
     ORDER BY created_at DESC NULLS LAST, id
     LIMIT ${sampleLimit};`,
    [canonicalNodeIds],
  ),
  sql.query(
    `SELECT
      (SELECT COUNT(*)::int FROM knowledge_cards) AS knowledge_cards,
      (SELECT COUNT(*)::int FROM knowledge_cards WHERE ${suspiciousCardWhere} AND NOT (id = ANY($1))) AS suspicious_knowledge_cards,
      (SELECT COUNT(*)::int FROM knowledge_cards WHERE NOT (id = ANY($1)) AND NOT (id IN ('burg_method', 'kalman_filter'))) AS orphan_knowledge_cards,
      (SELECT COUNT(*)::int FROM graph_nodes) AS graph_nodes,
      (SELECT COUNT(*)::int FROM graph_nodes WHERE ${suspiciousNodeWhere} AND NOT (id = ANY($2))) AS suspicious_graph_nodes,
      (SELECT COUNT(*)::int FROM graph_nodes WHERE NOT (id = ANY($2))) AS orphan_graph_nodes;`,
    [canonicalCardIds, canonicalNodeIds],
  ),
]);

let deleted = null;
if (shouldDelete) {
  await sql.query('BEGIN');
  try {
    const deletedCards = await sql.query(
      `DELETE FROM knowledge_cards
       WHERE ${suspiciousCardWhere}
         AND NOT (id = ANY($1))
       RETURNING id, title, domain, level, is_generated, created_at;`,
      [canonicalCardIds],
    );
    const deletedNodes = await sql.query(
      `DELETE FROM graph_nodes
       WHERE ${suspiciousNodeWhere}
         AND NOT (id = ANY($1))
       RETURNING id, label, domain, level, created_at;`,
      [canonicalNodeIds],
    );

    let deletedOrphanCards = [];
    let deletedOrphanNodes = [];
    if (deleteOrphans) {
      deletedOrphanCards = await sql.query(
        `DELETE FROM knowledge_cards
         WHERE NOT (id = ANY($1))
           AND NOT (id IN ('burg_method', 'kalman_filter'))
         RETURNING id, title, domain, level, is_generated, created_at;`,
        [canonicalCardIds],
      );
      deletedOrphanNodes = await sql.query(
        `DELETE FROM graph_nodes
         WHERE NOT (id = ANY($1))
         RETURNING id, label, domain, level, created_at;`,
        [canonicalNodeIds],
      );
    }

    await sql.query('COMMIT');
    deleted = {
      suspicious_knowledge_cards: deletedCards.length,
      suspicious_graph_nodes: deletedNodes.length,
      orphan_knowledge_cards: deletedOrphanCards.length,
      orphan_graph_nodes: deletedOrphanNodes.length,
    };
  } catch (error) {
    await sql.query('ROLLBACK');
    throw error;
  }
}

console.log(JSON.stringify({
  mode: shouldDelete ? 'delete' : 'dry-run',
  env_file_found: env.found,
  environment_hint: environmentHint(),
  counts: counts[0],
  samples: {
    suspicious_knowledge_cards: summarizeRows(suspiciousCards),
    orphan_knowledge_cards: summarizeRows(orphanCards),
    suspicious_graph_nodes: summarizeRows(suspiciousNodes),
    orphan_graph_nodes: summarizeRows(orphanNodes),
  },
  deleted,
}, null, 2));
