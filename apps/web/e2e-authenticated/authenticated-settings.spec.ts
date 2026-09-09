import { expect, test, type Page } from '@playwright/test';

const SETTINGS_STORAGE_KEY = 'girapphe:settings-preferences';

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon\.ico/i.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectSettingsTouchTargets(page: Page) {
  const undersized = await page.locator('main section a[href], main section button, main section select')
    .evaluateAll((elements) => elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) {
        return [];
      }
      return rect.width < 44 || rect.height < 44
        ? [{ tag: element.tagName, text: element.textContent?.trim().slice(0, 80), width: rect.width, height: rect.height }]
        : [];
    }));
  expect(undersized, 'visible Settings links, buttons, and selects smaller than 44 CSS px').toEqual([]);
}

test('keeps AI connection guidance honest and restores browser-local reuse defaults', async ({
  page,
}, testInfo) => {
  const browserErrors = collectBrowserErrors(page);
  await page.addInitScript((storageKey) => {
    const initializedKey = `${storageKey}:e2e-initialized`;
    if (window.sessionStorage.getItem(initializedKey)) return;
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.setItem(initializedKey, 'true');
  }, SETTINGS_STORAGE_KEY);

  await page.goto('/en/settings#ai-connections', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/en\/settings#ai-connections$/);
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  const settingsEntry = page.getByRole('link', { name: 'Open settings' });
  await expect(settingsEntry).toBeVisible();
  const entryBox = await settingsEntry.boundingBox();
  expect(entryBox?.width).toBeGreaterThanOrEqual(44);
  expect(entryBox?.height).toBeGreaterThanOrEqual(44);

  const connectionDisclosure = page.locator('#ai-connections > button');
  await expect(connectionDisclosure).toHaveAttribute('aria-expanded', 'true');
  await connectionDisclosure.focus();
  await connectionDisclosure.press('Space');
  await expect(connectionDisclosure).toHaveAttribute('aria-expanded', 'false');
  await connectionDisclosure.press('Enter');
  await expect(connectionDisclosure).toHaveAttribute('aria-expanded', 'true');

  const aiClient = page.locator('#settings-ai-client');
  const contextFormat = page.locator('#settings-context-format');
  await expect(aiClient).toHaveValue('chatgpt');
  await expect(contextFormat).toHaveValue('markdown');
  await expect(page.getByText('Model selection stays in the AI app.')).toBeVisible();

  const saveAnnouncement = page.getByRole('status');
  await aiClient.selectOption('claude');
  await expect(saveAnnouncement).toHaveAttribute('data-save-announcement', '1');
  await expect(saveAnnouncement).toHaveText('Saved on this browser.');
  const firstAnnouncement = await saveAnnouncement.locator('span').elementHandle();
  expect(firstAnnouncement).not.toBeNull();
  await contextFormat.selectOption('json');
  await expect(saveAnnouncement).toHaveAttribute('data-save-announcement', '2');
  await expect(saveAnnouncement).toHaveText('Saved on this browser.');
  await expect.poll(() => firstAnnouncement!.evaluate((element) => element.isConnected)).toBe(false);
  await expect(page.getByText(/Choose the exact model in Claude/)).toBeVisible();
  await expect.poll(() => page.evaluate((storageKey) => window.localStorage.getItem(storageKey), SETTINGS_STORAGE_KEY))
    .toBe(JSON.stringify({ version: 1, aiClient: 'claude', contextFormat: 'json' }));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(aiClient).toHaveValue('claude');
  await expect(contextFormat).toHaveValue('json');

  if (process.env.E2E_THINKING_HISTORY_ENABLED === 'true') {
    await page.goto('/en/my-notes?view=insights', { waitUntil: 'domcontentloaded' });
    await page.locator('.thinking-evidence-toggle').first().click();
    await expect(page.locator('select.thinking-format-select').first()).toHaveValue('json');
  }

  await page.goto('/ar/settings#ai-connections', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#settings-ai-client')).toHaveValue('claude');
  await expect(page.locator('#settings-context-format')).toHaveValue('json');
  await expect(page.locator('a[href="/ar/subscription"] span[aria-hidden="true"]')).toHaveText('←');
  await expect(page.locator('section[lang="en"][dir="ltr"]').filter({
    has: page.getByRole('heading', { name: 'Use Girapphe with ChatGPT or Claude' }),
  })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await expectSettingsTouchTargets(page);
  await page.waitForTimeout(250);
  expect(browserErrors).toEqual([]);

  const screenshotPath = testInfo.outputPath('authenticated-settings-success.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('authenticated-settings-success', {
    path: screenshotPath,
    contentType: 'image/png',
  });
});
