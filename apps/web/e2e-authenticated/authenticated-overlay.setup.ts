import fs from 'node:fs/promises';
import path from 'node:path';
import { createClerkClient } from '@clerk/backend';
import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { expect, test as setup } from '@playwright/test';
import {
  AUTHENTICATED_OVERLAY_AUTH_MODES,
  createSyntheticSignInTicket,
  isAuthenticatedOverlayMcpPatMutationPreview,
  resolveAuthenticatedOverlayAuthMode,
} from '../scripts/authenticated-overlay-auth.mjs';
import {
  ensureAuthenticatedOverlayFixture,
  fixtureIdsForUser,
  normalizeSyntheticEmail,
} from '../scripts/authenticated-overlay-fixture.mjs';

setup.describe.configure({ mode: 'serial' });

const authFile = path.resolve('playwright/.clerk/authenticated-overlay-user.json');
const fixtureFile = path.resolve('playwright/.clerk/authenticated-overlay-fixture.json');
let syntheticEmail = '';
let syntheticClerkUserId = '';
let clerkAuthMode = '';

setup('prepare Clerk testing token and owner-scoped fixture', async () => {
  syntheticEmail = normalizeSyntheticEmail(process.env.E2E_CLERK_USER_EMAIL);
  clerkAuthMode = resolveAuthenticatedOverlayAuthMode();
  if (clerkAuthMode === AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken) {
    await clerkSetup({ dotenv: false });
  }
  const result = await ensureAuthenticatedOverlayFixture({
    emailAddress: syntheticEmail,
    resetMcpAccessTokens: isAuthenticatedOverlayMcpPatMutationPreview({
      emailAddress: syntheticEmail,
    }),
  });
  syntheticClerkUserId = result.user.id;
  const recallFixture = process.env.E2E_RECALL_ENABLED === 'true'
    ? { itemId: fixtureIdsForUser(result.user.id).recall.itemId }
    : null;
  await fs.mkdir(path.dirname(fixtureFile), { recursive: true });
  await fs.writeFile(fixtureFile, `${JSON.stringify({
    userId: result.user.id,
    recall: recallFixture,
  }, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    authenticatedOverlayFixture: result.fixture.counts,
    authenticatedRecallFixture: recallFixture ? { perDeviceReset: true } : null,
    clerkAuthMode,
    createdClerkUser: result.createdClerkUser,
  }));
});

setup('sign in synthetic user and save authentication state', async ({ page }) => {
  expect(syntheticEmail, 'synthetic user setup completed before authentication').not.toBe('');
  await fs.mkdir(path.dirname(authFile), { recursive: true });

  await page.goto('/login');
  if (clerkAuthMode === AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken) {
    await clerk.signIn({ page, emailAddress: syntheticEmail });
  } else {
    expect(syntheticClerkUserId, 'synthetic Clerk user exists before authentication').not.toBe('');
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const ticket = await createSyntheticSignInTicket({
      clerkClient,
      userId: syntheticClerkUserId,
    });
    await clerk.loaded({ page });
    await page.evaluate(async (signInTicket) => {
      const clerkClient = window.Clerk.client;
      if (!clerkClient) throw new Error('Clerk client is unavailable for sign-in ticket exchange.');
      const signIn = await clerkClient.signIn.create({
        strategy: 'ticket',
        ticket: signInTicket,
      });
      if (signIn.status !== 'complete' || !signIn.createdSessionId) {
        throw new Error(`Clerk sign-in ticket did not complete: ${signIn.status}`);
      }
      await window.Clerk.setActive({ session: signIn.createdSessionId });
    }, ticket);
    await page.waitForFunction(() => window.Clerk?.user !== null);
  }

  await page.context().storageState({ path: authFile });
});
