export const RECALL_SCHEDULE_LOCK_PREFIX = 'recall-schedule';

export function recallScheduleLockKey(userId: string, knowledgeItemId: string): string {
  return `${RECALL_SCHEDULE_LOCK_PREFIX}:${userId}:${knowledgeItemId}`;
}
