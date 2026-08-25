import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicLeaderboardParticipantId } from './leaderboard';

test('leaderboard participant IDs are stable, distinct, and do not expose Clerk IDs', () => {
  const rawUserId = 'user_2abcDEF123456789';
  const participantId = toPublicLeaderboardParticipantId(rawUserId);

  assert.equal(participantId, toPublicLeaderboardParticipantId(rawUserId));
  assert.notEqual(participantId, toPublicLeaderboardParticipantId('user_other'));
  assert.match(participantId, /^[0-9a-f]{12}$/);
  assert.equal(participantId.includes(rawUserId), false);
});
