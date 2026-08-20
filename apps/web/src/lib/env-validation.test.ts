import assert from 'node:assert/strict';
import test from 'node:test';
import { validate } from '../../../../scripts/check-env-core.mjs';

function clerkKey(prefix: 'pk_test_' | 'pk_live_' | 'sk_test_' | 'sk_live_') {
  return `${prefix}${'a'.repeat(24)}`;
}

function baseEnv(overrides = {}) {
  return new Map(Object.entries({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey('pk_test_'),
    CLERK_SECRET_KEY: clerkKey('sk_test_'),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/login',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/signup',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: '/practice',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: '/practice',
    APP_BASE_URL: 'http://localhost:3000',
    ...overrides,
  }));
}

test('development env can omit DATABASE_URL and use fallback mode', () => {
  const result = validate({
    envName: 'dev',
    map: baseEnv(),
    allowPlaceholders: false,
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, [
    'DATABASE_URL is missing in local development (in-memory fallback mode will be used).',
  ]);
});

test('development warns when live Clerk keys are used locally', () => {
  const result = validate({
    envName: 'dev',
    map: baseEnv({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey('pk_live_'),
      CLERK_SECRET_KEY: clerkKey('sk_live_'),
    }),
    allowPlaceholders: false,
  });

  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join('\n'), /Prefer pk_test_/);
  assert.match(result.warnings.join('\n'), /Prefer sk_test_/);
});

test('preview rejects live Clerk keys, plain HTTP, and a missing database URL', () => {
  const result = validate({
    envName: 'preview',
    map: baseEnv({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey('pk_live_'),
      CLERK_SECRET_KEY: clerkKey('sk_live_'),
      APP_BASE_URL: 'http://preview.girapphe.com',
    }),
    allowPlaceholders: false,
  });

  assert.match(result.errors.join('\n'), /Missing required key for preview: DATABASE_URL/);
  assert.match(result.errors.join('\n'), /Preview must use a dedicated Clerk test publishable key/);
  assert.match(result.errors.join('\n'), /Preview must use the matching Clerk test secret key/);
  assert.match(result.errors.join('\n'), /preview APP_BASE_URL must use HTTPS/);
});

test('production requires live Clerk keys, canonical URL, and admin cleanup settings', () => {
  const result = validate({
    envName: 'prod',
    map: baseEnv({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey('pk_live_'),
      CLERK_SECRET_KEY: clerkKey('sk_live_'),
      APP_BASE_URL: 'https://www.girapphe.com',
      DATABASE_URL: 'postgres://user:password@host/prod_db?sslmode=require',
      ADMIN_CLERK_USER_ID: 'user_123',
      PERSONAL_KNOWLEDGE_PURGE_TOKEN: 'x'.repeat(32),
    }),
    allowPlaceholders: false,
  });

  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join('\n'), /Stripe billing is not configured; its production feature stays disabled/);
  assert.match(result.warnings.join('\n'), /RevenueCat entitlement sync is not configured; its production feature stays disabled/);
  assert.match(result.warnings.join('\n'), /AdSense practice ads is not configured; its production feature stays disabled/);
  assert.match(result.warnings.join('\n'), /Toss recurring billing is not configured; its production feature stays disabled/);
});

test('billing groups must be complete and Toss remains fuse-closed', () => {
  const result = validate({
    envName: 'prod',
    map: baseEnv({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey('pk_live_'),
      CLERK_SECRET_KEY: clerkKey('sk_live_'),
      APP_BASE_URL: 'https://www.girapphe.com',
      DATABASE_URL: 'postgres://user:password@host/prod_db?sslmode=require',
      ADMIN_CLERK_USER_ID: 'user_123',
      PERSONAL_KNOWLEDGE_PURGE_TOKEN: 'x'.repeat(32),
      STRIPE_SECRET_KEY: 'sk_live_partial_only',
      TOSS_BILLING_ENABLED: 'true',
    }),
    allowPlaceholders: false,
  });

  assert.match(result.errors.join('\n'), /Stripe billing must be configured as a complete group/);
  assert.match(result.errors.join('\n'), /Missing required key: STRIPE_WEBHOOK_SECRET/);
  assert.match(result.errors.join('\n'), /TOSS_BILLING_ENABLED=true requires the complete Toss recurring billing group/);
  assert.match(result.errors.join('\n'), /TOSS_BILLING_ENABLED=true is not release-approved; the runtime safety fuse is closed/);
});
