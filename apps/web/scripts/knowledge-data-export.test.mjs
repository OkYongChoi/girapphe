import assert from 'node:assert/strict';
import test from 'node:test';

const imported = await import('../src/lib/knowledge-data-export.ts');
const { buildKnowledgeDataExportQuery } = imported.default ?? imported;

test('builds one owner-scoped complete knowledge export without credential material', () => {
  const query = buildKnowledgeDataExportQuery('user_export');
  assert.deepEqual(query.params, ['user_export']);
  for (const table of [
    'user_knowledge_items',
    'knowledge_item_revisions',
    'knowledge_card_sources',
    'knowledge_evidence_spans',
    'user_graph_nodes',
    'user_graph_edges',
    'knowledge_relation_evidence',
    'knowledge_item_supersessions',
    'knowledge_item_activity',
    'knowledge_ingestion_batches',
    'knowledge_card_drafts',
    'knowledge_product_events',
  ]) assert.match(query.text, new RegExp(`FROM ${table} [a-z]+ WHERE [a-z]+\\.user_id = \\$1`), table);
  assert.match(query.text, /raw_conversations_included', FALSE/);
  assert.match(query.text, /archive_files_included', FALSE/);
  assert.doesNotMatch(query.text, /token_hash|archive_filename|raw_transcript/);
  assert.match(query.text, /- 'mcp_token_id'/);
});

test('rejects an export without an authenticated owner id', () => {
  assert.throws(() => buildKnowledgeDataExportQuery(''), /user is required/i);
});
