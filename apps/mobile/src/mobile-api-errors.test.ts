import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isTransientMobileApiError,
  MobileApiConfigurationError,
  MobileApiNetworkError,
  MobileApiRequestError,
} from './mobile-api-errors';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const mobileApiSource = readFileSync(join(sourceDir, 'api.ts'), 'utf8');

test('network failures are transient while unrelated errors are permanent', () => {
  assert.equal(isTransientMobileApiError(new MobileApiNetworkError('offline')), true);
  assert.equal(isTransientMobileApiError(new MobileApiConfigurationError('missing URL')), false);
  assert.equal(isTransientMobileApiError(new Error('invalid local state')), false);
  assert.equal(isTransientMobileApiError(null), false);
});

test('configuration resolution stays outside fetch network catches', () => {
  assert.match(mobileApiSource, /function getBaseUrl\(\)[\s\S]*?throw new MobileApiConfigurationError/);

  for (const [startToken, endToken] of [
    ['async function authenticatedFetch', 'async function request<'],
    ['async function publicRequest', 'function withLocale'],
  ]) {
    const start = mobileApiSource.indexOf(startToken);
    const end = mobileApiSource.indexOf(endToken, start);
    assert.notEqual(start, -1, startToken);
    assert.notEqual(end, -1, endToken);
    const body = mobileApiSource.slice(start, end);
    const baseUrl = body.indexOf('const baseUrl = getBaseUrl();');
    const networkTry = body.indexOf('try {', baseUrl);
    assert.notEqual(baseUrl, -1, `${startToken}: base URL`);
    assert.notEqual(networkTry, -1, `${startToken}: network try`);
    assert.ok(baseUrl < networkTry, `${startToken}: configuration before network catch`);
    assert.match(body, /fetch\(`\$\{baseUrl\}\$\{path\}`/);
  }
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
