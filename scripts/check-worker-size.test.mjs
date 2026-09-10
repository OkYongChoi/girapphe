import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertClerkLocalizationsExcluded,
  parseUncompressedWorkerSizeKiB,
} from './check-worker-size.mjs';

test('reads the uncompressed upload size instead of Wrangler gzip reference data', () => {
  assert.equal(
    parseUncompressedWorkerSizeKiB('Total Upload: 11820.83 KiB / gzip: 3052.31 KiB'),
    11820.83,
  );
});

test('rejects output without a finite uncompressed upload size', () => {
  assert.throws(
    () => parseUncompressedWorkerSizeKiB('Total Upload unavailable / gzip: 3052.31 KiB'),
    /Unable to read the uncompressed Worker size/,
  );
});

test('rejects Clerk localization dictionaries in Worker metadata', () => {
  assert.throws(
    () => assertClerkLocalizationsExcluded(JSON.stringify({
      inputs: {
        '.next/server/chunks/ssr/pkg_@clerk_localizations_dist_en-US.js': {},
      },
    })),
    /must be served as static assets/u,
  );
});

test('allows the public Clerk localization asset path', () => {
  assert.doesNotThrow(() => assertClerkLocalizationsExcluded(JSON.stringify({
    assets: ['/localization/clerk/en.json'],
  })));
});
