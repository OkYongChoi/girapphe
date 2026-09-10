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
  revokeExactAuthenticatedOverlayMcpToken,
  revokeExactAuthenticatedOverlayMcpTokenByMarker,
  verifyExactAuthenticatedOverlayMcpTokenInactive,
} from '../scripts/authenticated-overlay-fixture.mjs';

const RAW_PAT_PATTERN = /girapphe_mcp_[A-Za-z0-9_-]{20,}/u;
const RAW_PAT_SHAPE = /^girapphe_mcp_[A-Za-z0-9_-]{43}$/u;
const MCP_CLEANUP_RESERVE_MS = 180_000;
const MCP_CLEANUP_ATTEMPT_MS = 12_000;
const MCP_CLEANUP_OPERATION_MS = 5_000;
const MCP_CLEANUP_NAVIGATION_MS = 8_000;

// This file briefly holds a real synthetic PAT in page/process memory. Failure
// artifacts must never capture the one-time surface before cleanup completes.
test.use({ screenshot: 'off' });

function isPatMutationPreview(testInfo: { project: { name: string } }): boolean {
  return testInfo.project.name === 'authenticated-desktop'
    && isAuthenticatedOverlayMcpPatMutationPreview();
}

function cleanupTimeout(
  deadlineMs: number,
  maximumMs: number,
  timeoutCode: string,
): number {
  const remainingMs = deadlineMs - Date.now();
  if (remainingMs <= 0) throw new Error(timeoutCode);
  return Math.max(1, Math.min(maximumMs, remainingMs));
}

async function withCleanupOperationTimeout<T>(
  operation: () => Promise<T>,
  deadlineMs: number,
  timeoutCode: string,
): Promise<T> {
  const timeoutMs = cleanupTimeout(deadlineMs, MCP_CLEANUP_OPERATION_MS, timeoutCode);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutCode)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function captureAndHideOneTimePat(page: Page): Promise<string> {
  const rawTokenHandle = await page.waitForFunction(() => {
    const status = Array.from(
      document.querySelectorAll<HTMLElement>('#ai-connections [role="status"]'),
    ).find((candidate) => candidate.querySelector('code'));
    const code = status?.querySelector('code');
    const value = code?.textContent?.trim();
    if (!status || !code || !value) return false;

    code.textContent = '[redacted after one-time test capture]';
    status.hidden = true;
    status.setAttribute('aria-hidden', 'true');
    return value;
  });

  try {
    const value = await rawTokenHandle.jsonValue();
    return typeof value === 'string' ? value : '';
  } finally {
    await rawTokenHandle.dispose();
  }
}

async function hidePatSurface(page: Page, deadlineMs?: number): Promise<void> {
  const hide = () => page.evaluate(() => {
    const statuses = Array.from(
      document.querySelectorAll<HTMLElement>('#ai-connections [role="status"]'),
    ).filter((candidate) => candidate.querySelector('code'));
    for (const status of statuses) {
      for (const code of status.querySelectorAll('code')) {
        code.textContent = '[redacted after one-time test capture]';
      }
      status.hidden = true;
      status.setAttribute('aria-hidden', 'true');
    }
  });
  if (deadlineMs === undefined) {
    await hide();
    return;
  }
  await withCleanupOperationTimeout(hide, deadlineMs, 'MCP_CLEANUP_REDACTION_TIMEOUT');
}

async function clearClipboard(page: Page, deadlineMs?: number): Promise<void> {
  const clear = async () => {
    const clipboardValue = await page.evaluate(async () => {
      await navigator.clipboard.writeText('');
      return navigator.clipboard.readText();
    });
    if (clipboardValue !== '') throw new Error('MCP_CLEANUP_CLIPBOARD_NOT_EMPTY');
  };
  if (deadlineMs === undefined) {
    await clear();
    return;
  }
  await withCleanupOperationTimeout(clear, deadlineMs, 'MCP_CLEANUP_CLIPBOARD_TIMEOUT');
}

