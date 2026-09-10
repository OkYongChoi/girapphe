import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyConfirmLocatorActivationFailure,
  classifyReviewLocatorActivationFailure,
  hasHorizontalLayoutOverflow,
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

test('horizontal layout overflow uses the root client width without misclassifying zoom', () => {
  assert.equal(hasHorizontalLayoutOverflow({ documentWidth: 412, rootClientWidth: 412 }), false);
  assert.equal(hasHorizontalLayoutOverflow({ documentWidth: 413, rootClientWidth: 412 }), false);
  assert.equal(hasHorizontalLayoutOverflow({ documentWidth: 1028, rootClientWidth: 412 }), true);
  assert.equal(
    hasHorizontalLayoutOverflow({ documentWidth: 1028, rootClientWidth: 1028 }),
    false,
    'matching layout widths stay valid independently of visual viewport zoom',
  );
  assert.equal(hasHorizontalLayoutOverflow({ documentWidth: Number.NaN, rootClientWidth: 412 }), true);
  assert.equal(hasHorizontalLayoutOverflow({ documentWidth: 412, rootClientWidth: 0 }), true);
});

test('review locator failures retain only a bounded non-sensitive reason code', () => {
  const cases = [
    ['REVIEW_LAYOUT_OVERFLOW', 'REVIEW_LAYOUT_OVERFLOW'],
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

test('confirmation locator failures use the same bounded non-sensitive taxonomy', () => {
  const cases = [
    ['CONFIRM_LAYOUT_OVERFLOW', 'CONFIRM_LAYOUT_OVERFLOW'],
    ['CONFIRM_TARGET_OUTSIDE_VISUAL_VIEWPORT', 'CONFIRM_TARGET_OUTSIDE_VISUAL_VIEWPORT'],
    ['<nav aria-label="Site header"> from subtree intercepts pointer events', 'CONFIRM_LOCATOR_INTERCEPTED_HEADER'],
    ['<div> from subtree intercepts pointer events private-marker', 'CONFIRM_LOCATOR_INTERCEPTED_CONTENT'],
    ['element is not stable', 'CONFIRM_LOCATOR_UNSTABLE'],
    ['locator resolved, but element was detached from the DOM', 'CONFIRM_LOCATOR_DETACHED'],
    ['element is outside of the viewport', 'CONFIRM_LOCATOR_OUTSIDE_VIEWPORT'],
    ['The page does not support tap because hasTouch is false', 'CONFIRM_LOCATOR_TOUCH_UNAVAILABLE'],
    ['locator.tap: Timeout 10000ms exceeded.', 'CONFIRM_LOCATOR_TIMEOUT'],
    ['unexpected private-marker failure', 'CONFIRM_LOCATOR_ACTIVATION_FAILED'],
  ];
  for (const [message, expected] of cases) {
    const code = classifyConfirmLocatorActivationFailure(new Error(message));
    assert.equal(code, expected);
    assert.doesNotMatch(code, /private-marker|<|>/);
  }
});
