'use server';

import { RECALL_D1_OPEN_MS } from '@stem-brain/shared';
import { revalidatePath } from 'next/cache';
import { requireCurrentUser } from '@/lib/auth';
import {
  parseRecallAttemptActionInput,
  parseRecallCancelActionInput,
  parseRecallCompleteActionInput,
  parseRecallConfidenceActionInput,
  parseRecallEnrollActionInput,
  parseRecallStartActionInput,
} from '@/lib/recall-action-input';
import {
  completeRecallAttemptForUser,
  revealRecallAttemptForUser,
  setRecallAttemptConfidenceForUser,
  startOrResumeRecallAttemptForUser,
} from '@/lib/recall-attempts';
import {
  cancelRecallScheduleForItem,
  enrollApprovedRecallScheduleForUser,
} from '@/lib/recall-persistence';
import {
  getManualRecallPreRevealSessionForUser,
  getManualRecallRevealedSessionForUser,
  getManualRecallSessionForAttempt,
  reconcileActiveRecallSchedulesForUser,
  resolveManualRecallNextDeliveryAt,
  type ManualRecallPreRevealSession,
  type ManualRecallRevealedSession,
  type ManualRecallSession,
} from '@/lib/recall-runtime';
import { isRecallRuntimeEnrollmentEnabledForUser } from '@/lib/recall-runtime-rollout';

export type RecallEnrollmentActionResult = {
  kind:
    | 'enrolled'
    | 'unchanged'
    | 'capacity_reached'
    | 'disabled'
    | 'ineligible'
    | 'not_available';
};

export type RecallStartActionResult = {
  kind: 'started' | 'resumed' | 'not_available';
  session: ManualRecallSession | null;
};

export type RecallConfidenceActionResult = {
  kind: 'selected' | 'unchanged' | 'locked' | 'invalidated' | 'not_available';
  session: ManualRecallPreRevealSession | ManualRecallRevealedSession | null;
};

export type RecallRevealActionResult = {
  kind: 'revealed' | 'unchanged' | 'confidence_required' | 'invalidated' | 'not_available';
  session: ManualRecallRevealedSession | null;
};

export type RecallCompletionActionResult = {
  kind:
    | 'completed'
    | 'unchanged'
    | 'confidence_required'
    | 'reveal_required'
    | 'invalidated'
    | 'conflict'
    | 'not_available';
  resultingDueAt: string | null;
};

export type RecallCancellationActionResult = {
  kind: 'cancelled' | 'unchanged' | 'conflict' | 'not_available';
  retainedPractice: boolean;
};

function recallDatabaseAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function revalidateRecallSurfaces(): void {
  revalidatePath('/recall');
  revalidatePath('/practice');
}

export async function enrollManualRecall(
  inputValue: unknown,
): Promise<RecallEnrollmentActionResult> {
  const user = await requireCurrentUser();
  const input = parseRecallEnrollActionInput(inputValue);
  if (!isRecallRuntimeEnrollmentEnabledForUser(user.id)) return { kind: 'disabled' };
  if (!recallDatabaseAvailable()) return { kind: 'not_available' };

  const enrolledAt = new Date();
  const firstDeliveryAt = new Date(enrolledAt.getTime() + RECALL_D1_OPEN_MS);
  const result = await enrollApprovedRecallScheduleForUser(
    user.id,
    input.knowledgeItemId,
    input.itemVersion,
    enrolledAt,
    firstDeliveryAt,
  );
  revalidateRecallSurfaces();
  return { kind: result.kind };
}

export async function startManualRecall(
  inputValue: unknown,
): Promise<RecallStartActionResult> {
  const user = await requireCurrentUser();
  const input = parseRecallStartActionInput(inputValue);
  if (!recallDatabaseAvailable()) return { kind: 'not_available', session: null };

  await reconcileActiveRecallSchedulesForUser(user.id);
  const result = await startOrResumeRecallAttemptForUser(user.id, input.knowledgeItemId);
  if (!result.attempt) return { kind: 'not_available', session: null };
  const session = await getManualRecallSessionForAttempt(user.id, result.attempt);
  return session ? { kind: result.kind, session } : { kind: 'not_available', session: null };
}

export async function selectManualRecallConfidence(
  inputValue: unknown,
): Promise<RecallConfidenceActionResult> {
  const user = await requireCurrentUser();
  const input = parseRecallConfidenceActionInput(inputValue);
  if (!recallDatabaseAvailable()) return { kind: 'not_available', session: null };

  const result = await setRecallAttemptConfidenceForUser(
    user.id,
    input.attemptId,
    input.confidence,
  );
  if (result.attempt) {
    const session = await getManualRecallPreRevealSessionForUser(user.id, result.attempt.id);
    return session ? { kind: result.kind, session } : { kind: 'not_available', session: null };
  }
  if (result.kind === 'locked') {
    const session = await getManualRecallRevealedSessionForUser(user.id, input.attemptId);
    return session ? { kind: 'locked', session } : { kind: 'not_available', session: null };
  }
  return { kind: result.kind, session: null };
}

export async function revealManualRecall(
  inputValue: unknown,
): Promise<RecallRevealActionResult> {
  const user = await requireCurrentUser();
  const input = parseRecallAttemptActionInput(inputValue);
  if (!recallDatabaseAvailable()) return { kind: 'not_available', session: null };

  const result = await revealRecallAttemptForUser(user.id, input.attemptId);
  if (!result.attempt) return { kind: result.kind, session: null };
  const session = await getManualRecallRevealedSessionForUser(user.id, result.attempt.id);
  return session ? { kind: result.kind, session } : { kind: 'not_available', session: null };
}

export async function completeManualRecall(
  inputValue: unknown,
): Promise<RecallCompletionActionResult> {
  const user = await requireCurrentUser();
  const input = parseRecallCompleteActionInput(inputValue);
  if (!recallDatabaseAvailable()) return { kind: 'not_available', resultingDueAt: null };

  const result = await completeRecallAttemptForUser(
    user.id,
    input.attemptId,
    { outcome: input.outcome, hintUsed: false },
    resolveManualRecallNextDeliveryAt,
  );
  revalidateRecallSurfaces();
  return {
    kind: result.kind,
    resultingDueAt: result.attempt?.resultingDueAt ?? null,
  };
}

export async function cancelManualRecall(
  inputValue: unknown,
): Promise<RecallCancellationActionResult> {
  const user = await requireCurrentUser();
  const input = parseRecallCancelActionInput(inputValue);
  if (!recallDatabaseAvailable()) {
    return { kind: 'not_available', retainedPractice: false };
  }

  const result = await cancelRecallScheduleForItem(
    user.id,
    input.knowledgeItemId,
    {
      itemVersion: input.itemVersion,
      scheduleVersion: input.scheduleVersion,
      enrolledAt: input.enrolledAt,
    },
  );
  revalidateRecallSurfaces();
  return result.kind === 'not_found'
    ? { kind: 'not_available', retainedPractice: false }
    : result.kind === 'conflict'
      ? { kind: 'conflict', retainedPractice: false }
      : { kind: result.kind, retainedPractice: result.retainedPractice };
}
