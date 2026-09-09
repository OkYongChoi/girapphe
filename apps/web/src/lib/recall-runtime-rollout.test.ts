import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  isRecallRuntimeEnrollmentEnabledForUser,
  recallRuntimeRolloutMode,
} from './recall-runtime-rollout';

test('Recall enrollment rollout fails closed in production', () => {
  assert.equal(recallRuntimeRolloutMode({ NODE_ENV: 'production' }), 'off');
  assert.equal(
    recallRuntimeRolloutMode({ NODE_ENV: 'production', RECALL_RUNTIME_ROLLOUT: 'unexpected' }),
    'off',
  );
  assert.equal(
    isRecallRuntimeEnrollmentEnabledForUser('user_1', { NODE_ENV: 'production' }),
    false,
  );
});

test('Recall enrollment rollout defaults open only outside production', () => {
  assert.equal(recallRuntimeRolloutMode({ NODE_ENV: 'development' }), 'all');
  assert.equal(isRecallRuntimeEnrollmentEnabledForUser('user_1', { NODE_ENV: 'test' }), true);
  assert.equal(isRecallRuntimeEnrollmentEnabledForUser('', { NODE_ENV: 'test' }), false);
});

test('Recall allowlist uses exact bounded user-id tokens', () => {
  const environment = {
    NODE_ENV: 'production',
    RECALL_RUNTIME_ROLLOUT: 'allowlist',
    RECALL_RUNTIME_USER_IDS: 'user_one, user_two\nuser_three',
  };
  assert.equal(isRecallRuntimeEnrollmentEnabledForUser('user_two', environment), true);
  assert.equal(isRecallRuntimeEnrollmentEnabledForUser('user', environment), false);
  assert.equal(isRecallRuntimeEnrollmentEnabledForUser('user_four', environment), false);

  const moreThanLimit = Array.from({ length: 501 }, (_, index) => `user_${index}`).join(',');
  assert.equal(isRecallRuntimeEnrollmentEnabledForUser('user_499', {
    ...environment,
    RECALL_RUNTIME_USER_IDS: moreThanLimit,
  }), true);
  assert.equal(isRecallRuntimeEnrollmentEnabledForUser('user_500', {
    ...environment,
    RECALL_RUNTIME_USER_IDS: moreThanLimit,
  }), false);
});

test('checked-in Worker environments keep production off and Preview synthetic-owner allowlisted', () => {
  const wrangler = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
  const preview = wrangler.slice(
    wrangler.indexOf('"preview": {'),
    wrangler.indexOf('"prod": {'),
  );
  const production = wrangler.slice(wrangler.indexOf('"prod": {'));

  assert.match(preview, /"RECALL_RUNTIME_ROLLOUT": "allowlist"/u);
  assert.doesNotMatch(preview, /"RECALL_RUNTIME_ROLLOUT": "all"/u);
  assert.match(production, /"RECALL_RUNTIME_ROLLOUT": "off"/u);

  const deployWorkflow = readFileSync(
    new URL('../../../../.github/workflows/deploy-cloudflare.yml', import.meta.url),
    'utf8',
  );
  assert.match(deployWorkflow, /Prepare exact synthetic Recall Preview allowlist/u);
  assert.match(
    deployWorkflow,
    /authenticated-overlay-fixture\.mjs --write-recall-user-id-to-github-env/u,
  );
  assert.match(deployWorkflow, /NEXT_PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN RECALL_RUNTIME_USER_IDS/u);
  const absentSecretCleanup = deployWorkflow.slice(
    deployWorkflow.indexOf('current_secrets_file="$(mktemp)"'),
    deployWorkflow.indexOf('pnpm exec wrangler versions upload --env preview'),
  );
  const cleanupKeys = absentSecretCleanup.match(/for key in ([^\n]+); do/u)?.[1]?.split(' ');
  assert.deepEqual(cleanupKeys, [
    'NEXT_PUBLIC_ADSENSE_CLIENT_ID',
    'NEXT_PUBLIC_ADSENSE_PRACTICE_SLOT_ID',
    'NEXT_PUBLIC_ADSENSE_CONSENT_READY',
    'NEXT_PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN',
    'RECALL_RUNTIME_USER_IDS',
  ]);
  assert.match(absentSecretCleanup, /if \[ -z "\$\{!key:-\}" \]/u);

  const evidenceWorkflow = readFileSync(
    new URL('../../../../.github/workflows/authenticated-performance.yml', import.meta.url),
    'utf8',
  );
  const previewEvidence = evidenceWorkflow.slice(
    evidenceWorkflow.indexOf('  preview:'),
    evidenceWorkflow.indexOf('  production:'),
  );
  const productionEvidence = evidenceWorkflow.slice(evidenceWorkflow.indexOf('  production:'));
  assert.match(previewEvidence, /E2E_RECALL_ENABLED: 'true'/u);
  assert.doesNotMatch(productionEvidence, /E2E_RECALL_ENABLED/u);
});
