'use server';

import type { KnowledgeProductEventInput } from '@stem-brain/shared/ai-thinking-history';
import { requireCurrentUser } from '@/lib/auth';
import { recordKnowledgeProductEventsForUser } from '@/lib/knowledge-product-events';

export async function recordKnowledgeProductEvents(values: KnowledgeProductEventInput[]) {
  const user = await requireCurrentUser();
  return recordKnowledgeProductEventsForUser(user.id, values);
}
