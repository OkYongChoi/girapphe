export type KnowledgeItemCreateResult =
  | { outcome: 'inserted'; itemId: string }
  | { outcome: 'replayed'; itemId: null }
  | { outcome: 'quota_exceeded'; itemId: null; limit: 'account' | 'guest' }
  | { outcome: 'invalid'; itemId: null };

export type KnowledgeItemCreateDatabaseRow = {
  id: unknown;
  outcome: unknown;
};

export type MemoryKnowledgeItemCreateAdmission =
  | 'admitted'
  | 'replayed'
  | 'account_quota_exceeded'
  | 'guest_quota_exceeded';

export function classifyMemoryKnowledgeItemCreateAdmission(input: {
  requestAlreadySeen: boolean;
  isGuest: boolean;
  activeCount: number;
  totalCount: number;
  guestLimit: number;
  accountLimit: number;
}): MemoryKnowledgeItemCreateAdmission {
  if (input.requestAlreadySeen) return 'replayed';
  if (input.isGuest && input.activeCount >= input.guestLimit) return 'guest_quota_exceeded';
  if (input.totalCount >= input.accountLimit) return 'account_quota_exceeded';
  return 'admitted';
}

export type MobileNoteCreateHttpResult = {
  status: number;
  body:
    | { success: true; outcome: 'inserted' | 'replayed' }
    | { success: false; error: string; code: 'KNOWLEDGE_ITEM_QUOTA_EXCEEDED' | 'INVALID_NOTE' };
};

export function readKnowledgeItemCreateDatabaseResult(
  row: KnowledgeItemCreateDatabaseRow | undefined,
): KnowledgeItemCreateResult {
  if (row?.outcome === 'inserted' && typeof row.id === 'string' && row.id) {
    return { outcome: 'inserted', itemId: row.id };
  }
  if (row?.outcome === 'replayed') {
    return { outcome: 'replayed', itemId: null };
  }
  if (row?.outcome === 'account_quota_exceeded') {
    return { outcome: 'quota_exceeded', itemId: null, limit: 'account' };
  }
  if (row?.outcome === 'guest_quota_exceeded') {
    return { outcome: 'quota_exceeded', itemId: null, limit: 'guest' };
  }
  throw new Error('Unexpected knowledge item create result.');
}

export function toMobileNoteCreateHttpResult(
  result: KnowledgeItemCreateResult,
): MobileNoteCreateHttpResult {
  if (result.outcome === 'inserted') {
    return { status: 201, body: { success: true, outcome: 'inserted' } };
  }
  if (result.outcome === 'replayed') {
    return { status: 200, body: { success: true, outcome: 'replayed' } };
  }
  if (result.outcome === 'quota_exceeded') {
    return {
      status: 409,
      body: {
        success: false,
        error: 'My Notes is at its storage limit. Move unneeded notes to Trash; account-wide space is reclaimed after the 14-day retention period. Contact support if you need to save now.',
        code: 'KNOWLEDGE_ITEM_QUOTA_EXCEEDED',
      },
    };
  }
  return {
    status: 400,
    body: {
      success: false,
      error: 'The note is invalid.',
      code: 'INVALID_NOTE',
    },
  };
}
