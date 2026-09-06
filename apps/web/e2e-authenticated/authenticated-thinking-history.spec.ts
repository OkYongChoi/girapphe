import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { expect, test, type Page, type Response } from "@playwright/test";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(
      collectStrings,
    );
  }
  return [];
}

const messageAsset = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "apps/web/public/thinking-history-messages.json"),
    "utf8",
  ),
) as Record<string, unknown>;
const localizedCopy = collectStrings(messageAsset);

function copyMatching(pattern: RegExp, fallback: string): string {
  return localizedCopy.find((value) => pattern.test(value)) ?? fallback;
}

const headingCopy = copyMatching(/thinking history/i, "Thinking History");
const inspectCopy = copyMatching(
  /inspect.*evidence|evidence.*reuse/i,
  "Inspect evidence and reuse",
);
const contextCopy = copyMatching(
  /(?:download|create|build|reuse|use).{0,40}context|context.{0,40}(?:download|create|build|reuse|use)/i,
  "Download context",
);

function isContextPackResponse(response: Response): boolean {
  return (
    new URL(response.url()).pathname === "/api/knowledge/context-pack" &&
    response.request().method() === "POST"
  );
}

function installBrowserErrorGuards(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

test.skip(
  process.env.E2E_THINKING_HISTORY_ENABLED !== "true",
  "Thinking History is enabled for Preview evidence only; production needs an explicit synthetic-user allowlist gate.",
);

test("renders private intelligence evidence and exports only selected context", async ({
  page,
}, testInfo) => {
  const startedAt = Date.now();
  const browserErrors = installBrowserErrorGuards(page);
  const messageResponses: Response[] = [];
  const contextResponses: Response[] = [];

  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname === "/thinking-history-messages.json") {
      messageResponses.push(response);
    }
    if (isContextPackResponse(response)) contextResponses.push(response);
  });

  await page.goto("/my-knowledge?view=insights", {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/\/my-knowledge\?view=insights$/);

  const heading = page.getByRole("heading", { name: headingCopy });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => messageResponses.length).toBe(1);
  expect(messageResponses[0]?.status()).toBe(200);
  expect(contextResponses).toEqual([]);

  const inspectButton = page
    .getByRole("button", { name: inspectCopy })
    .first();
  await expect(inspectButton).toBeVisible();

  const viewedResponsePromise = page.waitForResponse(
    (response) => isContextPackResponse(response) && response.status() === 204,
  );
  await inspectButton.click();
  const viewedResponse = await viewedResponsePromise;
  expect(contextResponses.map((response) => response.status())).toEqual([204]);

  const signalRoot = inspectButton.locator(
    "xpath=ancestor::*[.//input[@type='checkbox']][1]",
  );
  const evidenceCheckboxes = signalRoot.getByRole("checkbox");
  await expect(evidenceCheckboxes.first()).toBeVisible();
  expect(await evidenceCheckboxes.count()).toBeGreaterThanOrEqual(2);
  await evidenceCheckboxes.nth(0).check();
  await evidenceCheckboxes.nth(1).check();

  let contextButton = signalRoot.getByRole("button", {
    name: contextCopy,
  });
  if ((await contextButton.count()) === 0) {
    contextButton = signalRoot
      .getByRole("button")
      .filter({ hasText: /context|download/i });
  }
  await expect(contextButton.first()).toBeEnabled();

  const contextResponsePromise = page.waitForResponse(
    (response) => isContextPackResponse(response) && response.status() === 200,
  );
  const downloadPromise = page.waitForEvent("download");
  await contextButton.first().click();
  const [contextResponse, download] = await Promise.all([
    contextResponsePromise,
    downloadPromise,
  ]);

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const markdown = readFileSync(downloadPath!, "utf8");
  expect(Buffer.byteLength(markdown)).toBeGreaterThan(100);
  expect(markdown).toMatch(/synthetic|authenticated overlay/i);
  expect(markdown).not.toMatch(
    /raw[_ -]?(?:conversation|transcript)|sk_(?:live|test)|secret/i,
  );

  expect(viewedResponse.status()).toBe(204);
  expect(contextResponse.status()).toBe(200);
  expect(contextResponses.map((response) => response.status())).toEqual([
    204, 200,
  ]);
  expect(browserErrors).toEqual([]);

  const messageBytes = Buffer.byteLength(await messageResponses[0]!.body());
  const metrics = {
    schemaVersion: 1,
    route: "/my-knowledge?view=insights",
    project: testInfo.project.name,
    syntheticPrivateEvidenceCount: 2,
    messageAsset: {
      requests: messageResponses.length,
      status: messageResponses[0]!.status(),
      bytes: messageBytes,
    },
    contextApiStatuses: contextResponses.map((response) => response.status()),
    contextRequestsBeforeIntent: 0,
    contextBytes: Buffer.byteLength(markdown),
    browserErrorCount: browserErrors.length,
    durationMs: Date.now() - startedAt,
  };

  const metricsPath = resolve(
    process.cwd(),
    "test-results/authenticated-overlay-performance/thinking-history",
    `${testInfo.project.name}.json`,
  );
  const screenshotPath = testInfo.outputPath("thinking-history-success.png");
  mkdirSync(dirname(metricsPath), { recursive: true });
  writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("thinking-history-metrics", {
    path: metricsPath,
    contentType: "application/json",
  });
  await testInfo.attach("thinking-history-success", {
    path: screenshotPath,
    contentType: "image/png",
  });
});
