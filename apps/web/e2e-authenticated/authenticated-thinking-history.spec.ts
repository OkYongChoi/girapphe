import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { expect, test, type Page, type Request, type Response } from "@playwright/test";
import { EXTRA_EN_MESSAGES } from "../src/i18n/catalogs/extended/en";

const thinkingHistoryAsset = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "apps/web/public/thinking-history-messages.json"),
    "utf8",
  ),
) as Record<string, unknown>;
const importAsset = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "apps/web/public/conversation-import-messages.json"),
    "utf8",
  ),
) as Record<string, unknown>;
const englishThinkingHistory = thinkingHistoryAsset.en as Record<string, unknown> | undefined;
const englishImport = importAsset.en as Record<string, unknown> | undefined;

function staticMessage(
  catalog: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  const value = catalog?.[key];
  return typeof value === "string" ? value : fallback;
}

const headingCopy = staticMessage(englishThinkingHistory, "insights.title", "Your thinking, in motion.");
const inspectCopy = staticMessage(englishThinkingHistory, "insights.showEvidence", "Inspect evidence and reuse");
const openKnowledgeCopy = staticMessage(englishThinkingHistory, "insights.openKnowledge", "Open approved knowledge");
const contextFormatCopy = staticMessage(englishThinkingHistory, "insights.context.format", "Format");
const contextCopy = staticMessage(englishThinkingHistory, "insights.context.copy", "Copy context");
const contextDownloadCopy = staticMessage(englishThinkingHistory, "insights.context.download", "Download context");
const contextCopiedCopy = staticMessage(englishThinkingHistory, "insights.context.copied", "Context copied and reuse recorded.");
const dismissCopy = staticMessage(englishThinkingHistory, "insights.dismiss.unhelpful", "Not useful");
const importHeadingCopy = "Find the ideas worth carrying forward.";
const importSummaryCopy = staticMessage(englishImport, "import.summaryTitle", "This is the shape of your AI history");
const importConsentCopy = staticMessage(englishImport, "import.consent", "I selected these exchanges intentionally.");
const transformationSummaryCopy = EXTRA_EN_MESSAGES["inbox.transformationSummary"];
const accountDataTitleCopy = EXTRA_EN_MESSAGES["account.data.title"];
const downloadExportCopy = EXTRA_EN_MESSAGES["account.data.downloadExport"];
const deleteImportCopy = EXTRA_EN_MESSAGES["account.data.deleteImport"];

type ContextFormat = "markdown" | "yaml" | "json";
const IMPORT_SUBMISSION_EVENT_NAMES = new Set([
  "conversation_import_started",
  "conversation_import_parsed",
  "conversation_import_confirmed",
  "conversation_import_candidates_ready",
]);

function isContextPackResponse(response: Response): boolean {
  return (
    new URL(response.url()).pathname === "/api/knowledge/context-pack" &&
    response.request().method() === "POST"
  );
}

