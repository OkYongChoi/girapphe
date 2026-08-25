import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('account deletion covers every owner-scoped private product table', () => {
  const source = readFileSync(new URL('../account-deletion.ts', import.meta.url), 'utf8');
  const privateTables = [
    'knowledge_card_sources',
    'user_graph_edges',
    'user_private_card_states',
    'user_graph_nodes',
    'user_knowledge_items',
    'knowledge_card_drafts',
    'knowledge_ingestion_batches',
    'mcp_access_tokens',
    'user_knowledge_evidence',
    'user_knowledge_states',
    'user_quiz_rate_limits',
    'user_card_states',
    'toss_prepare_rate_limits',
  ];

  for (const table of privateTables) {
    assert.match(source, new RegExp(`DELETE FROM ${table}\\b[\\s\\S]{0,120}user_id = \\$1`), `${table} must be owner-deleted`);
  }
  assert.match(source, /cancelStripeSubscriptionsForAccountDeletion/);
  assert.match(source, /cancelTossBilling/);
  assert.match(source, /deleteRevenueCatCustomer/);
  assert.doesNotMatch(source, /REVENUECAT_SECRET_API_KEY[^\n]*return false/);
  assert.match(source, /client\.users\.deleteUser\(userId\)/);
});
