import 'server-only';

import {
  deletePreConfirmationImportEventsForSubjectForUser,
  finalizeChatGptExportCompletionEventsForUser,
} from '@/lib/knowledge-product-events';
import { hasMemoryKnowledgeImportBatchForUser } from '@/lib/knowledge-ingestion';

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
  finalizeEvents: (
    userId: string,
    completion: ChatGptExportCompletion,
  ) => Promise<number>;
};

const defaultDependencies: ChatGptExportTelemetryDependencies = {
  deletePreConfirmationEvents: deletePreConfirmationImportEventsForSubjectForUser,
  finalizeEvents: (userId, completion) => finalizeChatGptExportCompletionEventsForUser(
    userId,
    {
      importSessionId: completion.importSessionId,
      batchId: completion.result.batchId!,
      selectionCount: completion.selectionCount,
      created: completion.result.created,
      draftCount: completion.result.draftCount,
    },
    {
      memoryBatchExists: () => hasMemoryKnowledgeImportBatchForUser(
        userId,
        completion.result.batchId!,
      ),
    },
  ),
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
  await dependencies.finalizeEvents(userId, completion).catch(() => undefined);
}
