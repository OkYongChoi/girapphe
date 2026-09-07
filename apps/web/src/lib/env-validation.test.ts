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
  assert.match(result.warnings.join('\n'), /Creem lifecycle processing is not configured; its production feature stays disabled/);
  assert.match(result.warnings.join('\n'), /Superwall lifecycle processing is not configured; its production feature stays disabled/);
  assert.match(result.warnings.join('\n'), /AdSense practice ads is not configured; its production feature stays disabled/);
  assert.match(result.warnings.join('\n'), /Cloudflare operations dashboard is not configured; its production feature stays disabled/);
  assert.match(result.warnings.join('\n'), /Neon control-plane dashboard is not configured; its production feature stays disabled/);
});

test('acquisition gates require complete lifecycle groups', () => {
  const result = validate({
    envName: 'prod',
    map: baseEnv({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey('pk_live_'),
      CLERK_SECRET_KEY: clerkKey('sk_live_'),
      APP_BASE_URL: 'https://www.girapphe.com',
      DATABASE_URL: 'postgres://user:password@host/prod_db?sslmode=require',
      ADMIN_CLERK_USER_ID: 'user_123',
      PERSONAL_KNOWLEDGE_PURGE_TOKEN: 'x'.repeat(32),
      CREEM_API_KEY: 'creem_partial_only',
      WEB_BILLING_ACQUISITION_ENABLED: 'true',
      MOBILE_BILLING_ACQUISITION_ENABLED: 'true',
    }),
    allowPlaceholders: false,
  });

  assert.match(result.errors.join('\n'), /Creem lifecycle processing must be configured as a complete group/);
  assert.match(result.errors.join('\n'), /Missing required key: CREEM_WEBHOOK_SECRET/);
  assert.match(result.errors.join('\n'), /WEB_BILLING_ACQUISITION_ENABLED=true requires its complete provider lifecycle group/);
  assert.match(result.errors.join('\n'), /MOBILE_BILLING_ACQUISITION_ENABLED=true requires its complete provider lifecycle group/);
});

test('lifecycle processing remains configurable while acquisition is disabled', () => {
  const result = validate({
    envName: 'preview',
    map: baseEnv({
      APP_BASE_URL: 'https://preview.girapphe.test',
      DATABASE_URL: 'postgres://user:password@host/preview_db?sslmode=require',
      CREEM_API_KEY: 'creem_test_key',
      CREEM_WEBHOOK_SECRET: 'creem_webhook_secret',
      CREEM_ANNUAL_PRODUCT_ID: 'creem_annual_product',
      CREEM_ENVIRONMENT: 'test',
      WEB_BILLING_ACQUISITION_ENABLED: 'false',
      SUPERWALL_ORGANIZATION_API_KEY: 'superwall_test_key',
      SUPERWALL_WEBHOOK_SECRET: `whsec_${'a'.repeat(32)}`,
      SUPERWALL_PROJECT_ID: '101',
      SUPERWALL_ENVIRONMENT: 'test',
      SUPERWALL_IOS_APPLICATION_ID: '201',
      SUPERWALL_ANDROID_APPLICATION_ID: '202',
      SUPERWALL_IOS_BUNDLE_ID: 'com.girapphe.app',
      SUPERWALL_ANDROID_PACKAGE_ID: 'com.girapphe.app',
      SUPERWALL_IOS_MONTHLY_PRODUCT_ID: 'ios_monthly',
      SUPERWALL_IOS_ANNUAL_PRODUCT_ID: 'ios_annual',
      SUPERWALL_ANDROID_MONTHLY_PRODUCT_ID: 'android_monthly',
      SUPERWALL_ANDROID_ANNUAL_PRODUCT_ID: 'android_annual',
      MOBILE_BILLING_ACQUISITION_ENABLED: 'false',
    }),
    allowPlaceholders: false,
  });

  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join('\n'), /new web acquisition stays disabled/);
  assert.match(result.warnings.join('\n'), /new mobile acquisition stays disabled/);
});

