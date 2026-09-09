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
  assert.match(source, /await dismissedSignalIdentity\.getByRole\("button", \{ name: dismissCopy \}\)\.click\(\)/);
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
  assert.match(source, /await expect\(row\)\.toHaveCount\(1\)[\s\S]{0,160}await expect\(row\)\.toBeVisible\(\)[\s\S]{0,160}await expect\(row\)\.toContainText\(question\)/);
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
  assert.match(source, /async function deleteSubmittedImportThroughOwnerUi\([\s\S]{0,1600}await batchRow\.getByRole\("button", \{ name: deleteImportCopy \}\)\.click\(\)[\s\S]{0,220}await waitForImportSubmissionEventCount\(page, 0\)/);
  const submissionClick = source.indexOf('await page.getByRole("button", { name: /Create 2 review candidates/i }).click()');
  const exactRedirect = source.indexOf('await expect(page).toHaveURL(IMPORT_BATCH_URL_PATTERN', submissionClick);
  const batchCapture = source.indexOf('batchId = decodeURIComponent');
  const evidenceTry = source.lastIndexOf('  try {', submissionClick);
  const batchAssertion = source.indexOf('expect(batchId).toMatch', batchCapture);
  const visibilityPoll = source.indexOf('postConsentImportEvents = await waitForImportSubmissionEventCount');
  const finallyBlock = source.indexOf('} finally {', visibilityPoll);
  const recoveryCall = source.indexOf('await waitForSubmittedImportBatchId(page, selectedQuestionA)', finallyBlock);
  const cleanupCall = source.indexOf('await deleteSubmittedImportThroughOwnerUi(page, batchId)', finallyBlock);
  assert.ok(evidenceTry >= 0 && evidenceTry < submissionClick, 'submission must start inside the cleanup boundary');
  assert.ok(submissionClick < exactRedirect && exactRedirect < batchCapture, 'the UUID redirect must resolve before batch capture');
  assert.ok(batchCapture < batchAssertion && batchAssertion < visibilityPoll, 'batch validation must precede telemetry polling');
  assert.ok(finallyBlock > visibilityPoll && recoveryCall > finallyBlock && cleanupCall > recoveryCall, 'finally must recover and delete the exact owner batch');
  assert.match(source, /Primary: \$\{errorSummary\(evidenceError\)\} Cleanup: \$\{errorSummary\(cleanupError\)\}/);
  assert.doesNotMatch(source, /const postConsentImportEvents = await importSubmissionEvents\(page\)/);
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
