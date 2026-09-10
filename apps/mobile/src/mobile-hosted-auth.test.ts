import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { catalogs } from './i18n/catalogs';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const signInSource = readFileSync(join(sourceDir, '../app/sign-in.tsx'), 'utf8');
const packageJson = JSON.parse(
  readFileSync(join(sourceDir, '../package.json'), 'utf8'),
) as { dependencies?: Record<string, string> };

test('configured mobile auth exposes Clerk hosted sign-in and preserves the native continuation', () => {
  assert.match(signInSource, /useHostedAuth/);
  assert.match(signInSource, /mode: mode === 'signIn' \? 'sign-in' : 'sign-up'/);
  assert.match(signInSource, /redirectUrl: ExpoLinking\.createURL\('hosted-auth-callback'\)/);
  assert.doesNotMatch(signInSource, /redirectUrl:\s*['"]https?:\/\//);
  assert.match(signInSource, /if \(result\.createdSessionId\) navigateAfterAuthentication\(\)/);
  assert.match(signInSource, /accessibilityRole="button"[\s\S]*?onPress=\{\(\) => void submitHostedAuth\(\)\}/);
  assert.match(signInSource, /hostedAuthButton: \{ minHeight: 52/);
});

test('hosted auth runtime dependencies and every supported locale are present', () => {
  for (const dependency of ['expo-auth-session', 'expo-crypto', 'expo-web-browser']) {
    assert.equal(typeof packageJson.dependencies?.[dependency], 'string', dependency);
  }

  for (const [locale, catalog] of Object.entries(catalogs)) {
    for (const key of ['auth.hostedSignIn', 'auth.hostedSignUp', 'auth.orUseEmail'] as const) {
      assert.ok(catalog[key].trim(), `${locale} provides ${key}`);
    }
  }
});
