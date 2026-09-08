import 'server-only';

import {
  deletePreConfirmationImportEventsForSubjectForUser,
  recordKnowledgeProductEventsForUser,
  reassignKnowledgeProductEventsSubjectForUser,
} from '@/lib/knowledge-product-events';

type ChatGptExportCompletion = {
  importSessionId: string;
  selectionCount: number;
  result: {
    batchId: string | null;
    created: boolean;
    draftCount: number;
  };
};

type ChatGptExportTelemetryDependencies = {
  deletePreConfirmationEvents: typeof deletePreConfirmationImportEventsForSubjectForUser;
  recordEvents: typeof recordKnowledgeProductEventsForUser;
  reassignEvents: typeof reassignKnowledgeProductEventsSubjectForUser;
};

const defaultDependencies: ChatGptExportTelemetryDependencies = {
  deletePreConfirmationEvents: deletePreConfirmationImportEventsForSubjectForUser,
  recordEvents: recordKnowledgeProductEventsForUser,
  reassignEvents: reassignKnowledgeProductEventsSubjectForUser,
};

export async function recordChatGptExportCompletionTelemetry(
  userId: string,
  completion: ChatGptExportCompletion,
  dependencies: ChatGptExportTelemetryDependencies = defaultDependencies,
): Promise<void> {
  if (completion.result.batchId === null) {
    await dependencies.deletePreConfirmationEvents(
      userId,
      completion.importSessionId,
    ).catch(() => undefined);
    return;
  }
  if (completion.result.batchId !== completion.importSessionId) {
    await dependencies.reassignEvents(
      userId,
      completion.importSessionId,
      completion.result.batchId,
    ).catch(() => undefined);
  }

  const events: unknown[] = [{
    eventName: 'conversation_import_confirmed',
    eventVersion: 1,
    subjectId: completion.result.batchId,
    selectionCount: completion.selectionCount,
  }];
  if (completion.result.created) {
    events.push({
      eventName: 'conversation_import_candidates_ready',
      eventVersion: 1,
      subjectId: completion.result.batchId,
      selectionCount: completion.result.draftCount,
    });
  }
  await dependencies.recordEvents(userId, events).catch(() => undefined);
}
