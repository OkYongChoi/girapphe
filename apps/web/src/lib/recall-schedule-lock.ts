export const RECALL_SCHEDULE_LOCK_PREFIX = 'recall-schedule';
export const RECALL_ENROLLMENT_CAPACITY_LOCK_PREFIX = 'recall-enrollment-capacity';
export const MAX_ACTIVE_RECALL_SCHEDULES = 100;

export function recallEnrollmentCapacityLockKey(userId: string): string {
  return `${RECALL_ENROLLMENT_CAPACITY_LOCK_PREFIX}:${userId}`;
}

export function recallScheduleLockKey(userId: string, knowledgeItemId: string): string {
  return `${RECALL_SCHEDULE_LOCK_PREFIX}:${userId}:${knowledgeItemId}`;
}
