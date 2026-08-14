#!/usr/bin/env node

const CLEANUP_POLICY = {
  // Keeps a just-merged Preview available for a short verification window.
  mergedHours: 24,
  // Allows authors time to reopen an accidentally closed, unmerged PR.
  closedDays: 7,
};

const required = [
  'GITHUB_REPOSITORY',
  'GITHUB_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const repository = process.env.GITHUB_REPOSITORY;
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
const workerName = process.env.PREVIEW_WORKER_NAME ?? 'girapphe-preview';
const dryRun = process.env.PREVIEW_CLEANUP_DRY_RUN === 'true';
const now = Date.now();

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    const detail = payload?.errors?.map((error) => error.message).join('; ') || response.statusText;
    throw new Error(`${options.method ?? 'GET'} ${url} failed (${response.status}): ${detail}`);
  }

  return payload;
}

async function listPreviewVersions() {
  const versions = [];
  let page = 1;

  while (true) {
    const url = new URL(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/workers/scripts/${workerName}/versions`
    );
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '100');

    const payload = await request(url, {
      headers: { Authorization: `Bearer ${cloudflareToken}` },
    });
    versions.push(...(payload.result ?? []));

    const totalPages = payload.result_info?.total_pages ?? page;
    if (page >= totalPages) return versions;
    page += 1;
  }
}

function getPreviewPullNumber(version) {
  const annotations = version.metadata?.annotations ?? version.annotations ?? {};
  const message = annotations['workers/message'] ?? version.metadata?.message ?? version.message ?? '';
  const match = /^PR #(\d+)$/.exec(message.trim());
  return match ? Number(match[1]) : null;
}

async function getPullRequest(number) {
  const payload = await request(`https://api.github.com/repos/${repository}/pulls/${number}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  return payload;
}

function getEligibleAt(pullRequest) {
  if (pullRequest.state !== 'closed') return null;

  const closedAt = pullRequest.merged_at ?? pullRequest.closed_at;
  if (!closedAt) return null;

  const closedTime = Date.parse(closedAt);
  if (Number.isNaN(closedTime)) return null;

  const retentionMs = pullRequest.merged_at
    ? CLEANUP_POLICY.mergedHours * 60 * 60 * 1000
    : CLEANUP_POLICY.closedDays * 24 * 60 * 60 * 1000;

  return closedTime + retentionMs;
}

async function deleteVersion(versionId) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/workers/workers/${workerName}/versions/${versionId}`;
  await request(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cloudflareToken}` },
  });
}

const versions = await listPreviewVersions();
const versionsByPullRequest = new Map();

for (const version of versions) {
  const pullNumber = getPreviewPullNumber(version);
  if (!pullNumber || !version.id) continue;

  const matchingVersions = versionsByPullRequest.get(pullNumber) ?? [];
  matchingVersions.push(version);
  versionsByPullRequest.set(pullNumber, matchingVersions);
}

let deleted = 0;
let skipped = 0;

for (const [pullNumber, pullVersions] of versionsByPullRequest) {
  const pullRequest = await getPullRequest(pullNumber);
  const eligibleAt = getEligibleAt(pullRequest);

  if (!eligibleAt || eligibleAt > now) {
    skipped += pullVersions.length;
    continue;
  }

  const reason = pullRequest.merged_at
    ? `merged more than ${CLEANUP_POLICY.mergedHours}h ago`
    : `closed more than ${CLEANUP_POLICY.closedDays}d ago`;

  for (const version of pullVersions) {
    if (dryRun) {
      console.log(`[dry-run] Would delete Preview version ${version.id} for PR #${pullNumber} (${reason}).`);
      continue;
    }

    await deleteVersion(version.id);
    deleted += 1;
    console.log(`Deleted Preview version ${version.id} for PR #${pullNumber} (${reason}).`);
  }
}

console.log(
  `Preview cleanup complete: ${dryRun ? 'dry-run, ' : ''}${deleted} deleted, ${skipped} retained, ${versions.length} versions inspected.`
);
