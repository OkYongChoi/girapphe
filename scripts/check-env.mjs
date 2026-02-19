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
    normalized === '' ||
    normalized === 'changeme' ||
    normalized === 'replace_me' ||
    normalized === 'your_value_here' ||
    normalized === '...'
  );
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
  if (envName === 'prod') {
    if (!databaseUrl) {
      errors.push('Missing required key for prod: DATABASE_URL');
    }
    if (!allowPlaceholders && isPlaceholder(databaseUrl)) {
      errors.push('Key has placeholder/empty value: DATABASE_URL');
    }
  } else if (!databaseUrl) {
    warnings.push('DATABASE_URL is missing in dev (in-memory fallback mode will be used).');
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
    if (envName === 'prod') {
      if (publishable && !publishable.startsWith('pk_live_')) {
        errors.push('Prod must use Clerk live publishable key (pk_live_...).');
      }
      if (secret && !secret.startsWith('sk_live_')) {
        errors.push('Prod must use Clerk live secret key (sk_live_...).');
      }
    } else {
      if (publishable && publishable.startsWith('pk_live_')) {
        warnings.push('Dev is using a live Clerk publishable key. Prefer pk_test_...');
      }
      if (secret && secret.startsWith('sk_live_')) {
        warnings.push('Dev is using a live Clerk secret key. Prefer sk_test_...');
      }
    }
  }

  const appBaseUrl = valueFor(map, 'APP_BASE_URL');
  if (appBaseUrl && !isValidUrl(appBaseUrl)) {
    errors.push(`APP_BASE_URL must be a valid absolute URL: ${appBaseUrl}`);
  }
  if (!allowPlaceholders && envName === 'prod' && appBaseUrl.includes('localhost')) {
    errors.push('Prod APP_BASE_URL cannot be localhost.');
  }

  return { errors, warnings };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.env !== 'dev' && options.env !== 'prod') {
    console.error('Usage: node scripts/check-env.mjs --env <dev|prod> [--file <path>] [--allow-placeholders]');
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
