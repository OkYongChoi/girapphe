import assert from 'node:assert/strict';
import test from 'node:test';
import { localDateTimeToIso } from './local-datetime';

test('converts an Asia/Seoul wall time to the intended UTC instant', () => {
  assert.equal(localDateTimeToIso('2026-08-28T09:30', -540), '2026-08-28T00:30:00.000Z');
});

test('rejects invalid and normalized-away local datetimes', () => {
  assert.throws(() => localDateTimeToIso('2026-02-30T09:30', -540), /Invalid local date and time/);
  assert.throws(() => localDateTimeToIso('2026-08-28T09:30Z', -540), /Invalid local date and time/);
});
