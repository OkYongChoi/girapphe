#!/usr/bin/env node

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
const checks = [
  { path: '/', expected: 200 },
  { path: '/login', expected: 200 },
  { path: '/signup', expected: 200 },
  { path: '/api/health', expected: 200 },
];

let failed = false;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  try {
    // Public pages may canonicalize to a locale-prefixed path. Follow that
    // redirect so the smoke test verifies the rendered destination and still
    // fails on redirect loops or an unavailable localized page.
    const response = await fetch(url, { redirect: 'follow' });
    const ok = response.status === check.expected;
    const marker = ok ? 'OK' : 'FAIL';
    const destination = new URL(response.url).pathname;
    console.log(`[${marker}] ${check.path} -> ${response.status} (${destination})`);
    if (!ok) failed = true;
  } catch (error) {
    failed = true;
    console.log(`[FAIL] ${check.path} -> request error: ${error instanceof Error ? error.message : 'unknown'}`);
  }
}

if (failed) {
  console.error(`Smoke check failed against ${baseUrl}`);
  process.exit(1);
}

console.log(`Smoke check passed against ${baseUrl}`);
