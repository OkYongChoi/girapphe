import { pathToFileURL } from 'node:url';

const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

function requireValue(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

export async function verifyDeploymentRevision({
  baseUrl,
  expectedRevision,
  attempts = 24,
  intervalMs = 5_000,
  fetchImpl = fetch,
  sleepImpl = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  const expected = requireValue(expectedRevision, 'expected deployment revision').toLowerCase();
  if (!GIT_SHA_PATTERN.test(expected)) throw new Error('Expected deployment revision must be a full Git SHA.');
  const target = new URL('/api/health', requireValue(baseUrl, 'deployment base URL'));
  let observed = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(target, { redirect: 'error' });
      const body = await response.json();
      observed = typeof body?.revision === 'string' ? body.revision.toLowerCase() : null;
      if (response.ok && observed === expected) return { attempt, revision: observed };
    } catch {
      observed = null;
    }
    if (attempt < attempts) await sleepImpl(intervalMs);
  }

  throw new Error(
    `Deployment revision mismatch after ${attempts} attempts: expected ${expected}, observed ${observed ?? 'unavailable'}.`,
  );
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  verifyDeploymentRevision({
    baseUrl: process.env.VERIFY_BASE_URL,
    expectedRevision: process.env.VERIFY_EXPECTED_REVISION,
    attempts: Number.parseInt(process.env.VERIFY_ATTEMPTS ?? '24', 10),
  })
    .then(({ attempt, revision }) => {
      console.log(`Verified deployed revision ${revision} on attempt ${attempt}.`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
