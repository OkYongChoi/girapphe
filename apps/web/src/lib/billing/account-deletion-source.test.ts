import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildActiveAccountGuardQueries,
  buildAccountDeletionFenceQueries,
  deriveAccountAdvisoryLockKey,
  deriveAccountBillingOperationScopeKey,
  deriveDeletedAccountScopeKey,
} from '../account-lifecycle';
import {
  deriveMcpAccountAdvisoryLockKey,
  deriveMcpDeletedAccountScopeKey,
} from '../mcp-account-lifecycle';

test('account deletion covers every owner-scoped private product table', () => {
  const source = readFileSync(new URL('../account-deletion.ts', import.meta.url), 'utf8');
  const purgeSource = readFileSync(new URL('../account-private-purge.ts', import.meta.url), 'utf8');
  const privateTables = [
    'knowledge_evidence_spans',
    'knowledge_item_revisions',
    'knowledge_item_activity',
    'knowledge_item_supersessions',
    'knowledge_card_sources',
    'user_graph_edges',
    'user_private_card_states',
    'user_graph_nodes',
    'user_knowledge_items',
    'user_knowledge_create_requests',
    'knowledge_ingestion_request_tombstones',
    'knowledge_card_drafts',
    'knowledge_ingestion_batches',
    'mcp_access_tokens',
    'user_knowledge_evidence',
    'user_knowledge_states',
    'user_quiz_rate_limits',
    'user_card_states',
    'toss_prepare_rate_limits',
    'billing_request_rate_limits',
  ];

  for (const table of privateTables) {
    assert.match(purgeSource, new RegExp(`DELETE FROM ${table}\\b[\\s\\S]{0,120}user_id = \\$1`), `${table} must be owner-deleted`);
  }
  assert.match(source, /cancelCreemRenewalForAccountDeletion/);
  assert.match(source, /cancelStripeSubscriptionsForAccountDeletion/);
  assert.match(source, /cancelTossBilling/);
  assert.match(source, /deleteLegacyRevenueCatProfile/);
  assert.match(
    source,
    /!shouldAttemptRevenueCatCustomerDeletion\(subscriptionIds\.length > 0\)/,
  );
  assert.match(source, /return await deleteRevenueCatCustomer\(userId\)/);
  assert.match(source, /abandonAcquisitionAttemptsForDeletion/);
  assert.match(source, /superwallDeviceResetRequired: true/);
  assert.match(source, /client\.users\.deleteUser\(userId\)/);
});

