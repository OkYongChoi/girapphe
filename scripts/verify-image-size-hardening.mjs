import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const requireFromMobile = createRequire(resolve('apps/mobile/package.json'));
const imageSize = requireFromMobile('image-size');

function assertRejectedPromptly(name, input) {
  const startedAt = performance.now();
  assert.throws(() => imageSize(input), /Invalid|unsupported|No codestream/);
  assert.ok(
    performance.now() - startedAt < 100,
    `${name} must reject malformed input without blocking the event loop`,
  );
}

const malformedIcns = Buffer.alloc(16);
malformedIcns.write('icns', 0);
malformedIcns.writeUInt32BE(16, 4);
malformedIcns.write('ic07', 8);
// A zero-sized entry caused the ICNS parser's image offset never to advance.
malformedIcns.writeUInt32BE(0, 12);
assertRejectedPromptly('ICNS', malformedIcns);

const malformedJxl = Buffer.alloc(32);
malformedJxl.writeUInt32BE(12, 0);
malformedJxl.write('JXL ', 4);
malformedJxl.writeUInt32BE(12, 12);
malformedJxl.write('ftyp', 16);
malformedJxl.write('jxl ', 20);
// A matching zero-sized jxlp box used to be returned to the caller, which then
// searched again from the same offset forever.
malformedJxl.writeUInt32BE(0, 24);
malformedJxl.write('jxlp', 28);
assertRejectedPromptly('JXL', malformedJxl);

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);
assert.deepEqual(imageSize(png), { width: 1, height: 1, type: 'png' });

console.log('image-size hardening verification passed');