async function revokeExactConnectionAfterReload(
  page: Page,
  connectionLabel: string,
): Promise<boolean> {
  const deadlineMs = Date.now() + MCP_CLEANUP_ATTEMPT_MS;
  page.removeAllListeners('dialog');
  await hidePatSurface(page, deadlineMs);
  await clearClipboard(page, deadlineMs);
  await page.reload({
    waitUntil: 'domcontentloaded',
    timeout: cleanupTimeout(
      deadlineMs,
      MCP_CLEANUP_NAVIGATION_MS,
      'MCP_CLEANUP_RELOAD_TIMEOUT',
    ),
  });

  const tokenRow = page.getByRole('listitem').filter({
    has: page.getByText(connectionLabel, { exact: true }),
  });
  const rowVisible = await tokenRow.first().waitFor({
    state: 'visible',
    timeout: cleanupTimeout(
      deadlineMs,
      MCP_CLEANUP_OPERATION_MS,
      'MCP_CLEANUP_ROW_WAIT_TIMEOUT',
    ),
  }).then(() => true, () => false);
  if (!rowVisible) return false;
  await expect(
    tokenRow,
    'the exact synthetic PAT label identifies at most one row',
  ).toHaveCount(1, {
    timeout: cleanupTimeout(
      deadlineMs,
      MCP_CLEANUP_OPERATION_MS,
      'MCP_CLEANUP_ROW_COUNT_TIMEOUT',
    ),
  });

  const revokeButton = tokenRow.getByRole('button', { name: 'Revoke' });
  const revokeButtonVisible = await revokeButton.waitFor({
    state: 'visible',
    timeout: cleanupTimeout(
      deadlineMs,
      MCP_CLEANUP_OPERATION_MS,
      'MCP_CLEANUP_REVOKE_WAIT_TIMEOUT',
    ),
  }).then(() => true, () => false);
  if (revokeButtonVisible) {
    page.once('dialog', (dialog) => dialog.accept());
    await revokeButton.click({
      timeout: cleanupTimeout(
        deadlineMs,
        MCP_CLEANUP_OPERATION_MS,
        'MCP_CLEANUP_REVOKE_CLICK_TIMEOUT',
      ),
    });
  }
  await expect(tokenRow.getByText('Revoked', { exact: true })).toBeVisible({
    timeout: cleanupTimeout(
      deadlineMs,
      MCP_CLEANUP_OPERATION_MS,
      'MCP_CLEANUP_REVOKED_EXPECT_TIMEOUT',
    ),
  });
  return true;
}

