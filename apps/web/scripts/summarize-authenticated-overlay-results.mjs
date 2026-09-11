import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

export function summarize(values) {
  return {
    median: Math.round(median(values) * 10) / 10,
    worst: Math.round(Math.max(...values) * 10) / 10,
  };
}

export function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  return `${Math.round((value / 1024) * 10) / 10} KiB`;
}

export function buildAuthenticatedOverlaySummary(metrics, generatedAt = new Date().toISOString()) {
  const byProject = Map.groupBy(metrics, (metric) => metric.project);
  const projects = Object.fromEntries([...byProject.entries()].map(([project, rows]) => {
    const transferred = rows
      .map((row) => row.overlayTransferredBytesAtCanvas)
      .filter((value) => Number.isFinite(value));
    return [project, {
      runs: rows.length,
      clickToCanvasMs: summarize(rows.map((row) => row.clickToCanvasMs)),
      overlayResponseHeadersMs: summarize(rows.map((row) => row.overlayResponseHeadersMs)),
      overlayDecodedBytesAtCanvas: summarize(rows.map((row) => row.overlayDecodedBytesAtCanvas)),
      overlayTransferredBytesAtCanvas: transferred.length > 0 ? summarize(transferred) : null,
      worstStatus: Math.max(...rows.map((row) => row.overlayStatus)),
    }];
  }));
  return { generatedAt, projects, runs: metrics };
}

export function buildAuthenticatedThinkingHistorySummary(metrics) {
  const byProject = Map.groupBy(metrics, (metric) => metric.project);
  const projects = Object.fromEntries([...byProject.entries()].map(([project, rows]) => [
    project,
    {
      runs: rows.length,
      messageAssetRequests: summarize(rows.map((row) => row.messageAsset.requests)),
      messageAssetStatuses: [...new Set(rows.map((row) => row.messageAsset.status))],
      privateEvidenceMinimum: Math.min(...rows.map((row) => row.syntheticPrivateEvidenceCount)),
      contextRequestsBeforeIntentWorst: Math.max(
        ...rows.map((row) => row.contextRequestsBeforeIntent),
      ),
      contextFlows: [...new Set(rows.map((row) => row.contextApiStatuses.join(' -> ')))],
      signalOperations: [...new Set(rows.flatMap((row) => row.signalOperations ?? []))].sort(),
      contextFormats: [...new Set(rows.flatMap((row) => row.contextFormats ?? []).filter(Boolean))].sort(),
      importCloseoutPassed: rows.every((row) => (
        row.importEvidence?.selectedCount === 2
        && row.importEvidence?.preConsentPostCount === 0
        && row.importEvidence?.preConsentImportEventRows === 0
        && row.importEvidence?.preSubmitImportEventRows === 0
        && row.importEvidence?.postConsentImportEventNames?.join(',') === [
          'conversation_import_candidates_ready',
          'conversation_import_confirmed',
          'conversation_import_parsed',
          'conversation_import_started',
        ].join(',')
        && row.importEvidence?.unselectedContentSent === false
        && row.importEvidence?.archiveFilenameSent === false
        && row.importEvidence?.pendingCandidatesBeforeReview === 2
        && row.importEvidence?.preApprovalPublishedStateUnchanged === true
        && row.importEvidence?.preApprovalActivationRows === 0
        && row.importEvidence?.batchDeleted === true
      )),
      contextBytes: summarize(rows.map((row) => row.contextBytes)),
      browserErrorCount: rows.reduce((total, row) => total + row.browserErrorCount, 0),
      durationMs: summarize(rows.map((row) => row.durationMs)),
    },
  ]));
  return { projects, runs: metrics };
}

const MOBILE_API_GATES = [
  'noteLifecycle',
  'topicsAndHub',
  'rankingAnonymous',
  'practiceNewAndReview',
  'candidateApproveIgnoreAndStale',
  'cleanup',
];

export function buildAuthenticatedMobileApiSummary(metrics) {
  const byProject = Map.groupBy(metrics, (metric) => metric.project);
  const projects = Object.fromEntries([...byProject.entries()].map(([project, rows]) => [
    project,
    {
      runs: rows.length,
      privateNoStoreReadsMinimum: Math.min(...rows.map((row) => row.privateNoStoreReads)),
      gates: Object.fromEntries(MOBILE_API_GATES.map((gate) => [
        gate,
        rows.every((row) => row[gate] === true),
      ])),
      closeoutPassed: rows.every((row) => (
        row.schemaVersion === 1
        && Number.isSafeInteger(row.privateNoStoreReads)
        && row.privateNoStoreReads > 0
        && MOBILE_API_GATES.every((gate) => row[gate] === true)
      )),
    },
  ]));
  return { projects, runs: metrics };
}

