import assert from 'node:assert/strict';
import test from 'node:test';
import { readAnnualPlan } from './checkout-policy';

function request(body: string, contentType = 'application/json') {
  return new Request('https://www.girapphe.com/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });
}

test('web checkout accepts the annual plan and rejects legacy monthly acquisition', async () => {
  assert.deepEqual(await readAnnualPlan(request('{"plan":"annual"}')), {
    ok: true,
    plan: 'annual',
  });
  assert.deepEqual(await readAnnualPlan(request('{"plan":"monthly"}')), {
    ok: false,
    reason: 'monthly',
  });
  assert.deepEqual(await readAnnualPlan(request('plan=monthly', 'application/x-www-form-urlencoded')), {
    ok: false,
    reason: 'monthly',
  });
});

test('web checkout rejects client-controlled fields and oversized payloads', async () => {
  assert.deepEqual(await readAnnualPlan(request('{"plan":"annual","price":1}')), {
    ok: false,
    reason: 'invalid',
  });
  assert.deepEqual(await readAnnualPlan(request(JSON.stringify({ plan: 'annual', padding: 'x'.repeat(5_000) }))), {
    ok: false,
    reason: 'too_large',
  });
});
