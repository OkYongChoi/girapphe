import assert from 'node:assert/strict';
import test from 'node:test';

const imported = await import('../src/lib/ai-thinking-history-rollout.ts');
const { isAiThinkingHistoryEnabledForUser } = imported.default ?? imported;

test('fails closed by default in production and remains available in local development', () => {
  assert.equal(isAiThinkingHistoryEnabledForUser('user_1', { NODE_ENV: 'production' }), false);
  assert.equal(isAiThinkingHistoryEnabledForUser('user_1', { NODE_ENV: 'development' }), true);
});

test('supports an exact account allowlist without substring matches', () => {
  const environment = {
    NODE_ENV: 'production',
    AI_THINKING_HISTORY_ROLLOUT: 'allowlist',
    AI_THINKING_HISTORY_USER_IDS: 'user_alpha, user_beta',
  };
  assert.equal(isAiThinkingHistoryEnabledForUser('user_alpha', environment), true);
  assert.equal(isAiThinkingHistoryEnabledForUser('user_al', environment), false);
  assert.equal(isAiThinkingHistoryEnabledForUser('', environment), false);
});

test('supports explicit all and off rollback modes', () => {
  assert.equal(isAiThinkingHistoryEnabledForUser('user_1', { AI_THINKING_HISTORY_ROLLOUT: 'all' }), true);
  assert.equal(isAiThinkingHistoryEnabledForUser('user_1', { AI_THINKING_HISTORY_ROLLOUT: 'off' }), false);
});
