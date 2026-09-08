import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifyRawBodyHmacSha256, verifyTimestampedHmac } from './hmac';

test('verifies Creem documented raw-body HMAC without inventing a timestamp envelope', () => {
  const secret = 'creem_test_signing_secret';
  const rawBody = '{"id":"evt_1","eventType":"subscription.paid"}';
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');

  assert.equal(verifyRawBodyHmacSha256(rawBody, signature, secret), true);
  assert.equal(verifyRawBodyHmacSha256(`${rawBody}\n`, signature, secret), false);
  assert.equal(verifyRawBodyHmacSha256(rawBody, `sha256=${signature}`, secret), false);
});

test('keeps the timestamped Stripe legacy signature isolated from Creem verification', () => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secret = 'stripe_legacy_signing_secret';
  const rawBody = '{"id":"evt_legacy"}';
  const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  assert.equal(verifyTimestampedHmac(rawBody, `t=${timestamp},v1=${signature}`, secret), true);
  assert.equal(verifyRawBodyHmacSha256(rawBody, `t=${timestamp},v1=${signature}`, secret), false);
});
