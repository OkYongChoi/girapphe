import { expect, test, type Page } from './authenticated-test';

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

test('one logout click clears the active browser session before returning home', async ({ page }, testInfo) => {
  const browserErrors = collectBrowserErrors(page);

  await page.goto('/grid', { waitUntil: 'domcontentloaded' });
  const logoutButton = page.getByRole('button', { name: 'Log out of your account' });
  await expect(logoutButton).toBeVisible();

  const authenticatedResponse = await page.request.get('/api/mobile?resource=notes&locale=en');
  expect(authenticatedResponse.status()).toBe(200);

  await logoutButton.click();

  await expect(page).toHaveURL(/\/en\/?(?:[?#]|$)/);
  await expect(page.getByRole('heading', { name: /Practice STEM concepts/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out of your account' })).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out of your account' })).toHaveCount(0);

  const privateResponse = await page.request.get('/api/mobile?resource=notes&locale=en');
  expect(privateResponse.status()).toBe(401);
  await expect(privateResponse.json()).resolves.toEqual({
    error: 'Sign in is required.',
    code: 'AUTH_REQUIRED',
  });

  await page.waitForTimeout(250);
  expect(browserErrors).toEqual([]);

  const screenshotPath = testInfo.outputPath('authenticated-logout-success.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach('authenticated-logout-success', {
    path: screenshotPath,
    contentType: 'image/png',
  });
});