const MCP_PROVIDER_EVIDENCE_SCHEMAS = {
  normal_ui_revocation: {
    projectsByArtifact: {
      'authenticated-desktop.json': 'authenticated-desktop',
    },
    fields: [
      'artifactName',
      'absentAfterDeleteReload',
      'browserErrorCount',
      'clearedOneTimePatImmediatelyOnRevoke',
      'clipboardEmptyAfterTest',
      'copiedWithoutRawPat',
      'createdOneTimePat',
      'deletedPermanentlyBeforeScreenshot',
      'evidenceKind',
      'pageOverflow',
      'project',
      'remainingActiveAfterUiRevoke',
      'revokedBeforeScreenshot',
      'revokedHiddenByDefault',
      'schemaVersion',
    ],
  },
  route_fault_fallback: {
    projectsByArtifact: {
      'authenticated-desktop-route-fault.json': 'authenticated-desktop',
    },
    fields: [
      'artifactName',
      'clipboardEmptyAfterTest',
      'databaseFallbackRan',
      'evidenceKind',
      'originalSentinelIdentityPreserved',
      'postResponseCaptured',
      'postResponseRedacted',
      'project',
      'remainingActiveAfterFallback',
      'routeFaultedRequestCount',
      'schemaVersion',
      'uiCleanupFailureCount',
    ],
  },
  read_only_provider: {
    projectsByArtifact: {
      'authenticated-desktop-ar.json': 'authenticated-desktop',
      'authenticated-mobile-ar.json': 'authenticated-mobile',
    },
    fields: [
      'artifactName',
      'browserErrorCount',
      'clipboardEmptyAfterTest',
      'copiedWithoutRawPat',
      'evidenceKind',
      'keyboardProviderSwitch',
      'ltrCodeBlock',
      'pageOverflow',
      'project',
      'rtlLayout',
      'schemaVersion',
    ],
  },
};

function isExactMcpProviderEvidence(metric, evidenceKind) {
  if (!metric || typeof metric !== 'object' || Array.isArray(metric)) return false;
  const schema = MCP_PROVIDER_EVIDENCE_SCHEMAS[evidenceKind];
  const expectedProject = schema.projectsByArtifact[metric.artifactName];
  if (
    metric.schemaVersion !== 1
    || metric.evidenceKind !== evidenceKind
    || !expectedProject
    || metric.project !== expectedProject
  ) {
    return false;
  }
  const actualFields = Object.keys(metric).sort();
  const expectedFields = [...schema.fields].sort();
  return actualFields.length === expectedFields.length
    && actualFields.every((field, index) => field === expectedFields[index]);
}

function isMcpPatMutationClaim(metric) {
  if (!metric || typeof metric !== 'object' || Array.isArray(metric)) return false;
  return metric.evidenceKind === 'normal_ui_revocation'
    || metric.evidenceKind === 'route_fault_fallback'
    || Object.hasOwn(metric, 'createdOneTimePat')
    || Object.hasOwn(metric, 'databaseFallbackRan');
}

export function buildAuthenticatedMcpProviderSummary(metrics) {
  const normal = metrics.filter((metric) => (
    isExactMcpProviderEvidence(metric, 'normal_ui_revocation')
  ));
  const routeFault = metrics.filter((metric) => (
    isExactMcpProviderEvidence(metric, 'route_fault_fallback')
  ));
  const readOnly = metrics.filter((metric) => (
    isExactMcpProviderEvidence(metric, 'read_only_provider')
  ));
  return {
    patMutationRuns: normal.length + routeFault.length,
    readOnlyRuns: readOnly.length,
    normalUiRevocationPassed: normal.length === 1 && normal.every((metric) => (
      metric.createdOneTimePat === true
      && metric.copiedWithoutRawPat === true
      && metric.revokedBeforeScreenshot === true
      && metric.revokedHiddenByDefault === true
      && metric.clearedOneTimePatImmediatelyOnRevoke === true
      && metric.remainingActiveAfterUiRevoke === 0
      && metric.deletedPermanentlyBeforeScreenshot === true
      && metric.absentAfterDeleteReload === true
      && metric.clipboardEmptyAfterTest === true
      && metric.browserErrorCount === 0
      && metric.pageOverflow === false
    )),
    routeFaultFallbackPassed: routeFault.length === 1 && routeFault.every((metric) => (
      metric.databaseFallbackRan === true
      && metric.postResponseCaptured === true
      && metric.postResponseRedacted === true
      && metric.uiCleanupFailureCount === 2
      && metric.routeFaultedRequestCount > 0
      && metric.remainingActiveAfterFallback === 0
      && metric.originalSentinelIdentityPreserved === true
      && metric.clipboardEmptyAfterTest === true
    )),
    readOnlyProviderChecksPassed: readOnly.length > 0 && readOnly.every((metric) => (
      metric.rtlLayout === true
      && metric.ltrCodeBlock === true
      && metric.keyboardProviderSwitch === true
      && metric.copiedWithoutRawPat === true
      && metric.clipboardEmptyAfterTest === true
      && metric.browserErrorCount === 0
      && metric.pageOverflow === false
    )),
  };
}

