import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('mobile account deletion preserves Clerk reverification hints and retries safely', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const api = readFileSync(join(sourceDir, 'api.ts'), 'utf8');
  const account = readFileSync(join(sourceDir, '../app/(tabs)/account.tsx'), 'utf8');

  assert.match(api, /deleteAccount: \(\) => authenticatedFetch\('\/api\/account'/);
  assert.doesNotMatch(api, /deleteAccount: \(\) => request</);
  assert.match(account, /useReverification\(mobileApi\.deleteAccount\)/);
  assert.match(account, /if \(!result\?\.deleted\) throw/);
});
