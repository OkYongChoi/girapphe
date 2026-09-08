import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import resourceLimits from '../config/resource-limits.json' with { type: 'json' };

// Multilingual UI catalogs and cache-only localized content add a bounded amount
// of runtime code. Keep the CI budget and operations dashboard on one source of truth.
const MAX_UNCOMPRESSED_KIB = resourceLimits.worker.uncompressedReleaseBudgetKiB;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDirectory = path.join(repositoryRoot, 'apps', 'web');

export function parseUncompressedWorkerSizeKiB(output) {
  const match = /Total Upload:\s*([\d.]+)\s*KiB\b/i.exec(output);
  if (!match) throw new Error('Unable to read the uncompressed Worker size from Wrangler output.');

  const uncompressedKiB = Number(match[1]);
  if (!Number.isFinite(uncompressedKiB)) {
    throw new Error('Wrangler returned an invalid uncompressed Worker size.');
  }
  return uncompressedKiB;
}

function main() {
  const result = spawnSync(
    'pnpm',
    ['exec', 'wrangler', 'deploy', '--env', 'preview', '--dry-run'],
    {
      cwd: webDirectory,
      encoding: 'utf8',
      env: process.env,
    }
  );

  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  let uncompressedKiB;
  try {
    uncompressedKiB = parseUncompressedWorkerSizeKiB(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (uncompressedKiB > MAX_UNCOMPRESSED_KIB) {
    console.error(
      `Uncompressed Worker size ${uncompressedKiB.toFixed(2)} KiB exceeds the ${MAX_UNCOMPRESSED_KIB} KiB release budget.`
    );
    process.exit(1);
  }

  console.log(
    `Uncompressed Worker size ${uncompressedKiB.toFixed(2)} KiB is within the ${MAX_UNCOMPRESSED_KIB} KiB release budget.`
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) main();
