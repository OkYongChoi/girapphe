import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyReviewLocatorActivationFailure,
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

test('review locator failures retain only a bounded non-sensitive reason code', () => {
  const cases = [
    ['<nav aria-label="Site header"> from subtree intercepts pointer events', 'REVIEW_LOCATOR_INTERCEPTED_HEADER'],
    ['<div> from subtree intercepts pointer events private-marker', 'REVIEW_LOCATOR_INTERCEPTED_CONTENT'],
    ['element is not stable', 'REVIEW_LOCATOR_UNSTABLE'],
    ['locator resolved, but element was detached from the DOM', 'REVIEW_LOCATOR_DETACHED'],
    ['element is outside of the viewport', 'REVIEW_LOCATOR_OUTSIDE_VIEWPORT'],
    ['The page does not support tap because hasTouch is false', 'REVIEW_LOCATOR_TOUCH_UNAVAILABLE'],
    ['waiting for scheduled navigations to finish', 'REVIEW_LOCATOR_NAVIGATION_WAIT'],
    ['locator.tap: Timeout 10000ms exceeded.', 'REVIEW_LOCATOR_TIMEOUT'],
    ['unexpected private-marker failure', 'REVIEW_LOCATOR_ACTIVATION_FAILED'],
  ];
  for (const [message, expected] of cases) {
    const code = classifyReviewLocatorActivationFailure(new Error(message));
    assert.equal(code, expected);
    assert.doesNotMatch(code, /private-marker|<|>/);
  }
});
