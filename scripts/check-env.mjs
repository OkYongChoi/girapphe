#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = {
    env: null,
    file: null,
    allowPlaceholders: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env') {
      out.env = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === '--file') {
      out.file = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === '--allow-placeholders') {
      out.allowPlaceholders = true;
      continue;
    }
  }

  return out;
}

function parseDotenv(content) {
  const map = new Map();
  const lines = content.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] ?? '';

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    map.set(key, value);
  }

  return map;
}

function getEnvMap(filePath) {
  if (!filePath) {
    return new Map(Object.entries(process.env));
  }

  const absolute = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Missing env file: ${absolute}`);
  }

  const content = fs.readFileSync(absolute, 'utf8');
  return parseDotenv(content);
}

function isPlaceholder(value) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes('...') ||
    /your|example|changeme/.test(normalized) ||
    normalized === '' ||
    normalized === 'changeme' ||
    normalized === 'replace_me' ||
    normalized === 'your_value_here' ||
    normalized === '...'
  );
}

function isValidClerkPublishableKey(value) {
  return /^(pk_test_|pk_live_)[A-Za-z0-9_]+$/.test(value) && value.length > 20 && !isPlaceholder(value);
}

function isValidClerkSecretKey(value) {
  return /^(sk_test_|sk_live_)[A-Za-z0-9_]+$/.test(value) && value.length > 20 && !isPlaceholder(value);
}

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function valueFor(map, key) {
  return (map.get(key) ?? '').trim();
}

function requireKeys(map, keys, allowPlaceholders, errors) {
  for (const key of keys) {
    const value = valueFor(map, key);
    if (!value) {
      errors.push(`Missing required key: ${key}`);
      continue;
    }

    if (!allowPlaceholders && isPlaceholder(value)) {
      errors.push(`Key has placeholder/empty value: ${key}`);
    }
  }
}

function validateCompleteGroup(map, label, keys, allowPlaceholders, errors, warnings, envName) {
  const configured = keys.filter((key) => Boolean(valueFor(map, key)));
  if (configured.length === 0) {
    if (envName === 'prod') warnings.push(`${label} is not configured; its production feature stays disabled.`);
    return false;
  }
  requireKeys(map, keys, allowPlaceholders, errors);
  if (configured.length !== keys.length) {
    errors.push(`${label} must be configured as a complete group.`);
  }
  return configured.length === keys.length;
}

function validate({ envName, map, allowPlaceholders }) {
  const errors = [];
  const warnings = [];

  const requiredCommon = [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
    'APP_BASE_URL',
  ];

  requireKeys(map, requiredCommon, allowPlaceholders, errors);

  const databaseUrl = valueFor(map, 'DATABASE_URL');
  if (envName === 'prod' || envName === 'preview') {
    if (!databaseUrl) {
      errors.push(`Missing required key for ${envName}: DATABASE_URL`);
    }
    if (!allowPlaceholders && isPlaceholder(databaseUrl)) {
      errors.push('Key has placeholder/empty value: DATABASE_URL');
    }
  } else if (!databaseUrl) {
    warnings.push('DATABASE_URL is missing in local development (in-memory fallback mode will be used).');
  } else if (!allowPlaceholders && isPlaceholder(databaseUrl)) {
    errors.push('DATABASE_URL must be omitted for fallback mode or contain a real development connection string.');
  }

  if (envName === 'prod') {
    requireKeys(map, ['ADMIN_CLERK_USER_ID', 'PERSONAL_KNOWLEDGE_PURGE_TOKEN'], allowPlaceholders, errors);
  }

  const signInUrl = valueFor(map, 'NEXT_PUBLIC_CLERK_SIGN_IN_URL');
  const signUpUrl = valueFor(map, 'NEXT_PUBLIC_CLERK_SIGN_UP_URL');
  const afterSignInUrl = valueFor(map, 'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL');
  const afterSignUpUrl = valueFor(map, 'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL');

  for (const [key, value] of [
    ['NEXT_PUBLIC_CLERK_SIGN_IN_URL', signInUrl],
    ['NEXT_PUBLIC_CLERK_SIGN_UP_URL', signUpUrl],
    ['NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL', afterSignInUrl],
    ['NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL', afterSignUpUrl],
  ]) {
    if (value && !value.startsWith('/')) {
      errors.push(`${key} must start with '/': ${value}`);
    }
  }

  const publishable = valueFor(map, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  const secret = valueFor(map, 'CLERK_SECRET_KEY');

  if (!allowPlaceholders) {
    if (!isValidClerkPublishableKey(publishable)) {
      errors.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a valid Clerk pk_test_... or pk_live_... key.');
    }
    if (!isValidClerkSecretKey(secret)) {
      errors.push('CLERK_SECRET_KEY must be a valid Clerk sk_test_... or sk_live_... key.');
    }

    if (envName === 'prod') {
      if (publishable && !publishable.startsWith('pk_live_')) {
        errors.push('Prod must use Clerk live publishable key (pk_live_...).');
      }
      if (secret && !secret.startsWith('sk_live_')) {
        errors.push('Prod must use Clerk live secret key (sk_live_...).');
      }
    } else if (envName === 'preview') {
      if (publishable && !publishable.startsWith('pk_test_')) {
        errors.push('Preview must use a dedicated Clerk test publishable key (pk_test_...).');
      }
      if (secret && !secret.startsWith('sk_test_')) {
        errors.push('Preview must use the matching Clerk test secret key (sk_test_...).');
      }
    } else {
      if (publishable && publishable.startsWith('pk_live_')) {
        warnings.push(`${envName} is using a live Clerk publishable key. Prefer pk_test_...`);
      }
      if (secret && secret.startsWith('sk_live_')) {
        warnings.push(`${envName} is using a live Clerk secret key. Prefer sk_test_...`);
      }
    }
  }

  const appBaseUrl = valueFor(map, 'APP_BASE_URL');
  if (appBaseUrl && !isValidUrl(appBaseUrl)) {
    errors.push(`APP_BASE_URL must be a valid absolute URL: ${appBaseUrl}`);
  }
  if (!allowPlaceholders && appBaseUrl && isValidUrl(appBaseUrl) && envName !== 'dev') {
    const parsedBaseUrl = new URL(appBaseUrl);
    if (parsedBaseUrl.protocol !== 'https:') {
      errors.push(`${envName} APP_BASE_URL must use HTTPS.`);
    }
    if (parsedBaseUrl.username || parsedBaseUrl.password) {
      errors.push(`${envName} APP_BASE_URL cannot contain URL credentials.`);
    }
    if (envName === 'prod' && appBaseUrl !== 'https://www.girapphe.com') {
      errors.push('Prod APP_BASE_URL must be exactly https://www.girapphe.com.');
    }
  }

  const stripeKeys = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_AD_FREE_MONTHLY',
    'STRIPE_PRICE_AD_FREE_ANNUAL',
  ];
  const revenueCatKeys = [
    'REVENUECAT_WEBHOOK_AUTHORIZATION',
    'REVENUECAT_WEBHOOK_SIGNING_SECRET',
    'REVENUECAT_APP_IDS',
    'REVENUECAT_SECRET_API_KEY',
    'REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS',
    'REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS',
  ];
  const adSenseKeys = [
    'NEXT_PUBLIC_ADSENSE_CLIENT_ID',
    'NEXT_PUBLIC_ADSENSE_PRACTICE_SLOT_ID',
    'NEXT_PUBLIC_ADSENSE_CONSENT_READY',
  ];
  const tossKeys = [
    'NEXT_PUBLIC_TOSS_CLIENT_KEY',
    'TOSS_SECRET_KEY',
    'TOSS_BILLING_ENCRYPTION_KEY',
    'TOSS_MONTHLY_AMOUNT_KRW',
    'TOSS_ANNUAL_AMOUNT_KRW',
    'TOSS_BILLING_CRON_TOKEN',
  ];
  const stripeConfigured = validateCompleteGroup(
    map, 'Stripe billing', stripeKeys, allowPlaceholders, errors, warnings, envName,
  );
  const revenueCatConfigured = validateCompleteGroup(
    map, 'RevenueCat entitlement sync', revenueCatKeys, allowPlaceholders, errors, warnings, envName,
  );
  const adSenseConfigured = validateCompleteGroup(
    map, 'AdSense practice ads', adSenseKeys, allowPlaceholders, errors, warnings, envName,
  );
  const tossConfigured = validateCompleteGroup(
    map, 'Toss recurring billing', tossKeys, allowPlaceholders, errors, warnings, envName,
  );
  const tossBillingEnabled = map.get('TOSS_BILLING_ENABLED') ?? '';
  if (tossBillingEnabled && !['true', 'false'].includes(tossBillingEnabled)) {
    errors.push('TOSS_BILLING_ENABLED must be exactly true or false.');
  }
  if (tossBillingEnabled === 'true' && !tossConfigured) {
    errors.push('TOSS_BILLING_ENABLED=true requires the complete Toss recurring billing group.');
  }
  if (tossBillingEnabled === 'true') {
    errors.push('TOSS_BILLING_ENABLED=true is not release-approved; the runtime safety fuse is closed.');
  }
  if (tossBillingEnabled === 'true' && (stripeConfigured || revenueCatConfigured)) {
    errors.push('TOSS_BILLING_ENABLED=true is exclusive; Stripe and RevenueCat server groups must be absent.');
  }
  if (tossConfigured && tossBillingEnabled !== 'true') {
    warnings.push('Toss credentials are configured but TOSS_BILLING_ENABLED is not true; Toss stays disabled.');
  }

  if (!allowPlaceholders && stripeConfigured) {
    const stripeSecret = valueFor(map, 'STRIPE_SECRET_KEY');
    if (!/^sk_(test|live)_/.test(stripeSecret)) errors.push('STRIPE_SECRET_KEY has an invalid format.');
    if (!valueFor(map, 'STRIPE_WEBHOOK_SECRET').startsWith('whsec_')) {
      errors.push('STRIPE_WEBHOOK_SECRET must start with whsec_.');
    }
    for (const key of ['STRIPE_PRICE_AD_FREE_MONTHLY', 'STRIPE_PRICE_AD_FREE_ANNUAL']) {
      if (!valueFor(map, key).startsWith('price_')) errors.push(`${key} must start with price_.`);
    }
    if (valueFor(map, 'STRIPE_PRICE_AD_FREE_MONTHLY') === valueFor(map, 'STRIPE_PRICE_AD_FREE_ANNUAL')) {
      errors.push('Stripe monthly and annual price IDs must be distinct.');
    }
    if (envName === 'prod' && !stripeSecret.startsWith('sk_live_')) {
      errors.push('Prod Stripe billing must use a live secret key.');
    }
    if (envName !== 'prod' && !stripeSecret.startsWith('sk_test_')) {
      errors.push(`${envName} Stripe billing must use a test secret key.`);
    }
  }

  if (!allowPlaceholders && revenueCatConfigured) {
    if (!valueFor(map, 'REVENUECAT_WEBHOOK_AUTHORIZATION').startsWith('Bearer ')) {
      errors.push('REVENUECAT_WEBHOOK_AUTHORIZATION must be the complete Bearer header value.');
    }
    if (valueFor(map, 'REVENUECAT_WEBHOOK_SIGNING_SECRET').length < 32) {
      errors.push('REVENUECAT_WEBHOOK_SIGNING_SECRET must be at least 32 characters.');
    }
    if (!valueFor(map, 'REVENUECAT_SECRET_API_KEY').startsWith('sk_')) {
      errors.push('REVENUECAT_SECRET_API_KEY must be a RevenueCat secret API key starting with sk_.');
    }
    const monthlyProductIds = new Set(valueFor(map, 'REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS').split(',').map((value) => value.trim()).filter(Boolean));
    const annualProductIds = new Set(valueFor(map, 'REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS').split(',').map((value) => value.trim()).filter(Boolean));
    const appIds = new Set(valueFor(map, 'REVENUECAT_APP_IDS').split(',').map((value) => value.trim()).filter(Boolean));
    if (appIds.size < 2) {
      errors.push('REVENUECAT_APP_IDS must contain the distinct iOS and Android RevenueCat app IDs.');
    }
    if ([...monthlyProductIds].some((productId) => annualProductIds.has(productId))) {
      errors.push('RevenueCat monthly and annual store product identifier lists cannot overlap.');
    }
  }

  if (!allowPlaceholders && adSenseConfigured) {
    if (envName !== 'prod') {
      errors.push('AdSense practice ads are production-only; development and PR previews use the house card.');
    }
    if (!/^ca-pub-\d+$/.test(valueFor(map, 'NEXT_PUBLIC_ADSENSE_CLIENT_ID'))) {
      errors.push('NEXT_PUBLIC_ADSENSE_CLIENT_ID must look like ca-pub-<digits>.');
    }
    if (!/^\d+$/.test(valueFor(map, 'NEXT_PUBLIC_ADSENSE_PRACTICE_SLOT_ID'))) {
      errors.push('NEXT_PUBLIC_ADSENSE_PRACTICE_SLOT_ID must contain digits only.');
    }
    if (valueFor(map, 'NEXT_PUBLIC_ADSENSE_CONSENT_READY') !== 'true') {
      errors.push('NEXT_PUBLIC_ADSENSE_CONSENT_READY must be true only after the certified CMP is active.');
    }
  }

  if (!allowPlaceholders && tossConfigured) {
    const clientKey = valueFor(map, 'NEXT_PUBLIC_TOSS_CLIENT_KEY');
    const secretKey = valueFor(map, 'TOSS_SECRET_KEY');
    if (!/^(test|live)_ck_/.test(clientKey)) errors.push('NEXT_PUBLIC_TOSS_CLIENT_KEY has an invalid format.');
    if (!/^(test|live)_sk_/.test(secretKey)) errors.push('TOSS_SECRET_KEY must be a direct API secret key (test_sk_... or live_sk_...).');
    if (clientKey.startsWith('test_') !== secretKey.startsWith('test_')) {
      errors.push('Toss client and secret keys must use the same environment.');
    }
    for (const key of ['TOSS_MONTHLY_AMOUNT_KRW', 'TOSS_ANNUAL_AMOUNT_KRW']) {
      const amount = Number(valueFor(map, key));
      if (!Number.isSafeInteger(amount) || amount <= 0) errors.push(`${key} must be a positive integer.`);
    }
    const encryptionKey = valueFor(map, 'TOSS_BILLING_ENCRYPTION_KEY');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encryptionKey) || Buffer.from(encryptionKey, 'base64').byteLength !== 32) {
      errors.push('TOSS_BILLING_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    }
    if (valueFor(map, 'TOSS_BILLING_CRON_TOKEN').length < 32) {
      errors.push('TOSS_BILLING_CRON_TOKEN must be at least 32 characters.');
    }
    if (valueFor(map, 'TOSS_BILLING_CRON_TOKEN') === encryptionKey) {
      errors.push('Toss billing encryption key and scheduler token must be independent values.');
    }
    if (envName === 'prod' && !clientKey.startsWith('live_')) {
      errors.push('Prod Toss billing must use live keys.');
    }
    if (envName !== 'prod' && !clientKey.startsWith('test_')) {
      errors.push(`${envName} Toss billing must use test keys.`);
    }
  }

  return { errors, warnings };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!['dev', 'preview', 'prod'].includes(options.env)) {
    console.error('Usage: node scripts/check-env.mjs --env <dev|preview|prod> [--file <path>] [--allow-placeholders]');
    process.exit(2);
  }

  let map;
  try {
    map = getEnvMap(options.file);
  } catch (error) {
    console.error(`[ERROR] ${error instanceof Error ? error.message : 'Unable to load env source.'}`);
    process.exit(1);
  }

  const { errors, warnings } = validate({
    envName: options.env,
    map,
    allowPlaceholders: options.allowPlaceholders,
  });

  for (const warning of warnings) {
    console.warn(`[WARN] ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`[ERROR] ${error}`);
    }
    process.exit(1);
  }

  const source = options.file ? path.resolve(process.cwd(), options.file) : 'process.env';
  console.log(`[OK] Environment validation passed (${options.env}, source: ${source})`);
}

main();
