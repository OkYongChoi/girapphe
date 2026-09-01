import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  AUTHENTICATED_OVERLAY_AUTH_MODES,
  createSyntheticSignInTicket,
  resolveAuthenticatedOverlayAuthMode,
} from './authenticated-overlay-auth.mjs';

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
