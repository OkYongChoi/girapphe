import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUBLIC_LEADERBOARD_LIMIT,
  buildPublicLeaderboardQuery,
  toPublicLeaderboardParticipantId,
} from './leaderboard';

test('leaderboard participant IDs are stable, distinct, and do not expose Clerk IDs', () => {
  const rawUserId = 'user_2abcDEF123456789';
  const participantId = toPublicLeaderboardParticipantId(rawUserId);

  assert.equal(participantId, toPublicLeaderboardParticipantId(rawUserId));
  assert.notEqual(participantId, toPublicLeaderboardParticipantId('user_other'));
  assert.match(participantId, /^[0-9a-f]{12}$/);
  assert.equal(participantId.includes(rawUserId), false);
});

test('leaderboard query keeps the top limit plus the current actor at the true deterministic rank', () => {
  const currentUserId = 'user_current_outside_top_limit';
  const query = buildPublicLeaderboardQuery(currentUserId);

  assert.deepEqual(query.params, [
    PUBLIC_LEADERBOARD_LIMIT,
    currentUserId,
    PUBLIC_LEADERBOARD_LIMIT + 1,
  ]);
  assert.match(
    query.text,
    /ROW_NUMBER\(\) OVER \([\s\S]*ORDER BY known_count DESC, total_count DESC, user_id ASC[\s\S]*\)/,
  );
  assert.match(query.text, /WHERE leaderboard_rank <= \$1 OR user_id = \$2/);
  assert.match(query.text, /ORDER BY leaderboard_rank ASC/);
  assert.match(query.text, /LIMIT \$3/);
});
