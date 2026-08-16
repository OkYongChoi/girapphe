import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifyTimestampedHmac } from './hmac';

test('verifies a current raw-body HMAC and rejects body mutation', () => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secret = 'test_signing_secret';
  const rawBody = '{"event":{"id":"evt_1"}}';
  const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(verifyTimestampedHmac(rawBody, header, secret), true);
  assert.equal(verifyTimestampedHmac(`${rawBody}\n`, header, secret), false);
});

test('rejects signatures outside the replay tolerance', () => {
  const timestamp = (Math.floor(Date.now() / 1000) - 301).toString();
  const secret = 'test_signing_secret';
  const rawBody = '{}';
  const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  assert.equal(verifyTimestampedHmac(rawBody, `t=${timestamp},v1=${signature}`, secret), false);
});
