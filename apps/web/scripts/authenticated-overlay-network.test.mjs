import assert from 'node:assert/strict';
import test from 'node:test';
import { isNoArgumentServerActionBody } from './authenticated-overlay-network.mjs';

test('overlay request matching distinguishes the no-argument action from the locale snapshot', () => {
  assert.equal(isNoArgumentServerActionBody('[]'), true);
  assert.equal(isNoArgumentServerActionBody('  []\n'), true);
  assert.equal(isNoArgumentServerActionBody('[{"locale":"en"}]'), false);
  assert.equal(isNoArgumentServerActionBody('{}'), false);
  assert.equal(isNoArgumentServerActionBody(undefined), false);
  assert.equal(isNoArgumentServerActionBody('not-json'), false);
});
