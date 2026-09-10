import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isNoArgumentServerActionBody,
  isSuccessfulReviewNavigation,
} from './authenticated-overlay-network.mjs';

test('overlay request matching distinguishes the no-argument action from the locale snapshot', () => {
  assert.equal(isNoArgumentServerActionBody('[]'), true);
  assert.equal(isNoArgumentServerActionBody('  []\n'), true);
  assert.equal(isNoArgumentServerActionBody('[{"locale":"en"}]'), false);
  assert.equal(isNoArgumentServerActionBody('{}'), false);
  assert.equal(isNoArgumentServerActionBody(undefined), false);
  assert.equal(isNoArgumentServerActionBody('not-json'), false);
});

test('review navigation accepts only cached commits or completed successful requests', () => {
  assert.equal(isSuccessfulReviewNavigation({
    committed: true,
    requestSeen: false,
    responseStatus: null,
    requestFailed: false,
  }), true);
  assert.equal(isSuccessfulReviewNavigation({
    committed: true,
    requestSeen: true,
    responseStatus: 200,
    requestFailed: false,
  }), true);
  assert.equal(isSuccessfulReviewNavigation({
    committed: true,
    requestSeen: true,
    responseStatus: 299,
    requestFailed: false,
  }), true);

  for (const observation of [
    { committed: true, requestSeen: true, responseStatus: null, requestFailed: false },
    { committed: true, requestSeen: true, responseStatus: null, requestFailed: true },
    { committed: true, requestSeen: true, responseStatus: 200, requestFailed: true },
    { committed: true, requestSeen: true, responseStatus: 302, requestFailed: false },
    { committed: true, requestSeen: true, responseStatus: 500, requestFailed: false },
    { committed: false, requestSeen: true, responseStatus: 200, requestFailed: false },
    { committed: true, requestSeen: false, responseStatus: 200, requestFailed: false },
  ]) {
    assert.equal(isSuccessfulReviewNavigation(observation), false);
  }
});
