import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  expect,
  test,
  type Locator,
  type Page,
  type Request,
  type Response,
  type TestInfo,
} from "@playwright/test";
import {
  classifyReviewLocatorActivationFailure,
  isSuccessfulReviewNavigation,
} from "../scripts/authenticated-overlay-network.mjs";
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
const twoContextItemsSelectedCopy = staticMessage(
  englishThinkingHistory,
  "insights.context.selected",
  "Selected {count}",
).replace("{count}", "2");
const dismissCopy = staticMessage(englishThinkingHistory, "insights.dismiss.unhelpful", "Not useful");
const importHeadingCopy = "Find the ideas worth carrying forward.";
const importSummaryCopy = staticMessage(englishImport, "import.summaryTitle", "This is the shape of your AI history");
const importConsentCopy = staticMessage(englishImport, "import.consent", "I selected these exchanges intentionally.");
const transformationSummaryCopy = EXTRA_EN_MESSAGES["inbox.transformationSummary"];
const resolutionMetadataCopy = EXTRA_EN_MESSAGES["resolution.metadata"];
const accountDataTitleCopy = EXTRA_EN_MESSAGES["account.data.title"];
const downloadExportCopy = EXTRA_EN_MESSAGES["account.data.downloadExport"];
const deleteImportCopy = EXTRA_EN_MESSAGES["account.data.deleteImport"];

type ContextFormat = "markdown" | "yaml" | "json";
type BrowserErrorDigest = {
  source: "console" | "page";
  kind: string;
  fingerprint: string;
};
type ReviewNavigationObservation = {
  requestSeen: boolean;
  responseStatus: number | null;
  requestFailed: boolean;
};
const IMPORT_SUBMISSION_EVENT_NAMES = new Set([
  "conversation_import_started",
  "conversation_import_parsed",
  "conversation_import_confirmed",
  "conversation_import_candidates_ready",
]);
const IMPORT_BATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMPORT_BATCH_URL_PATTERN = /\/knowledge-inbox\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function ownerKnowledgeExport(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async () => {
    const response = await fetch("/api/knowledge/export?scope=all", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`Knowledge export failed with ${response.status}.`);
    return response.json() as Promise<Record<string, unknown>>;
  });
}

function importSubmissionEventsFromExport(
  exportData: Record<string, unknown>,
): Record<string, unknown>[] {
  const events = exportData.intelligence_feedback_and_metrics;
  if (!Array.isArray(events)) throw new Error("Knowledge export omitted product events.");
  return events.filter((event): event is Record<string, unknown> => (
    typeof event === "object"
    && event !== null
    && typeof event.event_name === "string"
    && IMPORT_SUBMISSION_EVENT_NAMES.has(event.event_name)
  ));
}

async function importSubmissionEvents(page: Page): Promise<Record<string, unknown>[]> {
  return importSubmissionEventsFromExport(await ownerKnowledgeExport(page));
}

function submittedImportBatchIdsContainingMarker(
  exportData: Record<string, unknown>,
  marker: string,
): string[] {
  const candidates = exportData.pending_and_resolved_candidates;
  if (!Array.isArray(candidates)) throw new Error("Knowledge export omitted import candidates.");
  return Array.from(new Set(candidates.flatMap((candidate) => {
    if (typeof candidate !== "object" || candidate === null) return [];
    const row = candidate as Record<string, unknown>;
    const batchId = row.batch_id;
    return typeof batchId === "string"
      && IMPORT_BATCH_ID_PATTERN.test(batchId)
      && row.central_question === marker
      ? [batchId]
      : [];
  })));
}

async function waitForSubmittedImportBatchId(page: Page, marker: string): Promise<string> {
  let observed: string[] = [];
  await expect.poll(async () => {
    observed = submittedImportBatchIdsContainingMarker(
      await ownerKnowledgeExport(page),
      marker,
    );
    return observed.length;
  }, {
    message: "the exact synthetic import reaches its owner export",
    timeout: 30_000,
    intervals: [250, 500, 1_000],
  }).toBe(1);
  return observed[0]!;
}

async function waitForImportSubmissionEventCount(
  page: Page,
  expectedCount: number,
): Promise<Record<string, unknown>[]> {
  let observed: Record<string, unknown>[] = [];
  await expect.poll(async () => {
    observed = await importSubmissionEvents(page);
    return observed.length;
  }, {
    message: `owner export reaches ${expectedCount} import submission events`,
    timeout: 30_000,
    intervals: [250, 500, 1_000],
  }).toBe(expectedCount);
  return observed;
}

