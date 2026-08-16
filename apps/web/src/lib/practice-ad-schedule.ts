export const PRACTICE_ACTIONS_PER_AD = 5;

export function getPracticeAdSequence(completedActions: number, isAdFree: boolean) {
  if (isAdFree || completedActions < 1 || completedActions % PRACTICE_ACTIONS_PER_AD !== 0) return null;
  return completedActions / PRACTICE_ACTIONS_PER_AD;
}
