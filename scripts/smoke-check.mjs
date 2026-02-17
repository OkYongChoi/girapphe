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
    const response = await fetch(url, { redirect: 'manual' });
    const ok = response.status === check.expected;
    const marker = ok ? 'OK' : 'FAIL';
    console.log(`[${marker}] ${check.path} -> ${response.status}`);
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
