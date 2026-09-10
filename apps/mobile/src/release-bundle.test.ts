import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const exportScript = readFileSync(
  join(sourceDir, '../scripts/export-release-bundle.mjs'),
  'utf8',
);

test('release exports clear Metro cache paths inherited from another worktree', () => {
  const args = exportScript.match(/const args = \[[\s\S]*?\n\];/)?.[0] ?? '';
  assert.match(args, /'expo',[\s\S]*?'export',[\s\S]*?'--clear',[\s\S]*?'--platform'/);
});