test('account deletion clears reversible MCP rate-limit identities before deleting tokens', () => {
  const source = readFileSync(new URL('../account-private-purge.ts', import.meta.url), 'utf8');
  const selectedTokens = source.indexOf('selected_mcp_tokens AS MATERIALIZED');
  const deletedRateLimits = source.indexOf('deleted_mcp_rate_limits AS');
  const deletedTokens = source.indexOf('deleted_tokens AS');

  assert.ok(selectedTokens >= 0, 'token IDs must be captured before deletion');
  assert.ok(selectedTokens < deletedRateLimits, 'captured token IDs must feed rate-limit deletion');
  assert.ok(deletedRateLimits < deletedTokens, 'rate limits must be deleted before token rows');
  assert.match(
    source,
    /selected_mcp_tokens AS MATERIALIZED \(\s*SELECT id FROM mcp_access_tokens WHERE user_id = \$1\s*\)/,
  );
  assert.match(
    source,
    /DELETE FROM mcp_request_rate_limits[\s\S]{0,240}scope_key = 'user:' \|\| \$1[\s\S]{0,240}scope_key IN \(SELECT 'token:' \|\| id FROM selected_mcp_tokens\)/,
  );
  assert.match(
    source,
    /deleted_tokens AS \(\s*DELETE FROM mcp_access_tokens\s*WHERE user_id = \$1\s*AND \(SELECT COUNT\(\*\) FROM deleted_mcp_rate_limits\) >= 0/,
  );
  assert.match(source, /credential:\* fingerprints are non-reversible and remain subject to bounded stale cleanup/);
  assert.doesNotMatch(source, /scope_key\s+LIKE\s+'credential:%'/);
});

test('account deletion removes revision-bound sources before their referenced revisions', () => {
  const source = readFileSync(new URL('../account-private-purge.ts', import.meta.url), 'utf8');
  const deletedEvidenceSpans = source.indexOf('deleted_evidence_spans AS');
  const deletedSources = source.indexOf('deleted_sources AS');
  const deletedRevisions = source.indexOf('deleted_revisions AS');

  assert.ok(deletedEvidenceSpans >= 0 && deletedEvidenceSpans < deletedSources);
  assert.ok(deletedSources < deletedRevisions);
  assert.match(
    source,
    /deleted_sources AS \([\s\S]{0,240}DELETE FROM knowledge_card_sources[\s\S]{0,240}deleted_evidence_spans/,
  );
  assert.match(
    source,
    /deleted_revisions AS \([\s\S]{0,240}DELETE FROM knowledge_item_revisions[\s\S]{0,240}deleted_sources/,
  );
});

test('account deletion removes product events before batch deletion triggers run', () => {
  const source = readFileSync(new URL('../account-private-purge.ts', import.meta.url), 'utf8');
  const deletedBatches = source.indexOf('deleted_batches AS');
  const deletedTombstones = source.indexOf('deleted_ingestion_request_tombstones AS');

  assert.ok(deletedBatches >= 0 && deletedBatches < deletedTombstones);
  assert.match(
    source,
    /deleted_batches AS \([\s\S]{0,240}DELETE FROM knowledge_ingestion_batches[\s\S]{0,240}COUNT\(\*\) FROM deleted_knowledge_product_events/,
  );
  assert.match(
    source,
    /deleted_ingestion_request_tombstones AS \([\s\S]{0,240}DELETE FROM knowledge_ingestion_request_tombstones[\s\S]{0,240}COUNT\(\*\) FROM deleted_batches/,
  );
});

test('account deletion commits its permanent fence before provider cleanup without exposing owner identifiers', () => {
  const source = readFileSync(new URL('../account-deletion.ts', import.meta.url), 'utf8');
  const fence = source.indexOf('async function beginAccountDeletionFence');
  const deleteEntry = source.indexOf('export async function deleteGirappheAccount');
  const fenceCall = source.indexOf('await beginAccountDeletionFence(userId)', deleteEntry);
  const billingCleanup = source.indexOf('cancelRenewingWebBilling(userId)', fenceCall);
  const purge = source.indexOf('purgePrivateProductDataForUser(userId)', billingCleanup);

  assert.ok(fence >= 0 && fence < deleteEntry);
  assert.match(source.slice(fence, deleteEntry), /buildAccountDeletionFenceQueries\(userId\)/);
  assert.ok(fenceCall < billingCleanup && billingCleanup < purge);
  assert.match(
    source,
    /db\.transaction\(\s*\[buildPrivateProductPurgeQuery\(userId\)\],\s*\{ isolationLevel: 'ReadCommitted' \},\s*\)/,
  );
  assert.doesNotMatch(source, /DELETE FROM mcp_deleted_account_markers/);

  const userId = 'user_sensitive_clerk_identifier';
  const scopeKey = deriveDeletedAccountScopeKey(userId);
  const lockKey = deriveAccountAdvisoryLockKey(userId);
  const billingOperationScopeKey = deriveAccountBillingOperationScopeKey(userId);
  const deletionQueries = buildAccountDeletionFenceQueries(userId);
  assert.equal(deletionQueries.length, 2);
  assert.match(deletionQueries[0]!.text, /pg_advisory_xact_lock/);
  assert.deepEqual(deletionQueries[0]!.params, [lockKey]);
  assert.match(deletionQueries[1]!.text, /INSERT INTO mcp_deleted_account_markers/);
  assert.match(
    deletionQueries[1]!.text,
    /WHERE NOT EXISTS \([\s\S]*billing_account_operations[\s\S]*scope_key = \$2[\s\S]*expires_at > NOW\(\)/,
  );
  assert.match(
    deletionQueries[1]!.text,
    /billing_acquisition_blocks[\s\S]*user_id = \$3[\s\S]*reason = 'mobile_purchase_pending'[\s\S]*resolved_at IS NULL/,
  );
  assert.deepEqual(deletionQueries[1]!.params, [scopeKey, billingOperationScopeKey, userId]);
  assert.match(scopeKey, /^[0-9a-f]{64}$/);
  assert.equal(scopeKey.includes(userId), false);
  assert.equal(lockKey, `mcp-account-lifecycle:${scopeKey}`);
  assert.equal(lockKey.includes(userId), false);
  assert.match(billingOperationScopeKey, /^[0-9a-f]{64}$/);
  assert.equal(billingOperationScopeKey.includes(userId), false);
  assert.equal(deriveMcpDeletedAccountScopeKey(userId), scopeKey);
  assert.equal(deriveMcpAccountAdvisoryLockKey(userId), lockKey);
});

test('account transaction checks the persistent marker after taking the lifecycle lock', () => {
  const userId = 'user_guard_order';
  const queries = buildActiveAccountGuardQueries(userId);
  assert.equal(queries.length, 2);
  assert.match(queries[0]!.text, /pg_advisory_xact_lock/);
  assert.deepEqual(queries[0]!.params, [deriveAccountAdvisoryLockKey(userId)]);
  assert.match(queries[1]!.text, /INSERT INTO mcp_deleted_account_markers/);
  assert.match(queries[1]!.text, /SELECT scope_key, deleted_at/);
  assert.deepEqual(queries[1]!.params, [deriveDeletedAccountScopeKey(userId)]);

  const dbSource = readFileSync(new URL('../db.ts', import.meta.url), 'utf8');
  const guard = dbSource.indexOf('...buildActiveAccountGuardQueries(userId)');
  const writes = dbSource.indexOf('...queries', guard);
  const strip = dbSource.indexOf('guardedResults.slice(2)', writes);
  assert.ok(guard >= 0 && guard < writes && writes < strip);
  assert.match(dbSource.slice(guard, strip), /isolationLevel: 'ReadCommitted'/);
});

test('account-owned knowledge and practice insert paths use the lifecycle guard', () => {
  const guardedModules: Array<[string, number]> = [
    ['../../actions/user-knowledge-actions.ts', 4],
    ['../../actions/card-actions.ts', 2],
    ['../knowledge-graph-db.ts', 2],
    ['../private-practice-cards.ts', 1],
  ];
  for (const [path, minimumCount] of guardedModules) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const count = source.match(/\.accountTransaction(?:<[^>]+>)?\(/g)?.length ?? 0;
    assert.ok(count >= minimumCount, `${path} has ${count} guarded writes`);
  }

  const ingestion = readFileSync(new URL('../knowledge-ingestion.ts', import.meta.url), 'utf8');
  assert.ok((ingestion.match(/pool\.accountTransaction/g)?.length ?? 0) >= 2);
  const rawTransactions: Array<[string, string]> = [
    ['export async function approveKnowledgeDraftsForUser', 'export async function discardKnowledgeDraftBatchForUser'],
    ['export async function resolveKnowledgeDraftForUser', 'export async function verifyKnowledgeItemForUser'],
    ['export async function verifyKnowledgeItemForUser', 'export type KnowledgeArchiveResult'],
    ['async function setKnowledgeArchivedStateForUser', 'export async function archiveKnowledgeItemForUser'],
    ['export async function supersedeKnowledgeItemForUser', 'export type KnowledgeReuseMetadata'],
  ];
  for (const [startToken, endToken] of rawTransactions) {
    const start = ingestion.indexOf(startToken);
    const end = ingestion.indexOf(endToken, start + startToken.length);
    assert.ok(start >= 0 && end > start, startToken);
    const body = ingestion.slice(start, end);
    const accountLock = body.indexOf('deriveMcpAccountAdvisoryLockKey(userId)');
    const markerAssert = body.indexOf('ACTIVE_ACCOUNT_MARKER_ASSERTION_SQL', accountLock);
    assert.ok(accountLock >= 0 && accountLock < markerAssert, `${startToken}: guard order`);
    assert.match(body.slice(markerAssert), /isolationLevel: 'ReadCommitted'/, `${startToken}: fresh marker snapshot`);
  }
});

test('MCP route maps a deleted OAuth account to the same non-leaky unauthorized response', () => {
  const route = readFileSync(new URL('../../app/api/mcp/route.ts', import.meta.url), 'utf8');
  const deletedMapping = route.indexOf('error instanceof McpDeletedAccountError');
  const rateMapping = route.indexOf('error instanceof McpRequestRateLimitError');
  assert.ok(deletedMapping >= 0 && deletedMapping < rateMapping);
  assert.match(route.slice(deletedMapping, rateMapping), /return unauthorized\(request\)/);
});

test('account deletion requires strict Clerk reverification on server and client', () => {
  const route = readFileSync(new URL('../../app/api/account/route.ts', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../../components/account-deletion-panel.tsx', import.meta.url), 'utf8');

  assert.match(route, /has\(\{ reverification: 'strict' \}\)/);
  assert.match(route, /reverificationErrorResponse\('strict'\)/);
  assert.match(panel, /useReverification\(requestAccountDeletion\)/);
  assert.match(panel, /isReverificationCancelledError/);
});
