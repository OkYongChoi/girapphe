import { createHash } from 'node:crypto';

export function toPublicLeaderboardParticipantId(userId: string): string {
  return createHash('sha256')
    .update('girapphe:leaderboard:v1\0')
    .update(userId)
    .digest('hex')
    .slice(0, 12);
}
