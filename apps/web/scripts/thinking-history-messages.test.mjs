import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const asset = JSON.parse(await readFile(new URL('../public/thinking-history-messages.json', import.meta.url), 'utf8'));
const importAsset = JSON.parse(await readFile(new URL('../public/conversation-import-messages.json', import.meta.url), 'utf8'));
const locales = ['ar', 'en', 'es', 'hi', 'ja', 'zh-CN'];

test('thinking history static copy is bounded and complete in every supported locale', () => {
  assert.deepEqual(Object.keys(asset).sort(), locales.toSorted());
  const expected = Object.keys(asset.en).sort();
  assert.ok(expected.length > 0 && expected.length <= 64);
  for (const locale of locales) {
    assert.deepEqual(Object.keys(asset[locale]).sort(), expected);
    assert.ok(Object.values(asset[locale]).every((value) => typeof value === 'string' && value.trim().length > 0));
  }
  assert.ok(Buffer.byteLength(JSON.stringify(asset)) <= 64 * 1024);
});

test('conversation import static copy is bounded and complete in every supported locale', () => {
  assert.deepEqual(Object.keys(importAsset).sort(), locales.toSorted());
  const expected = Object.keys(importAsset.en).sort();
  assert.ok(expected.length > 0 && expected.length <= 32);
  for (const locale of locales) {
    assert.deepEqual(Object.keys(importAsset[locale]).sort(), expected);
    assert.ok(Object.values(importAsset[locale]).every((value) => typeof value === 'string' && value.trim().length > 0));
  }
  assert.ok(Buffer.byteLength(JSON.stringify(importAsset)) <= 48 * 1024);
});
