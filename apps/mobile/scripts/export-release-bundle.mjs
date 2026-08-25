import { spawnSync } from 'node:child_process';
import process from 'node:process';

const platform = process.argv[2];
if (platform !== 'ios' && platform !== 'android') {
  process.stderr.write('Usage: node scripts/export-release-bundle.mjs <ios|android>\n');
  process.exit(2);
}

const args = [
  'exec',
  'expo',
  'export',
  '--platform',
  platform,
  '--output-dir',
  `dist/${platform}`,
];

// Expo SDK 57 currently installs an x86-64 Linux hermesc binary. ARM64 Linux
// workstations can still validate Metro output; EAS and x86-64 CI retain the
// production Hermes bytecode gate.
if (process.platform === 'linux' && process.arch === 'arm64') {
  process.stderr.write('ARM64 Linux detected: validating the bundle without local Hermes bytecode.\n');
  args.push('--no-bytecode');
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(command, args, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
