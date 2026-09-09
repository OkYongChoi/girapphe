import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  addPendingCandidate,
  buildCandidateWebReviewUrl,
  classifyCandidateBatchScope,
  createCandidateInboxRequestGuard,
  removePendingCandidate,
  selectCandidateBatch,
} from './candidate-inbox-requests';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

test('a stale initial inbox response cannot auto-select over the latest explicit batch', async () => {
  const requestGuard = createCandidateInboxRequestGuard();
  const initialInbox = deferred<string[]>();
  const explicitBatch = deferred<string>();
  let selectedBatch: string | null = null;

  const initialLoad = (async () => {
    const request = requestGuard.begin();
    const batches = await initialInbox.promise;
    if (!requestGuard.isLatest(request)) return;
    selectedBatch = batches[0] ?? null;
  })();
  const explicitLoad = (async () => {
    const request = requestGuard.begin();
    const batch = await explicitBatch.promise;
    if (!requestGuard.isLatest(request)) return;
    selectedBatch = batch;
  })();

  explicitBatch.resolve('explicit-batch');
  await explicitLoad;
  initialInbox.resolve(['automatic-first-batch']);
  await initialLoad;

  assert.equal(selectedBatch, 'explicit-batch');
});

test('the last completed overlapping mutation owns the final guarded refresh', async () => {
  const requestGuard = createCandidateInboxRequestGuard();
  const firstMutation = deferred<void>();
  const secondMutation = deferred<void>();
  const firstRefresh = deferred<string[]>();
  const secondRefresh = deferred<string[]>();
  let renderedDrafts = ['candidate-a', 'candidate-b'];

  const settle = async (
    mutation: ReturnType<typeof deferred<void>>,
    refresh: ReturnType<typeof deferred<string[]>>,
  ) => {
    await mutation.promise;
    const request = requestGuard.begin();
    const drafts = await refresh.promise;
    if (requestGuard.isLatest(request)) renderedDrafts = drafts;
  };

  const first = settle(firstMutation, firstRefresh);
  const second = settle(secondMutation, secondRefresh);
  secondMutation.resolve();
  await Promise.resolve();
  firstMutation.resolve();
  await Promise.resolve();
  secondRefresh.resolve(['candidate-a']);
  firstRefresh.resolve([]);
  await Promise.all([first, second]);

  assert.deepEqual(renderedDrafts, []);
});

