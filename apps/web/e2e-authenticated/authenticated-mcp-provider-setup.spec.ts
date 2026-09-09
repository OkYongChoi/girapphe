import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  AUTHENTICATED_OVERLAY_AUTH_MODES,
  resolveAuthenticatedOverlayAuthMode,
} from '../scripts/authenticated-overlay-auth.mjs';

const RAW_PAT_PATTERN = /girapphe_mcp_[A-Za-z0-9_-]{20,}/u;
const RAW_PAT_SHAPE = /^girapphe_mcp_[A-Za-z0-9_-]{20,}$/u;

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

async function hidePatSurface(page: Page): Promise<void> {
  await page.evaluate(() => {
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
}

async function clearClipboard(page: Page): Promise<void> {
  await page.evaluate(() => navigator.clipboard.writeText(''));
}

test('switches between ChatGPT and Claude setup without exposing a PAT', async ({ context, page }, testInfo) => {
  const authMode = resolveAuthenticatedOverlayAuthMode();
  test.skip(
    authMode !== AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken,
    'PAT mutation evidence is restricted to the dedicated testing-token Preview fixture.',
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

  const connectionLabel = `Provider placeholder evidence ${testInfo.project.name}`;
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
  let rawSurfaceAbsentAfterReload = false;

  try {
    await page.getByLabel('Connection label').fill(connectionLabel);
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
  } finally {
    let cleanupError: unknown = null;
    try {
      await hidePatSurface(page);
      await clearClipboard(page);
    } catch (error) {
      cleanupError = error;
    }

    try {
      const capturedPatRequiresRevocation = rawToken.length > 0;
      let tokenRow = page.getByRole('listitem').filter({
        has: page.getByText(connectionLabel, { exact: true }),
      });
      let revokeButton = tokenRow.getByRole('button', { name: 'Revoke' });
      let revokeButtonVisible = false;
      try {
        await revokeButton.waitFor({ state: 'visible', timeout: 5_000 });
        revokeButtonVisible = true;
      } catch {
        await hidePatSurface(page);
        await clearClipboard(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        tokenRow = page.getByRole('listitem').filter({
          has: page.getByText(connectionLabel, { exact: true }),
        });
        revokeButton = tokenRow.getByRole('button', { name: 'Revoke' });
        try {
          await revokeButton.waitFor({ state: 'visible', timeout: 5_000 });
          revokeButtonVisible = true;
        } catch (error) {
          if (capturedPatRequiresRevocation) throw error;
        }
      }
      if (revokeButtonVisible) {
        page.once('dialog', (dialog) => dialog.accept());
        await revokeButton.click();
        await expect(tokenRow.getByText('Revoked', { exact: true })).toBeVisible();
      }
    } catch (error) {
      cleanupError ??= error;
    }

    try {
      await hidePatSurface(page);
      await clearClipboard(page);
      await page.reload({ waitUntil: 'domcontentloaded' });

      const reloadedTokenRow = page.getByRole('listitem').filter({
        has: page.getByText(connectionLabel, { exact: true }),
      });
      revokedAfterReload = await reloadedTokenRow.getByText('Revoked', { exact: true }).isVisible();
      rawSurfaceAbsentAfterReload = await page.locator(
        '#ai-connections [role="status"] code',
      ).count() === 0;
    } catch (error) {
      cleanupError ??= error;
    }

    rawToken = '';
    if (cleanupError) throw cleanupError;
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
    route: '/en/settings#ai-connections',
    project: testInfo.project.name,
    providers: ['chatgpt', 'claude'],
    createdOneTimePat: true,
    copiedWithoutRawPat: true,
    revokedBeforeScreenshot: revokedAfterReload,
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
    route: '/ar/settings#ai-connections',
    locale: 'ar',
    direction: 'rtl',
    codeDirection: 'ltr',
    project: testInfo.project.name,
    keyboardProviderSwitch: true,
    copiedWithoutRawPat: true,
    browserErrorCount: browserErrors.length,
    pageOverflow,
  }, null, 2)}\n`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('mcp-provider-setup-arabic-evidence', { path: evidencePath, contentType: 'application/json' });
  await testInfo.attach('mcp-provider-setup-arabic-success', { path: screenshotPath, contentType: 'image/png' });
});
