import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isTransientMobileApiError,
  MobileApiNetworkError,
  MobileApiRequestError,
} from './mobile-api-errors';

test('network failures are transient while unrelated errors are permanent', () => {
  assert.equal(isTransientMobileApiError(new MobileApiNetworkError('offline')), true);
  assert.equal(isTransientMobileApiError(new Error('invalid local state')), false);
  assert.equal(isTransientMobileApiError(null), false);
});

test('only timeout, too-early, and 5xx request failures are transient', () => {
  for (const status of [408, 425, 500, 503, 599]) {
    assert.equal(
      isTransientMobileApiError(new MobileApiRequestError('retryable', null, status)),
      true,
      String(status),
    );
  }

  for (const status of [0, 400, 401, 403, 404, 409, 413, 422, 429, 499, 600]) {
    assert.equal(
      isTransientMobileApiError(new MobileApiRequestError('permanent', 'CODE', status)),
      false,
      String(status),
    );
  }
});

test('structured request errors preserve their response metadata', () => {
  const error = new MobileApiRequestError('failed', 'NOTE_STALE', 409);

  assert.equal(error.name, 'MobileApiRequestError');
  assert.equal(error.message, 'failed');
  assert.equal(error.code, 'NOTE_STALE');
  assert.equal(error.status, 409);
});
