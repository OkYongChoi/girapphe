import { expect, test } from '@playwright/test';

const usesDeployedPreview = Boolean(process.env.PLAYWRIGHT_BASE_URL);

test.describe('main stabilization regressions', () => {
  test('clearing filters in My Notes trash keeps the trash view', async ({ page }) => {
    await page.goto('/my-knowledge?view=trash&q=no-match');

    await expect(page.getByRole('heading', { name: 'Knowledge Trash' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clear', exact: true })).toHaveAttribute(
      'href',
      /\/(?:en\/)?my-knowledge\?view=trash$/
    );
  });

  test('a guest note appears as one private Concepts card', async ({ page }, testInfo) => {
    test.skip(
      usesDeployedPreview,
      'Guest-note mutations are covered by the isolated local in-memory browser suite.',
    );

    const title = `Guest concept injection ${testInfo.project.name} ${Date.now()}`;

    await page.goto('/my-knowledge');
    await page.locator('#new-title').fill(title);
    await page.locator('#new-topic').fill('machine-learning');
    await page.locator('#new-summary').fill('A private note rendered in Concepts.');
    await page.locator('#new-tags').fill('optimization');
    await page.getByRole('button', { name: 'Save item' }).click();

    await expect(page.getByRole('heading', { name: title, level: 3 })).toBeVisible();

    await page.goto('/grid');
    const privateCard = page.getByTestId('concept-card').filter({ hasText: title });
    await expect(privateCard).toHaveCount(1);
    await expect(privateCard).toContainText('Private card');
    await expect(privateCard).toContainText('Machine Learning');
    await expect(privateCard).toContainText('#optimization');
  });

});