async function clickAndAcceptConfirm(
  page: Page,
  control: Locator,
  hasTouch: boolean,
): Promise<void> {
  const smoothScrollOverride = await page.addStyleTag({
    content: "html { scroll-behavior: auto !important; }",
  });
  await expect.poll(async () => control.evaluate(async (element) => {
    element.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
    await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
    const firstBounds = element.getBoundingClientRect();
    await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
    const bounds = element.getBoundingClientRect();
    const point = {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    };
    const hitTarget = document.elementFromPoint(point.x, point.y);
    return Math.abs(firstBounds.left - bounds.left) < 0.5
      && Math.abs(firstBounds.top - bounds.top) < 0.5
      && Math.abs(firstBounds.width - bounds.width) < 0.5
      && Math.abs(firstBounds.height - bounds.height) < 0.5
      && bounds.width > 0
      && bounds.height > 0
      && hitTarget !== null
      && (hitTarget === element || element.contains(hitTarget));
  }), {
    message: "the confirmation control is the stable centered pointer target",
    timeout: 10_000,
    intervals: [100, 250, 500],
  }).toBe(true);

  let dialogType: string | null = null;
  const confirmHandled = page.waitForEvent("dialog", { timeout: 10_000 })
    .then(async (dialog) => {
      dialogType = dialog.type();
      if (dialogType === "confirm") await dialog.accept();
      else await dialog.dismiss();
    });
  const activateControl = async () => {
    if (!hasTouch) {
      await control.click({ timeout: 10_000 });
      return;
    }
    await expect(control).toBeEnabled({ timeout: 10_000 });
    // The control is already centered and hit-tested. Keep the real touch
    // action unforced while preventing a second locator scroll from moving it.
    await control.tap({ timeout: 10_000, scroll: "none" });
  };
  const [dialogResult, activationResult] = await Promise.allSettled([
    confirmHandled,
    activateControl(),
  ]);
  await smoothScrollOverride.evaluate((element) => {
    element.parentNode?.removeChild(element);
  }).catch(() => undefined);
  if (activationResult.status === "rejected" && dialogResult.status === "rejected") {
    throw activationResult.reason;
  }
  if (dialogResult.status === "rejected") throw dialogResult.reason;
  if (dialogType !== "confirm") throw new Error(`UNEXPECTED_DIALOG_TYPE:${dialogType ?? "none"}`);
  if (activationResult.status === "rejected") throw activationResult.reason;
}

async function deleteSubmittedImportThroughOwnerUi(
  page: Page,
  batchId: string,
  hasTouch: boolean,
): Promise<void> {
  // A failed confirm-driven assertion can leave a one-shot dialog listener
  // behind. Cleanup owns the next dialog and must not race that stale handler.
  page.removeAllListeners("dialog");
  await gotoOwnerKnowledgeData(page);
  await expect(
    page.getByText(batchId, { exact: true }),
    "the submitted synthetic import reaches its owner deletion surface",
  ).toHaveCount(1);

  const batchRow = page.getByText(batchId, { exact: true }).locator("xpath=ancestor::li[1]");
  await clickAndAcceptConfirm(
    page,
    batchRow.getByRole("button", { name: deleteImportCopy }),
    hasTouch,
  );
  await expect(page.getByText(batchId, { exact: true })).toHaveCount(0);
  await waitForImportSubmissionEventCount(page, 0);
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

function failureFingerprint(value: unknown): string {
  const material = value instanceof Error
    ? `${value.name}\0${value.message}`
    : String(value);
  return createHash("sha256").update(material).digest("hex").slice(0, 12);
}

function safeErrorSummary(error: unknown): string {
  const unsafeName = error instanceof Error ? error.name : "UnknownError";
  const name = /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(unsafeName)
    ? unsafeName
    : "UnknownError";
  return `${name}:${failureFingerprint(error)}`;
}

function safeEvidenceErrorSummary(error: unknown): string {
  const errorCode = error instanceof Error
    ? /^(REVIEW_[A-Z0-9_]+)(?::(?:[0-9]{3}|[0-9a-f]{12}))?$/.exec(error.message)?.[1]
    : undefined;
  return errorCode
    ? `${errorCode}:${safeErrorSummary(error)}`
    : safeErrorSummary(error);
}

function installBrowserErrorGuards(page: Page): BrowserErrorDigest[] {
  const errors: BrowserErrorDigest[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push({
        source: "console",
        kind: "error",
        fingerprint: failureFingerprint(message.text()),
      });
    }
  });
  page.on("pageerror", (error) => errors.push({
    source: "page",
    kind: /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name) ? error.name : "Error",
    fingerprint: failureFingerprint(error),
  }));
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