export function assertRequiredMcpPatCloseoutEvidence(metrics, summary) {
  const normalArtifacts = metrics.filter((metric) => (
    isExactMcpProviderEvidence(metric, 'normal_ui_revocation')
  ));
  const routeFaultArtifacts = metrics.filter((metric) => (
    isExactMcpProviderEvidence(metric, 'route_fault_fallback')
  ));
  const mutationClaims = metrics.filter(isMcpPatMutationClaim);
  const mutationArtifactNames = new Set([
    ...normalArtifacts,
    ...routeFaultArtifacts,
  ].map((metric) => metric.artifactName));
  if (
    normalArtifacts.length !== 1
    || routeFaultArtifacts.length !== 1
    || mutationClaims.length !== 2
    || mutationArtifactNames.size !== 2
    || summary?.patMutationRuns !== 2
    || summary.normalUiRevocationPassed !== true
    || summary.routeFaultFallbackPassed !== true
  ) {
    throw new Error(
      'Required Preview MCP PAT closeout evidence is incomplete: expected one successful UI-revocation artifact and one successful route-fault fallback artifact.',
    );
  }
}

export function renderAuthenticatedMcpProviderSummary(summary) {
  if (!summary) {
    return [
      '## MCP provider PAT closeout',
      '',
      'No provider evidence artifacts were produced.',
      '',
    ].join('\n');
  }
  return [
    '## MCP provider PAT closeout',
    '',
    '| PAT mutation runs | Read-only runs | Normal UI revoke/delete closeout | Route-fault exact fallback | Read-only provider checks |',
    '| ---: | ---: | --- | --- | --- |',
    `| ${summary.patMutationRuns} | ${summary.readOnlyRuns} | ${summary.normalUiRevocationPassed ? 'passed' : 'not run or failed'} | ${summary.routeFaultFallbackPassed ? 'passed' : 'not run or failed'} | ${summary.readOnlyProviderChecksPassed ? 'passed' : 'failed'} |`,
    '',
    'Only counts and pass/fail booleans are summarized; raw PATs, labels, run markers, response bodies, and account identity are excluded.',
    '',
  ].join('\n');
}

const RECALL_EVIDENCE_KIND = 'manual_recall_closeout';
const RECALL_ACTION_STAGES = ['start', 'confidence', 'reveal', 'complete'];
const RECALL_PROJECTS_BY_ARTIFACT = {
  'authenticated-desktop.json': 'authenticated-desktop',
  'authenticated-mobile.json': 'authenticated-mobile',
};
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RECALL_ROOT_FIELDS = [
  'actionDecodedBytesTotal',
  'actionFlow',
  'actionResponseHeadersTotalMs',
  'actionTransferredBytesTotal',
  'artifactName',
  'browserErrorCount',
  'cleanup',
  'durationMs',
  'evidenceKind',
  'persisted',
  'project',
  'rendered',
  'rollout',
  'route',
  'routeHtmlBytes',
  'routeReadyMs',
  'routeStatus',
  'rtlRouteStatus',
  'schemaVersion',
  'screenshots',
  'serverActionRequestCount',
];
const RECALL_ROLLOUT_FIELDS = [
  'distinctCandidateDenied',
  'enabled',
  'exactSingleAllowedOwner',
  'mode',
];
const RECALL_RENDERED_FIELDS = [
  'completionVisible',
  'localDraftAbsentFromActions',
  'localDraftVisibleAfterReveal',
  'measuredTouchTargetCount',
  'minimumTouchTargetPx',
  'postRevealAnswerVisible',
  'preRevealAnswerHidden',
  'privateQuestionVisible',
  'rtlContained',
  'rtlDirection',
];
const RECALL_ACTION_FIELDS = [
  'decodedBytesAtSettledUi',
  'requestBytes',
  'responseHeadersMs',
  'stage',
  'status',
  'transferredBytesAtSettledUi',
];
const RECALL_PERSISTED_FIELDS = [
  'attemptCount',
  'attemptLifecycleState',
  'confidence',
  'dueMatchesAttempt',
  'hintUsed',
  'outcome',
  'practiceStatus',
  'scheduleState',
  'scheduleVersion',
];
const RECALL_CLEANUP_FIELDS = [
  'attempts',
  'batches',
  'drafts',
  'evidence',
  'items',
  'revisions',
  'schedules',
  'sources',
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactFields(value, fields) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  return actual.length === expected.length
    && actual.every((field, index) => field === expected[index]);
}

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function isSafeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function recallScreenshotNamesForProject(project) {
  return [
    `${project}-pre-reveal.png`,
    `${project}-post-reveal.png`,
    `${project}-completed.png`,
  ];
}

