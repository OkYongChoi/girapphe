export const MAX_CHATGPT_EXPORT_BYTES = 20 * 1024 * 1024;
export const MAX_CHATGPT_EXPORT_CONVERSATIONS = 5_000;
export const MAX_CHATGPT_EXPORT_MESSAGES = 100_000;
export const MAX_CHATGPT_EXPORT_SELECTIONS = 12;
export const MAX_CHATGPT_SELECTED_TEXT_LENGTH = 4_000;

export type ChatGptExportErrorCode = 'invalid' | 'too_large' | 'empty';

export class ChatGptExportError extends Error {
  constructor(public readonly code: ChatGptExportErrorCode) {
    super(code);
    this.name = 'ChatGptExportError';
  }
}

export type ChatGptExportExchange = {
  id: string;
  conversationId: string;
  messageId: string;
  title: string;
  topic: string;
  question: string;
  answer: string;
  createdAt: string | null;
  truncated: boolean;
};

export type ParsedChatGptExport = {
  conversationCount: number;
  exchangeCount: number;
  dateFrom: string | null;
  dateTo: string | null;
  exchanges: ChatGptExportExchange[];
};

type ParsedMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string | null;
  order: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedText(value: unknown, limit: number) {
  return typeof value === 'string'
    ? value.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim().slice(0, limit)
    : '';
}

function sourceId(value: unknown, fallback: string) {
  return boundedText(value, 200) || fallback;
}

function timestamp(value: unknown): string | null {
  const numeric = typeof value === 'number' ? value : Number.NaN;
  const date = Number.isFinite(numeric)
    ? new Date(numeric * 1_000)
    : typeof value === 'string' && value.trim()
      ? new Date(value)
      : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function messageText(content: unknown) {
  const record = asRecord(content);
  if (!record || !Array.isArray(record.parts)) return '';
  return record.parts.flatMap((part) => {
    if (typeof part === 'string') return [part];
    const partRecord = asRecord(part);
    return partRecord && typeof partRecord.text === 'string' ? [partRecord.text] : [];
  }).join('\n').replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim();
}

function deriveTopic(title: string, question: string) {
  const genericTitle = /^(new chat|untitled|chat)$/i.test(title.trim());
  const source = genericTitle ? question : title;
  const tokens = source
    .replace(/[^\p{L}\p{N}#+.\-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  return (tokens.join(' ') || 'Imported chat').slice(0, 48);
}

function parseMessages(mapping: Record<string, unknown>, counter: { value: number }) {
  const messages: ParsedMessage[] = [];
  let order = 0;
  for (const nodeValue of Object.values(mapping)) {
    counter.value += 1;
    if (counter.value > MAX_CHATGPT_EXPORT_MESSAGES) throw new ChatGptExportError('too_large');
    const node = asRecord(nodeValue);
    const message = asRecord(node?.message);
    const author = asRecord(message?.author);
    const metadata = asRecord(message?.metadata);
    const role = author?.role;
    const text = messageText(message?.content);
    if ((role !== 'user' && role !== 'assistant') || !text || metadata?.is_visually_hidden_from_conversation === true) {
      order += 1;
      continue;
    }
    messages.push({
      id: sourceId(message?.id ?? node?.id, `message-${order}`),
      role,
      text,
      createdAt: timestamp(message?.create_time),
      order,
    });
    order += 1;
  }
  return messages.toSorted((left, right) => {
    const byTime = (left.createdAt ?? '').localeCompare(right.createdAt ?? '');
    return byTime || left.order - right.order;
  });
}

export function parseChatGptExport(value: unknown): ParsedChatGptExport {
  if (!Array.isArray(value)) throw new ChatGptExportError('invalid');
  if (value.length > MAX_CHATGPT_EXPORT_CONVERSATIONS) throw new ChatGptExportError('too_large');

  const exchanges: ChatGptExportExchange[] = [];
  const conversationsWithExchanges = new Set<string>();
  const messageCounter = { value: 0 };

  value.forEach((conversationValue, conversationIndex) => {
    const conversation = asRecord(conversationValue);
    const mapping = asRecord(conversation?.mapping);
    if (!conversation || !mapping) return;
    const conversationId = sourceId(conversation.id, `conversation-${conversationIndex}`);
    const title = boundedText(conversation.title, 200) || 'Untitled conversation';
    const fallbackDate = timestamp(conversation.update_time ?? conversation.create_time);
    const messages = parseMessages(mapping, messageCounter);
    let pendingQuestion: ParsedMessage | null = null;

    for (const message of messages) {
      if (message.role === 'user') {
        pendingQuestion = message;
        continue;
      }
      if (!pendingQuestion) continue;
      const question = pendingQuestion.text.slice(0, MAX_CHATGPT_SELECTED_TEXT_LENGTH);
      const answer = message.text.slice(0, MAX_CHATGPT_SELECTED_TEXT_LENGTH);
      exchanges.push({
        id: `${conversationId}:${message.id}`,
        conversationId,
        messageId: message.id,
        title,
        topic: deriveTopic(title, question),
        question,
        answer,
        createdAt: message.createdAt ?? pendingQuestion.createdAt ?? fallbackDate,
        truncated: pendingQuestion.text.length > question.length || message.text.length > answer.length,
      });
      conversationsWithExchanges.add(conversationId);
      pendingQuestion = null;
    }
  });

  if (exchanges.length === 0) throw new ChatGptExportError('empty');
  exchanges.sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''));
  const dated = exchanges.flatMap((exchange) => exchange.createdAt ? [exchange.createdAt] : []).toSorted();
  return {
    conversationCount: conversationsWithExchanges.size,
    exchangeCount: exchanges.length,
    dateFrom: dated[0] ?? null,
    dateTo: dated.at(-1) ?? null,
    exchanges,
  };
}

export function parseChatGptExportText(source: string): ParsedChatGptExport {
  if (new TextEncoder().encode(source).byteLength > MAX_CHATGPT_EXPORT_BYTES) {
    throw new ChatGptExportError('too_large');
  }
  try {
    return parseChatGptExport(JSON.parse(source) as unknown);
  } catch (error) {
    if (error instanceof ChatGptExportError) throw error;
    throw new ChatGptExportError('invalid');
  }
}
