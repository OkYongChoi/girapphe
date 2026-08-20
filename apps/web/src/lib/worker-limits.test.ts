import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('keeps a bounded Worker subrequest ceiling above the default free-tier limit', async () => {
  const configPath = new URL('../../wrangler.jsonc', import.meta.url);
  const config = JSON.parse(await readFile(configPath, 'utf8')) as {
    limits?: { subrequests?: unknown };
  };

  assert.equal(config.limits?.subrequests, 250);
});
