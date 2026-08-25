import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isServerIssuedGuestId } from './guest';
import {
  GUEST_KNOWLEDGE_ITEM_LIMIT,
  GUEST_KNOWLEDGE_RETENTION_DAYS,
  GUEST_KNOWLEDGE_WRITES_PER_HOUR,
  getGuestKnowledgeRateScope,
  normalizeKnowledgeRequestId,
} from './guest-knowledge-admission';

test('accepts only server-shaped UUID v4 guest identifiers', () => {
  assert.equal(isServerIssuedGuestId('guest_123e4567-e89b-42d3-a456-426614174000'), true);
  assert.equal(isServerIssuedGuestId('guest_attacker-controlled'), false);
  assert.equal(isServerIssuedGuestId(`guest_${'a'.repeat(5000)}`), false);
});

test('guest write rate scope follows the Cloudflare client IP instead of a rotatable cookie', () => {
  const first = getGuestKnowledgeRateScope('guest_first', '203.0.113.9');
  const rotated = getGuestKnowledgeRateScope('guest_second', '203.0.113.9');
  const otherIp = getGuestKnowledgeRateScope('guest_first', '203.0.113.10');

  assert.equal(first, rotated);
  assert.notEqual(first, otherIp);
  assert.equal(first.includes('203.0.113.9'), false);
});

test('guest knowledge admission bounds identifiers, writes, rows, and retention', () => {
  assert.equal(normalizeKnowledgeRequestId(' request-1 '), 'request-1');
  assert.throws(() => normalizeKnowledgeRequestId('x'.repeat(161)), /knowledge_request_id_too_long/);
  assert.equal(GUEST_KNOWLEDGE_WRITES_PER_HOUR, 20);
  assert.equal(GUEST_KNOWLEDGE_ITEM_LIMIT, 100);
  assert.equal(GUEST_KNOWLEDGE_RETENTION_DAYS, 90);

  const source = readFileSync(new URL('../actions/user-knowledge-actions.ts', import.meta.url), 'utf8');
  assert.match(source, /guest_knowledge_write_limits/);
  assert.match(source, /request_count < \$2/);
  assert.match(source, /GUEST_KNOWLEDGE_ITEM_LIMIT/);
  assert.match(source, /GUEST_KNOWLEDGE_RETENTION_DAYS/);
  assert.match(source, /cf-connecting-ip/);
  assert.match(source, /pool\.transaction<\{ id: string \}>/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext\(\$1\)\)/);
  assert.match(source, /guest-knowledge:\$\{user\.id\}/);

  const purgeSource = readFileSync(new URL('./personal-knowledge.ts', import.meta.url), 'utf8');
  assert.match(purgeSource, /DELETE FROM user_knowledge_create_requests/);
  assert.match(purgeSource, /DELETE FROM guest_knowledge_write_limits/);
});