async function assertExactRecallScreenshotFiles(recallDirectory, metrics) {
  const expectedNames = metrics
    .flatMap((metric) => metric.screenshots)
    .sort();
  let entries = [];
  try {
    entries = await fs.readdir(recallDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const pngEntries = entries
    .filter((entry) => /\.png$/i.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const actualNames = pngEntries.map((entry) => entry.name);
  if (
    actualNames.length !== expectedNames.length
    || actualNames.some((name, index) => name !== expectedNames[index])
  ) {
    throw new Error(
      'Authenticated Recall screenshot evidence is incomplete or contains unexpected PNG files.',
    );
  }

  for (const entry of pngEntries) {
    if (!entry.isFile()) {
      throw new Error('Authenticated Recall screenshots must be regular PNG files.');
    }
    const screenshotPath = path.join(recallDirectory, entry.name);
    const handle = await fs.open(screenshotPath, 'r');
    try {
      const stats = await handle.stat();
      if (!stats.isFile() || stats.size <= PNG_SIGNATURE.length) {
        throw new Error('Authenticated Recall screenshots must be nonempty regular PNG files.');
      }
      const signature = Buffer.alloc(PNG_SIGNATURE.length);
      const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
      if (bytesRead !== PNG_SIGNATURE.length || !signature.equals(PNG_SIGNATURE)) {
        throw new Error('Authenticated Recall screenshot evidence has an invalid PNG signature.');
      }
    } finally {
      await handle.close();
    }
  }
}

function isExactRecallEvidence(metric) {
  if (!hasExactFields(metric, RECALL_ROOT_FIELDS)) return false;
  const expectedProject = Object.hasOwn(RECALL_PROJECTS_BY_ARTIFACT, metric.artifactName)
    ? RECALL_PROJECTS_BY_ARTIFACT[metric.artifactName]
    : null;
  const expectedScreenshots = expectedProject
    ? recallScreenshotNamesForProject(expectedProject)
    : [];
  return metric.schemaVersion === 1
    && metric.evidenceKind === RECALL_EVIDENCE_KIND
    && metric.route === '/en/recall'
    && Boolean(expectedProject)
    && metric.project === expectedProject
    && hasExactFields(metric.rollout, RECALL_ROLLOUT_FIELDS)
    && ['off', 'allowlist', 'all'].includes(metric.rollout.mode)
    && typeof metric.rollout.enabled === 'boolean'
    && typeof metric.rollout.exactSingleAllowedOwner === 'boolean'
    && typeof metric.rollout.distinctCandidateDenied === 'boolean'
    && hasExactFields(metric.rendered, RECALL_RENDERED_FIELDS)
    && [
      'privateQuestionVisible',
      'preRevealAnswerHidden',
      'localDraftAbsentFromActions',
      'localDraftVisibleAfterReveal',
      'postRevealAnswerVisible',
      'completionVisible',
      'rtlContained',
    ].every((field) => typeof metric.rendered[field] === 'boolean')
    && isSafeNonNegativeInteger(metric.rendered.measuredTouchTargetCount)
    && isFiniteNonNegative(metric.rendered.minimumTouchTargetPx)
    && ['ltr', 'rtl'].includes(metric.rendered.rtlDirection)
    && Number.isSafeInteger(metric.rtlRouteStatus)
    && Number.isSafeInteger(metric.routeStatus)
    && isFiniteNonNegative(metric.routeReadyMs)
    && isSafeNonNegativeInteger(metric.routeHtmlBytes)
    && isSafeNonNegativeInteger(metric.serverActionRequestCount)
    && Array.isArray(metric.actionFlow)
    && metric.actionFlow.length === RECALL_ACTION_STAGES.length
    && metric.actionFlow.every((action, index) => (
      hasExactFields(action, RECALL_ACTION_FIELDS)
      && action.stage === RECALL_ACTION_STAGES[index]
      && Number.isSafeInteger(action.status)
      && isFiniteNonNegative(action.responseHeadersMs)
      && isSafeNonNegativeInteger(action.requestBytes)
      && isSafeNonNegativeInteger(action.decodedBytesAtSettledUi)
      && (
        action.transferredBytesAtSettledUi === null
        || isSafeNonNegativeInteger(action.transferredBytesAtSettledUi)
      )
    ))
    && isFiniteNonNegative(metric.actionResponseHeadersTotalMs)
    && isSafeNonNegativeInteger(metric.actionDecodedBytesTotal)
    && (
      metric.actionTransferredBytesTotal === null
      || isSafeNonNegativeInteger(metric.actionTransferredBytesTotal)
    )
    && hasExactFields(metric.persisted, RECALL_PERSISTED_FIELDS)
    && isSafeNonNegativeInteger(metric.persisted.attemptCount)
    && [
      'prepared',
      'confidence_selected',
      'revealed',
      'completed',
      'invalidated',
    ].includes(metric.persisted.attemptLifecycleState)
    && ['low', 'medium', 'high'].includes(metric.persisted.confidence)
    && ['remembered', 'partial', 'missed'].includes(metric.persisted.outcome)
    && typeof metric.persisted.hintUsed === 'boolean'
    && ['d1_pending', 'd1_retry', 'd7_pending', 'ordinary_practice']
      .includes(metric.persisted.scheduleState)
    && isSafeNonNegativeInteger(metric.persisted.scheduleVersion)
    && ['known', 'saved'].includes(metric.persisted.practiceStatus)
    && typeof metric.persisted.dueMatchesAttempt === 'boolean'
    && isSafeNonNegativeInteger(metric.browserErrorCount)
    && isFiniteNonNegative(metric.durationMs)
    && Array.isArray(metric.screenshots)
    && metric.screenshots.length === expectedScreenshots.length
    && metric.screenshots.every((screenshot, index) => screenshot === expectedScreenshots[index])
    && hasExactFields(metric.cleanup, RECALL_CLEANUP_FIELDS)
    && RECALL_CLEANUP_FIELDS.every((field) => (
      isSafeNonNegativeInteger(metric.cleanup[field])
    ));
}

function isRecallCloseoutPassed(metric) {
  if (!isExactRecallEvidence(metric)) return false;
  const responseHeadersTotal = metric.actionFlow.reduce(
    (total, action) => total + action.responseHeadersMs,
    0,
  );
  const decodedBytesTotal = metric.actionFlow.reduce(
    (total, action) => total + action.decodedBytesAtSettledUi,
    0,
  );
  const transferredValues = metric.actionFlow
    .map((action) => action.transferredBytesAtSettledUi)
    .filter((value) => value !== null);
  const expectedTransferredTotal = transferredValues.length === metric.actionFlow.length
    ? transferredValues.reduce((total, value) => total + value, 0)
    : null;
  return metric.rollout.mode === 'allowlist'
    && metric.rollout.enabled === true
    && metric.rollout.exactSingleAllowedOwner === true
    && metric.rollout.distinctCandidateDenied === true
    && metric.routeStatus === 200
    && metric.rtlRouteStatus === 200
    && metric.routeReadyMs > 0
    && metric.routeHtmlBytes > 0
    && metric.serverActionRequestCount === 4
    && metric.actionFlow.every((action) => (
      action.status === 200
      && action.responseHeadersMs > 0
      && action.requestBytes > 0
      && action.decodedBytesAtSettledUi > 0
    ))
    && Math.abs(metric.actionResponseHeadersTotalMs - responseHeadersTotal) < 0.11
    && metric.actionDecodedBytesTotal === decodedBytesTotal
    && metric.actionTransferredBytesTotal === expectedTransferredTotal
    && metric.rendered.privateQuestionVisible === true
    && metric.rendered.preRevealAnswerHidden === true
    && metric.rendered.localDraftAbsentFromActions === true
    && metric.rendered.localDraftVisibleAfterReveal === true
    && metric.rendered.postRevealAnswerVisible === true
    && metric.rendered.completionVisible === true
    && metric.rendered.measuredTouchTargetCount > 0
    && metric.rendered.minimumTouchTargetPx >= 44
    && metric.rendered.rtlDirection === 'rtl'
    && metric.rendered.rtlContained === true
    && metric.persisted.attemptCount === 1
    && metric.persisted.attemptLifecycleState === 'completed'
    && metric.persisted.confidence === 'high'
    && metric.persisted.outcome === 'remembered'
    && metric.persisted.hintUsed === false
    && metric.persisted.scheduleState === 'd7_pending'
    && metric.persisted.scheduleVersion === 2
    && metric.persisted.practiceStatus === 'known'
    && metric.persisted.dueMatchesAttempt === true
    && metric.browserErrorCount === 0
    && metric.durationMs > 0
    && RECALL_CLEANUP_FIELDS.every((field) => metric.cleanup[field] === 0);
}

export function buildAuthenticatedRecallSummary(metrics) {
  if (!Array.isArray(metrics) || metrics.some((metric) => !isExactRecallEvidence(metric))) {
    throw new Error('Authenticated Recall evidence is malformed or contains unknown fields.');
  }
  const byProject = Map.groupBy(metrics, (metric) => metric.project);
  const projects = Object.fromEntries([...byProject.entries()].map(([project, rows]) => {
    const transferred = rows
      .map((row) => row.actionTransferredBytesTotal)
      .filter((value) => Number.isFinite(value));
    return [project, {
      runs: rows.length,
      routeStatuses: [...new Set(rows.map((row) => row.routeStatus))],
      routeReadyMs: summarize(rows.map((row) => row.routeReadyMs)),
      routeHtmlBytes: summarize(rows.map((row) => row.routeHtmlBytes)),
      serverActionRequests: summarize(rows.map((row) => row.serverActionRequestCount)),
      actionFlows: [...new Set(rows.map((row) => (
        row.actionFlow.map((action) => `${action.stage}:${action.status}`).join(' -> ')
      )))],
      actionResponseHeadersTotalMs: summarize(
        rows.map((row) => row.actionResponseHeadersTotalMs),
      ),
      actionDecodedBytesTotal: summarize(rows.map((row) => row.actionDecodedBytesTotal)),
      actionTransferredBytesTotal: transferred.length > 0 ? summarize(transferred) : null,
      rolloutContractEveryRun: rows.every((row) => (
        row.rollout.mode === 'allowlist'
        && row.rollout.enabled === true
        && row.rollout.exactSingleAllowedOwner === true
        && row.rollout.distinctCandidateDenied === true
      )),
      privateQuestionVisibleEveryRun: rows.every((row) => row.rendered.privateQuestionVisible),
      preRevealAnswerHiddenEveryRun: rows.every((row) => row.rendered.preRevealAnswerHidden),
      localDraftAbsentFromActionsEveryRun: rows.every(
        (row) => row.rendered.localDraftAbsentFromActions,
      ),
      localDraftVisibleAfterRevealEveryRun: rows.every(
        (row) => row.rendered.localDraftVisibleAfterReveal,
      ),
      postRevealAnswerVisibleEveryRun: rows.every((row) => row.rendered.postRevealAnswerVisible),
      completionVisibleEveryRun: rows.every((row) => row.rendered.completionVisible),
      measuredTouchTargetMinimum: Math.min(
        ...rows.map((row) => row.rendered.minimumTouchTargetPx),
      ),
      touchTargetsAtLeast44EveryRun: rows.every(
        (row) => row.rendered.measuredTouchTargetCount > 0
          && row.rendered.minimumTouchTargetPx >= 44,
      ),
      rtlRouteStatuses: [...new Set(rows.map((row) => row.rtlRouteStatus))],
      rtlDirectionEveryRun: rows.every((row) => row.rendered.rtlDirection === 'rtl'),
      rtlContainedEveryRun: rows.every((row) => row.rendered.rtlContained === true),
      completedDbStateEveryRun: rows.every((row) => (
        row.persisted.attemptCount === 1
        && row.persisted.attemptLifecycleState === 'completed'
        && row.persisted.confidence === 'high'
        && row.persisted.outcome === 'remembered'
        && row.persisted.hintUsed === false
        && row.persisted.scheduleState === 'd7_pending'
        && row.persisted.scheduleVersion === 2
        && row.persisted.practiceStatus === 'known'
        && row.persisted.dueMatchesAttempt === true
      )),
      browserErrorCount: rows.reduce((total, row) => total + row.browserErrorCount, 0),
      cleanupZeroEveryRun: rows.every((row) => (
        RECALL_CLEANUP_FIELDS.every((field) => row.cleanup[field] === 0)
      )),
      closeoutPassed: rows.every(isRecallCloseoutPassed),
      durationMs: summarize(rows.map((row) => row.durationMs)),
      screenshotMinimum: Math.min(...rows.map((row) => row.screenshots.length)),
    }];
  }));
  return { projects, runs: metrics };
}

export function assertRequiredRecallCloseoutEvidence(
  metrics,
  summary,
  sourceArtifactNames = metrics.map((metric) => metric?.artifactName),
) {
  const expectedArtifactNames = Object.keys(RECALL_PROJECTS_BY_ARTIFACT).sort();
  const actualArtifactNames = metrics.map((metric) => metric?.artifactName).sort();
  const actualSourceNames = [...sourceArtifactNames].sort();
  const expectedProjects = Object.values(RECALL_PROJECTS_BY_ARTIFACT).sort();
  const actualProjects = Object.keys(summary?.projects ?? {}).sort();
  if (
    metrics.length !== 2
    || metrics.some((metric) => !isRecallCloseoutPassed(metric))
    || actualArtifactNames.join(',') !== expectedArtifactNames.join(',')
    || actualSourceNames.join(',') !== expectedArtifactNames.join(',')
    || sourceArtifactNames.some((name, index) => name !== metrics[index]?.artifactName)
    || actualProjects.join(',') !== expectedProjects.join(',')
    || expectedProjects.some((project) => (
      summary?.projects?.[project]?.runs !== 1
      || summary.projects[project].closeoutPassed !== true
    ))
  ) {
    throw new Error(
      'Required Preview Recall closeout evidence is incomplete: expected one exact successful desktop artifact and one exact successful mobile artifact after zero-residue cleanup.',
    );
  }
}

export function renderAuthenticatedThinkingHistorySummary(summary) {
  if (!summary) {
    return [
      '## Thinking History private path',
      '',
      'Not enabled for this run. Production evidence remains separately gated.',
      '',
    ].join('\n');
  }

  return [
    '## Thinking History private path',
    '',
    '| Project | Runs | Message asset requests median / worst; statuses | Private evidence minimum | Pre-intent context requests worst | Signal operations | Context formats | Context API flow | Import closeout | Context bytes median / worst | Browser errors | Duration median / worst |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: | ---: | ---: |',
    ...Object.entries(summary.projects).map(([project, value]) => (
      `| ${project} | ${value.runs} | ${value.messageAssetRequests.median} / ${value.messageAssetRequests.worst}; ${value.messageAssetStatuses.join(', ')} | ${value.privateEvidenceMinimum} | ${value.contextRequestsBeforeIntentWorst} | ${value.signalOperations.join(', ')} | ${value.contextFormats.join(', ')} | ${value.contextFlows.join(', ')} | ${value.importCloseoutPassed ? 'passed' : 'failed'} | ${formatBytes(value.contextBytes.median)} / ${formatBytes(value.contextBytes.worst)} | ${value.browserErrorCount} | ${value.durationMs.median} ms / ${value.durationMs.worst} ms |`
    )),
    '',
    'Synthetic owner-scoped Playwright evidence. It separately proves privacy-safe signal operations, copy/download for JSON, Markdown, and YAML, and selected-import deletion; this is not production user telemetry.',
    '',
  ].join('\n');
}

export function renderAuthenticatedMobileApiSummary(summary) {
  if (!summary) {
    return [
      '## Mobile API deployed path',
      '',
      'Not enabled for this run. Physical-device and store evidence remain separately gated.',
      '',
    ].join('\n');
  }

  return [
    '## Mobile API deployed path',
    '',
    '| Project | Runs | Private no-store reads minimum | Notes | Topics / hub | Anonymous ranking | Practice new / review | Candidate approve / ignore / stale | Exact cleanup | Closeout |',
    '| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |',
    ...Object.entries(summary.projects).map(([project, value]) => (
      `| ${project} | ${value.runs} | ${value.privateNoStoreReadsMinimum} | ${value.gates.noteLifecycle ? 'passed' : 'failed'} | ${value.gates.topicsAndHub ? 'passed' : 'failed'} | ${value.gates.rankingAnonymous ? 'passed' : 'failed'} | ${value.gates.practiceNewAndReview ? 'passed' : 'failed'} | ${value.gates.candidateApproveIgnoreAndStale ? 'passed' : 'failed'} | ${value.gates.cleanup ? 'passed' : 'failed'} | ${value.closeoutPassed ? 'passed' : 'failed'} |`
    )),
    '',
    'Synthetic owner-scoped Preview API evidence with sanitized counts and booleans only. It is not physical-device, accessibility, signed-binary, or store-release evidence.',
    '',
  ].join('\n');
}

export function renderAuthenticatedRecallSummary(summary) {
  if (!summary) {
    return [
      '## Recall private review path',
      '',
      'Not enabled for this run. Recall enrollment stays production-default-off; rendered evidence requires the allowlisted Preview synthetic owner.',
      '',
    ].join('\n');
  }

  return [
    '## Recall private review path',
    '',
    '| Project | Runs | Route status; ready median / worst; HTML bytes | Server Action requests median / worst; status flow | Action headers total median / worst | Decoded median / worst | Transfer median / worst | Privacy/render gates | Persisted completion | Browser errors | Total duration median / worst | Screenshots minimum |',
    '| --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: |',
    ...Object.entries(summary.projects).map(([project, value]) => {
      const transfer = value.actionTransferredBytesTotal
        ? `${formatBytes(value.actionTransferredBytesTotal.median)} / ${formatBytes(value.actionTransferredBytesTotal.worst)}`
        : 'n/a';
      const renderGates = value.rolloutContractEveryRun
        && value.privateQuestionVisibleEveryRun
        && value.preRevealAnswerHiddenEveryRun
        && value.localDraftAbsentFromActionsEveryRun
        && value.localDraftVisibleAfterRevealEveryRun
        && value.postRevealAnswerVisibleEveryRun
        && value.completionVisibleEveryRun
        && value.touchTargetsAtLeast44EveryRun
        && value.rtlDirectionEveryRun
        && value.rtlContainedEveryRun
        && value.rtlRouteStatuses.every((status) => status === 200)
        && value.cleanupZeroEveryRun
        ? `exact allowlist; draft not sent; hidden -> revealed -> complete; targets >= ${value.measuredTouchTargetMinimum}px; RTL contained; cleanup zero`
        : 'failed';
      return `| ${project} | ${value.runs} | ${value.routeStatuses.join(', ')}; ${value.routeReadyMs.median} ms / ${value.routeReadyMs.worst} ms; ${formatBytes(value.routeHtmlBytes.median)} / ${formatBytes(value.routeHtmlBytes.worst)} | ${value.serverActionRequests.median} / ${value.serverActionRequests.worst}; ${value.actionFlows.join(', ')} | ${value.actionResponseHeadersTotalMs.median} ms / ${value.actionResponseHeadersTotalMs.worst} ms | ${formatBytes(value.actionDecodedBytesTotal.median)} / ${formatBytes(value.actionDecodedBytesTotal.worst)} | ${transfer} | ${renderGates} | ${value.completedDbStateEveryRun ? 'completed; D+7; due matched' : 'failed'} | ${value.browserErrorCount} | ${value.durationMs.median} ms / ${value.durationMs.worst} ms | ${value.screenshotMinimum} |`;
    }),
    '',
    'Synthetic owner-and-ID-scoped Preview evidence. The deployed route must report exact single-owner allowlist mode, four explicit Server Actions must remain 200, the browser-local draft must be absent from every request, and the artifact is written only after cleanup verifies zero deterministic fixture rows.',
    '',
  ].join('\n');
}

export function renderAuthenticatedOverlaySummary(
  summary,
  thinkingHistory = null,
  mobileApi = null,
  mcpProvider = null,
  recall = null,
) {
  const projectEntries = Object.entries(summary.projects);
  const overlay = projectEntries.length === 0
    ? [
      '# Authenticated overlay performance',
      '',
      'No overlay metrics completed for this run.',
      '',
    ].join('\n')
    : [
      '# Authenticated overlay performance',
      '',
      '| Project | Runs | Click to canvas median / worst | Overlay headers median / worst | Decoded by canvas median / worst | Transfer by canvas median / worst |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
      ...projectEntries.map(([project, value]) => {
    const transfer = value.overlayTransferredBytesAtCanvas
      ? `${formatBytes(value.overlayTransferredBytesAtCanvas.median)} / ${formatBytes(value.overlayTransferredBytesAtCanvas.worst)}`
      : 'n/a';
    return `| ${project} | ${value.runs} | ${value.clickToCanvasMs.median} ms / ${value.clickToCanvasMs.worst} ms | ${value.overlayResponseHeadersMs.median} ms / ${value.overlayResponseHeadersMs.worst} ms | ${formatBytes(value.overlayDecodedBytesAtCanvas.median)} / ${formatBytes(value.overlayDecodedBytesAtCanvas.worst)} | ${transfer} |`;
      }),
      '',
      'Synthetic Playwright measurements. Overlay timing ends at response headers, and byte counts include data received through canvas display so streaming RSC responses do not block the evidence run. These are not production user telemetry.',
      '',
    ].join('\n');
  return `${overlay}\n${renderAuthenticatedThinkingHistorySummary(thinkingHistory)}\n${renderAuthenticatedMobileApiSummary(mobileApi)}\n${renderAuthenticatedMcpProviderSummary(mcpProvider)}\n${renderAuthenticatedRecallSummary(recall)}`;
}

export async function summarizeAuthenticatedOverlayResults(
  resultsDirectory = path.resolve('test-results/authenticated-overlay-performance'),
  {
    requireMcpPatCloseout = process.env.E2E_REQUIRE_MCP_PAT_CLOSEOUT === 'true',
    requireRecallCloseout = process.env.E2E_REQUIRE_RECALL_CLOSEOUT === 'true',
  } = {},
) {
  const metricsDirectory = path.join(resultsDirectory, 'metrics');
  let names = [];
  try {
    names = (await fs.readdir(metricsDirectory)).filter((name) => name.endsWith('.json')).sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const metrics = await Promise.all(names.map(async (name) => (
    JSON.parse(await fs.readFile(path.join(metricsDirectory, name), 'utf8'))
  )));
  const thinkingHistoryDirectory = path.join(resultsDirectory, 'thinking-history');
  let thinkingHistoryNames = [];
  try {
    thinkingHistoryNames = (await fs.readdir(thinkingHistoryDirectory))
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const thinkingHistoryMetrics = await Promise.all(thinkingHistoryNames.map(async (name) => (
    JSON.parse(await fs.readFile(path.join(thinkingHistoryDirectory, name), 'utf8'))
  )));
  const thinkingHistory = thinkingHistoryMetrics.length > 0
    ? buildAuthenticatedThinkingHistorySummary(thinkingHistoryMetrics)
    : null;
  const mobileApiDirectory = path.join(resultsDirectory, 'mobile-api');
  let mobileApiNames = [];
  try {
    mobileApiNames = (await fs.readdir(mobileApiDirectory))
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const recallDirectory = path.join(resultsDirectory, 'recall');
  let recallNames = [];
  try {
    recallNames = (await fs.readdir(recallDirectory))
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const mobileApiMetrics = await Promise.all(mobileApiNames.map(async (name) => (
    JSON.parse(await fs.readFile(path.join(mobileApiDirectory, name), 'utf8'))
  )));
  const mobileApi = mobileApiMetrics.length > 0
    ? buildAuthenticatedMobileApiSummary(mobileApiMetrics)
    : null;
  const mcpProviderDirectory = path.join(resultsDirectory, 'mcp-provider-setup');
  let mcpProviderNames = [];
  try {
    mcpProviderNames = (await fs.readdir(mcpProviderDirectory))
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const mcpProviderMetrics = await Promise.all(mcpProviderNames.map(async (name) => ({
    ...JSON.parse(await fs.readFile(path.join(mcpProviderDirectory, name), 'utf8')),
    artifactName: name,
  })));
  const mcpProvider = mcpProviderMetrics.length > 0
    ? buildAuthenticatedMcpProviderSummary(mcpProviderMetrics)
    : null;
  const recallMetrics = await Promise.all(recallNames.map(async (name) => {
    const metric = JSON.parse(await fs.readFile(path.join(recallDirectory, name), 'utf8'));
    if (metric?.artifactName !== name) {
      throw new Error('Authenticated Recall evidence filename does not match its artifact contract.');
    }
    return metric;
  }));
  const recall = recallMetrics.length > 0
    ? buildAuthenticatedRecallSummary(recallMetrics)
    : null;
  if (requireMcpPatCloseout) {
    assertRequiredMcpPatCloseoutEvidence(mcpProviderMetrics, mcpProvider);
  }
  if (requireRecallCloseout) {
    assertRequiredRecallCloseoutEvidence(recallMetrics, recall, recallNames);
  }
  if (recallMetrics.length > 0) {
    await assertExactRecallScreenshotFiles(recallDirectory, recallMetrics);
  }
  if (
    metrics.length === 0
    && thinkingHistoryMetrics.length === 0
    && mobileApiMetrics.length === 0
    && mcpProviderMetrics.length === 0
    && recallMetrics.length === 0
  ) {
    throw new Error(`No authenticated evidence metrics found at ${resultsDirectory}.`);
  }
  const summary = {
    ...buildAuthenticatedOverlaySummary(metrics),
    thinkingHistory,
    mobileApi,
    mcpProvider,
    recall,
  };
  const markdown = renderAuthenticatedOverlaySummary(
    summary,
    thinkingHistory,
    mobileApi,
    mcpProvider,
    recall,
  );

  await fs.mkdir(resultsDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(resultsDirectory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(resultsDirectory, 'summary.md'), markdown, 'utf8'),
  ]);
  return { summary, markdown };
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  summarizeAuthenticatedOverlayResults()
    .then(({ markdown }) => console.log(markdown))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
