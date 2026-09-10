import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test, type Page } from './authenticated-test';
import {
  AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE,
} from '../scripts/authenticated-overlay-constants.mjs';
import {
  isAuthenticatedOverlayMcpPatMutationPreview,
} from '../scripts/authenticated-overlay-auth.mjs';
import {
  resolveAuthenticatedOverlaySyntheticUser,
  revokeExactAuthenticatedOverlayMcpToken,
  revokeExactAuthenticatedOverlayMcpTokenByMarker,
} from '../scripts/authenticated-overlay-fixture.mjs';
import {
  isExactMcpCreateServerAction,
  targetsExactSettingsDocument,
} from './authenticated-mcp-provider-setup-fault-routing';

const RAW_PAT_CAPTURE_PATTERN = /girapphe_mcp_[A-Za-z0-9_-]{43}/gu;
const RAW_PAT_SHAPE = /^girapphe_mcp_[A-Za-z0-9_-]{43}$/u;
const UI_FAULT_TIMEOUT_MS = 5_000;

// Keep automatic failure artifacts from ever sampling a one-time synthetic
// PAT. This test writes only sanitized JSON after exact revocation succeeds.
test.use({ screenshot: 'off' });

function isPatMutationPreview(testInfo: { project: { name: string } }): boolean {
  return testInfo.project.name === 'authenticated-desktop'
    && isAuthenticatedOverlayMcpPatMutationPreview();
}

async function withCleanupOperationTimeout<T>(
  operation: () => Promise<T>,
  timeoutCode: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(timeoutCode)),
          UI_FAULT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function clearClipboardAndReadBack(page: Page): Promise<boolean> {
  return withCleanupOperationTimeout(
    () => page.evaluate(async () => {
      await navigator.clipboard.writeText('');
      return (await navigator.clipboard.readText()) === '';
    }),
    'MCP_CLEANUP_CLIPBOARD_TIMEOUT',
  );
}

