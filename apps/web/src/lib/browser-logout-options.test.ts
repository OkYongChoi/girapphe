import assert from 'node:assert/strict';
import test from 'node:test';
import { browserLogoutOptions } from './browser-logout-options';

test('browser logout keeps the current session scope and localized destination', () => {
  assert.deepEqual(browserLogoutOptions('/ja', 'sess_current'), {
    redirectUrl: '/ja',
    sessionId: 'sess_current',
  });
});

test('browser logout can still clear stale client state when the session id is unavailable', () => {
  assert.deepEqual(browserLogoutOptions('/en', null), { redirectUrl: '/en' });
});