test('legacy lifecycle bridges must be complete and may coexist without reopening acquisition', () => {
  const partialStripe = validate({
    envName: 'prod',
    map: baseEnv({
      APP_BASE_URL: 'https://www.girapphe.com',
      DATABASE_URL: 'postgres://user:password@host/prod_db?sslmode=require',
      ADMIN_CLERK_USER_ID: 'user_123',
      PERSONAL_KNOWLEDGE_PURGE_TOKEN: 'x'.repeat(32),
      STRIPE_SECRET_KEY: 'sk_live_legacy',
    }),
    allowPlaceholders: false,
  });
  assert.match(partialStripe.errors.join('\n'), /Legacy Stripe lifecycle bridge must be configured as a complete group/);

  const nonExactTossGate = validate({
    envName: 'prod',
    map: baseEnv({
      APP_BASE_URL: 'https://www.girapphe.com',
      DATABASE_URL: 'postgres://user:password@host/prod_db?sslmode=require',
      ADMIN_CLERK_USER_ID: 'user_123',
      PERSONAL_KNOWLEDGE_PURGE_TOKEN: 'x'.repeat(32),
      TOSS_BILLING_ENABLED: ' true ',
    }),
    allowPlaceholders: false,
  });
  assert.match(nonExactTossGate.errors.join('\n'), /TOSS_BILLING_ENABLED must be exactly true or false/);

  const tossEnabled = validate({
    envName: 'prod',
    map: baseEnv({
      APP_BASE_URL: 'https://www.girapphe.com',
      DATABASE_URL: 'postgres://user:password@host/prod_db?sslmode=require',
      ADMIN_CLERK_USER_ID: 'user_123',
      PERSONAL_KNOWLEDGE_PURGE_TOKEN: 'x'.repeat(32),
      TOSS_BILLING_ENABLED: 'true',
      NEXT_PUBLIC_TOSS_CLIENT_KEY: 'live_ck_partial',
    }),
    allowPlaceholders: false,
  });
  assert.match(tossEnabled.errors.join('\n'), /Legacy Toss recovery bridge must be configured as a complete group/);
  assert.match(tossEnabled.errors.join('\n'), /TOSS_BILLING_ENABLED=true requires the complete legacy Toss recovery group/);

  const coexistingLifecycle = validate({
    envName: 'prod',
    map: baseEnv({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey('pk_live_'),
      CLERK_SECRET_KEY: clerkKey('sk_live_'),
      APP_BASE_URL: 'https://www.girapphe.com',
      DATABASE_URL: 'postgres://user:password@host/prod_db?sslmode=require',
      ADMIN_CLERK_USER_ID: 'user_123',
      PERSONAL_KNOWLEDGE_PURGE_TOKEN: 'x'.repeat(32),
      STRIPE_SECRET_KEY: `sk_live_${'s'.repeat(24)}`,
      STRIPE_WEBHOOK_SECRET: `whsec_${'s'.repeat(32)}`,
      STRIPE_PRICE_AD_FREE_MONTHLY: 'price_monthly',
      STRIPE_PRICE_AD_FREE_ANNUAL: 'price_annual',
      REVENUECAT_WEBHOOK_AUTHORIZATION: `Bearer ${'r'.repeat(32)}`,
      REVENUECAT_WEBHOOK_SIGNING_SECRET: 'r'.repeat(32),
      REVENUECAT_APP_IDS: 'app_ios,app_android',
      REVENUECAT_SECRET_API_KEY: `sk_${'r'.repeat(24)}`,
      REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS: 'ios.monthly,android.monthly',
      REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS: 'ios.annual,android.annual',
      TOSS_BILLING_ENABLED: 'true',
      NEXT_PUBLIC_TOSS_CLIENT_KEY: `live_ck_${'t'.repeat(24)}`,
      TOSS_SECRET_KEY: `live_sk_${'t'.repeat(24)}`,
      TOSS_BILLING_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      TOSS_MONTHLY_AMOUNT_KRW: '1400',
      TOSS_ANNUAL_AMOUNT_KRW: '14000',
      TOSS_BILLING_CRON_TOKEN: 't'.repeat(32),
    }),
    allowPlaceholders: false,
  });
  assert.deepEqual(coexistingLifecycle.errors, []);
  assert.match(
    coexistingLifecycle.warnings.join('\n'),
    /Legacy Toss lifecycle\/recovery processing is enabled; new Toss acquisition remains unavailable/,
  );
});

test('capacity dashboard provider groups activate only with their control-plane tokens', () => {
  const dormant = validate({
    envName: 'prod',
    map: baseEnv({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey('pk_live_'),
      CLERK_SECRET_KEY: clerkKey('sk_live_'),
      APP_BASE_URL: 'https://www.girapphe.com',
      DATABASE_URL: 'postgres://user:password@host/prod_db?sslmode=require',
      ADMIN_CLERK_USER_ID: 'user_123',
      PERSONAL_KNOWLEDGE_PURGE_TOKEN: 'x'.repeat(32),
      CLOUDFLARE_ACCOUNT_ID: 'account_123',
    }),
    allowPlaceholders: false,
  });

  assert.doesNotMatch(dormant.errors.join('\n'), /Cloudflare operations dashboard must be configured as a complete group/);
  assert.match(dormant.warnings.join('\n'), /Cloudflare operations dashboard is not configured/);

  const activated = validate({
    envName: 'prod',
    map: baseEnv({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey('pk_live_'),
      CLERK_SECRET_KEY: clerkKey('sk_live_'),
      APP_BASE_URL: 'https://www.girapphe.com',
      DATABASE_URL: 'postgres://user:password@host/prod_db?sslmode=require',
      ADMIN_CLERK_USER_ID: 'user_123',
      PERSONAL_KNOWLEDGE_PURGE_TOKEN: 'x'.repeat(32),
      CLOUDFLARE_ANALYTICS_API_TOKEN: 'analytics_partial',
      NEON_API_KEY: 'napi_partial',
    }),
    allowPlaceholders: false,
  });

  const errors = activated.errors.join('\n');
  assert.match(errors, /Cloudflare operations dashboard must be configured as a complete group/);
  assert.match(errors, /Missing required key: CLOUDFLARE_ACCOUNT_ID/);
  assert.match(errors, /Neon control-plane dashboard must be configured as a complete group/);
  assert.match(errors, /Missing required key: NEON_PROJECT_ID/);
});