function sameReviewDestination(requestUrl: string, targetUrl: URL): boolean {
  const candidate = new URL(requestUrl);
  return candidate.origin === targetUrl.origin
    && candidate.pathname === targetUrl.pathname;
}

type ReviewTapScrollSample = {
  at: number;
  scrollY: number;
  rootScrollTop: number;
  visualPageTop: number | null;
  visualOffsetTop: number | null;
  targetTop: number;
  targetLeft: number;
  targetWidth: number;
  targetHeight: number;
};

type ReviewTapScrollState = {
  samples: ReviewTapScrollSample[];
  totalEvents: number;
  record: () => void;
};

type ReviewTapWindow = typeof window & {
  __girappheReviewTapScroll?: ReviewTapScrollState;
};

async function startReviewTapScrollRecorder(link: Locator): Promise<void> {
  await link.evaluate((element) => {
    const browserWindow = window as ReviewTapWindow;
    const previous = browserWindow.__girappheReviewTapScroll;
    if (previous) {
      window.removeEventListener("scroll", previous.record);
      window.visualViewport?.removeEventListener("scroll", previous.record);
    }
    const state: ReviewTapScrollState = {
      samples: [],
      totalEvents: 0,
      record: () => undefined,
    };
    state.record = () => {
      state.totalEvents += 1;
      const bounds = element.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      state.samples.push({
        at: Math.round(performance.now()),
        scrollY: Math.round(window.scrollY * 100) / 100,
        rootScrollTop: Math.round((document.scrollingElement?.scrollTop ?? 0) * 100) / 100,
        visualPageTop: visualViewport ? Math.round(visualViewport.pageTop * 100) / 100 : null,
        visualOffsetTop: visualViewport ? Math.round(visualViewport.offsetTop * 100) / 100 : null,
        targetTop: Math.round(bounds.top * 100) / 100,
        targetLeft: Math.round(bounds.left * 100) / 100,
        targetWidth: Math.round(bounds.width * 100) / 100,
        targetHeight: Math.round(bounds.height * 100) / 100,
      });
      if (state.samples.length > 64) state.samples.shift();
    };
    browserWindow.__girappheReviewTapScroll = state;
    window.addEventListener("scroll", state.record, { passive: true });
    window.visualViewport?.addEventListener("scroll", state.record, { passive: true });
    state.record();
  });
}

