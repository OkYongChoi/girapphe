import fs from 'node:fs/promises';
import path from 'node:path';
import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { expect, test as setup } from '@playwright/test';

setup.describe.configure({ mode: 'serial' });

const authFile = path.resolve('playwright/.clerk/authenticated-overlay-user.json');
let syntheticEmail = '';

setup('prepare Clerk testing token and owner-scoped fixture', async () => {
  const {
    ensureAuthenticatedOverlayFixture,
    normalizeSyntheticEmail,
  } = await import('../scripts/authenticated-overlay-fixture.mjs');
  syntheticEmail = normalizeSyntheticEmail(process.env.E2E_CLERK_USER_EMAIL);
  await clerkSetup({ dotenv: false });
  const result = await ensureAuthenticatedOverlayFixture({ emailAddress: syntheticEmail });
  console.log(JSON.stringify({
    authenticatedOverlayFixture: result.fixture.counts,
    createdClerkUser: result.createdClerkUser,
  }));
});

setup('sign in synthetic user and save authentication state', async ({ page }) => {
  expect(syntheticEmail, 'synthetic user setup completed before authentication').not.toBe('');
  await fs.mkdir(path.dirname(authFile), { recursive: true });

  await page.goto('/login');
  await clerk.signIn({ page, emailAddress: syntheticEmail });
  await page.goto('/grid');
  await expect(page.getByTitle(syntheticEmail)).toBeVisible();

  await page.context().storageState({ path: authFile });
});
