import assert from 'node:assert/strict';
import test from 'node:test';
import { Webhook } from 'svix';
import { verifySuperwallSignature } from './superwall-signature';

test('verifies the exact Superwall Svix body and rejects invalid signatures', () => {
  const secret = `whsec_${Buffer.from('girapphe-superwall-test-secret-32').toString('base64')}`;
  const rawBody = '{"type":"renewal","data":{"id":"event_one"}}';
  const messageId = 'msg_test_01';
  const timestamp = new Date();
  const signature = new Webhook(secret).sign(messageId, timestamp, rawBody);
  const headers = {
    'svix-id': messageId,
    'svix-timestamp': Math.floor(timestamp.getTime() / 1_000).toString(),
    'svix-signature': signature,
  };

  assert.equal(verifySuperwallSignature(rawBody, headers, secret), true);
  assert.equal(verifySuperwallSignature(`${rawBody}\n`, headers, secret), false);
  assert.equal(verifySuperwallSignature(rawBody, {
    ...headers,
    'svix-signature': 'v1,invalid',
  }, secret), false);
});
