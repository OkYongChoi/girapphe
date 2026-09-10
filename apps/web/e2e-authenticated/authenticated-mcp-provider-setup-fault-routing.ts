type RouteRequestIdentity = {
  method(): string;
  url(): string;
  headers(): Record<string, string>;
  postData(): string | null;
};

type CleanupResult = { matched: number; remainingActive: number };

const QUIESCENCE_POLL_MS = 25;
const QUIESCENCE_QUIET_MS = 50;
const CLEANUP_RETRY_MS = 100;
const RETRYABLE_CLEANUP_ERROR = /^(SYNTHETIC_MCP_(?:(?:MARKER|TOKEN)_(?:CLEANUP|VERIFY)_(?:TARGET_NOT_OWNED|UPDATE_MISSED|VERIFICATION_FAILED|ACTIVE|DATABASE_FAILED)|(?:MARKER|TOKEN)_CLEANUP_FAILED|TOKEN_VERIFY_FAILED))(?:[:]|$)/u;

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function targetsExactSettingsDocument(
  requestUrl: string,
  settingsDocumentUrl: string,
): boolean {
  try {
    const request = new URL(requestUrl);
    const settings = new URL(settingsDocumentUrl);
    return request.origin === settings.origin
      && request.pathname === settings.pathname;
  } catch {
    return false;
  }
}

export function isExactMcpCreateServerAction(
  request: RouteRequestIdentity,
  settingsDocumentUrl: string,
  runMarker: string,
): boolean {
  const nextAction = request.headers()['next-action']?.trim();
  const postData = request.postData();
  return request.method() === 'POST'
    && targetsExactSettingsDocument(request.url(), settingsDocumentUrl)
    && Boolean(nextAction)
    && typeof postData === 'string'
    && postData.includes(runMarker);
}

export function createExactMcpCreateQuiescenceTracker() {
  let createActionsStarted = 0;
  let pendingCreateActions = 0;
  let exactRequestsStarted = 0;
  let exactRequestsSucceeded = 0;
  let exactRequestsFailed = 0;
  let pendingExactRequests = 0;
  let revision = 0;

  const track = async <T>(kind: 'action' | 'request', operation: () => Promise<T>): Promise<T> => {
    if (kind === 'action') {
      createActionsStarted += 1;
      pendingCreateActions += 1;
    } else {
      exactRequestsStarted += 1;
      pendingExactRequests += 1;
    }
    revision += 1;
    try {
      const result = await operation();
      if (kind === 'request') exactRequestsSucceeded += 1;
      return result;
    } catch (error) {
      if (kind === 'request') exactRequestsFailed += 1;
      throw error;
    } finally {
      if (kind === 'action') pendingCreateActions -= 1;
      else pendingExactRequests -= 1;
      revision += 1;
    }
  };

  return {
    trackCreateAction<T>(operation: () => Promise<T>): Promise<T> {
      return track('action', operation);
    },
    trackExactRequest<T>(operation: () => Promise<T>): Promise<T> {
      return track('request', operation);
    },
    async waitForQuiescence(deadlineMs: number): Promise<{
      exactRequestsStarted: number;
      exactRequestsSucceeded: number;
      exactRequestsFailed: number;
    }> {
      while (Date.now() < deadlineMs) {
        if (
          createActionsStarted > 0
          && pendingCreateActions === 0
          && pendingExactRequests === 0
        ) {
          const quietRevision = revision;
          const quietRemainingMs = deadlineMs - Date.now();
          if (quietRemainingMs <= 0) break;
          await wait(Math.min(QUIESCENCE_QUIET_MS, quietRemainingMs));
          if (
            revision === quietRevision
            && pendingCreateActions === 0
            && pendingExactRequests === 0
          ) {
            return {
              exactRequestsStarted,
              exactRequestsSucceeded,
              exactRequestsFailed,
            };
          }
          continue;
        }
        await wait(Math.min(QUIESCENCE_POLL_MS, Math.max(1, deadlineMs - Date.now())));
      }
      throw new Error('MCP_PAT_CREATE_QUIESCENCE_DEADLINE_EXCEEDED');
    },
  };
}

export async function retryExactMcpPatCleanupAfterCreate({
  tracker,
  deadlineMs,
  cleanup,
}: {
  tracker: ReturnType<typeof createExactMcpCreateQuiescenceTracker>;
  deadlineMs: number;
  cleanup: (deadlineMs: number) => Promise<CleanupResult>;
}): Promise<CleanupResult & {
  cleanupAttempts: number;
  exactRequestsStarted: number;
  exactRequestsSucceeded: number;
  exactRequestsFailed: number;
}> {
  let cleanupAttempts = 0;
  let quiescenceSettled = false;
  let quiescenceResult: {
    exactRequestsStarted: number;
    exactRequestsSucceeded: number;
    exactRequestsFailed: number;
  } | undefined;
  let quiescenceError: unknown;
  let lastRetryableErrorCode = 'SYNTHETIC_MCP_CLEANUP_NOT_ATTEMPTED';
  const quiescence = tracker.waitForQuiescence(deadlineMs).then(
    (result) => {
      quiescenceResult = result;
      quiescenceSettled = true;
    },
    (error) => {
      quiescenceError = error;
      quiescenceSettled = true;
    },
  );

  const attemptCleanup = async (): Promise<CleanupResult | undefined> => {
    cleanupAttempts += 1;
    try {
      return await cleanup(deadlineMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const retryable = message.match(RETRYABLE_CLEANUP_ERROR);
      if (!retryable) throw error;
      lastRetryableErrorCode = retryable[1] ?? 'SYNTHETIC_MCP_CLEANUP_RETRYABLE_FAILURE';
      return undefined;
    }
  };

  // A timed-out Playwright step does not cancel its body. Revoke opportunistically
  // while that exact Create request settles, then require another successful
  // exact cleanup attempt after quiescence before returning.
  while (!quiescenceSettled && Date.now() < deadlineMs) {
    await attemptCleanup();
    if (!quiescenceSettled) {
      await Promise.race([
        quiescence,
        wait(Math.min(CLEANUP_RETRY_MS, Math.max(1, deadlineMs - Date.now()))),
      ]);
    }
  }
  await quiescence;
  if (quiescenceError || !quiescenceResult) {
    throw new Error('MCP_PAT_CREATE_QUIESCENCE_DEADLINE_EXCEEDED');
  }

  while (Date.now() < deadlineMs) {
    const result = await attemptCleanup();
    if (result?.matched === 1 && result.remainingActive === 0) {
      return {
        ...result,
        cleanupAttempts,
        ...quiescenceResult,
      };
    }
    await wait(Math.min(CLEANUP_RETRY_MS, Math.max(1, deadlineMs - Date.now())));
  }
  throw new Error(`MCP_PAT_CREATE_CLEANUP_DEADLINE_EXCEEDED:${lastRetryableErrorCode}`);
}