test('switches between ChatGPT and Claude setup without exposing a PAT', async ({ context, page }, testInfo) => {
  const testStartedAt = Date.now();
  const evidenceTimeoutMs = testInfo.timeout;
  test.skip(
    !isPatMutationPreview(testInfo),
    'PAT mutation evidence runs once in the marker-validated testing-token Preview desktop project.',
  );

  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`page: ${error.message}`));

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/en/settings#ai-connections', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Use Girapphe with ChatGPT or Claude' })).toBeVisible();

  const runMarker = `${AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE}:mcp-pat:${randomUUID()}`;
  const connectionLabel = `PAT ${runMarker}`;
  let createAttempted = false;
  let rawToken = '';
  let rawTokenHasExpectedShape = false;
  let openAiSnippetChecks = {
    configurationShape: false,
    endpoint: false,
    placeholder: false,
    omitsHeaders: false,
    contextTool: false,
    omitsCapturedPat: false,
    omitsAnyRawPat: false,
  };
  let claudeSnippetChecks = {
    command: false,
    placeholder: false,
    omitsCapturedPat: false,
    omitsAnyRawPat: false,
  };
  let renderedGuideOmitsCapturedPat = false;
  let renderedGuideOmitsAnyRawPat = false;
  let overflowsViewport = true;
  let revokedAfterReload = false;
  let rawSurfaceAbsentImmediatelyAfterRevoke = false;
  let rawSurfaceAbsentAfterReload = false;
  let normalUiRemainingActive = -1;
  let originalEvidenceFailed = false;
  let originalEvidenceError: unknown = null;

  try {
    await page.getByLabel('Connection label').fill(connectionLabel);
    const elapsedBeforeCreateMs = Math.max(0, Date.now() - testStartedAt);
    // Preserve the original evidence budget in a bounded step, while adding a
    // separate reserve to the enclosing test before a PAT can be committed.
    testInfo.setTimeout(Math.max(
      testInfo.timeout,
      elapsedBeforeCreateMs + evidenceTimeoutMs + MCP_CLEANUP_RESERVE_MS,
    ));

    await test.step('collect and revoke normal-path PAT evidence', async () => {
      createAttempted = true;
      await page.getByRole('button', { name: 'Create token' }).click();
      rawToken = await captureAndHideOneTimePat(page);
      rawTokenHasExpectedShape = RAW_PAT_SHAPE.test(rawToken);
      await clearClipboard(page);

      const chatgpt = page.getByRole('radio', { name: 'ChatGPT' });
      const claude = page.getByRole('radio', { name: 'Claude' });
      await expect(chatgpt).toBeChecked();
      await expect(page.getByRole('heading', { name: 'ChatGPT web app' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Use the PAT with OpenAI Responses API' })).toBeVisible();
      await expect(page.getByText('GIRAPPHE_MCP_TOKEN', { exact: false }).first()).toBeVisible();
      await expect(page.getByText(/On Business, an admin or owner enables developer mode/)).toBeVisible();
      await expect(page.getByText(/Enterprise\/Edu requires admin-granted access/)).toBeVisible();

      const openAiTokenArticle = page.locator('article').filter({
        has: page.getByRole('heading', { name: 'Use the PAT with OpenAI Responses API' }),
      });
      const copySetup = openAiTokenArticle.getByRole('button');
      await copySetup.click();
      await expect(copySetup).toHaveText('Copied');
      const openAiSnippet = await page.evaluate(() => navigator.clipboard.readText());
      await clearClipboard(page);
      openAiSnippetChecks = {
        configurationShape: openAiSnippet.includes('type: "mcp"'),
        endpoint: openAiSnippet.includes(`${new URL(page.url()).origin}/api/mcp`),
        placeholder: openAiSnippet.includes('authorization: process.env.GIRAPPHE_MCP_TOKEN'),
        omitsHeaders: !openAiSnippet.includes('headers:'),
        contextTool: openAiSnippet.includes('get_topic_context'),
        omitsCapturedPat: rawToken.length > 0 && !openAiSnippet.includes(rawToken),
        omitsAnyRawPat: !RAW_PAT_PATTERN.test(openAiSnippet),
      };

      await claude.check();
      await expect(claude).toBeChecked();
      await expect(page.getByRole('heading', { name: 'Claude web or Desktop' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Use the PAT with Claude Code' })).toBeVisible();
      await expect(page.getByText(/Free, Pro, or Max, open Customize → Connectors/)).toBeVisible();
      await expect(page.getByText(/Free \(one custom connector\), Pro, Max, Team, and Enterprise/)).toBeVisible();
      const claudeTokenArticle = page.locator('article').filter({
        has: page.getByRole('heading', { name: 'Use the PAT with Claude Code' }),
      });
      await claudeTokenArticle.getByRole('button').click();
      const claudeSnippet = await page.evaluate(() => navigator.clipboard.readText());
      await clearClipboard(page);
      claudeSnippetChecks = {
        command: claudeSnippet.includes('claude mcp add-json girapphe'),
        placeholder: claudeSnippet.includes('${GIRAPPHE_MCP_TOKEN}'),
        omitsCapturedPat: rawToken.length > 0 && !claudeSnippet.includes(rawToken),
        omitsAnyRawPat: !RAW_PAT_PATTERN.test(claudeSnippet),
      };

      const renderedText = await page.locator('main').innerText();
      renderedGuideOmitsCapturedPat = rawToken.length > 0 && !renderedText.includes(rawToken);
      renderedGuideOmitsAnyRawPat = !RAW_PAT_PATTERN.test(renderedText);
      overflowsViewport = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    }, { timeout: evidenceTimeoutMs });
  } catch (error) {
    originalEvidenceFailed = true;
    originalEvidenceError = error;
  } finally {
    let cleanupError: unknown = null;
    const uiCleanupErrors: unknown[] = [];
    let cleanupEvidenceError: unknown = null;
    const initialRedactionDeadlineMs = Date.now() + MCP_CLEANUP_ATTEMPT_MS;
    try {
      await hidePatSurface(page, initialRedactionDeadlineMs);
      await clearClipboard(page, initialRedactionDeadlineMs);
    } catch (error) {
      cleanupError = error;
    }

    try {
      const immediateCleanupDeadlineMs = Date.now() + MCP_CLEANUP_ATTEMPT_MS;
      const capturedPatRequiresRevocation = rawToken.length > 0;
      const tokenRow = page.getByRole('listitem').filter({
        has: page.getByText(connectionLabel, { exact: true }),
      });
      const revokeButton = tokenRow.getByRole('button', { name: 'Revoke' });
      let revokeButtonVisible = false;
      try {
        await revokeButton.waitFor({
          state: 'visible',
          timeout: cleanupTimeout(
            immediateCleanupDeadlineMs,
            MCP_CLEANUP_OPERATION_MS,
            'MCP_CLEANUP_IMMEDIATE_REVOKE_WAIT_TIMEOUT',
          ),
        });
        revokeButtonVisible = true;
      } catch (error) {
        if (capturedPatRequiresRevocation) throw error;
      }
      if (revokeButtonVisible) {
        const rawTokenCode = page.locator('#ai-connections [role="status"] code');
        await expect(rawTokenCode).toHaveCount(1, {
          timeout: cleanupTimeout(
            immediateCleanupDeadlineMs,
            MCP_CLEANUP_OPERATION_MS,
            'MCP_CLEANUP_IMMEDIATE_RAW_EXPECT_TIMEOUT',
          ),
        });
        page.once('dialog', (dialog) => dialog.accept());
        await revokeButton.click({
          timeout: cleanupTimeout(
            immediateCleanupDeadlineMs,
            MCP_CLEANUP_OPERATION_MS,
            'MCP_CLEANUP_IMMEDIATE_REVOKE_CLICK_TIMEOUT',
          ),
        });
        await expect(tokenRow.getByText('Revoked', { exact: true })).toBeVisible({
          timeout: cleanupTimeout(
            immediateCleanupDeadlineMs,
            MCP_CLEANUP_OPERATION_MS,
            'MCP_CLEANUP_IMMEDIATE_REVOKED_EXPECT_TIMEOUT',
          ),
        });
        await expect(rawTokenCode).toHaveCount(0, {
          timeout: cleanupTimeout(
            immediateCleanupDeadlineMs,
            MCP_CLEANUP_OPERATION_MS,
            'MCP_CLEANUP_IMMEDIATE_RAW_CLEAR_TIMEOUT',
          ),
        });
        rawSurfaceAbsentImmediatelyAfterRevoke = true;
      }
    } catch (error) {
      if (rawToken.length > 0) {
        uiCleanupErrors.push(error);
        cleanupEvidenceError = error;
      }
    }

    let exactConnectionObserved = false;
    try {
      const observed = await revokeExactConnectionAfterReload(page, connectionLabel);
      exactConnectionObserved = observed;
      if (!observed) {
        throw new Error('The captured synthetic PAT row was unavailable for exact cleanup.');
      }
    } catch (error) {
      uiCleanupErrors.push(error);
      cleanupEvidenceError ??= error;
    }

    if (uiCleanupErrors.length === 2 && rawTokenHasExpectedShape) {
      try {
        const databaseCleanup = await revokeExactAuthenticatedOverlayMcpToken({
          rawToken,
          connectionLabel,
          runMarker,
        });
        if (databaseCleanup.remainingActive !== 0) {
          throw new Error('Synthetic PAT database cleanup left an active credential.');
        }
      } catch (error) {
        cleanupError ??= error;
      }
    } else if (rawTokenHasExpectedShape) {
      try {
        const verification = await verifyExactAuthenticatedOverlayMcpTokenInactive({
          rawToken,
          connectionLabel,
          runMarker,
        });
        normalUiRemainingActive = verification.remainingActive;
      } catch (error) {
        cleanupError ??= error;
      }
    } else if (createAttempted) {
      // A create may commit before the one-time PAT reaches the page. The
      // unique random marker is the only safe emergency identity in that
      // case, so revoke that exact row and still fail this evidence run.
      try {
        const databaseCleanup = await revokeExactAuthenticatedOverlayMcpTokenByMarker({
          connectionLabel,
          runMarker,
        });
        normalUiRemainingActive = databaseCleanup.remainingActive;
        if (databaseCleanup.remainingActive !== 0) {
          throw new Error('Synthetic PAT marker cleanup left an active credential.');
        }
      } catch (error) {
        cleanupError ??= error;
      }
      cleanupEvidenceError ??= new Error('SYNTHETIC_MCP_TOKEN_CAPTURE_FAILED');
    }

    revokedAfterReload = exactConnectionObserved;

    const finalRedactionDeadlineMs = Date.now() + MCP_CLEANUP_ATTEMPT_MS;
    try {
      await hidePatSurface(page, finalRedactionDeadlineMs);
      await clearClipboard(page, finalRedactionDeadlineMs);
      await expect(page.locator(
        '#ai-connections [role="status"] code',
      )).toHaveCount(0, {
        timeout: cleanupTimeout(
          finalRedactionDeadlineMs,
          MCP_CLEANUP_OPERATION_MS,
          'MCP_CLEANUP_FINAL_RAW_EXPECT_TIMEOUT',
        ),
      });
      rawSurfaceAbsentAfterReload = true;
    } catch (error) {
      cleanupError ??= error;
    } finally {
      rawToken = '';
    }
    if (cleanupError) throw cleanupError;
    if (originalEvidenceFailed) throw originalEvidenceError;
    if (cleanupEvidenceError) throw cleanupEvidenceError;
  }

  expect(rawTokenHasExpectedShape).toBe(true);
  expect(openAiSnippetChecks).toEqual({
    configurationShape: true,
    endpoint: true,
    placeholder: true,
    omitsHeaders: true,
    contextTool: true,
    omitsCapturedPat: true,
    omitsAnyRawPat: true,
  });
  expect(claudeSnippetChecks).toEqual({
    command: true,
    placeholder: true,
    omitsCapturedPat: true,
    omitsAnyRawPat: true,
  });
  expect(renderedGuideOmitsCapturedPat).toBe(true);
  expect(renderedGuideOmitsAnyRawPat).toBe(true);
  expect(revokedAfterReload).toBe(true);
  expect(rawSurfaceAbsentImmediatelyAfterRevoke).toBe(true);
  expect(normalUiRemainingActive).toBe(0);
  expect(rawSurfaceAbsentAfterReload).toBe(true);
  expect(overflowsViewport).toBe(false);
  expect(browserErrors.length === 0).toBe(true);

  const screenshotPath = testInfo.outputPath('mcp-provider-setup-success.png');
  const evidencePath = resolve(
    process.cwd(),
    'test-results/authenticated-overlay-performance/mcp-provider-setup',
    `${testInfo.project.name}.json`,
  );
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify({
    schemaVersion: 1,
    evidenceKind: 'normal_ui_revocation',
    project: testInfo.project.name,
    createdOneTimePat: true,
    copiedWithoutRawPat: true,
    revokedBeforeScreenshot: revokedAfterReload,
    clearedOneTimePatImmediatelyOnRevoke: rawSurfaceAbsentImmediatelyAfterRevoke,
    remainingActiveAfterUiRevoke: normalUiRemainingActive,
    clipboardEmptyAfterTest: true,
    browserErrorCount: browserErrors.length,
    pageOverflow: overflowsViewport,
  }, null, 2)}\n`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('mcp-provider-setup-evidence', { path: evidencePath, contentType: 'application/json' });
  await testInfo.attach('mcp-provider-setup-success', { path: screenshotPath, contentType: 'image/png' });
});

test('keeps the localized provider guide usable in an Arabic RTL layout', async ({ context, page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`page: ${error.message}`));

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/ar/settings#ai-connections', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'استخدم Girapphe مع ChatGPT أو Claude' })).toBeVisible();

  const guide = page.locator('section[aria-labelledby="mcp-provider-setup-title"]');
  const chatgpt = guide.getByRole('radio', { name: 'ChatGPT' });
  const claude = guide.getByRole('radio', { name: 'Claude' });
  await chatgpt.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(claude).toBeChecked();
  await expect(guide.getByRole('heading', { name: 'Claude على الويب أو Desktop' })).toBeVisible();

  const snippet = guide.locator('pre');
  await expect(snippet).toHaveAttribute('dir', 'ltr');
  await expect(snippet).toHaveCSS('direction', 'ltr');
  await guide.getByRole('button', { name: 'نسخ الإعداد' }).click();
  await expect(guide.getByRole('button', { name: 'تم النسخ' })).toBeVisible();
  const copiedSnippet = await page.evaluate(() => navigator.clipboard.readText());
  await clearClipboard(page);
  expect(copiedSnippet).toContain('${GIRAPPHE_MCP_TOKEN}');
  expect(copiedSnippet).not.toMatch(/girapphe_mcp_[A-Za-z0-9_-]{20,}/u);

  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(pageOverflow).toBe(false);
  expect(browserErrors).toEqual([]);

  const screenshotPath = testInfo.outputPath('mcp-provider-setup-arabic-success.png');
  const evidencePath = resolve(
    process.cwd(),
    'test-results/authenticated-overlay-performance/mcp-provider-setup',
    `${testInfo.project.name}-ar.json`,
  );
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify({
    schemaVersion: 1,
    evidenceKind: 'read_only_provider',
    project: testInfo.project.name,
    rtlLayout: true,
    ltrCodeBlock: true,
    keyboardProviderSwitch: true,
    copiedWithoutRawPat: true,
    clipboardEmptyAfterTest: true,
    browserErrorCount: browserErrors.length,
    pageOverflow,
  }, null, 2)}\n`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('mcp-provider-setup-arabic-evidence', { path: evidencePath, contentType: 'application/json' });
  await testInfo.attach('mcp-provider-setup-arabic-success', { path: screenshotPath, contentType: 'image/png' });
});