async function captureReviewTapGeometry(page: Page, link: Locator) {
  const playwrightBox = await link.boundingBox();
  return link.evaluate((element, box) => {
    const bounds = element.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const targetArticle = element.closest("article");
    const describeHits = (x: number, y: number) => document.elementsFromPoint(x, y)
      .slice(0, 6)
      .map((node) => {
        const html = node instanceof HTMLElement ? node : node.parentElement;
        const position = html === element
          ? "target"
          : html?.contains(element)
            ? "target-ancestor"
            : html && (html.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
              ? "before-target"
              : "after-target";
        const kind = html && element.contains(html)
          ? "target"
          : html?.closest("nav")
            ? "navigation"
            : targetArticle && html?.closest("article") === targetArticle
              ? "target-article"
              : html?.closest("section[aria-label]")
                ? "labelled-section"
                : "document-flow";
        return {
          tag: html?.tagName.toLowerCase() ?? "unknown",
          kind,
          position,
        };
      });
    const domCenter = {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    };
    const playwrightCenter = box
      ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      : null;
    const visibleLeft = visualViewport?.pageLeft ?? 0;
    const visibleRight = visibleLeft + (visualViewport?.width ?? window.innerWidth);
    const elementGeometry = [...document.body.querySelectorAll("*")]
      .filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement)
      .map((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = getComputedStyle(candidate);
        const className = candidate.className;
        let classFingerprint = 2_166_136_261;
        for (let index = 0; index < Math.min(className.length, 512); index += 1) {
          classFingerprint ^= className.charCodeAt(index);
          classFingerprint = Math.imul(classFingerprint, 16_777_619);
        }
        let depth = 0;
        for (let parent = candidate.parentElement; parent; parent = parent.parentElement) depth += 1;
        return {
          tag: candidate.tagName.toLowerCase(),
          classFingerprint: classFingerprint >>> 0,
          classLength: Math.min(className.length, 512),
          depth,
          rect: {
            left: Math.round(rect.left * 100) / 100,
            right: Math.round(rect.right * 100) / 100,
            width: Math.round(rect.width * 100) / 100,
          },
          clientWidth: candidate.clientWidth,
          scrollWidth: candidate.scrollWidth,
          display: style.display,
          minWidth: style.minWidth,
          width: style.width,
          overflowX: style.overflowX,
          whiteSpace: style.whiteSpace,
          gridTemplateColumns: style.gridTemplateColumns,
          flexWrap: style.flexWrap,
          flexShrink: style.flexShrink,
        };
      });
    const ownOverflow = elementGeometry
      .filter((candidate) => candidate.scrollWidth > candidate.clientWidth + 1)
      .sort((left, right) => (
        (right.scrollWidth - right.clientWidth) - (left.scrollWidth - left.clientWidth)
        || right.depth - left.depth
      ))
      .slice(0, 24);
    const outsideVisualViewport = elementGeometry
      .filter((candidate) => (
        candidate.rect.width > 0
        && (candidate.rect.left < visibleLeft - 1 || candidate.rect.right > visibleRight + 1)
      ))
      .sort((left, right) => right.depth - left.depth || right.rect.width - left.rect.width)
      .slice(0, 48);
    const viewportMetaContent = document.querySelector('meta[name="viewport"]')
      ?.getAttribute("content") ?? "";
    return {
      scrollY: window.scrollY,
      rootScrollTop: document.scrollingElement?.scrollTop ?? null,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      devicePixelRatio: window.devicePixelRatio,
      screenWidth: window.screen.width,
      viewportMeta: {
        present: viewportMetaContent.length > 0,
        deviceWidth: /(?:^|,)\s*width=device-width(?:\s*,|$)/i.test(viewportMetaContent),
        initialScaleOne: /(?:^|,)\s*initial-scale=1(?:\.0+)?(?:\s*,|$)/i.test(viewportMetaContent),
        length: Math.min(viewportMetaContent.length, 256),
      },
      documentClientWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      visualViewport: visualViewport ? {
        width: visualViewport.width,
        height: visualViewport.height,
        pageLeft: visualViewport.pageLeft,
        pageTop: visualViewport.pageTop,
        offsetLeft: visualViewport.offsetLeft,
        offsetTop: visualViewport.offsetTop,
        scale: visualViewport.scale,
      } : null,
      targetRect: {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
      playwrightBox: box,
      domCenterHits: describeHits(domCenter.x, domCenter.y),
      playwrightCenterHits: playwrightCenter
        ? describeHits(playwrightCenter.x, playwrightCenter.y)
        : [],
      wideElements: { ownOverflow, outsideVisualViewport },
    };
  }, playwrightBox);
}

async function stopReviewTapScrollRecorder(page: Page) {
  return page.evaluate(() => {
    const browserWindow = window as ReviewTapWindow;
    const state = browserWindow.__girappheReviewTapScroll;
    if (!state) return null;
    window.removeEventListener("scroll", state.record);
    window.visualViewport?.removeEventListener("scroll", state.record);
    delete browserWindow.__girappheReviewTapScroll;
    return {
      totalEvents: state.totalEvents,
      samples: state.samples,
    };
  });
}

async function activateExactReviewLink(
  page: Page,
  link: Locator,
  batchId: string,
  hasTouch: boolean,
  testInfo: TestInfo,
): Promise<void> {
  const currentUrl = new URL(page.url());
  const rawHref = await link.getAttribute("href");
  if (!rawHref) throw new Error("REVIEW_TARGET_MISSING");
  const targetUrl = new URL(rawHref, currentUrl);
  const currentBatchSuffix = `/knowledge-inbox/${encodeURIComponent(batchId)}`;
  const targetPrefix = `${currentUrl.pathname}/`;
  const targetSuffix = "/resolve";
  const targetDraftId = targetUrl.pathname.slice(targetPrefix.length, -targetSuffix.length);
  if (
    currentUrl.origin !== targetUrl.origin
    || !currentUrl.pathname.endsWith(currentBatchSuffix)
    || !targetUrl.pathname.startsWith(targetPrefix)
    || !targetUrl.pathname.endsWith(targetSuffix)
    || !IMPORT_BATCH_ID_PATTERN.test(targetDraftId)
    || targetUrl.search !== ""
    || targetUrl.hash !== ""
  ) {
    throw new Error("REVIEW_TARGET_INVALID");
  }

  const smoothScrollOverride = await page.addStyleTag({
    content: "html { scroll-behavior: auto !important; }",
  });
  await expect.poll(async () => {
    return link.evaluate(async (element) => {
      element.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
      await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
      const firstBounds = element.getBoundingClientRect();
      await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
      const bounds = element.getBoundingClientRect();
      const boundsAreStable = Math.abs(firstBounds.left - bounds.left) < 0.5
        && Math.abs(firstBounds.top - bounds.top) < 0.5
        && Math.abs(firstBounds.width - bounds.width) < 0.5
        && Math.abs(firstBounds.height - bounds.height) < 0.5;
      const point = {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      };
      const hitTarget = document.elementFromPoint(point.x, point.y);
      const ready = boundsAreStable
        && element instanceof HTMLAnchorElement
        && bounds.width > 0
        && bounds.height > 0
        && hitTarget !== null
        && (hitTarget === element || element.contains(hitTarget))
        && element.href.length > 0;
      return ready;
    });
  }, {
    message: "the stable centered review link is the next pointer target",
    timeout: 10_000,
    intervals: [100, 250, 500],
  }).toBe(true);
  if (!hasTouch) {
    try {
      await link.click({ trial: true, timeout: 10_000 });
    } catch (error) {
      throw new Error(`REVIEW_LOCATOR_NOT_ACTIONABLE:${failureFingerprint(error)}`);
    }
  }

  const activate = async () => {
    if (hasTouch) {
      // The centered target is already stable. Preserve Playwright's visibility,
      // stability, hit-target, and trusted-touch checks without a second scroll.
      await link.tap({ timeout: 10_000, scroll: "none" });
      return;
    }
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
  };

  const observation: ReviewNavigationObservation = {
    requestSeen: false,
    responseStatus: null,
    requestFailed: false,
  };
  const onRequest = (request: Request) => {
    if (request.method() === "GET" && sameReviewDestination(request.url(), targetUrl)) {
      observation.requestSeen = true;
    }
  };
  const onResponse = (response: Response) => {
    if (response.request().method() === "GET" && sameReviewDestination(response.url(), targetUrl)) {
      observation.requestSeen = true;
      if (observation.responseStatus === null || response.status() >= 400) {
        observation.responseStatus = response.status();
      }
    }
  };
  const onRequestFailed = (request: Request) => {
    if (request.method() === "GET" && sameReviewDestination(request.url(), targetUrl)) {
      observation.requestSeen = true;
      observation.requestFailed = true;
    }
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);

  const geometryBefore = hasTouch
    ? await startReviewTapScrollRecorder(link).then(() => captureReviewTapGeometry(page, link))
    : null;

  let activationError: unknown;
  const mobileLayoutOverflow = geometryBefore?.visualViewport
    ? geometryBefore.innerWidth > geometryBefore.visualViewport.width + 1
      || geometryBefore.documentWidth > geometryBefore.visualViewport.width + 1
    : false;
  if (mobileLayoutOverflow) {
    activationError = new Error("REVIEW_LAYOUT_OVERFLOW");
  } else {
    try {
      await activate();
    } catch (error) {
      activationError = error;
    }
  }
  if (hasTouch && activationError) {
    const [geometryAfter, scroll] = await Promise.all([
      captureReviewTapGeometry(page, link).catch(() => null),
      stopReviewTapScrollRecorder(page).catch(() => null),
    ]);
    await testInfo.attach("review-tap-geometry", {
      body: Buffer.from(JSON.stringify({ before: geometryBefore, after: geometryAfter, scroll }, null, 2)),
      contentType: "application/json",
    });
  }
  await expect.poll(() => {
    if (observation.requestFailed) return true;
    if (observation.responseStatus !== null && observation.responseStatus >= 400) return true;
    if (page.url() !== targetUrl.href) return false;
    return !observation.requestSeen || observation.responseStatus !== null;
  }, {
    message: "the exact review activation reaches a terminal browser outcome",
    timeout: 10_000,
    intervals: [100, 250, 500],
  }).toBe(true).catch(() => undefined);

  page.off("request", onRequest);
  page.off("response", onResponse);
  page.off("requestfailed", onRequestFailed);
  if (smoothScrollOverride) {
    await smoothScrollOverride.evaluate((element) => {
      element.parentNode?.removeChild(element);
    }).catch(() => undefined);
  }

  const committed = page.url() === targetUrl.href;
  if (isSuccessfulReviewNavigation({ committed, ...observation })) return;
  if (activationError && !observation.requestSeen) {
    throw new Error(classifyReviewLocatorActivationFailure(activationError));
  }
  if (observation.requestFailed) throw new Error("REVIEW_TARGET_REQUEST_FAILED");
  if (observation.responseStatus !== null && observation.responseStatus >= 400) {
    throw new Error(`REVIEW_DESTINATION_HTTP_ERROR:${observation.responseStatus}`);
  }
  if (!observation.requestSeen) throw new Error("REVIEW_ACTIVATION_NO_REQUEST");
  if (observation.responseStatus === null) throw new Error("REVIEW_TARGET_REQUEST_NO_RESPONSE");
  if (observation.responseStatus >= 300) {
    throw new Error(`REVIEW_TARGET_REDIRECT_NO_COMMIT:${observation.responseStatus}`);
  }
  throw new Error(`REVIEW_TARGET_SUCCESS_NO_COMMIT:${observation.responseStatus}`);
}

async function gotoOwnerKnowledgeData(page: Page): Promise<void> {
  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await page.goto("/account/delete#knowledge-data", {
      waitUntil: "domcontentloaded",
    });
    lastStatus = response?.status() ?? null;
    try {
      await expect(page.getByRole("heading", { name: accountDataTitleCopy })).toBeVisible({
        timeout: 5_000,
      });
      return;
    } catch {}
  }
  throw new Error(
    `OWNER_DATA_CONTROLS_UNAVAILABLE:${lastStatus ?? "none"}`,
  );
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
  testInfo.setTimeout(180_000);
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
  const messageBytes = Buffer.byteLength(await messageResponses[0]!.body());
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
  await expect(signalRoot.locator(".thinking-selected-count")).toHaveText(twoContextItemsSelectedCopy);

  const formats: ContextFormat[] = ["json", "yaml", "markdown"];
  const contextPayloads: string[] = [];
  const formatSelect = signalRoot.getByRole("combobox", { name: contextFormatCopy });
  for (const format of formats) {
    await formatSelect.selectOption(format);
    const copyResponsePromise = page.waitForResponse(
      (response) => contextFormat(response) === format,
      { timeout: 30_000 },
    );
    await signalRoot.getByRole("button", { name: contextCopy }).click();
    const copyResponse = await copyResponsePromise;
    expect(copyResponse.status(), `${format} copy context response`).toBe(200);
    await expect(signalRoot.getByRole("status")).toHaveText(contextCopiedCopy);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    assertPortableContext(format, clipboard);
    contextPayloads.push(clipboard);

    const downloadResponsePromise = page.waitForResponse(
      (response) => contextFormat(response) === format,
      { timeout: 30_000 },
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
  const dismissResponsePromise = page.waitForResponse(
    (response) => signalOperation(response) === "dismissed" && response.status() === 204,
  );
  await clickAndAcceptConfirm(
    page,
    dismissedSignalIdentity.getByRole("button", { name: dismissCopy }),
    testInfo.project.use.hasTouch === true,
  );
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
    expect(
      (await row.textContent())?.includes(question) === true,
      "the synthetic exchange row contains its generated question marker",
    ).toBe(true);
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
    postBodies.slice(importRequestStart).length,
    "local parsing must not invoke a same-origin Server Action before consent",
  ).toBe(0);
  const preConsentImportEvents = await importSubmissionEvents(page);
  expect(
    preConsentImportEvents.length,
    "local parsing must not create product-event rows before consent",
  ).toBe(0);

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
    postBodies.slice(importRequestStart).length,
    "selection and consent controls stay local until the submit action",
  ).toBe(0);
  const preSubmitImportEvents = await importSubmissionEvents(page);
  expect(
    preSubmitImportEvents.length,
    "selection and consent without submission must not create product-event rows",
  ).toBe(0);
  const {
    inspectPendingAuthenticatedOverlayImport,
    readAuthenticatedOverlayPublishedState,
  } = await import("../scripts/authenticated-overlay-fixture.mjs");
  const publishedStateBeforeSubmission = await readAuthenticatedOverlayPublishedState();
  const submitRequestStart = postBodies.length;
  const submitOutboundRequestStart = outboundRequestMaterial.length;
  let batchId = "";
  let postConsentImportEvents: Record<string, unknown>[] = [];
  let evidenceError: unknown;
  let uiCleanupError: unknown;
  let databaseFallbackStatus = "not-needed";
  let databaseFallbackError: unknown;
  let preApprovalPublishedStateUnchanged = false;
  let preApprovalActivationRows = -1;
  let evidenceStage = "import_submission";
  try {
    await page.getByRole("button", { name: /Create 2 review candidates/i }).click();
    await expect(page).toHaveURL(IMPORT_BATCH_URL_PATTERN, { timeout: 30_000 });
    batchId = decodeURIComponent(new URL(page.url()).pathname.split("/").at(-1) ?? "");
    expect(batchId).toMatch(IMPORT_BATCH_ID_PATTERN);
    const submittedBodies = postBodies.slice(submitRequestStart).join("\n");
    for (const selectedMarker of [
      selectedQuestionA,
      selectedAnswerA,
      selectedQuestionB,
      selectedAnswerB,
    ]) {
      expect(
        submittedBodies.includes(selectedMarker),
        "the submitted payload contains each explicitly selected synthetic marker",
      ).toBe(true);
    }
    expect(
      submittedBodies.includes(unselectedMarker),
      "the submitted payload omits the unselected synthetic marker",
    ).toBe(false);
    expect(
      submittedBodies.includes(filenameMarker),
      "the submitted payload omits the local filename marker",
    ).toBe(false);
    const submittedRequestMaterial = outboundRequestMaterial.slice(submitOutboundRequestStart).join("\n");
    expect(
      submittedRequestMaterial.includes(unselectedMarker),
      "no unselected synthetic marker leaves the browser on submission",
    ).toBe(false);
    expect(
      submittedRequestMaterial.includes(filenameMarker),
      "no local filename marker leaves the browser on submission",
    ).toBe(false);
    postConsentImportEvents = await waitForImportSubmissionEventCount(
      page,
      IMPORT_SUBMISSION_EVENT_NAMES.size,
    );
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

    const preApprovalInspection = await inspectPendingAuthenticatedOverlayImport({
      batchId,
      marker: selectedQuestionA,
      expectedDraftCount: 2,
    });
    expect(
      preApprovalInspection.publishedState,
      "selected import cannot alter canonical knowledge, graph, mastery, or ranking before approval",
    ).toEqual(publishedStateBeforeSubmission);
    preApprovalPublishedStateUnchanged = true;
    preApprovalActivationRows = [
      preApprovalInspection.activation.foreignDrafts,
      preApprovalInspection.activation.canonicalLinks,
      preApprovalInspection.activation.sourceRows,
      preApprovalInspection.activation.privateGraphNodes,
      preApprovalInspection.activation.privateGraphEdges,
      preApprovalInspection.activation.privateMasteryRows,
      preApprovalInspection.activation.revisionRows,
      preApprovalInspection.activation.activityRows,
    ].reduce((total, value) => total + value, 0);
    expect(preApprovalActivationRows).toBe(0);

    evidenceStage = "pending_summary";
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
    evidenceStage = "review_link";
    await activateExactReviewLink(
      page,
      reviewLinks.first(),
      batchId,
      testInfo.project.use.hasTouch === true,
      testInfo,
    );
    evidenceStage = "review_metadata";
    const metadataSummary = page.locator("summary").filter({
      hasText: resolutionMetadataCopy,
    });
    await expect(metadataSummary).toHaveCount(1);
    const metadataDetails = metadataSummary.locator("xpath=ancestor::details[1]");
    if ((await metadataDetails.getAttribute("open")) === null) {
      await metadataSummary.click();
    }
    await expect(metadataDetails).toHaveAttribute("open", "");
    const evidenceGroup = page.getByRole("group", { name: "Evidence selectors to retain" });
    await expect(evidenceGroup).toBeVisible();
    await expect(evidenceGroup).toContainText(/chatgpt-message:[0-9a-f]{48}/);
    await expect(evidenceGroup).not.toContainText(conversationId);
    await expect(evidenceGroup).not.toContainText(`answer-a-${marker}`);

    evidenceStage = "ignore_candidate";
    await clickAndAcceptConfirm(
      page,
      page.getByRole("button", { name: "Ignore candidate" }),
      testInfo.project.use.hasTouch === true,
    );
    await expect(page).toHaveURL(new RegExp(`/knowledge-inbox/${batchId}$`));
    await expect(page.getByRole("link", { name: /Review resolution/i })).toHaveCount(1);
    evidenceStage = "ignore_batch";
    await clickAndAcceptConfirm(
      page,
      page.getByRole("button", { name: "Ignore whole batch" }),
      testInfo.project.use.hasTouch === true,
    );
    await expect(page).toHaveURL(/\/knowledge-inbox(?:[/?#]|$)/);

    evidenceStage = "export_verification";
    await gotoOwnerKnowledgeData(page);
    const exportBeforeDelete = await downloadText(page, downloadExportCopy);
    expect(exportBeforeDelete.includes(batchId), "the owner export contains the exact synthetic batch").toBe(true);
    expect(exportBeforeDelete.includes(selectedQuestionA), "the owner export contains selected synthetic evidence").toBe(true);
    expect(exportBeforeDelete.includes(selectedAnswerB), "the owner export contains the second selected answer").toBe(true);
    expect(exportBeforeDelete.includes(unselectedMarker), "the owner export omits unselected synthetic content").toBe(false);
    expect(exportBeforeDelete.includes(filenameMarker), "the owner export omits the local filename marker").toBe(false);

    evidenceStage = "batch_row_verification";
    const batchRow = page.getByText(batchId, { exact: true }).locator("xpath=ancestor::li[1]");
    await expect(batchRow).toContainText(/0 pending · 0 approved/);
  } catch (error) {
    evidenceError = error;
  } finally {
    try {
      await test.step("delete submitted import and await telemetry cleanup", async () => {
        batchId = IMPORT_BATCH_ID_PATTERN.test(batchId)
          ? batchId
          : await waitForSubmittedImportBatchId(page, selectedQuestionA);
        await deleteSubmittedImportThroughOwnerUi(
          page,
          batchId,
          testInfo.project.use.hasTouch === true,
        );
      });
    } catch (cleanupError) {
      uiCleanupError = cleanupError;
      if (IMPORT_BATCH_ID_PATTERN.test(batchId)) {
        try {
          const { deleteExactAuthenticatedOverlayImport } = await import(
            "../scripts/authenticated-overlay-fixture.mjs"
          );
          const fallback = await deleteExactAuthenticatedOverlayImport({
            batchId,
            marker: selectedQuestionA,
          });
          if (
            fallback.deleted !== true
            || fallback.remainingBatches !== 0
            || fallback.remainingDrafts !== 0
            || fallback.remainingEvents !== 0
          ) {
            throw new Error("EXACT_DATABASE_FALLBACK_NOT_VERIFIED");
          }
          databaseFallbackStatus = "verified";
        } catch (fallbackError) {
          databaseFallbackStatus = "failed";
          databaseFallbackError = fallbackError;
        }
      } else {
        databaseFallbackStatus = "unavailable";
      }
    }
  }
  if (evidenceError || uiCleanupError) {
    const evidenceStatus = evidenceError
      ? `${evidenceStage}:${safeEvidenceErrorSummary(evidenceError)}`
      : "passed";
    const cleanupStatus = uiCleanupError ? safeErrorSummary(uiCleanupError) : "passed";
    const fallbackStatus = databaseFallbackError
      ? `${databaseFallbackStatus}:${safeErrorSummary(databaseFallbackError)}`
      : databaseFallbackStatus;
    throw new Error(
      `THINKING_HISTORY_EVIDENCE_FAILED evidence=${evidenceStatus} ui_cleanup=${cleanupStatus} db_fallback=${fallbackStatus}`,
    );
  }
  const exportAfterDelete = await downloadText(page, downloadExportCopy);
  for (const rawMarker of [
    selectedQuestionA,
    selectedAnswerA,
    selectedQuestionB,
    selectedAnswerB,
    unselectedMarker,
    filenameMarker,
  ]) {
    expect(
      exportAfterDelete.includes(rawMarker),
      "the owner export omits every deleted synthetic import marker",
    ).toBe(false);
  }

  const signalOperations = signalEventResponses.map(signalOperation).filter(Boolean);
  expect(signalOperations).toContain("viewed");
  expect(signalOperations).toContain("evidence_opened");
  expect(signalOperations).toContain("dismissed");
  expect(signalEventResponses.every((response) => response.status() === 204)).toBe(true);
  expect(contextResponses).toHaveLength(formats.length * 2);
  expect(contextResponses.every((response) => response.status() === 200)).toBe(true);
  if (browserErrors.length > 0) {
    const digests = browserErrors
      .map((error) => `${error.source}:${error.kind}:${error.fingerprint}`)
      .join(",");
    throw new Error(`BROWSER_ERROR_DIGESTS:${digests}`);
  }

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
      preApprovalPublishedStateUnchanged,
      preApprovalActivationRows,
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
