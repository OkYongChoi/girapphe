import { expect, test } from '@playwright/test';

test.describe('main stabilization regressions', () => {
  test('clearing filters in My Notes trash keeps the trash view', async ({ page }) => {
    await page.goto('/my-knowledge?view=trash&q=no-match');

    await expect(page.getByRole('heading', { name: 'Knowledge Trash' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clear', exact: true })).toHaveAttribute(
      'href',
      /\/(?:en\/)?my-knowledge\?view=trash$/
    );
  });

});
