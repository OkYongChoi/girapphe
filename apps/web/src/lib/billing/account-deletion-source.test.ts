import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildActiveAccountGuardQueries,
  buildAccountDeletionFenceQueries,
  deriveAccountAdvisoryLockKey,
  deriveAccountBillingOperationEventId,
  deriveDeletedAccountScopeKey,
} from '../account-lifecycle';
import {
  deriveMcpAccountAdvisoryLockKey,
  deriveMcpDeletedAccountScopeKey,
} from '../mcp-account-lifecycle';

test('account deletion covers every owner-scoped private product table', () => {
  const source = readFileSync(new URL('../account-deletion.ts', import.meta.url), 'utf8');
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

test('account deletion clears reversible MCP rate-limit identities before deleting tokens', () => {
  const source = readFileSync(new URL('../account-deletion.ts', import.meta.url), 'utf8');
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

test('account deletion commits its permanent fence before provider cleanup without exposing owner identifiers', () => {
  const source = readFileSync(new URL('../account-deletion.ts', import.meta.url), 'utf8');
  const fence = source.indexOf('async function beginAccountDeletionFence');
  const deleteEntry = source.indexOf('export async function deleteGirappheAccount');
  const fenceCall = source.indexOf('await beginAccountDeletionFence(userId)', deleteEntry);
  const stripeCleanup = source.indexOf('cancelRenewingWebBilling(userId)', fenceCall);
  const revenueCatCleanup = source.indexOf('deleteProcessorCustomerData(userId)', stripeCleanup);
  const purge = source.indexOf('purgePrivateProductData(userId)', revenueCatCleanup);

  assert.ok(fence >= 0 && fence < deleteEntry);
  assert.match(source.slice(fence, deleteEntry), /buildAccountDeletionFenceQueries\(userId\)/);
  assert.ok(fenceCall < stripeCleanup && stripeCleanup < revenueCatCleanup && revenueCatCleanup < purge);
  assert.match(source, /\], \{ isolationLevel: 'ReadCommitted' \}\)/);
  assert.doesNotMatch(source, /DELETE FROM mcp_deleted_account_markers/);

  const userId = 'user_sensitive_clerk_identifier';
  const scopeKey = deriveDeletedAccountScopeKey(userId);
  const lockKey = deriveAccountAdvisoryLockKey(userId);
  const stripeLeaseId = deriveAccountBillingOperationEventId(userId, 'stripe');
  const tossLeaseId = deriveAccountBillingOperationEventId(userId, 'toss');
  const deletionQueries = buildAccountDeletionFenceQueries(userId);
  assert.equal(deletionQueries.length, 2);
  assert.match(deletionQueries[0]!.text, /pg_advisory_xact_lock/);
  assert.deepEqual(deletionQueries[0]!.params, [lockKey]);
  assert.match(deletionQueries[1]!.text, /INSERT INTO mcp_deleted_account_markers/);
  assert.match(
    deletionQueries[1]!.text,
    /WHERE NOT EXISTS \([\s\S]*billing_webhook_events[\s\S]*created_at >= NOW\(\) - INTERVAL '10 minutes'/,
  );
  assert.deepEqual(deletionQueries[1]!.params, [scopeKey, stripeLeaseId, tossLeaseId]);
  assert.match(scopeKey, /^[0-9a-f]{64}$/);
  assert.equal(scopeKey.includes(userId), false);
  assert.equal(lockKey, `mcp-account-lifecycle:${scopeKey}`);
  assert.equal(lockKey.includes(userId), false);
  assert.match(stripeLeaseId, /^account-billing:[0-9a-f]{64}$/);
  assert.match(tossLeaseId, /^account-billing:[0-9a-f]{64}$/);
  assert.notEqual(stripeLeaseId, tossLeaseId);
  assert.equal(stripeLeaseId.includes(userId), false);
  assert.equal(tossLeaseId.includes(userId), false);
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
    ['../../actions/card-actions.ts', 3],
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

test('Toss initiation and renewal are fenced while recovery and cleanup remain available', () => {
  const source = readFileSync(new URL('./toss-subscriptions.ts', import.meta.url), 'utf8');
  const rateStart = source.indexOf('async function createRateLimitedTossBillingSession');
  const prepareStart = source.indexOf('export async function prepareTossBilling');
  const claimStart = source.indexOf('export async function claimTossBillingSession');
  const activationCoreStart = source.indexOf('async function activateTossBillingWithLease');
  const activationStart = source.indexOf('export async function activateTossBilling');
  const dueStart = source.indexOf('export async function processDueTossBilling');
  const cancelStart = source.indexOf('export async function cancelTossBilling');
  const recoveryStart = source.indexOf('async function recoverIssuingTossBillingKeyIntents');
  const orphanCleanupStart = source.indexOf('async function cleanupOrphanedTossBillingKeyIntents');

  assert.match(source.slice(rateStart, prepareStart), /db\.accountTransaction/);
  assert.match(source.slice(claimStart, activationStart), /db\.accountTransaction/);
  const activation = source.slice(activationStart, dueStart);
  assert.ok(
    activation.indexOf("claimTossAccountOperation(input.userId, 'activation')")
      < activation.indexOf('activateTossBillingWithLease(input)'),
  );
  const activationCore = source.slice(activationCoreStart, activationStart);
  assert.match(activationCore, /getBillingCustomer\(input\.userId\)/);
  assert.match(activationCore, /materializeTossBillingKeyIntent\(intent\)/);
  const due = source.slice(dueStart, cancelStart);
  assert.ok(
    due.indexOf("claimAccountBillingOperation(")
      < due.indexOf('prepareTossCharge({'),
  );
  assert.ok(due.indexOf("'renewal'") < due.indexOf('executeTossCharge({'));

  const recovery = source.slice(recoveryStart, orphanCleanupStart);
  assert.doesNotMatch(recovery, /claimAccountBillingOperation|accountTransaction/);
  assert.match(recovery, /materializeTossBillingKeyIntent/);
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