function responseBody(response: Response): Record<string, unknown> | null {
  try {
    return response.request().postDataJSON() as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function importSubmissionEvents(page: Page): Promise<Record<string, unknown>[]> {
  const exportData = await page.evaluate(async () => {
    const response = await fetch("/api/knowledge/export?scope=all", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`Knowledge export failed with ${response.status}.`);
    return response.json() as Promise<Record<string, unknown>>;
  });
  const events = exportData.intelligence_feedback_and_metrics;
  if (!Array.isArray(events)) throw new Error("Knowledge export omitted product events.");
  return events.filter((event): event is Record<string, unknown> => (
    typeof event === "object"
    && event !== null
    && typeof event.event_name === "string"
    && IMPORT_SUBMISSION_EVENT_NAMES.has(event.event_name)
  ));
}

function contextFormat(response: Response): ContextFormat | null {
  if (!isContextPackResponse(response)) return null;
  const format = responseBody(response)?.format;
  return format === "markdown" || format === "yaml" || format === "json" ? format : null;
}

function signalOperation(response: Response): string | null {
  if (!isContextPackResponse(response)) return null;
  const operation = responseBody(response)?.operation;
  return typeof operation === "string" ? operation : null;
}

function installBrowserErrorGuards(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

function sameOriginPostBody(request: Request): string | null {
  if (request.method() !== "POST") return null;
  const baseUrl = new URL(process.env.PLAYWRIGHT_BASE_URL!);
  if (new URL(request.url()).origin !== baseUrl.origin) return null;
  return request.postData();
}

function requestMaterial(request: Request): string {
  return `${request.url()}\n${request.postData() ?? ""}`;
}

function assertPortableContext(format: ContextFormat, content: string) {
  expect(Buffer.byteLength(content)).toBeGreaterThan(100);
  expect(content).toMatch(/synthetic|authenticated overlay/i);
  expect(content).not.toMatch(
    /raw[_ -]?(?:conversation|transcript)|sk_(?:live|test)|secret/i,
  );
  if (format === "json") {
    expect(() => JSON.parse(content)).not.toThrow();
  } else if (format === "yaml") {
    expect(content).toMatch(/^"(?:generated_at|items|topic)":/m);
  } else {
    expect(content).toMatch(/^#/m);
  }
}

function exportMessage(id: string, role: "user" | "assistant", text: string, createdAt: number) {
  return {
    id,
    message: {
      id,
      author: { role },
      create_time: createdAt,
      content: { content_type: "text", parts: [text] },
      metadata: {},
    },
  };
}

async function downloadText(page: Page, linkName: string) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: linkName }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFileSync(path!, "utf8");
}

test.skip(
  process.env.E2E_THINKING_HISTORY_ENABLED !== "true",
  "Thinking History is enabled for Preview evidence only; production needs an explicit synthetic-user allowlist gate.",
);

test("proves selected import, private evidence, portable context, dismissal, and deletion", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(120_000);
  const startedAt = Date.now();
  const browserErrors = installBrowserErrorGuards(page);
  const messageResponses: Response[] = [];
  const signalEventResponses: Response[] = [];
  const contextResponses: Response[] = [];
  const postBodies: string[] = [];
  const outboundRequestMaterial: string[] = [];

  page.on("request", (request) => {
    outboundRequestMaterial.push(requestMaterial(request));
    const body = sameOriginPostBody(request);
    if (body !== null) postBodies.push(body);
  });
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname === "/thinking-history-messages.json") messageResponses.push(response);
    if (signalOperation(response)) signalEventResponses.push(response);
    else if (contextFormat(response)) contextResponses.push(response);
  });

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/my-notes?view=insights", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/my-notes\?view=insights$/);
  await expect(page.getByRole("heading", { name: headingCopy })).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => messageResponses.length).toBe(1);
  expect(messageResponses[0]?.status()).toBe(200);
  expect(contextResponses).toHaveLength(0);

  const signalRoot = page.locator(".thinking-card").first();
  const inspectButton = signalRoot.getByRole("button", { name: inspectCopy });
  await expect(inspectButton).toBeVisible();
  await inspectButton.click();
  const evidenceCheckboxes = signalRoot.getByRole("checkbox");
  await expect(evidenceCheckboxes.first()).toBeVisible();
  expect(await evidenceCheckboxes.count()).toBeGreaterThanOrEqual(2);
  await evidenceCheckboxes.nth(0).check();
  await evidenceCheckboxes.nth(1).check();

  const formats: ContextFormat[] = ["json", "yaml", "markdown"];
  const contextPayloads: string[] = [];
  const formatSelect = signalRoot.getByRole("combobox", { name: contextFormatCopy });
  for (const format of formats) {
    await formatSelect.selectOption(format);
    const copyResponsePromise = page.waitForResponse(
      (response) => contextFormat(response) === format && response.status() === 200,
    );
    await signalRoot.getByRole("button", { name: contextCopy }).click();
    await copyResponsePromise;
    await expect(signalRoot.getByRole("status")).toHaveText(contextCopiedCopy);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    assertPortableContext(format, clipboard);
    contextPayloads.push(clipboard);

    const downloadResponsePromise = page.waitForResponse(
      (response) => contextFormat(response) === format && response.status() === 200,
    );
    const downloadPromise = page.waitForEvent("download");
    await signalRoot.getByRole("button", { name: contextDownloadCopy }).click();
    const [downloadResponse, download] = await Promise.all([
      downloadResponsePromise,
      downloadPromise,
    ]);
    expect(downloadResponse.headers()["content-disposition"]).toContain(
      `girapphe-context-pack.${format === "markdown" ? "md" : format}`,
    );
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const downloaded = readFileSync(downloadPath!, "utf8");
    assertPortableContext(format, downloaded);
    contextPayloads.push(downloaded);
  }

  const openKnowledgeLink = signalRoot.getByRole("link", { name: openKnowledgeCopy }).first();
  await expect(openKnowledgeLink).toHaveAttribute("href", /\/topics\/[^#]+#item-/);
  const evidenceOpenedPromise = page.waitForResponse(
    (response) => signalOperation(response) === "evidence_opened" && response.status() === 204,
  );
  await openKnowledgeLink.click();
  await evidenceOpenedPromise;
  await expect(page).toHaveURL(/\/topics\/[^#]+#item-/);

  await page.goto("/my-notes?view=insights", { waitUntil: "domcontentloaded" });
  const signalCards = page.locator(".thinking-card");
  await expect(signalCards.first()).toBeVisible({ timeout: 30_000 });
  const signalCountBeforeDismiss = await signalCards.count();
  // Desktop and mobile may run sequentially. The fixture provides two
  // independent signals so each project still has at least one to dismiss.
  expect(signalCountBeforeDismiss).toBeGreaterThanOrEqual(1);
  const dismissedSignal = signalCards.first();
  const dismissedSignalId = await dismissedSignal.getAttribute("data-signal-id");
  expect(dismissedSignalId).not.toBeNull();
  const dismissedSignalIdentity = page.locator(
    `.thinking-card[data-signal-id=${JSON.stringify(dismissedSignalId)}]`,
  );
  await expect(dismissedSignalIdentity).toHaveCount(1);
  const dismissInspectButton = dismissedSignal.getByRole("button", { name: inspectCopy });
  await dismissInspectButton.click();
  const dismissedEvidenceLink = dismissedSignal.getByRole("link", {
    name: openKnowledgeCopy,
  }).first();
  await expect(dismissedEvidenceLink).toHaveAttribute("href", /\/topics\/[^#]+#item-/);
  page.once("dialog", (dialog) => dialog.accept());
  const dismissResponsePromise = page.waitForResponse(
    (response) => signalOperation(response) === "dismissed" && response.status() === 204,
  );
  await dismissedSignalIdentity.getByRole("button", { name: dismissCopy }).click();
  await dismissResponsePromise;
  await expect(dismissedSignalIdentity).toHaveCount(0);
  await expect(signalCards).toHaveCount(signalCountBeforeDismiss - 1);

  const marker = randomUUID().replaceAll("-", "");
  const selectedQuestionA = `E2E_SELECTED_QUESTION_A_${marker}`;
  const selectedAnswerA = `E2E_SELECTED_ANSWER_A_${marker}`;
  const selectedQuestionB = `E2E_SELECTED_QUESTION_B_${marker}`;
  const selectedAnswerB = `E2E_SELECTED_ANSWER_B_${marker}`;
  const unselectedMarker = `E2E_UNSELECTED_RAW_${marker}`;
  const filenameMarker = `E2E_PRIVATE_FILENAME_${marker}`;
  const conversationId = `conversation-${marker}`;
  const fixture = [{
    id: conversationId,
    title: "Synthetic import evidence",
    create_time: 1_788_000_000,
    mapping: {
      userA: exportMessage(`user-a-${marker}`, "user", selectedQuestionA, 1_788_000_001),
      answerA: exportMessage(`answer-a-${marker}`, "assistant", selectedAnswerA, 1_788_000_002),
      userB: exportMessage(`user-b-${marker}`, "user", selectedQuestionB, 1_788_000_003),
      answerB: exportMessage(`answer-b-${marker}`, "assistant", selectedAnswerB, 1_788_000_004),
      userC: exportMessage(`user-c-${marker}`, "user", unselectedMarker, 1_788_000_005),
      answerC: exportMessage(`answer-c-${marker}`, "assistant", `${unselectedMarker}_ANSWER`, 1_788_000_006),
    },
  }];

  const importRequestStart = postBodies.length;
  const importOutboundRequestStart = outboundRequestMaterial.length;
  await page.goto("/knowledge-inbox/import", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: importHeadingCopy })).toBeVisible();
  await page.locator("#chatgpt-export-file").setInputFiles({
    name: `${filenameMarker}.json`,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(page.getByRole("heading", { name: importSummaryCopy })).toBeVisible();
  const exchangeRow = (question: string) => page.getByRole("listitem").filter({
    has: page.getByRole("checkbox", { name: question }),
  });
  const selectedExchangeARow = exchangeRow(selectedQuestionA);
  const selectedExchangeBRow = exchangeRow(selectedQuestionB);
  const unselectedExchangeRow = exchangeRow(unselectedMarker);
  for (const [row, question] of [
    [selectedExchangeARow, selectedQuestionA],
    [selectedExchangeBRow, selectedQuestionB],
    [unselectedExchangeRow, unselectedMarker],
  ] as const) {
    await expect(row).toHaveCount(1);
    await expect(row).toBeVisible();
    await expect(row).toContainText(question);
  }
  await page.waitForTimeout(500);
  const privateMarkers = [
    selectedQuestionA,
    selectedAnswerA,
    selectedQuestionB,
    selectedAnswerB,
    unselectedMarker,
    `${unselectedMarker}_ANSWER`,
    filenameMarker,
  ];
  const preConsentRequestMaterial = outboundRequestMaterial.slice(importOutboundRequestStart).join("\n");
  for (const privateMarker of privateMarkers) {
    expect(
      preConsentRequestMaterial.includes(privateMarker),
      "no selected, unselected, or filename marker leaves the browser before consent",
    ).toBe(false);
  }
  expect(
    postBodies.slice(importRequestStart),
    "local parsing must not invoke a same-origin Server Action before consent",
  ).toHaveLength(0);
  const preConsentImportEvents = await importSubmissionEvents(page);
  expect(
    preConsentImportEvents,
    "local parsing must not create product-event rows before consent",
  ).toEqual([]);

  for (const row of [selectedExchangeARow, selectedExchangeBRow]) {
    await row.getByRole("checkbox").check();
  }
  await page.getByText(importConsentCopy, { exact: true })
    .locator("xpath=ancestor::label[1]")
    .getByRole("checkbox")
    .check();
  const preSubmitRequestMaterial = outboundRequestMaterial.slice(importOutboundRequestStart).join("\n");
  for (const privateMarker of privateMarkers) {
    expect(
      preSubmitRequestMaterial.includes(privateMarker),
      "no selected, unselected, or filename marker leaves the browser before submission",
    ).toBe(false);
  }
  expect(
    postBodies.slice(importRequestStart),
    "selection and consent controls stay local until the submit action",
  ).toHaveLength(0);
  const preSubmitImportEvents = await importSubmissionEvents(page);
  expect(
    preSubmitImportEvents,
    "selection and consent without submission must not create product-event rows",
  ).toEqual([]);
  const submitRequestStart = postBodies.length;
  const submitOutboundRequestStart = outboundRequestMaterial.length;
  await page.getByRole("button", { name: /Create 2 review candidates/i }).click();
  await expect(page).toHaveURL(/\/knowledge-inbox\/[^/?#]+$/, { timeout: 30_000 });
  const submittedBodies = postBodies.slice(submitRequestStart).join("\n");
  expect(submittedBodies).toContain(selectedQuestionA);
  expect(submittedBodies).toContain(selectedAnswerA);
  expect(submittedBodies).toContain(selectedQuestionB);
  expect(submittedBodies).toContain(selectedAnswerB);
  expect(submittedBodies).not.toContain(unselectedMarker);
  expect(submittedBodies).not.toContain(filenameMarker);
  const submittedRequestMaterial = outboundRequestMaterial.slice(submitOutboundRequestStart).join("\n");
  expect(submittedRequestMaterial).not.toContain(unselectedMarker);
  expect(submittedRequestMaterial).not.toContain(filenameMarker);
  const postConsentImportEvents = await importSubmissionEvents(page);
  for (const eventName of IMPORT_SUBMISSION_EVENT_NAMES) {
    expect(
      postConsentImportEvents.filter((event) => event.event_name === eventName),
      `${eventName} is recorded once after selected-content submission`,
    ).toHaveLength(1);
  }
  expect(
    postConsentImportEvents.find((event) => event.event_name === "conversation_import_parsed")
      ?.selection_count,
  ).toBe(3);
  expect(
    postConsentImportEvents.find((event) => event.event_name === "conversation_import_confirmed")
      ?.selection_count,
  ).toBe(2);
  expect(
    postConsentImportEvents.find((event) => event.event_name === "conversation_import_candidates_ready")
      ?.selection_count,
  ).toBe(2);

  const batchId = decodeURIComponent(new URL(page.url()).pathname.split("/").at(-1) ?? "");
  expect(batchId).toMatch(/^[0-9a-f-]{36}$/i);
  const transformationSummary = page.getByRole("region", {
    name: transformationSummaryCopy,
  });
  await expect(transformationSummary).toContainText("Candidate · not confirmed");
  await expect(transformationSummary.getByText("Evidence (2)", { exact: true })).toBeVisible();
  await expect(transformationSummary.getByText("1 Relationship", { exact: true })).toBeVisible();
  const reviewLinks = page.getByRole("link", { name: /Review resolution/i });
  await expect(reviewLinks).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await expect(reviewLinks.nth(index).locator("xpath=ancestor::article[1]"))
      .toContainText("Candidate · not confirmed");
  }
  await reviewLinks.first().click();
  await expect(page).toHaveURL(/\/knowledge-inbox\/[^/]+\/[^/]+\/resolve$/);
  const evidenceGroup = page.getByRole("group", { name: "Evidence selectors to retain" });
  await expect(evidenceGroup).toContainText(/chatgpt-message:[0-9a-f]{48}/);
  await expect(evidenceGroup).not.toContainText(conversationId);
  await expect(evidenceGroup).not.toContainText(`answer-a-${marker}`);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Ignore candidate" }).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge-inbox/${batchId}$`));
  await expect(page.getByRole("link", { name: /Review resolution/i })).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Ignore whole batch" }).click();
  await expect(page).toHaveURL(/\/knowledge-inbox(?:[/?#]|$)/);

  await page.goto("/account/delete#knowledge-data", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: accountDataTitleCopy })).toBeVisible();
  const exportBeforeDelete = await downloadText(page, downloadExportCopy);
  expect(exportBeforeDelete).toContain(batchId);
  expect(exportBeforeDelete).toContain(selectedQuestionA);
  expect(exportBeforeDelete).toContain(selectedAnswerB);
  expect(exportBeforeDelete).not.toContain(unselectedMarker);
  expect(exportBeforeDelete).not.toContain(filenameMarker);

  const batchRow = page.getByText(batchId, { exact: true }).locator("xpath=ancestor::li[1]");
  await expect(batchRow).toContainText(/0 pending · 0 approved/);
  page.once("dialog", (dialog) => dialog.accept());
  await batchRow.getByRole("button", { name: deleteImportCopy }).click();
  await expect(page.getByText(batchId, { exact: true })).toHaveCount(0);
  const exportAfterDelete = await downloadText(page, downloadExportCopy);
  for (const rawMarker of [
    selectedQuestionA,
    selectedAnswerA,
    selectedQuestionB,
    selectedAnswerB,
    unselectedMarker,
    filenameMarker,
  ]) {
    expect(exportAfterDelete).not.toContain(rawMarker);
  }

  const signalOperations = signalEventResponses.map(signalOperation).filter(Boolean);
  expect(signalOperations).toContain("viewed");
  expect(signalOperations).toContain("evidence_opened");
  expect(signalOperations).toContain("dismissed");
  expect(signalEventResponses.every((response) => response.status() === 204)).toBe(true);
  expect(contextResponses).toHaveLength(formats.length * 2);
  expect(contextResponses.every((response) => response.status() === 200)).toBe(true);
  expect(browserErrors).toEqual([]);

  const messageBytes = Buffer.byteLength(await messageResponses[0]!.body());
  const metrics = {
    schemaVersion: 2,
    route: "/my-notes?view=insights -> /knowledge-inbox/import -> /account/delete",
    project: testInfo.project.name,
    syntheticPrivateEvidenceCount: 2,
    messageAsset: {
      requests: messageResponses.length,
      status: messageResponses[0]!.status(),
      bytes: messageBytes,
    },
    signalEventStatuses: signalEventResponses.map((response) => response.status()),
    signalOperations,
    contextApiStatuses: contextResponses.map((response) => response.status()),
    contextFormats: contextResponses.map(contextFormat),
    contextRequestsBeforeIntent: 0,
    contextBytes: contextPayloads.reduce((total, content) => total + Buffer.byteLength(content), 0),
    importEvidence: {
      selectedCount: 2,
      preConsentPostCount: postBodies.slice(importRequestStart, submitRequestStart).length,
      preConsentImportEventRows: preConsentImportEvents.length,
      preSubmitImportEventRows: preSubmitImportEvents.length,
      postConsentImportEventNames: postConsentImportEvents
        .map((event) => String(event.event_name))
        .toSorted(),
      unselectedContentSent: false,
      archiveFilenameSent: false,
      pendingCandidatesBeforeReview: 2,
      batchDeleted: true,
    },
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
