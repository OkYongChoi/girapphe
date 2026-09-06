import 'server-only';

import { createHash } from 'node:crypto';
import {
  parseSelectedConversationImportResult,
  SELECTED_CONVERSATION_IMPORT_SCHEMA_VERSION,
  type SelectedConversationImportResult,
} from '@stem-brain/shared/ai-thinking-history';
import {
  createKnowledgeDraftBatchForUser,
  type CreateKnowledgeDraftBatchInput,
  type CreateKnowledgeDraftBatchResult,
} from '@/lib/knowledge-ingestion';
import {
  MAX_CHATGPT_EXPORT_SELECTIONS,
  MAX_CHATGPT_SELECTED_TEXT_LENGTH,
} from '@/lib/chatgpt-export';

type ChatGptExportSelection = {
  conversationId: string;
  messageId: string;
  title: string;
  question: string;
  answer: string;
  createdAt: string | null;
};

export type ChatGptExportImportInput = {
  source: 'chatgpt_export';
  consent: true;
  selections: ChatGptExportSelection[];
};

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

const INPUT_KEYS = ['source', 'consent', 'selections'] as const;
const SELECTION_KEYS = ['conversationId', 'messageId', 'title', 'question', 'answer', 'createdAt'] as const;
const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function boundedString(value: unknown, limit: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= limit ? normalized : null;
}

function parseSelection(value: unknown): ChatGptExportSelection | null {
  if (!isRecord(value) || !hasExactKeys(value, SELECTION_KEYS)) return null;

  const conversationId = boundedString(value.conversationId, 200);
  const messageId = boundedString(value.messageId, 200);
  const title = boundedString(value.title, 200);
  const question = boundedString(value.question, MAX_CHATGPT_SELECTED_TEXT_LENGTH);
  const answer = boundedString(value.answer, MAX_CHATGPT_SELECTED_TEXT_LENGTH);
  const createdAt = value.createdAt;
  const validCreatedAt = createdAt === null || (
    typeof createdAt === 'string'
    && OFFSET_DATE_TIME.test(createdAt)
    && Number.isFinite(Date.parse(createdAt))
  );

  if (!conversationId || !messageId || !title || !question || !answer || !validCreatedAt) return null;
  return { conversationId, messageId, title, question, answer, createdAt };
}

function parseChatGptExportImportInput(value: unknown): ChatGptExportImportInput {
  if (!isRecord(value) || !hasExactKeys(value, INPUT_KEYS)) {
    throw new Error('Invalid selected ChatGPT export payload.');
  }
  if (value.source !== 'chatgpt_export' || value.consent !== true || !Array.isArray(value.selections)) {
    throw new Error('Invalid selected ChatGPT export payload.');
  }
  if (value.selections.length < 1 || value.selections.length > MAX_CHATGPT_EXPORT_SELECTIONS) {
    throw new Error('Invalid selected ChatGPT export payload.');
  }

  const selections = value.selections.map(parseSelection);
  if (selections.some((selection) => selection === null)) {
    throw new Error('Invalid selected ChatGPT export payload.');
  }

  const parsedSelections = selections as ChatGptExportSelection[];
  const ids = new Set(parsedSelections.map((selection) => `${selection.conversationId}\u0000${selection.messageId}`));
  if (ids.size !== parsedSelections.length) {
    throw new Error('Invalid selected ChatGPT export payload.');
  }

  return { source: 'chatgpt_export', consent: true, selections: parsedSelections };
}

