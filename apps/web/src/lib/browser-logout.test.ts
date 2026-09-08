import assert from 'node:assert/strict';
import test from 'node:test';
import { completeBrowserLogout } from './browser-logout';

test('browser logout signs out only the current session and keeps the localized destination', async () => {
  const signOutCalls: Array<{ redirectUrl: string; sessionId: string }> = [];
  const redirects: string[] = [];

  await completeBrowserLogout({
    redirectUrl: '/ja',
    sessionId: 'sess_current',
    signOut: async (options) => {
      signOutCalls.push(options);
    },
    redirect: (url) => redirects.push(url),
  });

  assert.deepEqual(signOutCalls, [{ redirectUrl: '/ja', sessionId: 'sess_current' }]);
  assert.deepEqual(redirects, []);
});

test('browser logout redirects stale server UI when Clerk has no browser session', async () => {
  let signOutCalls = 0;
  const redirects: string[] = [];

  await completeBrowserLogout({
    redirectUrl: '/en',
    sessionId: null,
    signOut: async () => {
      signOutCalls += 1;
    },
    redirect: (url) => redirects.push(url),
  });

  assert.equal(signOutCalls, 0);
  assert.deepEqual(redirects, ['/en']);
});
