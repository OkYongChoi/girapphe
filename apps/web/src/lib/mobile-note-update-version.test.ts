import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMobileNoteUpdateVersion } from './mobile-note-update-version';

test('modern mobile note updates retain their supplied optimistic version', async () => {
  let loads = 0;
  const result = await resolveMobileNoteUpdateVersion(7, async () => {
    loads += 1;
    return 9;
  });
  assert.deepEqual(result, { ok: true, version: 7, legacy: false });
  assert.equal(loads, 0);
});

test('versionless legacy updates load one current owner-scoped version', async () => {
  let loads = 0;
  const result = await resolveMobileNoteUpdateVersion(undefined, async () => {
    loads += 1;
    return 9;
  });
  assert.deepEqual(result, { ok: true, version: 9, legacy: true });
  assert.equal(loads, 1);
});

test('invalid supplied versions fail without falling back to compatibility mode', async () => {
  for (const invalid of [null, 0, -1, 1.5, '1']) {
    let loads = 0;
    assert.deepEqual(await resolveMobileNoteUpdateVersion(invalid, async () => {
      loads += 1;
      return 9;
    }), { ok: false, reason: 'invalid' });
    assert.equal(loads, 0);
  }
});

test('versionless updates do not expose inactive or unowned items', async () => {
  assert.deepEqual(
    await resolveMobileNoteUpdateVersion(undefined, async () => null),
    { ok: false, reason: 'not_found' },
  );
});