export const chatGptExportImportInputSchema = {
  parse: parseChatGptExportImportInput,
  safeParse(value: unknown): ParseResult<ChatGptExportImportInput> {
    try {
      return { success: true, data: parseChatGptExportImportInput(value) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function compact(value: string, limit: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function topicFrom(title: string, question: string) {
  const source = /^(new chat|untitled|chat)$/i.test(title.trim()) ? question : title;
  return compact(source.replace(/[^\p{L}\p{N}#+.\-]+/gu, ' '), 48) || 'Imported chat';
}

export function toSelectedChatGptImportResult(input: ChatGptExportImportInput): SelectedConversationImportResult {
  return parseSelectedConversationImportResult({
    schemaVersion: SELECTED_CONVERSATION_IMPORT_SCHEMA_VERSION,
    provider: 'chatgpt',
    sourceKind: 'export',
    consent: input.consent,
    selections: input.selections.map((selection) => ({
      conversationRef: selection.conversationId,
      messageRef: selection.messageId,
      title: selection.title,
      prompt: selection.question,
      response: selection.answer,
      occurredAt: selection.createdAt,
    })),
  });
}

export function buildSelectedConversationImportBatchInput(
  value: SelectedConversationImportResult,
): CreateKnowledgeDraftBatchInput {
  const input = parseSelectedConversationImportResult(value);
  const selectionKey = input.selections
    .map((selection) => `${selection.conversationRef}:${selection.messageRef}`)
    .toSorted()
    .join('|');
  const latestDate = input.selections.flatMap((selection) => selection.occurredAt ? [selection.occurredAt] : []).toSorted().at(-1);
  const importKey = digest(`${input.provider}:${selectionKey}`).slice(0, 48);
  const canonicalProvider = input.provider === 'chatgpt' || input.provider === 'claude' || input.provider === 'gemini'
    ? input.provider
    : 'other';
  const cards: CreateKnowledgeDraftBatchInput['cards'] = input.selections.map((selection) => {
    const question = selection.prompt.slice(0, MAX_CHATGPT_SELECTED_TEXT_LENGTH);
    const answer = selection.response.slice(0, MAX_CHATGPT_SELECTED_TEXT_LENGTH);
    const conversationKey = digest(`${input.provider}:${selection.conversationRef}`).slice(0, 48);
    const messageKey = digest(`${input.provider}:${selection.conversationRef}:${selection.messageRef}`).slice(0, 48);
    const shortQuestion = compact(question, 76);
    const title = compact(`${selection.title}: ${shortQuestion}`, 120);
    return {
      clientCardId: `export-exchange:${messageKey}`,
      title,
      summary: compact(answer, 500),
      topic: topicFrom(selection.title, question),
      tags: [`${input.provider}-export`, 'selected'],
      knowledgeType: 'question',
      centralQuestion: compact(question, 500),
      structuredContent: {
        type: 'question',
        question,
        context: '',
        known_facts: [],
        hypotheses: [],
        next_steps: [],
        answer_summary: answer,
        status: 'answered',
      },
      bundleSchemaVersion: 1,
      proposedEvidence: [{
        selectorType: 'message',
        sourceRef: `${input.provider}-conversation:${conversationKey}`,
        messageRef: `${input.provider}-message:${messageKey}`,
        polarity: 'supports',
        quality: 'unknown',
        relationOrigin: 'extracted_from_source',
      }],
      observedAt: selection.occurredAt,
    };
  });
  const firstCardByTopic = new Map<string, string>();
  for (const card of cards) {
    const topic = card.topic ?? 'general';
    const firstCardId = firstCardByTopic.get(topic);
    if (firstCardId) {
      card.relations = [{
        targetKind: 'draft',
        targetId: `draft:${firstCardId}`,
        type: 'related',
        direction: 'outgoing',
        weight: 0.72,
        relationOrigin: 'model_inferred',
        evidenceSelectorIndexes: [0],
      }];
    } else if (card.clientCardId) {
      firstCardByTopic.set(topic, card.clientCardId);
    }
  }

  return {
    provider: canonicalProvider,
    scope: 'selected_export',
    requestId: `${input.provider}-export:${importKey}`,
    conversationRef: `${input.provider}-export-selection:${importKey}`,
    ...(latestDate ? { discussedAt: latestDate } : {}),
    cards,
  };
}

export function buildChatGptExportBatchInput(input: ChatGptExportImportInput): CreateKnowledgeDraftBatchInput {
  return buildSelectedConversationImportBatchInput(toSelectedChatGptImportResult(input));
}

export async function createChatGptExportDraftBatchForUser(
  userId: string,
  value: unknown,
): Promise<CreateKnowledgeDraftBatchResult> {
  const parsed = chatGptExportImportInputSchema.safeParse(value);
  if (!parsed.success) throw new Error('Invalid selected ChatGPT export payload.');
  return createKnowledgeDraftBatchForUser(userId, buildChatGptExportBatchInput(parsed.data));
}
