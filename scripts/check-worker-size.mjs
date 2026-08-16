import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_COMPRESSED_KIB = 3020;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDirectory = path.join(repositoryRoot, 'apps', 'web');

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

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const compressedSize = /Total Upload:.*?\/ gzip:\s*([\d.]+)\s*KiB/i.exec(output);

if (!compressedSize) {
  console.error('Unable to read the compressed Worker size from Wrangler output.');
  process.exit(1);
}

const compressedKiB = Number(compressedSize[1]);
if (!Number.isFinite(compressedKiB)) {
  console.error('Wrangler returned an invalid compressed Worker size.');
  process.exit(1);
}

if (compressedKiB > MAX_COMPRESSED_KIB) {
  console.error(
    `Compressed Worker size ${compressedKiB.toFixed(2)} KiB exceeds the ${MAX_COMPRESSED_KIB} KiB release budget.`
  );
  process.exit(1);
}

console.log(
  `Compressed Worker size ${compressedKiB.toFixed(2)} KiB is within the ${MAX_COMPRESSED_KIB} KiB release budget.`
);