test('falls back to exact database revocation after both UI cleanup paths fault', async ({
  context,
  page,
}, testInfo) => {
  test.skip(
    !isPatMutationPreview(testInfo),
    'PAT route-fault evidence runs once in the marker-validated testing-token Preview desktop project.',
  );
  // Complete the only unbounded Clerk request before the create Server Action
  // can commit a PAT. Fault cleanup then uses this already verified owner.
  const syntheticUser = await resolveAuthenticatedOverlaySyntheticUser();
  testInfo.setTimeout(Math.max(testInfo.timeout, 180_000));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/en/settings#ai-connections', { waitUntil: 'domcontentloaded' });

  const runMarker = `${AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE}:mcp-pat:${randomUUID()}`;
  const connectionLabel = `PAT ${runMarker}`;
  const settingsDocumentUrl = page.url();
  const originalSentinel = new Error('MCP_PAT_ROUTE_FAULT_SENTINEL');
  let rawToken = '';
  let postResponseCaptured = false;
  let postResponseRedacted = false;
  let routeFaultArmed = false;
  let routeFaultedRequestCount = 0;
  let uiCleanupFailureCount = 0;
  let databaseFallbackRan = false;
  let remainingActiveAfterFallback = -1;
  let clipboardEmptyAfterTest = false;
  let observedError: unknown = null;

  await page.route('**/*', async (route) => {
    const request = route.request();
    const targetsSettings = targetsExactSettingsDocument(
      request.url(),
      settingsDocumentUrl,
    );
    if (routeFaultArmed && targetsSettings) {
      routeFaultedRequestCount += 1;
      await route.abort('failed');
      return;
    }
    if (
      routeFaultArmed
      || !isExactMcpCreateServerAction(request, settingsDocumentUrl, runMarker)
    ) {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    let responseBody = await response.text();
    const matches = responseBody.match(RAW_PAT_CAPTURE_PATTERN) ?? [];
    const uniqueMatches = [...new Set(matches)];
    if (uniqueMatches.length === 1 && RAW_PAT_SHAPE.test(uniqueMatches[0] ?? '')) {
      rawToken = uniqueMatches[0]!;
      postResponseCaptured = true;
    }
    const redactedBody = responseBody.replace(
      RAW_PAT_CAPTURE_PATTERN,
      '[redacted synthetic PAT response]',
    );
    responseBody = '';
    postResponseRedacted = !RAW_PAT_CAPTURE_PATTERN.test(redactedBody);
    RAW_PAT_CAPTURE_PATTERN.lastIndex = 0;
    routeFaultArmed = true;
    await route.fulfill({ response, body: redactedBody });
  });

  try {
    let originalError: unknown = null;
    let cleanupError: unknown = null;
    try {
      await page.getByLabel('Connection label').fill(connectionLabel);
      await page.getByRole('button', { name: 'Create token' }).click();
      await expect.poll(() => postResponseCaptured, { timeout: 30_000 }).toBe(true);
      if (!postResponseRedacted) throw new Error('MCP_PAT_ROUTE_RESPONSE_NOT_REDACTED');
      throw originalSentinel;
    } catch (error) {
      originalError = error;
    } finally {
      try {
        try {
          if (!await clearClipboardAndReadBack(page)) {
            cleanupError = new Error('MCP_CLEANUP_CLIPBOARD_NOT_EMPTY');
          }
        } catch (error) {
          cleanupError ??= error;
        }

        const uiCleanupErrors: unknown[] = [];
        try {
          const tokenRow = page.getByRole('listitem').filter({
            has: page.getByText(connectionLabel, { exact: true }),
          });
          page.once('dialog', (dialog) => dialog.accept());
          await tokenRow.getByRole('button', { name: 'Revoke' }).click({
            timeout: UI_FAULT_TIMEOUT_MS,
          });
          await expect(tokenRow.getByText('Revoked', { exact: true })).toBeVisible({
            timeout: UI_FAULT_TIMEOUT_MS,
          });
        } catch (error) {
          uiCleanupErrors.push(error);
        }
        try {
          await page.reload({
            waitUntil: 'domcontentloaded',
            timeout: UI_FAULT_TIMEOUT_MS,
          });
        } catch (error) {
          uiCleanupErrors.push(error);
        }
        uiCleanupFailureCount = uiCleanupErrors.length;

        // The exact database fallback is the final safety control, not a test
        // discriminator. Run it after every create attempt, using the hash
        // when captured or the random label marker when capture itself fails.
        try {
          const fallback = RAW_PAT_SHAPE.test(rawToken)
            ? await revokeExactAuthenticatedOverlayMcpToken({
              syntheticUser,
              rawToken,
              connectionLabel,
              runMarker,
            })
            : await revokeExactAuthenticatedOverlayMcpTokenByMarker({
              syntheticUser,
              connectionLabel,
              runMarker,
            });
          databaseFallbackRan = true;
          remainingActiveAfterFallback = fallback.remainingActive;
          if (fallback.remainingActive !== 0) {
            throw new Error('MCP_PAT_ROUTE_FAULT_FALLBACK_ACTIVE');
          }
        } catch (error) {
          cleanupError ??= error;
        }
        if (!RAW_PAT_SHAPE.test(rawToken)) {
          cleanupError ??= new Error('MCP_PAT_ROUTE_FAULT_TOKEN_NOT_CAPTURED');
        }
        if (uiCleanupErrors.length !== 2) {
          cleanupError ??= new Error('MCP_PAT_ROUTE_FAULT_UI_PATHS_DID_NOT_BOTH_FAIL');
        }

        try {
          await withCleanupOperationTimeout(
            () => page.unroute('**/*'),
            'MCP_CLEANUP_UNROUTE_TIMEOUT',
          );
        } catch (error) {
          cleanupError ??= error;
        }
        try {
          clipboardEmptyAfterTest = await clearClipboardAndReadBack(page);
          if (!clipboardEmptyAfterTest) {
            cleanupError ??= new Error('MCP_CLEANUP_CLIPBOARD_NOT_EMPTY');
          }
        } catch (error) {
          cleanupError ??= error;
        }
      } finally {
        rawToken = '';
      }
      if (cleanupError) throw cleanupError;
    }
    if (originalError) throw originalError;
  } catch (error) {
    observedError = error;
  }

  expect(observedError).toBe(originalSentinel);
  expect(postResponseCaptured).toBe(true);
  expect(postResponseRedacted).toBe(true);
  expect(routeFaultedRequestCount).toBeGreaterThan(0);
  expect(uiCleanupFailureCount).toBe(2);
  expect(databaseFallbackRan).toBe(true);
  expect(remainingActiveAfterFallback).toBe(0);
  expect(clipboardEmptyAfterTest).toBe(true);

  const evidencePath = resolve(
    process.cwd(),
    'test-results/authenticated-overlay-performance/mcp-provider-setup',
    `${testInfo.project.name}-route-fault.json`,
  );
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify({
    schemaVersion: 1,
    evidenceKind: 'route_fault_fallback',
    project: testInfo.project.name,
    postResponseCaptured,
    postResponseRedacted,
    routeFaultedRequestCount,
    uiCleanupFailureCount,
    databaseFallbackRan,
    remainingActiveAfterFallback,
    originalSentinelIdentityPreserved: observedError === originalSentinel,
    clipboardEmptyAfterTest,
  }, null, 2)}\n`);
  await testInfo.attach('mcp-provider-setup-route-fault-evidence', {
    path: evidencePath,
    contentType: 'application/json',
  });
});
