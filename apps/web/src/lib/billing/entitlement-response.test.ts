import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authenticationRequiredEntitlementResponse,
  readEntitlementResponse,
} from './entitlement-response';

test('returns a no-store entitlement response for an authoritative result', async () => {
  const response = await readEntitlementResponse(async () => false);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('vary'), 'Authorization, Cookie');
  assert.deepEqual(await response.json(), { isAdFree: false });
});

test('returns 503 instead of treating an unavailable entitlement as false', async (context) => {
  const originalConsoleError = console.error;
  context.after(() => { console.error = originalConsoleError; });
  console.error = () => undefined;

  const response = await readEntitlementResponse(async () => {
    throw new Error('database unavailable');
  });

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'entitlement_unavailable' });
});

test('returns 401 without consulting an entitlement reader for unauthenticated requests', async () => {
  const response = authenticationRequiredEntitlementResponse();

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'authentication_required' });
});
