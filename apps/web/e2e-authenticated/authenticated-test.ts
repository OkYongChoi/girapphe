import {
  clerkSetup,
  setupClerkTestingToken,
} from '@clerk/testing/playwright';
import {
  expect,
  request as playwrightRequest,
  test as base,
  type APIRequestContext,
} from '@playwright/test';
import {
  AUTHENTICATED_OVERLAY_AUTH_MODES,
  resolveAuthenticatedOverlayAuthMode,
} from '../scripts/authenticated-overlay-auth.mjs';

type ClerkContextFixtures = {
  bearerOnlyApi: APIRequestContext;
  clerkTestingToken: void;
};

type ClerkWorkerFixtures = {
  clerkTestingEnvironment: void;
};

export const test = base.extend<ClerkContextFixtures, ClerkWorkerFixtures>({
  bearerOnlyApi: async ({}, provide) => {
    const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
    if (!configuredBaseUrl) {
      throw new Error('PLAYWRIGHT_BASE_URL is required for bearer-only API evidence.');
    }
    const api = await playwrightRequest.newContext({
      baseURL: new URL(configuredBaseUrl).origin,
      storageState: { cookies: [], origins: [] },
    });
    try {
      await provide(api);
    } finally {
      await api.dispose();
    }
  },
  clerkTestingEnvironment: [async ({}, provide) => {
    if (
      resolveAuthenticatedOverlayAuthMode()
      === AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken
    ) {
      await clerkSetup({ dotenv: false });
    }
    await provide();
  }, { scope: 'worker' }],
  clerkTestingToken: [async ({ context, clerkTestingEnvironment }, provide) => {
    void clerkTestingEnvironment;
    if (
      resolveAuthenticatedOverlayAuthMode()
      === AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken
    ) {
      await setupClerkTestingToken({ context });
    }
    await provide();
  }, { auto: true }],
});

export { expect };
export type {
  APIRequestContext,
  APIResponse,
  BrowserContext,
  Locator,
  Page,
  Request,
  Response,
  TestInfo,
} from '@playwright/test';
