import { createHash } from 'node:crypto';

export const PUBLIC_LEADERBOARD_LIMIT = 100;

export function buildPublicLeaderboardQuery(currentUserId: string | null): {
  text: string;
  params: [number, string, number];
} {
  return {
    text: `
      WITH aggregated AS (
        SELECT
          user_id,
          COUNT(*) FILTER (
            WHERE knowledge_state = 'known'
              OR (knowledge_state IS NULL AND status = 'known')
          ) AS known_count,
          COUNT(*) AS total_count
        FROM user_card_states
        WHERE user_id NOT LIKE 'guest\\_%' ESCAPE '\\'
        GROUP BY user_id
      ), ranked AS (
        SELECT
          user_id,
          known_count,
          total_count,
          ROW_NUMBER() OVER (
            ORDER BY known_count DESC, total_count DESC, user_id ASC
          ) AS leaderboard_rank
        FROM aggregated
      )
      SELECT user_id, known_count, total_count, leaderboard_rank
      FROM ranked
      WHERE leaderboard_rank <= $1 OR user_id = $2
      ORDER BY leaderboard_rank ASC
      LIMIT $3;
    `,
    params: [
      PUBLIC_LEADERBOARD_LIMIT,
      currentUserId ?? '',
      PUBLIC_LEADERBOARD_LIMIT + 1,
    ],
  };
}

export function toPublicLeaderboardParticipantId(userId: string): string {
  return createHash('sha256')
    .update('girapphe:leaderboard:v1\0')
    .update(userId)
    .digest('hex')
    .slice(0, 12);
}
