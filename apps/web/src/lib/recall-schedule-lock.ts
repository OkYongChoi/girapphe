export function recallScheduleLockKey(userId: string, knowledgeItemId: string): string {
  return `recall-schedule:${userId}:${knowledgeItemId}`;
}
