import { rename } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const webDirectory = process.cwd();
const openNextDirectory = path.join(webDirectory, '.open-next');
const parkedOpenNextDirectory = `${openNextDirectory}.worker-types-${process.pid}`;
let movedOpenNextOutput = false;

try {
  try {
    // Wrangler adds a generated GlobalProps type only when this build output exists.
    await rename(openNextDirectory, parkedOpenNextDirectory);
    movedOpenNextOutput = true;
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  const result = spawnSync(
    'pnpm',
    ['exec', 'wrangler', 'types', 'worker-configuration.d.ts', '--env-interface', 'CloudflareEnv', '--check'],
    {
      cwd: webDirectory,
      encoding: 'utf8',
      env: process.env,
    }
  );

  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  if (movedOpenNextOutput) {
    await rename(parkedOpenNextDirectory, openNextDirectory);
  }
}
