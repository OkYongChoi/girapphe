import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  AUTHENTICATED_OVERLAY_AUTH_MODES,
  createSyntheticSignInTicket,
  resolveAuthenticatedOverlayAuthMode,
} from './authenticated-overlay-auth.mjs';
import { AUTHENTICATED_OVERLAY_DRAFT_PROBE_TITLE_PREFIX } from './authenticated-overlay-constants.mjs';

test('Clerk auth mode keeps testing tokens away from production instances', () => {
  assert.equal(
    resolveAuthenticatedOverlayAuthMode({ secretKey: 'sk_test_example' }),
    AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken,
  );
  assert.equal(
    resolveAuthenticatedOverlayAuthMode({ secretKey: 'sk_live_example' }),
    AUTHENTICATED_OVERLAY_AUTH_MODES.signInToken,
  );
  assert.throws(
    () => resolveAuthenticatedOverlayAuthMode({
      configuredMode: AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken,
      secretKey: 'sk_live_example',
    }),
    /Production Clerk instances cannot use Clerk testing tokens/,
  );
});

test('provider PAT evidence gates on the same resolved Clerk auth mode as setup', async () => {
  const testUrl = new URL(
    '../e2e-authenticated/authenticated-mcp-provider-setup.spec.ts',
    import.meta.url,
  );
  const source = await fs.readFile(testUrl, 'utf8');

  assert.match(source, /resolveAuthenticatedOverlayAuthMode\(\)/);
  assert.match(
    source,
    /authMode !== AUTHENTICATED_OVERLAY_AUTH_MODES\.testingToken/,
  );
  assert.doesNotMatch(
    source,
    /process\.env\.E2E_CLERK_AUTH_MODE !== ['"]testing-token['"]/,
  );
});

test('My Notes mutation evidence gates on the same resolved Clerk auth mode as setup', async () => {
  const testUrl = new URL(
    '../e2e-authenticated/authenticated-my-notes-tags.spec.ts',
    import.meta.url,
  );
  const source = await fs.readFile(testUrl, 'utf8');

  assert.match(source, /resolveAuthenticatedOverlayAuthMode\(\)/);
  assert.match(
    source,
    /AUTHENTICATED_OVERLAY_AUTH_MODES\.testingToken/,
  );
  assert.doesNotMatch(
    source,
    /process\.env\.E2E_CLERK_AUTH_MODE !== ['"]testing-token['"]/,
  );
  assert.match(source, new RegExp(AUTHENTICATED_OVERLAY_DRAFT_PROBE_TITLE_PREFIX));
  assert.doesNotMatch(
    source,
    /from ['"]\.\.\/scripts\/authenticated-overlay-(?:constants|fixture)\.mjs['"]/,
  );
});

test('Thinking History dismissal evidence waits for rendering and tracks the exact expanded card', async () => {
  const testUrl = new URL(
    '../e2e-authenticated/authenticated-thinking-history.spec.ts',
    import.meta.url,
  );
  const source = await fs.readFile(testUrl, 'utf8');

  assert.match(
    source,
    /await page\.goto\("\/my-notes\?view=insights"[\s\S]{0,240}await expect\(signalCards\.first\(\)\)\.toBeVisible[\s\S]{0,160}const signalCountBeforeDismiss = await signalCards\.count\(\)/,
  );
  assert.match(source, /const dismissedSignalId = await dismissedSignal\.getAttribute\("data-signal-id"\)/);
  assert.match(source, /const dismissedSignalIdentity = page\.locator\([\s\S]{0,160}data-signal-id=\$\{JSON\.stringify\(dismissedSignalId\)\}/);
  assert.match(source, /await clickAndAcceptConfirm\([\s\S]{0,120}dismissedSignalIdentity\.getByRole\("button", \{ name: dismissCopy \}\)/);
  assert.match(source, /await expect\(dismissedSignalIdentity\)\.toHaveCount\(0\)/);
  assert.match(source, /await expect\(signalCards\)\.toHaveCount\(signalCountBeforeDismiss - 1\)/);
  assert.doesNotMatch(source, /dismissInspectButton\.locator\("xpath=ancestor::article/);
  assert.doesNotMatch(source, /dismissedSignalIdentity = signalCards\.filter/);
  assert.doesNotMatch(source, /await expect\(dismissedSignal\)\.toBeHidden/);
});

test('Thinking History local import evidence targets unique visible exchange rows', async () => {
  const testUrl = new URL(
    '../e2e-authenticated/authenticated-thinking-history.spec.ts',
    import.meta.url,
  );
  const source = await fs.readFile(testUrl, 'utf8');

  assert.match(source, /const exchangeRow = \(question: string\) => page\.getByRole\("listitem"\)\.filter\(\{/);
  assert.match(source, /has: page\.getByRole\("checkbox", \{ name: question \}\)/);
  assert.match(source, /await expect\(row\)\.toHaveCount\(1\)[\s\S]{0,160}await expect\(row\)\.toBeVisible\(\)[\s\S]{0,240}row\.textContent\(\)[\s\S]{0,120}includes\(question\)/);
  assert.match(source, /for \(const row of \[selectedExchangeARow, selectedExchangeBRow\]\)[\s\S]{0,100}await row\.getByRole\("checkbox"\)\.check\(\)/);
  assert.doesNotMatch(source, /getByText\(selectedQuestionA, \{ exact: true \}\)/);
  assert.doesNotMatch(source, /getByText\(question, \{ exact: true \}\)/);
});

test('Thinking History import-event evidence waits for commit visibility and cleans between projects', async () => {
  const testUrl = new URL(
    '../e2e-authenticated/authenticated-thinking-history.spec.ts',
    import.meta.url,
  );
  const source = await fs.readFile(testUrl, 'utf8');

  assert.match(source, /async function waitForImportSubmissionEventCount\([\s\S]{0,700}expect\.poll\([\s\S]{0,500}timeout: 30_000[\s\S]{0,300}\.toBe\(expectedCount\)/);
  assert.ok(
    source.includes('const IMPORT_BATCH_URL_PATTERN = /\\/knowledge-inbox\\/[0-9a-f]{8}-'),
    'the import route itself must not satisfy the submitted-batch redirect',
  );
  assert.match(source, /async function waitForSubmittedImportBatchId\([\s\S]{0,1400}submittedImportBatchIdsContainingMarker\([\s\S]{0,700}\.toBe\(1\)/);
  assert.match(source, /async function activateExactReviewLink\([\s\S]{0,180}batchId: string,[\s\S]{0,80}hasTouch: boolean,[\s\S]{0,40}Promise<void>/);
  assert.match(source, /const smoothScrollOverride = hasTouch[\s\S]{0,80}\? null[\s\S]{0,180}html \{ scroll-behavior: auto !important; \}/);
  assert.match(source, /if \(!hasTouch\) \{[\s\S]{0,700}scrollIntoView\(\{ behavior: "instant", block: "center", inline: "nearest" \}\)/);
  assert.match(source, /if \(!hasTouch\) \{[\s\S]{0,900}const firstBounds = element\.getBoundingClientRect\(\)[\s\S]{0,220}const bounds = element\.getBoundingClientRect\(\)[\s\S]{0,500}const boundsAreStable/);
  assert.match(source, /if \(!hasTouch\) \{[\s\S]{0,1400}document\.elementFromPoint\(point\.x, point\.y\)/);
  assert.match(source, /if \(!hasTouch\) \{[\s\S]{0,1900}link\.click\(\{ trial: true, timeout: 10_000 \}\)[\s\S]{0,180}REVIEW_LOCATOR_NOT_ACTIONABLE/);
  assert.match(source, /if \(hasTouch\)[\s\S]{0,500}link\.tap\(\{ timeout: 10_000 \}\)[\s\S]{0,180}link\.focus\(\)[\s\S]{0,120}expect\(link\)\.toBeFocused\(\)[\s\S]{0,120}page\.keyboard\.press\("Enter"\)/);
  assert.doesNotMatch(source, /link\.tap\(\{[^}]*trial: true/);
  assert.doesNotMatch(source, /link\.tap\(\{[^}]*position:/);
  assert.match(source, /page\.on\("request", onRequest\)[\s\S]{0,500}await activate\(\)/);
  assert.match(source, /REVIEW_ACTIVATION_NO_REQUEST/);
  assert.match(source, /REVIEW_DESTINATION_HTTP_ERROR/);
  assert.match(source, /REVIEW_TARGET_REQUEST_NO_RESPONSE/);
  assert.match(source, /REVIEW_TARGET_REDIRECT_NO_COMMIT/);
  assert.match(source, /REVIEW_TARGET_SUCCESS_NO_COMMIT/);
  assert.match(source, /await activateExactReviewLink\([\s\S]{0,180}reviewLinks\.first\(\)[\s\S]{0,100}batchId,[\s\S]{0,100}testInfo\.project\.use\.hasTouch === true/);
  assert.doesNotMatch(source, /page\.touchscreen\.tap|page\.mouse\.click/);
  assert.doesNotMatch(source, /force:\s*true/);
  assert.match(source, /async function gotoOwnerKnowledgeData\([\s\S]{0,1200}attempt <= 2[\s\S]{0,500}\/account\/delete#knowledge-data[\s\S]{0,700}OWNER_DATA_CONTROLS_UNAVAILABLE/);
  assert.match(source, /async function clickAndAcceptConfirm\([\s\S]{0,500}html \{ scroll-behavior: auto !important; \}/);
  assert.match(source, /async function clickAndAcceptConfirm\([\s\S]{0,1200}scrollIntoView\(\{ behavior: "instant", block: "center", inline: "nearest" \}\)[\s\S]{0,1000}document\.elementFromPoint\(point\.x, point\.y\)[\s\S]{0,700}the confirmation control is the stable centered pointer target/);
  assert.match(source, /const confirmHandled = page\.waitForEvent\("dialog", \{ timeout: 5_000 \}\)[\s\S]{0,300}dialog\.accept\(\)[\s\S]{0,100}dialog\.dismiss\(\)/);
  assert.match(source, /const activateControl = async \(\) => \{[\s\S]{0,180}if \(!hasTouch\)[\s\S]{0,120}control\.click\(\{ timeout: 5_000 \}\)[\s\S]{0,300}expect\(control\)\.toBeEnabled[\s\S]{0,500}control\.tap\(\{ timeout: 5_000 \}\)/);
  assert.doesNotMatch(source, /control\.tap\(\{[^}]*position:/);
  assert.match(source, /isSuccessfulReviewNavigation\(\{ committed, \.\.\.observation \}\)/);
  assert.match(source, /function safeEvidenceErrorSummary\([\s\S]{0,700}\^\(REVIEW_\[A-Z0-9_\]\+\)[\s\S]{0,500}safeErrorSummary\(error\)/);
  assert.match(source, /let evidenceStage = "import_submission"[\s\S]{0,7000}evidenceStage = "review_link"[\s\S]{0,7000}\$\{evidenceStage\}:\$\{safeEvidenceErrorSummary\(evidenceError\)\}/);
  assert.match(source, /Promise\.allSettled\(\[[\s\S]{0,120}confirmHandled,[\s\S]{0,80}activateControl\(\)[\s\S]{0,700}UNEXPECTED_DIALOG_TYPE/);
  assert.match(source, /async function deleteSubmittedImportThroughOwnerUi\([\s\S]{0,1600}await clickAndAcceptConfirm\([\s\S]{0,220}deleteImportCopy[\s\S]{0,220}await waitForImportSubmissionEventCount\(page, 0\)/);
  assert.doesNotMatch(source, /page\.once\("dialog"/);
  const submissionClick = source.indexOf('await page.getByRole("button", { name: /Create 2 review candidates/i }).click()');
  const exactRedirect = source.indexOf('await expect(page).toHaveURL(IMPORT_BATCH_URL_PATTERN', submissionClick);
  const batchCapture = source.indexOf('batchId = decodeURIComponent');
  const evidenceTry = source.lastIndexOf('  try {', submissionClick);
  const batchAssertion = source.indexOf('expect(batchId).toMatch', batchCapture);
  const visibilityPoll = source.indexOf('postConsentImportEvents = await waitForImportSubmissionEventCount');
  const preSubmitEvents = source.indexOf('const preSubmitImportEvents = await importSubmissionEvents');
  const messageResponseReady = source.indexOf('await expect.poll(() => messageResponses.length).toBe(1)');
  const messageBodyCapture = source.indexOf('const messageBytes = Buffer.byteLength(await messageResponses[0]!.body())');
  const firstThinkingCard = source.indexOf('const signalRoot = page.locator(".thinking-card").first()');
  const preSubmitState = source.indexOf('publishedStateBeforeSubmission = await readAuthenticatedOverlayPublishedState');
  const pendingState = source.indexOf('await inspectPendingAuthenticatedOverlayImport({', visibilityPoll);
  const pendingStateComparison = source.indexOf(').toEqual(publishedStateBeforeSubmission)', pendingState);
  const metadataExpansion = source.indexOf('await metadataSummary.click()', pendingStateComparison);
  const metadataOpenAssertion = source.indexOf('toHaveAttribute("open", "")', metadataExpansion);
  const evidenceVisibleAssertion = source.indexOf('expect(evidenceGroup).toBeVisible()', metadataOpenAssertion);
  const finallyBlock = source.indexOf('} finally {', visibilityPoll);
  const recoveryCall = source.indexOf('await waitForSubmittedImportBatchId(page, selectedQuestionA)', finallyBlock);
  const cleanupCall = source.indexOf('await deleteSubmittedImportThroughOwnerUi(', finallyBlock);
  const fallbackImport = source.indexOf('"../scripts/authenticated-overlay-fixture.mjs"', cleanupCall);
  const fallbackCall = source.indexOf('await deleteExactAuthenticatedOverlayImport({', fallbackImport);
  const safeFailure = source.indexOf('THINKING_HISTORY_EVIDENCE_FAILED', fallbackCall);
  assert.ok(evidenceTry >= 0 && evidenceTry < submissionClick, 'submission must start inside the cleanup boundary');
  assert.ok(submissionClick < exactRedirect && exactRedirect < batchCapture, 'the UUID redirect must resolve before batch capture');
  assert.ok(batchCapture < batchAssertion && batchAssertion < visibilityPoll, 'batch validation must precede telemetry polling');
  assert.ok(
    messageResponseReady >= 0
      && messageResponseReady < messageBodyCapture
      && messageBodyCapture < firstThinkingCard,
    'the message asset body must be captured before later navigations can evict it from Chromium',
  );
  assert.ok(
    preSubmitState > preSubmitEvents
      && preSubmitState < submissionClick
      && pendingState > visibilityPoll
      && pendingStateComparison > pendingState
      && metadataExpansion > pendingStateComparison
      && metadataOpenAssertion > metadataExpansion
      && evidenceVisibleAssertion > metadataOpenAssertion,
    'the exact pending batch must leave published state unchanged before review metadata opens',
  );
  assert.ok(finallyBlock > visibilityPoll && recoveryCall > finallyBlock && cleanupCall > recoveryCall, 'finally must recover and delete the exact owner batch');
  assert.ok(cleanupCall < fallbackImport && fallbackImport < fallbackCall && fallbackCall < safeFailure, 'UI cleanup must precede exact DB fallback and the fallback must not suppress test failure');
  assert.match(source, /fallback\.deleted !== true[\s\S]{0,300}fallback\.remainingEvents !== 0[\s\S]{0,300}databaseFallbackStatus = "verified"/);
  assert.match(source, /if \(evidenceError \|\| uiCleanupError\)[\s\S]{0,800}THINKING_HISTORY_EVIDENCE_FAILED/);
  assert.match(source, /preApprovalPublishedStateUnchanged,[\s\S]{0,120}preApprovalActivationRows/);
  assert.match(source, /failureFingerprint\(message\.text\(\)\)/);
  assert.doesNotMatch(source, /console: \$\{message\.text\(\)\}|page: \$\{error\.message\}|heading \$\{JSON\.stringify/);
  assert.doesNotMatch(source, /const postConsentImportEvents = await importSubmissionEvents\(page\)/);
});

test('owner data controls depend only on the verified Clerk session subject', async () => {
  const pageUrl = new URL(
    '../src/app/account/delete/page.tsx',
    import.meta.url,
  );
  const entrypointUrl = new URL(
    '../src/components/account-deletion-panel-entrypoint.tsx',
    import.meta.url,
  );
  const localizedPanelUrl = new URL(
    '../src/components/localized-account-deletion-panel.tsx',
    import.meta.url,
  );
  const [source, entrypoint, localizedPanel] = await Promise.all([
    fs.readFile(pageUrl, 'utf8'),
    fs.readFile(entrypointUrl, 'utf8'),
    fs.readFile(localizedPanelUrl, 'utf8'),
  ]);

  assert.match(source, /import \{ requireCurrentUser \} from '@\/lib\/auth'/);
  assert.match(source, /requireCurrentUser\(\)/);
  assert.doesNotMatch(source, /requireCurrentUserProfile|currentUser\(/);
  assert.match(source, /getKnowledgeDraftBatchesForUser\(user\.id, true/);
  assert.match(source, /const \[user, \{ t, locale \}, resolvedSearchParams\] = await Promise\.all/);
  assert.match(source, /<AccountDeletionPanelEntrypoint email=\{user\.email\} locale=\{locale\} \/>/);
  assert.match(entrypoint, /import\('\.\/localized-account-deletion-panel'\)/);
  assert.match(entrypoint, /\{ ssr: false, loading: LoadingAccountDeletionPanel \}/);
  assert.match(localizedPanel, /const localizationState = useClerkLocalization\(locale\)/);
  assert.match(localizedPanel, /localizationState\.status === 'error'[\s\S]*role="alert"[\s\S]*onClick=\{localizationState\.retry\}/);
  assert.match(localizedPanel, /<ClerkProvider localization=\{localizationState\.localization\}>[\s\S]*<AccountDeletionPanel email=\{email\} \/>[\s\S]*<\/ClerkProvider>/);
});

test('production-compatible sign-in ticket is short lived and owner scoped', async () => {
  const calls = [];
  const ticket = await createSyntheticSignInTicket({
    clerkClient: {
      signInTokens: {
        async createSignInToken(input) {
          calls.push(input);
          return { token: 'short-lived-ticket' };
        },
      },
    },
    userId: 'user_synthetic',
  });

  assert.equal(ticket, 'short-lived-ticket');
  assert.deepEqual(calls, [{ userId: 'user_synthetic', expiresInSeconds: 300 }]);
});

test('production evidence can expose live credentials only from protected main', async () => {
  const workflowUrl = new URL('../../../.github/workflows/authenticated-performance.yml', import.meta.url);
  const workflow = await fs.readFile(workflowUrl, 'utf8');

  assert.match(workflow, /RUN_REF: \$\{\{ github\.ref \}\}/);
  assert.match(workflow, /\[ "\$RUN_REF" != "refs\/heads\/main" \]/);
  assert.match(
    workflow,
    /if: inputs\.target == 'production' && github\.ref == 'refs\/heads\/main'/,
  );
});

test('preview evidence checks out the open same-repository PR head', async () => {
  const workflowUrl = new URL('../../../.github/workflows/authenticated-performance.yml', import.meta.url);
  const workflow = await fs.readFile(workflowUrl, 'utf8');

  assert.match(workflow, /pull-requests: read/);
  assert.match(workflow, /"\$GITHUB_API_URL\/repos\/\$GITHUB_REPOSITORY\/pulls\/\$PREVIEW_PR_NUMBER"/);
  assert.match(workflow, /\[ "\$state" != "open" \]/);
  assert.match(workflow, /\[ "\$head_repository" != "\$GITHUB_REPOSITORY" \]/);
  assert.match(workflow, /preview_head_sha: \$\{\{ steps\.validate-inputs\.outputs\.preview_head_sha \}\}/);
  assert.match(workflow, /ref: \$\{\{ needs\.validate\.outputs\.preview_head_sha \}\}/);
  assert.match(workflow, /VERIFY_EXPECTED_REVISION: \$\{\{ needs\.validate\.outputs\.preview_head_sha \}\}/);
  assert.match(workflow, /node apps\/web\/scripts\/verify-deployment-revision\.mjs/);
});

test('deployment workflow publishes the served Git revision for Preview and production', async () => {
  const workflowUrl = new URL('../../../.github/workflows/deploy-cloudflare.yml', import.meta.url);
  const workflow = await fs.readFile(workflowUrl, 'utf8');

  assert.match(workflow, /GIRAPPHE_REVISION: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /APP_BASE_URL GIRAPPHE_REVISION/);
  const productionSecretSync = workflow.slice(
    workflow.indexOf('- name: Sync Worker runtime secrets (prod)'),
    workflow.indexOf('- name: Deploy Worker'),
  );
  assert.doesNotMatch(productionSecretSync, /GIRAPPHE_REVISION/);
  const productionDeploy = workflow.slice(
    workflow.indexOf('- name: Deploy Worker'),
    workflow.indexOf('- name: Smoke Test (prod)'),
  );
  assert.match(productionDeploy, /GIRAPPHE_REVISION: \$\{\{ github\.sha \}\}/);
  assert.match(productionDeploy, /--secrets-file "\$revision_secrets_file"/);
});
