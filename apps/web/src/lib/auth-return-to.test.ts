import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveAuthReturnTo } from './auth-return-to';

const sourceDir = dirname(fileURLToPath(import.meta.url));

test('auth returnTo accepts only the fixed first-party destinations', () => {
  assert.equal(resolveAuthReturnTo('/practice'), '/practice');
  assert.equal(resolveAuthReturnTo('/subscription'), '/subscription');
  assert.equal(resolveAuthReturnTo('/account/delete'), '/account/delete');
  assert.equal(resolveAuthReturnTo('/account/data-controls-handoff'), '/account/data-controls-handoff');

  for (const value of [
    'https://attacker.invalid/subscription',
    '//attacker.invalid',
    '/subscription?next=https://attacker.invalid',
    '/account/delete#other',
    '/account/delete#knowledge-data',
    '/en/subscription',
    ' /subscription',
  ]) {
    assert.equal(resolveAuthReturnTo(value), '/practice');
  }
  assert.equal(resolveAuthReturnTo(['/subscription', '/account/delete']), '/practice');
  assert.equal(resolveAuthReturnTo(undefined), '/practice');
});

test('login and signup sanitize returnTo before the localized Clerk redirect', () => {
  const authEntrypointSource = readFileSync(join(sourceDir, '../components/auth-entrypoint.tsx'), 'utf8');
  const authSource = readFileSync(join(sourceDir, 'auth.ts'), 'utf8');
  const subscriptionSource = readFileSync(join(sourceDir, '../app/subscription/page.tsx'), 'utf8');
  const accountDeletionSource = readFileSync(join(sourceDir, '../app/account/delete/page.tsx'), 'utf8');
  const loginSource = readFileSync(join(sourceDir, '../app/login/[[...login]]/page.tsx'), 'utf8');
  const signupSource = readFileSync(join(sourceDir, '../app/signup/[[...signup]]/page.tsx'), 'utf8');

  assert.match(authEntrypointSource, /localizePathname\(returnTo, locale\)/);
  assert.match(authEntrypointSource, /forceRedirectUrl=\{redirectHref\}/);
  assert.match(authEntrypointSource, /fallbackRedirectUrl=\{redirectHref\}/);
  assert.match(authEntrypointSource, /signUpForceRedirectUrl=\{redirectHref\}/);
  assert.match(authEntrypointSource, /signInForceRedirectUrl=\{redirectHref\}/);
  for (const source of [loginSource, signupSource]) {
    assert.match(source, /resolveAuthReturnTo\(\(await searchParams\)\.returnTo\)/);
    assert.match(source, /returnTo=\{returnTo\}/);
  }
  assert.match(authSource, /returnTo \? `\$\{loginPath\}\?returnTo=\$\{encodeURIComponent\(returnTo\)\}` : loginPath/);
  assert.match(subscriptionSource, /requireCurrentUser\('\/subscription'\)/);
  assert.match(accountDeletionSource, /requireCurrentUser\('\/account\/delete'\)/);
});