test('candidate inbox guards the list response before automatic batch selection', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const candidateInbox = readFileSync(join(sourceDir, '../app/candidate-inbox.tsx'), 'utf8');

  assert.match(candidateInbox, /const \[requestGuard\] = useState\(createCandidateInboxRequestGuard\)/);
  assert.match(
    candidateInbox,
    /const load = useCallback\(async \(\) => \{\s*const request = requestGuard\.begin\(\);\s*setDrafts\(\[\]\);[\s\S]*?const next = \(await mobileApi\.candidateInbox\(\)\)\.batches;\s*if \(!requestGuard\.isLatest\(request\)\) return;\s*setBatches\(next\);\s*const nextBatch = selectCandidateBatch\(next, selectedBatchId\.current\);\s*if \(nextBatch\) await loadBatch\(nextBatch\);/,
  );
  assert.match(
    candidateInbox,
    /const result = await mobileApi\.candidateBatch\(batch\.id\);\s*if \(!requestGuard\.isLatest\(request\)\) return;\s*selectedBatchId\.current = result\.batch\.id;\s*setSelectedBatch\(result\.batch\);\s*setDrafts\(result\.drafts\);/,
  );
  assert.match(
    candidateInbox,
    /setSelectedBatch\(batch\);\s*setDrafts\(\[\]\);\s*setLoading\(true\);/,
  );
  assert.match(
    candidateInbox,
    /if \(requestGuard\.isLatest\(request\)\) setLoading\(false\)/,
  );
  assert.match(
    candidateInbox,
    /mobileApi\.mutate<MobileCandidateResolutionResult>\([\s\S]*?\.then\(async \(result\) => \{\s*await load\(\);[\s\S]*?result\.skippedEdges/,
  );
  assert.match(candidateInbox, /reason instanceof MobileApiRequestError[\s\S]*?CANDIDATE_DEPENDENCY_PENDING[\s\S]*?copy\.pendingDependency/);
  assert.match(candidateInbox, /accessibilityLiveRegion="polite"[\s\S]*?styles\.noticeCard/);
  assert.match(candidateInbox, /pendingMutations\.current\.has\(draft\.id\)/);
  assert.match(
    candidateInbox,
    /setMutatingIds\(\(current\) => removePendingCandidate\(current, draft\.id\)\)/,
  );
  assert.match(candidateInbox, /scopeLabels\[classifyCandidateBatchScope\(selectedBatch\.scope\)\]/);
  assert.match(candidateInbox, /Selected from current conversation/);
  assert.match(candidateInbox, /Selected from ChatGPT export/);
  assert.match(candidateInbox, /Unsupported source/);
});

test('mobile candidate resolution preserves structured error codes and event lifecycle metadata', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const mobileApi = readFileSync(join(sourceDir, 'api.ts'), 'utf8');
  const mobileApiErrors = readFileSync(join(sourceDir, 'mobile-api-errors.ts'), 'utf8');
  const mobileRoute = readFileSync(join(sourceDir, '../../web/src/app/api/mobile/route.ts'), 'utf8');

  assert.match(mobileApiErrors, /export class MobileApiRequestError extends Error/);
  assert.match(mobileApi, /throw new MobileApiRequestError\([\s\S]*?readApiErrorCode\(payload\)/);
  assert.match(mobileRoute, /lifecycle_patch_semantics[\s\S]*?tri_state_v1/);
  assert.match(
    mobileRoute,
    /structured_content\?\.type === 'event'[\s\S]*?new Date\(draft\.structured_content\.occurred_at\)[\s\S]*?!Number\.isNaN\(occurredAt\.getTime\(\)\)[\s\S]*?occurredAt\.toISOString\(\)/,
  );
  assert.match(mobileRoute, /result\.pendingDependency[\s\S]*?CANDIDATE_DEPENDENCY_PENDING/);
  assert.match(
    mobileRoute,
    /mobileCandidateApprovalRequiresCapability\(draft, capabilities\)[\s\S]*?KNOWLEDGE_CAPABILITY_REQUIRED/,
  );
  assert.match(
    mobileRoute,
    /mobileCandidateApprovalRequiresCapability\(draft, capabilities\)[\s\S]*?candidateForm\.set\('structured_content'/,
  );
  assert.match(
    mobileRoute,
    /mobileCandidateRequiresDetailedCausalReview\(draft\)[\s\S]*?CAUSAL_REVIEW_REQUIRED/,
  );
});

test('finishing one candidate action keeps every other candidate pending', () => {
  const empty = new Set<string>();
  const firstPending = addPendingCandidate(empty, 'candidate-a');
  const bothPending = addPendingCandidate(firstPending, 'candidate-b');
  const secondStillPending = removePendingCandidate(bothPending, 'candidate-a');

  assert.deepEqual([...empty], []);
  assert.deepEqual([...firstPending], ['candidate-a']);
  assert.deepEqual([...bothPending].sort(), ['candidate-a', 'candidate-b']);
  assert.deepEqual([...secondStillPending], ['candidate-b']);
});

test('candidate refresh preserves the explicit batch and falls back only when it is gone', () => {
  const batches = [{ id: 'first' }, { id: 'explicit' }];

  assert.equal(selectCandidateBatch(batches, 'explicit')?.id, 'explicit');
  assert.equal(selectCandidateBatch(batches, 'removed')?.id, 'first');
  assert.equal(selectCandidateBatch([], 'removed'), null);
});

test('candidate batch provenance recognizes selected exports and fails closed on unknown scopes', () => {
  assert.equal(classifyCandidateBatchScope('current_conversation'), 'current_conversation');
  assert.equal(classifyCandidateBatchScope('selected_export'), 'selected_export');
  assert.equal(classifyCandidateBatchScope('future_scope'), 'unsupported');
  assert.equal(classifyCandidateBatchScope(null), 'unsupported');
});

test('builds an encoded first-party detailed review handoff and rejects unsafe bases', () => {
  assert.equal(
    buildCandidateWebReviewUrl(
      'https://www.girapphe.com/',
      'batch/selected',
      'draft with spaces',
    ),
    'https://www.girapphe.com/knowledge-inbox/batch%2Fselected/draft%20with%20spaces/resolve',
  );
  assert.equal(buildCandidateWebReviewUrl('javascript:alert(1)', 'batch', 'draft'), null);
  assert.equal(buildCandidateWebReviewUrl('https://user:pass@example.com', 'batch', 'draft'), null);
  assert.equal(buildCandidateWebReviewUrl(undefined, 'batch', 'draft'), null);
});

test('renders an actionable detailed web review link for duplicate candidates', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const candidateInbox = readFileSync(join(sourceDir, '../app/candidate-inbox.tsx'), 'utf8');
  assert.match(candidateInbox, /buildCandidateWebReviewUrl\(appBaseUrl, draft\.batch_id, draft\.id\)/);

  const groupStart = candidateInbox.indexOf('<KnowledgeNotationGroup');
  const groupEnd = candidateInbox.indexOf('</KnowledgeNotationGroup>', groupStart);
  const reviewLinkStart = candidateInbox.indexOf('{webReviewUrl ? (', groupStart);

  assert.notEqual(groupStart, -1);
  assert.notEqual(groupEnd, -1);
  assert.notEqual(reviewLinkStart, -1);
  assert.ok(
    reviewLinkStart > groupEnd,
    'the native web review action must remain outside the notation-rendered group',
  );
  assert.doesNotMatch(candidateInbox.slice(groupStart, groupEnd), /webReviewUrl/);
  assert.match(
    candidateInbox,
    /const webReviewLabel = interpolate\(WEB_REVIEW_COPY\[locale\], \{ title: draft\.title \}\)/,
  );
  assert.match(
    candidateInbox.slice(reviewLinkStart),
    /accessibilityLabel=\{webReviewLabel\}\s*accessibilityRole="link"[\s\S]*?Linking\.openURL\(webReviewUrl\)[\s\S]*?>\{webReviewLabel\} ↗/,
  );
  const reviewTemplates = candidateInbox.match(
    /(?:en|ja|'zh-CN'|es|ar|hi): '[^']*\{title\}[^']*'/g,
  ) ?? [];
  assert.equal(reviewTemplates.length, 6);
});
