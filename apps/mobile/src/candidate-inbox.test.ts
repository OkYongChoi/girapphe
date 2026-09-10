import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  addPendingCandidate,
  buildCandidateWebReviewUrl,
  candidateQuickActionRequiresDetailedReview,
  classifyCandidateBatchScope,
  createCandidateBatchSelectionGuard,
  createCandidateInboxRequestGuard,
  removePendingCandidate,
  resolveCandidateQuickAction,
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

test('candidate request invalidation rejects a response that settles after blur', () => {
  const requestGuard = createCandidateInboxRequestGuard();
  const request = requestGuard.begin();

  requestGuard.invalidate();

  assert.equal(requestGuard.isLatest(request), false);
});

test('a candidate mutation notice belongs only to the captured batch selection revision', () => {
  const selectionGuard = createCandidateBatchSelectionGuard('batch-a');
  const batchASelection = selectionGuard.capture();

  assert.equal(selectionGuard.isCurrent(batchASelection), true);
  selectionGuard.select('batch-b');
  assert.equal(selectionGuard.isCurrent(batchASelection), false);

  selectionGuard.select('batch-a');
  assert.equal(selectionGuard.isCurrent(batchASelection), false);
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

test('candidate quick-action resolver blocks causal approval before mutation', async () => {
  const draft = { id: 'causal-draft', requires_detailed_review: true };
  let mutations = 0;
  let reloads = 0;

  assert.equal(candidateQuickActionRequiresDetailedReview(draft, 'approve-candidate'), true);
  assert.equal(candidateQuickActionRequiresDetailedReview(draft, 'ignore-candidate'), false);

  const outcome = await resolveCandidateQuickAction({
    draft,
    action: 'approve-candidate',
    mutate: async () => { mutations += 1; return { resolved: true }; },
    reloadLatest: async () => { reloads += 1; return [draft]; },
    isStaleError: () => false,
  });

  assert.deepEqual(outcome, { status: 'detailed-review-required' });
  assert.equal(mutations, 0);
  assert.equal(reloads, 0);
});

test('candidate quick-action resolver reloads and returns the fresh draft after a stale race', async () => {
  const staleDraft = { id: 'draft-a', version: 1, requires_detailed_review: false };
  const freshDraft = { ...staleDraft, version: 2 };
  const staleError = new Error('candidate stale');
  let reloads = 0;
  let renderedDrafts = [staleDraft];

  const outcome = await resolveCandidateQuickAction({
    draft: staleDraft,
    action: 'ignore-candidate',
    mutate: async () => { throw staleError; },
    reloadLatest: async () => {
      reloads += 1;
      renderedDrafts = [freshDraft];
      return renderedDrafts;
    },
    isStaleError: (reason) => reason === staleError,
  });

  assert.equal(reloads, 1);
  assert.equal(outcome.status, 'stale');
  if (outcome.status !== 'stale') return;
  assert.equal(outcome.reloadSucceeded, true);
  assert.equal(outcome.latestDraft?.version, 2);
  assert.equal(renderedDrafts[0]?.version, 2);
  assert.ok(outcome.latestDraft);
  const latestDraft = outcome.latestDraft;

  let retriedVersion = 0;
  const retry = await resolveCandidateQuickAction({
    draft: latestDraft,
    action: 'ignore-candidate',
    mutate: async () => { retriedVersion = latestDraft.version; return { resolved: true }; },
    reloadLatest: async () => renderedDrafts,
    isStaleError: () => false,
  });
  assert.equal(retry.status, 'resolved');
  assert.equal(retriedVersion, 2);
});

test('a stale noncausal approval reloads a newly causal draft and converges to detailed review', async () => {
  const staleDraft = { id: 'draft-a', version: 1, requires_detailed_review: false };
  const latestCausalDraft = { ...staleDraft, version: 2, requires_detailed_review: true };
  const staleError = new Error('candidate stale');
  let mutations = 0;
  let reloads = 0;

  const staleOutcome = await resolveCandidateQuickAction({
    draft: staleDraft,
    action: 'approve-candidate',
    mutate: async () => { mutations += 1; throw staleError; },
    reloadLatest: async () => { reloads += 1; return [latestCausalDraft]; },
    isStaleError: (reason) => reason === staleError,
  });

  assert.equal(staleOutcome.status, 'stale');
  assert.equal(mutations, 1);
  assert.equal(reloads, 1);
  if (staleOutcome.status !== 'stale' || !staleOutcome.latestDraft) return;
  assert.deepEqual(staleOutcome.latestDraft, latestCausalDraft);

  const retryOutcome = await resolveCandidateQuickAction({
    draft: staleOutcome.latestDraft,
    action: 'approve-candidate',
    mutate: async () => { mutations += 1; return { resolved: true }; },
    reloadLatest: async () => { reloads += 1; return [latestCausalDraft]; },
    isStaleError: () => false,
  });

  assert.deepEqual(retryOutcome, { status: 'detailed-review-required' });
  assert.equal(mutations, 1);
  assert.equal(reloads, 1);
});

test('candidate inbox guards the list response before automatic batch selection', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const candidateInbox = readFileSync(join(sourceDir, '../app/candidate-inbox.tsx'), 'utf8');

  assert.match(candidateInbox, /const \[requestGuard\] = useState\(createCandidateInboxRequestGuard\)/);
  assert.match(candidateInbox, /return \(\) => requestGuard\.invalidate\(\)/);
  assert.match(
    candidateInbox,
    /const load = useCallback\(async \(\): Promise<MobileCandidateDraft\[\] \| null> => \{\s*const request = requestGuard\.begin\(\);\s*setDrafts\(\[\]\);[\s\S]*?const next = \(await mobileApi\.candidateInbox\(\)\)\.batches;\s*if \(!requestGuard\.isLatest\(request\)\) return null;\s*setBatches\(next\);\s*const nextBatch = selectCandidateBatch\(next, selectionGuard\.selected\(\)\);\s*if \(nextBatch\) return await loadBatch\(nextBatch\);/,
  );
  assert.match(
    candidateInbox,
    /const result = await mobileApi\.candidateBatch\(batch\.id\);\s*if \(!requestGuard\.isLatest\(request\)\) return null;\s*selectionGuard\.select\(result\.batch\.id\);\s*setSelectedBatch\(result\.batch\);\s*setDrafts\(result\.drafts\);\s*return result\.drafts;/,
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
    /const mutationSelection = selectionGuard\.capture\(\);[\s\S]*?resolveCandidateQuickAction\(\{[\s\S]*?draftVersion: draft\.version,[\s\S]*?reloadLatest: load,[\s\S]*?\.then\(async \(outcome\) => \{[\s\S]*?const result = outcome\.result;\s*await load\(\);[\s\S]*?mutationSelection\.batchId === draft\.batch_id[\s\S]*?selectionGuard\.isCurrent\(mutationSelection\)[\s\S]*?setNotice/,
  );
  assert.match(candidateInbox, /reason instanceof MobileApiRequestError[\s\S]*?CANDIDATE_DEPENDENCY_PENDING[\s\S]*?copy\.pendingDependency/);
  assert.match(
    candidateInbox,
    /reason\.code === 'CAUSAL_REVIEW_REQUIRED' \|\| reason\.code === 'PROVENANCE_REVIEW_REQUIRED'[\s\S]*?detailedReviewCopy\(locale, draft\)/,
  );
  assert.match(candidateInbox, /outcome\.status === 'stale'[\s\S]*?STALE_REVIEW_COPY\[locale\]/);
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
  assert.match(mobileApi, /requires_detailed_review: boolean;/);
  assert.match(mobileApi, /detailed_review_reason: 'causal_relations' \| 'provenance' \| null;/);
  assert.match(mobileRoute, /lifecycle_patch_semantics[\s\S]*?tri_state_v1/);
  assert.match(
    mobileRoute,
    /structured_content\?\.type === 'event'[\s\S]*?new Date\(draft\.structured_content\.occurred_at\)[\s\S]*?!Number\.isNaN\(occurredAt\.getTime\(\)\)[\s\S]*?occurredAt\.toISOString\(\)/,
  );
  assert.match(mobileRoute, /result\.pendingDependency[\s\S]*?CANDIDATE_DEPENDENCY_PENDING/);
  assert.match(
    mobileRoute,
    /action === 'ignore-candidate'[\s\S]*?ignoreKnowledgeDraft\(candidateForm\)[\s\S]*?code: 'CANDIDATE_STALE'/,
  );
  assert.match(
    mobileRoute,
    /classifyMobileCandidateMutationPreflight\(\{[\s\S]*?draftVersion,[\s\S]*?preflight === 'stale'[\s\S]*?CANDIDATE_STALE[\s\S]*?action === 'ignore-candidate'/,
  );
  assert.match(
    mobileRoute,
    /preflight === 'knowledge-capability-required'[\s\S]*?KNOWLEDGE_CAPABILITY_REQUIRED[\s\S]*?candidateForm\.set\('structured_content'/,
  );
  assert.match(
    mobileRoute,
    /preflight === 'causal-review-required'[\s\S]*?CAUSAL_REVIEW_REQUIRED/,
  );
  assert.match(
    mobileRoute,
    /preflight === 'provenance-review-required'[\s\S]*?PROVENANCE_REVIEW_REQUIRED/,
  );
  assert.match(
    mobileRoute,
    /requires_detailed_review: detailedReviewReason !== null,[\s\S]*?detailed_review_reason: detailedReviewReason/,
  );
  const reviewGuardStart = mobileRoute.indexOf("if (preflight === 'knowledge-capability-required')");
  const evidenceClear = mobileRoute.indexOf("candidateForm.set('evidence_selectors_json', '[]')", reviewGuardStart);
  assert.ok(reviewGuardStart >= 0 && evidenceClear > reviewGuardStart);
  assert.match(mobileRoute.slice(reviewGuardStart, evidenceClear), /PROVENANCE_REVIEW_REQUIRED[\s\S]*?status: 409/);
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

test('renders an actionable detailed web review link for duplicate and provenance-sensitive candidates', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const candidateInbox = readFileSync(join(sourceDir, '../app/candidate-inbox.tsx'), 'utf8');
  assert.match(candidateInbox, /buildCandidateWebReviewUrl\(appBaseUrl, draft\.batch_id, draft\.id\)/);
  assert.match(
    candidateInbox,
    /draft\.duplicate_suggestions\.length > 0 \|\| draft\.requires_detailed_review\s*\? buildCandidateWebReviewUrl/,
  );
  assert.match(
    candidateInbox,
    /const approvalDisabled = mutatingIds\.has\(draft\.id\) \|\| draft\.requires_detailed_review/,
  );
  assert.match(
    candidateInbox,
    /candidateQuickActionRequiresDetailedReview\(draft, action\)[\s\S]*?setError\(detailedReviewCopy\(locale, draft\)\);\s*return;/,
  );
  assert.match(
    candidateInbox,
    /draft\.requires_detailed_review \? \([\s\S]*?detailedReviewWarning[\s\S]*?reviewCopy/,
  );
  assert.match(
    candidateInbox,
    /accessibilityState=\{\{ disabled: approvalDisabled \}\}\s*disabled=\{approvalDisabled\}/,
  );

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

  const causalCopyStart = candidateInbox.indexOf('const CAUSAL_REVIEW_COPY');
  const causalCopyEnd = candidateInbox.indexOf('const PROVENANCE_REVIEW_COPY', causalCopyStart);
  const causalTemplates = candidateInbox.slice(causalCopyStart, causalCopyEnd).match(
    /(?:en|ja|'zh-CN'|es|ar|hi): '[^']+'/g,
  ) ?? [];
  assert.equal(causalTemplates.length, 6);

  const provenanceCopyStart = candidateInbox.indexOf('const PROVENANCE_REVIEW_COPY');
  const provenanceCopyEnd = candidateInbox.indexOf('function detailedReviewCopy', provenanceCopyStart);
  const provenanceTemplates = candidateInbox.slice(provenanceCopyStart, provenanceCopyEnd).match(
    /(?:en|ja|'zh-CN'|es|ar|hi): '[^']+'/g,
  ) ?? [];
  assert.equal(provenanceTemplates.length, 6);
  assert.match(candidateInbox, /PROVENANCE_REVIEW_REQUIRED/);

  const staleCopyStart = candidateInbox.indexOf('const STALE_REVIEW_COPY');
  const staleCopyEnd = candidateInbox.indexOf('type ScopeCopy', staleCopyStart);
  const staleTemplates = candidateInbox.slice(staleCopyStart, staleCopyEnd).match(
    /(?:en|ja|'zh-CN'|es|ar|hi): '[^']+'/g,
  ) ?? [];
  assert.equal(staleTemplates.length, 6);
});
