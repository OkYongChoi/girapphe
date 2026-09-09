import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('switches between ChatGPT and Claude setup without exposing a PAT', async ({ context, page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`page: ${error.message}`));

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/knowledge-inbox', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Knowledge Inbox' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Use Girapphe with ChatGPT or Claude' })).toBeVisible();

  const chatgpt = page.getByRole('radio', { name: 'ChatGPT' });
  const claude = page.getByRole('radio', { name: 'Claude' });
  await expect(chatgpt).toBeChecked();
  await expect(page.getByRole('heading', { name: 'ChatGPT web app' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Use the PAT with OpenAI Responses API' })).toBeVisible();
  await expect(page.getByText('GIRAPPHE_MCP_TOKEN', { exact: false }).first()).toBeVisible();

  const openAiTokenArticle = page.locator('article').filter({
    has: page.getByRole('heading', { name: 'Use the PAT with OpenAI Responses API' }),
  });
  const copySetup = openAiTokenArticle.getByRole('button');
  await copySetup.click();
  await expect(copySetup).toHaveText('Copied');
  const openAiSnippet = await page.evaluate(() => navigator.clipboard.readText());
  expect(openAiSnippet).toContain('type: "mcp"');
  expect(openAiSnippet).toContain(`${new URL(page.url()).origin}/api/mcp`);
  expect(openAiSnippet).toContain('process.env.GIRAPPHE_MCP_TOKEN');
  expect(openAiSnippet).toContain('get_topic_context');

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
  expect(claudeSnippet).toContain('claude mcp add-json girapphe');
  expect(claudeSnippet).toContain('${GIRAPPHE_MCP_TOKEN}');

  const renderedText = await page.locator('main').innerText();
  expect(renderedText).not.toMatch(/girapphe_mcp_[A-Za-z0-9_-]{20,}/u);
  const overflowsViewport = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflowsViewport).toBe(false);
  expect(browserErrors).toEqual([]);

  const screenshotPath = testInfo.outputPath('mcp-provider-setup-success.png');
  const evidencePath = resolve(
    process.cwd(),
    'test-results/authenticated-overlay-performance/mcp-provider-setup',
    `${testInfo.project.name}.json`,
  );
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify({
    schemaVersion: 1,
    route: '/knowledge-inbox',
    project: testInfo.project.name,
    providers: ['chatgpt', 'claude'],
    copiedWithoutRawPat: true,
    browserErrorCount: browserErrors.length,
    pageOverflow: overflowsViewport,
  }, null, 2)}\n`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('mcp-provider-setup-evidence', { path: evidencePath, contentType: 'application/json' });
  await testInfo.attach('mcp-provider-setup-success', { path: screenshotPath, contentType: 'image/png' });
});
