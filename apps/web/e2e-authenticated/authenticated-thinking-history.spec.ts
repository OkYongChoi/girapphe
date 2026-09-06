import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { expect, test, type Page, type Response } from "@playwright/test";

const messageAsset = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "apps/web/public/thinking-history-messages.json"),
    "utf8",
  ),
) as Record<string, unknown>;
const englishMessages = messageAsset.en as Record<string, unknown> | undefined;

function englishMessage(key: string, fallback: string): string {
  const value = englishMessages?.[key];
  return typeof value === "string" ? value : fallback;
}

const headingCopy = englishMessage("insights.title", "Your thinking, in motion.");
const inspectCopy = englishMessage("insights.showEvidence", "Inspect evidence and reuse");
const contextCopy = englishMessage("insights.context.download", "Download context");

function isContextPackResponse(response: Response): boolean {
  return (
    new URL(response.url()).pathname === "/api/knowledge/context-pack" &&
    response.request().method() === "POST"
  );
}

function isSignalEventResponse(response: Response): boolean {
  if (!isContextPackResponse(response)) return false;
  try {
    const body = response.request().postDataJSON() as Record<string, unknown>;
    return typeof body.operation === "string";
  } catch {
    return false;
  }
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
  const signalEventResponses: Response[] = [];
  const contextResponses: Response[] = [];

  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname === "/thinking-history-messages.json") {
      messageResponses.push(response);
    }
    if (isSignalEventResponse(response)) signalEventResponses.push(response);
    else if (isContextPackResponse(response)) contextResponses.push(response);
  });

  await page.goto("/my-knowledge?view=insights", {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/\/my-knowledge\?view=insights$/);

  const heading = page.getByRole("heading", { name: headingCopy });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => messageResponses.length).toBe(1);
  expect(messageResponses[0]?.status()).toBe(200);
  const contextRequestsBeforeIntent = contextResponses.length;
  expect(contextRequestsBeforeIntent).toBe(0);

  const inspectButton = page
    .getByRole("button", { name: inspectCopy })
    .first();
  await expect(inspectButton).toBeVisible();

  await inspectButton.click();
  expect(contextResponses).toHaveLength(0);

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

  expect(contextResponse.status()).toBe(200);
  expect(contextResponses.map((response) => response.status())).toEqual([200]);
  const signalEventStatuses = signalEventResponses.map((response) => response.status());
  expect(signalEventStatuses).toEqual([204]);
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
    signalEventStatuses,
    contextApiStatuses: contextResponses.map((response) => response.status()),
    contextRequestsBeforeIntent,
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
