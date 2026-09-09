import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import yaml from 'js-yaml';

const deployWorkflowUrl = new URL(
  '../../../.github/workflows/deploy-cloudflare.yml',
  import.meta.url,
);
const authenticatedWorkflowUrl = new URL(
  '../../../.github/workflows/authenticated-performance.yml',
  import.meta.url,
);

function statefulConcurrency(job) {
  assert.deepEqual(job.concurrency, {
    group: 'girapphe-preview-shared-state-v1',
    'cancel-in-progress': false,
    queue: 'max',
  });
}

function stepWithRun(job, pattern) {
  const index = job.steps.findIndex((step) => pattern.test(step.run ?? ''));
  assert.notEqual(index, -1, `missing workflow command ${pattern}`);
  return { index, step: job.steps[index] };
}

test('preview jobs serialize shared database and Worker-settings mutations', async () => {
  const deployWorkflow = yaml.load(await fs.readFile(deployWorkflowUrl, 'utf8'));
  const authenticatedWorkflow = yaml.load(await fs.readFile(authenticatedWorkflowUrl, 'utf8'));
  const previewJob = deployWorkflow.jobs.deploy_preview;
  const productionJob = deployWorkflow.jobs.deploy_prod;
  const authenticatedPreviewJob = authenticatedWorkflow.jobs.preview;

  assert.equal(deployWorkflow.permissions['pull-requests'], 'read');
  assert.equal(deployWorkflow.concurrency['cancel-in-progress'], false);
  assert.match(deployWorkflow.concurrency.group, /github\.event\.pull_request\.number/);
  assert.equal(authenticatedWorkflow.concurrency['cancel-in-progress'], false);
  assert.equal(authenticatedWorkflow.concurrency.queue, 'max');
  statefulConcurrency(previewJob);
  statefulConcurrency(authenticatedPreviewJob);

  const previewHeadGuard = stepWithRun(
    previewJob,
    /repos\/\$GITHUB_REPOSITORY\/pulls\/\$PR_NUMBER/,
  );
  assert.equal(previewHeadGuard.step.env.EXPECTED_HEAD_SHA, '${{ github.event.pull_request.head.sha }}');
  assert.match(previewHeadGuard.step.run, /current_state.*open/s);
  assert.match(previewHeadGuard.step.run, /current_head_repository.*GITHUB_REPOSITORY/s);
  assert.match(previewHeadGuard.step.run, /current_head_sha.*EXPECTED_HEAD_SHA/s);

  const orderedStatefulCommands = [
    /pnpm db:prepare:preview/,
    /scripts\/recall-persistence-postgres\.test\.mjs/,
    /scripts\/knowledge-supersession-tombstone-postgres\.test\.mjs/,
    /scripts\/knowledge-resolution-postgres\.test\.mjs/,
    /scripts\/chatgpt-export-postgres\.test\.mjs/,
    /pnpm exec wrangler deploy --env preview --secrets-file/,
  ];

  let previousIndex = -1;
  for (const command of orderedStatefulCommands) {
    const { index, step } = stepWithRun(previewJob, command);
    assert.ok(index > previewHeadGuard.index, `${command} must run after the current-head guard`);
    assert.ok(index > previousIndex, `${command} must remain in serialized order`);
    previousIndex = index;

    if (command.source.includes('db:prepare')) {
      assert.equal(step.env.DATABASE_URL, '${{ secrets.DATABASE_URL_PREVIEW }}');
    } else if (command.source.includes('postgres')) {
      assert.equal(
        step.env.LIVE_POSTGRES_TEST_DATABASE_URL,
        '${{ secrets.DATABASE_URL_PREVIEW }}',
      );
    }
  }

  const deployMutationStep = stepWithRun(
    previewJob,
    /pnpm exec wrangler deploy --env preview --secrets-file/,
  ).step;
  assert.equal(
    deployMutationStep.env.DATABASE_URL,
    '${{ secrets.DATABASE_URL_PREVIEW }}',
  );
  const mutationCommands = [
    'pnpm exec wrangler deploy --env preview --secrets-file',
    'pnpm exec wrangler secret list --env preview',
    'pnpm exec wrangler secret delete "$key" --env preview',
    'pnpm exec wrangler versions upload --env preview',
  ];
  let previousMutationIndex = -1;
  for (const command of mutationCommands) {
    const currentMutationIndex = deployMutationStep.run.indexOf(command);
    assert.ok(
      currentMutationIndex > previousMutationIndex,
      `${command} must remain in serialized mutation order`,
    );
    previousMutationIndex = currentMutationIndex;
  }

  const authenticatedFixture = stepWithRun(
    authenticatedPreviewJob,
    /pnpm browser:authenticated-overlay/,
  ).step;
  const authenticatedHeadGuard = stepWithRun(
    authenticatedPreviewJob,
    /repos\/\$GITHUB_REPOSITORY\/pulls\/\$PREVIEW_PR_NUMBER/,
  );
  assert.equal(
    authenticatedHeadGuard.step.env.EXPECTED_HEAD_SHA,
    '${{ needs.validate.outputs.preview_head_sha }}',
  );
  assert.match(authenticatedHeadGuard.step.run, /current_state.*open/s);
  assert.match(authenticatedHeadGuard.step.run, /current_head_repository.*GITHUB_REPOSITORY/s);
  assert.match(authenticatedHeadGuard.step.run, /current_head_sha.*EXPECTED_HEAD_SHA/s);
  assert.ok(
    stepWithRun(authenticatedPreviewJob, /pnpm browser:authenticated-overlay/).index
      > authenticatedHeadGuard.index,
    'authenticated Preview fixtures must run after the post-queue current-head guard',
  );
  assert.equal(
    authenticatedFixture.env.DATABASE_URL,
    '${{ secrets.DATABASE_URL_PREVIEW }}',
  );

  const productionHeadGuard = stepWithRun(
    productionJob,
    /repos\/\$GITHUB_REPOSITORY\/git\/ref\/heads\/main/,
  );
  assert.equal(productionHeadGuard.step.env.EXPECTED_HEAD_SHA, '${{ github.sha }}');
  assert.match(productionHeadGuard.step.run, /current_head_sha.*EXPECTED_HEAD_SHA/s);
  assert.ok(
    stepWithRun(productionJob, /pnpm db:migrate/).index > productionHeadGuard.index,
    'production migration must run after the current-main guard',
  );
});
