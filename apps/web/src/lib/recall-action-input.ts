const KNOWLEDGE_ITEM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const ATTEMPT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type RecallEnrollActionInput = {
  knowledgeItemId: string;
  itemVersion: number;
};

export type RecallStartActionInput = {
  knowledgeItemId: string;
};

export type RecallAttemptActionInput = {
  attemptId: string;
};

export type RecallConfidenceActionInput = RecallAttemptActionInput & {
  confidence: 'low' | 'medium' | 'high';
};

export type RecallCompleteActionInput = RecallAttemptActionInput & {
  outcome: 'remembered' | 'partial' | 'missed';
};

export type RecallCancelActionInput = {
  knowledgeItemId: string;
  itemVersion: number;
  scheduleVersion: number;
  enrolledAt: string;
};

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Recall action input.');
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error('Invalid Recall action input.');
  }
  return record;
}

function knowledgeItemId(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid Recall knowledge item id.');
  const normalized = value.trim();
  if (!KNOWLEDGE_ITEM_ID_PATTERN.test(normalized)) {
    throw new Error('Invalid Recall knowledge item id.');
  }
  return normalized;
}

function attemptId(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid Recall attempt id.');
  const normalized = value.trim();
  if (!ATTEMPT_ID_PATTERN.test(normalized)) throw new Error('Invalid Recall attempt id.');
  return normalized;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`Invalid ${field}.`);
  return Number(value);
}

export function parseRecallEnrollActionInput(value: unknown): RecallEnrollActionInput {
  const record = exactRecord(value, ['knowledgeItemId', 'itemVersion']);
  return {
    knowledgeItemId: knowledgeItemId(record.knowledgeItemId),
    itemVersion: positiveInteger(record.itemVersion, 'Recall item version'),
  };
}

export function parseRecallStartActionInput(value: unknown): RecallStartActionInput {
  const record = exactRecord(value, ['knowledgeItemId']);
  return { knowledgeItemId: knowledgeItemId(record.knowledgeItemId) };
}

export function parseRecallAttemptActionInput(value: unknown): RecallAttemptActionInput {
  const record = exactRecord(value, ['attemptId']);
  return { attemptId: attemptId(record.attemptId) };
}

export function parseRecallConfidenceActionInput(value: unknown): RecallConfidenceActionInput {
  const record = exactRecord(value, ['attemptId', 'confidence']);
  if (!['low', 'medium', 'high'].includes(String(record.confidence))) {
    throw new Error('Invalid Recall confidence.');
  }
  return {
    attemptId: attemptId(record.attemptId),
    confidence: record.confidence as RecallConfidenceActionInput['confidence'],
  };
}

export function parseRecallCompleteActionInput(value: unknown): RecallCompleteActionInput {
  const record = exactRecord(value, ['attemptId', 'outcome']);
  if (!['remembered', 'partial', 'missed'].includes(String(record.outcome))) {
    throw new Error('Invalid Recall outcome.');
  }
  return {
    attemptId: attemptId(record.attemptId),
    outcome: record.outcome as RecallCompleteActionInput['outcome'],
  };
}

export function parseRecallCancelActionInput(value: unknown): RecallCancelActionInput {
  const record = exactRecord(value, [
    'knowledgeItemId',
    'itemVersion',
    'scheduleVersion',
    'enrolledAt',
  ]);
  if (typeof record.enrolledAt !== 'string' || !ISO_INSTANT_PATTERN.test(record.enrolledAt)) {
    throw new Error('Invalid Recall enrollment instant.');
  }
  const enrolledAt = new Date(record.enrolledAt);
  if (Number.isNaN(enrolledAt.getTime())) throw new Error('Invalid Recall enrollment instant.');
  return {
    knowledgeItemId: knowledgeItemId(record.knowledgeItemId),
    itemVersion: positiveInteger(record.itemVersion, 'Recall item version'),
    scheduleVersion: positiveInteger(record.scheduleVersion, 'Recall schedule version'),
    enrolledAt: enrolledAt.toISOString(),
  };
}
