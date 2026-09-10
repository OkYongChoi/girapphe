import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  AUTHENTICATED_OVERLAY_AUTH_MODES,
  createSyntheticSignInTicket,
  isAuthenticatedOverlayMcpPatMutationPreview,
  resolveAuthenticatedOverlayAuthMode,
} from './authenticated-overlay-auth.mjs';
import {
  AUTHENTICATED_OVERLAY_DRAFT_PROBE_TITLE_PREFIX,
  AUTHENTICATED_OVERLAY_EMAIL_MARKER,
} from './authenticated-overlay-constants.mjs';

test('Clerk auth mode keeps testing tokens away from production instances', () => {
  assert.equal(
    resolveAuthenticatedOverlayAuthMode({ secretKey: 'sk_test_example' }),
    AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken,
  );
  assert.equal(
    resolveAuthenticatedOverlayAuthMode({ secretKey: 'sk_live_example' }),
    AUTHENTICATED_OVERLAY_AUTH_MODES.signInToken,
  );
  assert.throws(
    () => resolveAuthenticatedOverlayAuthMode({
      configuredMode: AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken,
      secretKey: 'sk_live_example',
    }),
    /Production Clerk instances cannot use Clerk testing tokens/,
  );
});

test('MCP PAT mutation requires an explicit marker-owned testing-token Preview run', () => {
  const validInput = {
    baseUrl: 'https://pr-192-girapphe-preview.example.workers.dev',
    configuredMode: AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken,
    secretKey: 'sk_test_example',
    emailAddress: `fixture${AUTHENTICATED_OVERLAY_EMAIL_MARKER}@example.com`,
    requireCloseout: 'true',
  };
  assert.equal(isAuthenticatedOverlayMcpPatMutationPreview(validInput), true);
  assert.equal(isAuthenticatedOverlayMcpPatMutationPreview({
    ...validInput,
    requireCloseout: 'false',
  }), false);
  assert.equal(isAuthenticatedOverlayMcpPatMutationPreview({
    ...validInput,
    baseUrl: 'https://www.girapphe.com',
  }), false);
  assert.equal(isAuthenticatedOverlayMcpPatMutationPreview({
    ...validInput,
    emailAddress: 'fixture@example.com',
  }), false);
  assert.equal(isAuthenticatedOverlayMcpPatMutationPreview({
    ...validInput,
    configuredMode: AUTHENTICATED_OVERLAY_AUTH_MODES.signInToken,
  }), false);
});

test('fixture PAT reset uses the same explicit Preview mutation gate', async () => {
  const setupSource = await fs.readFile(new URL(
    '../e2e-authenticated/authenticated-overlay.setup.ts',
    import.meta.url,
  ), 'utf8');

  assert.match(
    setupSource,
    /resetMcpAccessTokens: isAuthenticatedOverlayMcpPatMutationPreview\(\{[\s\S]*emailAddress: syntheticEmail,[\s\S]*\}\)/,
  );
  assert.doesNotMatch(
    setupSource,
    /resetMcpAccessTokens: clerkAuthMode === AUTHENTICATED_OVERLAY_AUTH_MODES\.testingToken/,
  );
  assert.match(
    setupSource,
    /import \{[\s\S]*ensureAuthenticatedOverlayFixture,[\s\S]*normalizeSyntheticEmail,[\s\S]*\} from ['"]\.\.\/scripts\/authenticated-overlay-fixture\.mjs['"]/,
  );
  assert.doesNotMatch(
    setupSource,
    /await import\(['"]\.\.\/scripts\/authenticated-overlay-fixture\.mjs['"]\)/,
  );
});

test('each authenticated browser context can refresh Clerk testing sessions', async () => {
  const fixtureUrl = new URL(
    '../e2e-authenticated/authenticated-test.ts',
    import.meta.url,
  );
  const source = await fs.readFile(fixtureUrl, 'utf8');

  assert.match(source, /clerkTestingEnvironment:[\s\S]{0,400}clerkSetup\(\{ dotenv: false \}\)/);
  assert.match(source, /clerkTestingToken:[\s\S]{0,500}setupClerkTestingToken\(\{ context \}\)/);
  assert.match(source, /AUTHENTICATED_OVERLAY_AUTH_MODES\.testingToken/);
  assert.match(source, /\{ auto: true \}/);

  const specDirectory = new URL('../e2e-authenticated/', import.meta.url);
  const specNames = (await fs.readdir(specDirectory))
    .filter((name) => name.endsWith('.spec.ts'));
  const specSources = await Promise.all(specNames.map(async (name) => ({
    name,
    source: await fs.readFile(new URL(name, specDirectory), 'utf8'),
  })));
  for (const spec of specSources) {
    assert.match(
      spec.source,
      /from ['"]\.\/authenticated-test['"];/,
      `${spec.name} must install the per-context Clerk testing-token refresh fixture`,
    );
  }
});

test('authenticated Playwright workers statically load database fixtures', async () => {
  const specDirectory = new URL('../e2e-authenticated/', import.meta.url);
  const workerNames = (await fs.readdir(specDirectory))
    .filter((name) => name.endsWith('.spec.ts') || name.endsWith('.setup.ts'));
  const workerSources = await Promise.all(workerNames.map(async (name) => ({
    name,
    source: await fs.readFile(new URL(name, specDirectory), 'utf8'),
  })));

  for (const worker of workerSources) {
    assert.doesNotMatch(
      worker.source,
      /import\s*\(\s*['"][^'"]*authenticated-(?:overlay|mobile-api)-fixture\.mjs['"]\s*\)/,
      `${worker.name} must not mix a dynamic fixture import with Playwright's CommonJS worker transform`,
    );
  }

  const requiredStaticImports = [
    {
      name: 'authenticated-thinking-history.spec.ts',
      moduleName: 'authenticated-overlay-fixture.mjs',
      symbols: [
        'deleteExactAuthenticatedOverlayImport',
        'inspectPendingAuthenticatedOverlayImport',
        'readAuthenticatedOverlayPublishedState',
      ],
    },
    {
      name: 'authenticated-mobile-api.spec.ts',
      moduleName: 'authenticated-mobile-api-fixture.mjs',
      symbols: [
        'cleanupAuthenticatedMobileApiFixture',
        'createAuthenticatedMobileApiFixture',
      ],
    },
  ];

  for (const requirement of requiredStaticImports) {
    const worker = workerSources.find(({ name }) => name === requirement.name);
    assert.ok(worker, `${requirement.name} must be part of the authenticated suite`);
    const escapedModuleName = requirement.moduleName.replaceAll('.', '\\.');
    const fixtureImport = worker.source.match(new RegExp(
      `import\\s*\\{([^}]*)\\}\\s*from\\s*['"][^'"]*${escapedModuleName}['"]`,
    ));
    assert.ok(fixtureImport, `${requirement.name} must statically import ${requirement.moduleName}`);
    for (const symbol of requirement.symbols) {
      assert.match(
        fixtureImport[1],
        new RegExp(`(?:^|\\s|,)${symbol}(?:\\s|,|$)`),
        `${requirement.name} must statically import ${symbol}`,
      );
    }
  }
});

test('provider PAT evidence gates on the same resolved Clerk auth mode as setup', async () => {
  const testUrl = new URL(
    '../e2e-authenticated/authenticated-mcp-provider-setup.spec.ts',
    import.meta.url,
  );
  const source = await fs.readFile(testUrl, 'utf8');

  assert.match(source, /test\.use\(\{ screenshot: ['"]off['"] \}\)/);
  assert.match(source, /evidenceKind: ['"]normal_ui_revocation['"]/);
  assert.match(source, /project: testInfo\.project\.name/);
  assert.match(source, /isAuthenticatedOverlayMcpPatMutationPreview\(\)/);
  assert.match(
    source,
    /!isPatMutationPreview\(testInfo\)/,
  );
  assert.match(source, /testInfo\.project\.name === ['"]authenticated-desktop['"]/);
  assert.match(
    source,
    /AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE}:mcp-pat:\$\{randomUUID\(\)\}/,
  );
  assert.doesNotMatch(
    source,
    /process\.env\.E2E_CLERK_AUTH_MODE !== ['"]testing-token['"]/,
  );
  assert.ok(source.includes(
    'const RAW_PAT_SHAPE = /^girapphe_mcp_[A-Za-z0-9_-]{43}$/u;',
  ));
  const testStartedAt = source.indexOf('const testStartedAt = Date.now()');
  const evidenceTimeout = source.indexOf(
    'const evidenceTimeoutMs = testInfo.timeout',
    testStartedAt,
  );
  const cleanupReserve = source.indexOf(
    'testInfo.setTimeout(Math.max(',
    evidenceTimeout,
  );
  const createClick = source.indexOf(
    "getByRole('button', { name: 'Create token' }).click()",
    cleanupReserve,
  );
  const boundedEvidenceStep = source.indexOf(
    '}, { timeout: evidenceTimeoutMs });',
    createClick,
  );
  const originalEvidenceCapture = source.indexOf(
    'originalEvidenceError = error',
    boundedEvidenceStep,
  );
  const cleanupFinally = source.indexOf('} finally {', originalEvidenceCapture);
  const firstCleanupOperation = source.indexOf(
    'await hidePatSurface(page, initialRedactionDeadlineMs)',
    cleanupFinally,
  );
  const immediateEvidence = source.indexOf('rawSurfaceAbsentImmediatelyAfterRevoke = true');
  const firstReloadCleanup = source.indexOf(
    'await revokeExactConnectionAfterReload(page, connectionLabel)',
    immediateEvidence,
  );
  const databaseFallback = source.indexOf(
    'await revokeExactAuthenticatedOverlayMcpToken({',
    firstReloadCleanup,
  );
  const markerFallback = source.indexOf(
    'await revokeExactAuthenticatedOverlayMcpTokenByMarker({',
    databaseFallback,
  );
  const captureFailureResurface = source.indexOf(
    "cleanupEvidenceError ??= new Error('SYNTHETIC_MCP_TOKEN_CAPTURE_FAILED')",
    markerFallback,
  );
  const cleanupFailureResurface = source.indexOf(
    'if (cleanupError) throw cleanupError',
    markerFallback,
  );
  const originalEvidenceResurface = source.indexOf(
    'if (originalEvidenceFailed) throw originalEvidenceError',
    cleanupFailureResurface,
  );
  const cleanupEvidenceFailureResurface = source.indexOf(
    'if (cleanupEvidenceError) throw cleanupEvidenceError',
    originalEvidenceResurface,
  );
  assert.ok(
    testStartedAt >= 0
      && testStartedAt < evidenceTimeout
      && evidenceTimeout < cleanupReserve
      && cleanupReserve < createClick
      && createClick < boundedEvidenceStep
      && boundedEvidenceStep < originalEvidenceCapture
      && originalEvidenceCapture < cleanupFinally
      && cleanupFinally < firstCleanupOperation
      && firstCleanupOperation < immediateEvidence
      && immediateEvidence < firstReloadCleanup
      && databaseFallback < markerFallback
      && markerFallback < captureFailureResurface
      && captureFailureResurface < cleanupFailureResurface
      && databaseFallback < cleanupFailureResurface
      && cleanupFailureResurface < originalEvidenceResurface
      && originalEvidenceResurface < cleanupEvidenceFailureResurface,
    'the bounded evidence step must reserve cleanup time before PAT creation and precede every cleanup path',
  );
  assert.match(
    source.slice(testStartedAt, cleanupFinally),
    /} catch \(error\) \{\s+originalEvidenceFailed = true;\s+originalEvidenceError = error;/,
  );
  assert.match(
    source.slice(evidenceTimeout, createClick),
    /Date\.now\(\) - testStartedAt[\s\S]*elapsedBeforeCreateMs \+ evidenceTimeoutMs \+ MCP_CLEANUP_RESERVE_MS/,
  );
  assert.doesNotMatch(
    source.slice(cleanupFinally, firstCleanupOperation),
    /testInfo\.setTimeout/,
  );
  const cleanupReserveValue = source.match(
    /const MCP_CLEANUP_RESERVE_MS = ([\d_]+);/,
  );
  const cleanupAttemptValue = source.match(
    /const MCP_CLEANUP_ATTEMPT_MS = ([\d_]+);/,
  );
  assert.ok(cleanupReserveValue && cleanupAttemptValue);
  assert.ok(
    Number(cleanupReserveValue[1].replaceAll('_', ''))
      > Number(cleanupAttemptValue[1].replaceAll('_', '')) * 4,
    'the cleanup reserve must outlast redaction, both UI cleanup paths, and database verification',
  );
  assert.match(
    source.slice(firstReloadCleanup, databaseFallback),
    /uiCleanupErrors\.length === 2 && rawTokenHasExpectedShape/,
  );
  assert.match(
    source.slice(databaseFallback, markerFallback),
    /else if \(createAttempted\)/,
  );
  assert.match(
    source.slice(databaseFallback, originalEvidenceResurface),
    /databaseCleanup\.remainingActive !== 0/,
  );
  assert.match(
    source.slice(markerFallback, cleanupFailureResurface),
    /connectionLabel,[\s\S]*runMarker,[\s\S]*normalUiRemainingActive = databaseCleanup\.remainingActive/,
  );

  const hideEvaluation = source.indexOf('const hide = () => page.evaluate');
  const boundedHide = source.indexOf(
    "withCleanupOperationTimeout(hide, deadlineMs, 'MCP_CLEANUP_REDACTION_TIMEOUT')",
    hideEvaluation,
  );
  const clearEvaluation = source.indexOf('const clear = async () =>');
  const boundedClear = source.indexOf(
    "withCleanupOperationTimeout(clear, deadlineMs, 'MCP_CLEANUP_CLIPBOARD_TIMEOUT')",
    clearEvaluation,
  );
  assert.ok(
    hideEvaluation >= 0
      && hideEvaluation < boundedHide
      && clearEvaluation >= 0
      && clearEvaluation < boundedClear,
    'cleanup page evaluations must have short explicit deadlines',
  );

  const reloadHelper = source.slice(
    source.indexOf('async function revokeExactConnectionAfterReload'),
    source.indexOf("test('switches between ChatGPT and Claude setup"),
  );
  assert.match(
    reloadHelper,
    /page\.reload\(\{[\s\S]*?timeout: cleanupTimeout\(/,
  );
  assert.match(
    reloadHelper,
    /\.waitFor\(\{[\s\S]*?timeout: cleanupTimeout\(/,
  );
  assert.match(
    reloadHelper,
    /\.click\(\{[\s\S]*?timeout: cleanupTimeout\(/,
  );
  assert.match(
    reloadHelper,
    /\.to(?:HaveCount|BeVisible)\([^)]*[\s\S]*?timeout: cleanupTimeout\(/,
  );
  assert.match(
    reloadHelper,
    /page\.reload\(\{[\s\S]*?tokenRow\.getByText\(['"]Revoked['"], \{ exact: true \}\)[\s\S]*?\.toBeVisible\(/,
  );
  assert.doesNotMatch(
    source,
    /revokedAfterReload = await reloadedTokenRow[\s\S]{0,120}\.isVisible\(\)/,
  );

  const immediateCleanup = source.slice(
    source.indexOf('const immediateCleanupDeadlineMs', cleanupFinally),
    firstReloadCleanup,
  );
  assert.match(
    immediateCleanup,
    /\.waitFor\(\{[\s\S]*?timeout: cleanupTimeout\(/,
  );
  assert.match(
    immediateCleanup,
    /\.click\(\{[\s\S]*?timeout: cleanupTimeout\(/,
  );
  assert.match(
    immediateCleanup,
    /\.toHaveCount\([^)]*[\s\S]*?timeout: cleanupTimeout\(/,
  );
  assert.match(
    immediateCleanup,
    /\.toBeVisible\(\{[\s\S]*?timeout: cleanupTimeout\(/,
  );
  assert.match(source, /navigator\.clipboard\.writeText\(['"]['"]\)[\s\S]*navigator\.clipboard\.readText\(\)/);
  assert.match(source, /revokeExactAuthenticatedOverlayMcpToken\(\{[\s\S]*rawToken,[\s\S]*connectionLabel,[\s\S]*runMarker,/);
  assert.match(source, /verifyExactAuthenticatedOverlayMcpTokenInactive\(\{[\s\S]*remainingActive/);
  assert.doesNotMatch(
    source,
    /await import\([\s\S]{0,120}authenticated-overlay-fixture\.mjs/,
  );
});

test('provider PAT route fault proves exact fallback and original error identity', async () => {
  const testUrl = new URL(
    '../e2e-authenticated/authenticated-mcp-provider-setup-fault.spec.ts',
    import.meta.url,
  );
  const source = await fs.readFile(testUrl, 'utf8');

  assert.match(source, /test\.use\(\{ screenshot: ['"]off['"] \}\)/);
  assert.match(source, /evidenceKind: ['"]route_fault_fallback['"]/);
  assert.match(source, /project: testInfo\.project\.name/);
  assert.match(source, /!isPatMutationPreview\(testInfo\)/);
  assert.match(source, /testInfo\.project\.name === ['"]authenticated-desktop['"]/);
  assert.match(source, /isAuthenticatedOverlayMcpPatMutationPreview\(\)/);
  assert.match(
    source,
    /AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE}:mcp-pat:\$\{randomUUID\(\)\}/,
  );
  const postFetch = source.indexOf('const response = await route.fetch()');
  const rawCapture = source.indexOf('rawToken = uniqueMatches[0]!', postFetch);
  const responseRedaction = source.indexOf('responseBody.replace(', rawCapture);
  const armFault = source.indexOf('routeFaultArmed = true', responseRedaction);
  const firstClipboardCleanup = source.indexOf(
    'if (!await clearClipboardAndReadBack(page))',
    armFault,
  );
  const firstClipboardCleanupCatch = source.indexOf(
    '} catch (error) {',
    firstClipboardCleanup,
  );
  const firstUiPath = source.indexOf("getByRole('button', { name: 'Revoke' })", armFault);
  const secondUiPath = source.indexOf('await page.reload({', firstUiPath);
  const fallback = source.indexOf(
    '? await revokeExactAuthenticatedOverlayMcpToken({',
    secondUiPath,
  );
  const markerFallback = source.indexOf(
    ': await revokeExactAuthenticatedOverlayMcpTokenByMarker({',
    fallback,
  );
  const originalRethrow = source.indexOf('if (originalError) throw originalError', markerFallback);
  assert.ok(
    postFetch >= 0
      && postFetch < rawCapture
      && rawCapture < responseRedaction
      && responseRedaction < armFault
      && armFault < firstClipboardCleanup
      && firstClipboardCleanup < firstClipboardCleanupCatch
      && firstClipboardCleanupCatch < firstUiPath
      && firstUiPath < secondUiPath
      && secondUiPath < fallback
      && fallback < markerFallback
      && markerFallback < originalRethrow,
  );
  assert.match(
    source,
    /const fallback = RAW_PAT_SHAPE\.test\(rawToken\)[\s\S]*revokeExactAuthenticatedOverlayMcpToken\([\s\S]*revokeExactAuthenticatedOverlayMcpTokenByMarker\(/,
  );
  assert.match(source, /if \(uiCleanupErrors\.length !== 2\)/);
  assert.match(
    source,
    /async function withCleanupOperationTimeout[\s\S]*Promise\.race\(\[[\s\S]*operation\(\)[\s\S]*setTimeout\(/,
  );
  assert.match(source, /rawToken,[\s\S]*connectionLabel,[\s\S]*runMarker,/);
  assert.match(source, /remainingActiveAfterFallback = fallback\.remainingActive/);
  assert.doesNotMatch(
    source,
    /await import\([\s\S]{0,120}authenticated-overlay-fixture\.mjs/,
  );
  assert.match(source, /expect\(observedError\)\.toBe\(originalSentinel\)/);
  assert.match(source, /expect\(routeFaultedRequestCount\)\.toBeGreaterThan\(0\)/);
  assert.match(source, /clipboardEmptyAfterTest = await clearClipboardAndReadBack\(page\)/);
  assert.match(
    source,
    /try \{[\s\S]*await withCleanupOperationTimeout\([\s\S]*page\.unroute\(['"]\*\*\/\*['"]\)[\s\S]*MCP_CLEANUP_UNROUTE_TIMEOUT[\s\S]*\} catch \(error\) \{[\s\S]*cleanupError \?\?= error;/,
  );
  assert.match(source, /\} finally \{\s*rawToken = ['"]['"];\s*\}/);
  assert.doesNotMatch(
    source.slice(source.indexOf('writeFileSync(evidencePath')),
    /rawToken|connectionLabel|runMarker|MCP_PAT_ROUTE_FAULT_SENTINEL/,
  );
});

test('authenticated evidence disables private failure captures and identity metadata', async () => {
  const [configSource, packageSource, workflowSource] = await Promise.all([
    fs.readFile(new URL('../../../playwright.authenticated.config.ts', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../../.github/workflows/authenticated-performance.yml', import.meta.url), 'utf8'),
  ]);
  const packageJson = JSON.parse(packageSource);
  const runScript = packageJson.scripts['browser:authenticated-overlay'];

  assert.match(
    configSource,
    /process\.env\.PLAYWRIGHT_NO_COPY_PROMPT = ['"]1['"];/,
  );
  assert.match(
    runScript,
    /^PLAYWRIGHT_NO_COPY_PROMPT=1 playwright test --config=playwright\.authenticated\.config\.ts/,
  );
  assert.match(configSource, /captureGitInfo: \{ commit: false, diff: false \}/);
  assert.match(configSource, /screenshot: ['"]off['"]/);
  assert.match(
    workflowSource,
    /Remove private failure context before diagnostic upload[\s\S]*find test-results\/authenticated-overlay-performance[\s\S]*-name ['"]error-context\.md['"][\s\S]*-name ['"]\*\.png['"][\s\S]*-delete/,
  );
  assert.match(
    workflowSource,
    /Upload successful authenticated overlay evidence[\s\S]*success\(\)[\s\S]*playwright-report\/authenticated-overlay\//,
  );
  assert.match(
    workflowSource,
    /Upload sanitized authenticated overlay failure diagnostics[\s\S]*failure\(\)[\s\S]*path: test-results\/authenticated-overlay-performance\//,
  );
});

test('My Notes mutation evidence gates on the same resolved Clerk auth mode as setup', async () => {
  const testUrl = new URL(
    '../e2e-authenticated/authenticated-my-notes-tags.spec.ts',
    import.meta.url,
  );
  const source = await fs.readFile(testUrl, 'utf8');

  assert.match(source, /resolveAuthenticatedOverlayAuthMode\(\)/);
  assert.match(
    source,
    /AUTHENTICATED_OVERLAY_AUTH_MODES\.testingToken/,
  );
  assert.doesNotMatch(
    source,
    /process\.env\.E2E_CLERK_AUTH_MODE !== ['"]testing-token['"]/,
  );
  assert.match(source, new RegExp(AUTHENTICATED_OVERLAY_DRAFT_PROBE_TITLE_PREFIX));
  assert.doesNotMatch(
    source,
    /from ['"]\.\.\/scripts\/authenticated-overlay-(?:constants|fixture)\.mjs['"]/,
  );
});

test('Thinking History dismissal evidence waits for rendering and tracks the exact expanded card', async () => {
  const testUrl = new URL(
    '../e2e-authenticated/authenticated-thinking-history.spec.ts',
    import.meta.url,
  );
  const source = await fs.readFile(testUrl, 'utf8');

  assert.match(
    source,
    /await page\.goto\("\/my-notes\?view=insights"[\s\S]{0,240}await expect\(signalCards\.first\(\)\)\.toBeVisible[\s\S]{0,160}const signalCountBeforeDismiss = await signalCards\.count\(\)/,
  );
  assert.match(source, /const dismissedSignalId = await dismissedSignal\.getAttribute\("data-signal-id"\)/);
  assert.match(source, /const dismissedSignalIdentity = page\.locator\([\s\S]{0,160}data-signal-id=\$\{JSON\.stringify\(dismissedSignalId\)\}/);
  assert.match(source, /await clickAndAcceptConfirm\([\s\S]{0,120}dismissedSignalIdentity\.getByRole\("button", \{ name: dismissCopy \}\)/);
  assert.match(source, /await expect\(dismissedSignalIdentity\)\.toHaveCount\(0\)/);
  assert.match(source, /await expect\(signalCards\)\.toHaveCount\(signalCountBeforeDismiss - 1\)/);
  assert.doesNotMatch(source, /dismissInspectButton\.locator\("xpath=ancestor::article/);
  assert.doesNotMatch(source, /dismissedSignalIdentity = signalCards\.filter/);
  assert.doesNotMatch(source, /await expect\(dismissedSignal\)\.toBeHidden/);
});

test('Thinking History local import evidence targets unique visible exchange rows', async () => {
  const testUrl = new URL(
    '../e2e-authenticated/authenticated-thinking-history.spec.ts',
    import.meta.url,
  );
  const source = await fs.readFile(testUrl, 'utf8');

  assert.match(source, /const exchangeRow = \(question: string\) => page\.getByRole\("listitem"\)\.filter\(\{/);
  assert.match(source, /has: page\.getByRole\("checkbox", \{ name: question \}\)/);
  assert.match(source, /await expect\(row\)\.toHaveCount\(1\)[\s\S]{0,160}await expect\(row\)\.toBeVisible\(\)[\s\S]{0,240}row\.textContent\(\)[\s\S]{0,120}includes\(question\)/);
  assert.match(source, /for \(const row of \[selectedExchangeARow, selectedExchangeBRow\]\)[\s\S]{0,100}await row\.getByRole\("checkbox"\)\.check\(\)/);
  assert.doesNotMatch(source, /getByText\(selectedQuestionA, \{ exact: true \}\)/);
  assert.doesNotMatch(source, /getByText\(question, \{ exact: true \}\)/);
});

test('Thinking History import-event evidence waits for commit visibility and cleans between projects', async () => {
  const testUrl = new URL(
    '../e2e-authenticated/authenticated-thinking-history.spec.ts',
    import.meta.url,
  );
  const source = await fs.readFile(testUrl, 'utf8');

  assert.match(source, /async function waitForImportSubmissionEventCount\([\s\S]{0,700}expect\.poll\([\s\S]{0,500}timeout: 30_000[\s\S]{0,300}\.toBe\(expectedCount\)/);
  assert.ok(
    source.includes('const IMPORT_BATCH_URL_PATTERN = /\\/knowledge-inbox\\/[0-9a-f]{8}-'),
    'the import route itself must not satisfy the submitted-batch redirect',
  );
  assert.match(source, /async function waitForSubmittedImportBatchId\([\s\S]{0,1400}submittedImportBatchIdsContainingMarker\([\s\S]{0,700}\.toBe\(1\)/);
  assert.match(source, /async function activateExactReviewLink\([\s\S]{0,180}batchId: string,[\s\S]{0,80}hasTouch: boolean,[\s\S]{0,80}testInfo: TestInfo,[\s\S]{0,40}Promise<void>/);
  assert.match(source, /const smoothScrollOverride = await page\.addStyleTag\([\s\S]{0,180}html \{ scroll-behavior: auto !important; \}/);
  assert.match(source, /scrollIntoView\(\{ behavior: "instant", block: "center", inline: "nearest" \}\)/);
  assert.match(source, /const firstBounds = element\.getBoundingClientRect\(\)[\s\S]{0,220}const bounds = element\.getBoundingClientRect\(\)[\s\S]{0,500}const boundsAreStable/);
  assert.match(source, /document\.elementFromPoint\(point\.x, point\.y\)/);
  assert.match(source, /if \(!hasTouch\) \{[\s\S]{0,1900}link\.click\(\{ trial: true, timeout: 10_000 \}\)[\s\S]{0,180}REVIEW_LOCATOR_NOT_ACTIONABLE/);
  assert.match(source, /if \(hasTouch\)[\s\S]{0,500}link\.tap\(\{ timeout: 10_000, scroll: "none" \}\)[\s\S]{0,180}link\.focus\(\)[\s\S]{0,120}expect\(link\)\.toBeFocused\(\)[\s\S]{0,120}page\.keyboard\.press\("Enter"\)/);
  assert.doesNotMatch(source, /link\.tap\(\{[^}]*trial: true/);
  assert.doesNotMatch(source, /link\.tap\(\{[^}]*position:/);
  const requestListenerIndex = source.indexOf('page.on("request", onRequest)');
  const activationIndex = source.indexOf('await activate()', requestListenerIndex);
  assert.ok(requestListenerIndex >= 0, 'review request observation must be installed');
  assert.ok(
    activationIndex > requestListenerIndex,
    'review request observation must be installed before activation',
  );
  assert.match(source, /REVIEW_ACTIVATION_NO_REQUEST/);
  assert.match(source, /REVIEW_DESTINATION_HTTP_ERROR/);
  assert.match(source, /REVIEW_TARGET_REQUEST_NO_RESPONSE/);
  assert.match(source, /REVIEW_TARGET_REDIRECT_NO_COMMIT/);
  assert.match(source, /REVIEW_TARGET_SUCCESS_NO_COMMIT/);
  assert.match(source, /await activateExactReviewLink\([\s\S]{0,180}reviewLinks\.first\(\)[\s\S]{0,100}batchId,[\s\S]{0,100}testInfo\.project\.use\.hasTouch === true/);
  assert.doesNotMatch(source, /page\.touchscreen\.tap|page\.mouse\.click/);
  assert.doesNotMatch(source, /force:\s*true/);
  assert.match(source, /startReviewTapScrollRecorder\(link\)[\s\S]{0,120}captureReviewTapGeometry\(page, link\)/);
  assert.match(source, /wideElements: \{ ownOverflow, outsideVisualViewport \}/);
  assert.match(source, /classFingerprint: classFingerprint >>> 0[\s\S]{0,100}classLength: Math\.min\(className\.length, 512\)/);
  assert.match(source, /viewportMeta: \{[\s\S]{0,300}deviceWidth:[\s\S]{0,300}initialScaleOne:[\s\S]{0,120}length: Math\.min\(viewportMetaContent\.length, 256\)/);
  assert.match(source, /geometryBefore\.innerWidth > geometryBefore\.visualViewport\.width \+ 1[\s\S]{0,180}REVIEW_LAYOUT_OVERFLOW/);
  assert.match(source, /testInfo\.attach\("review-tap-geometry"[\s\S]{0,180}JSON\.stringify\(\{ before: geometryBefore, after: geometryAfter, scroll \}/);
  const geometryDiagnosticSource = source.slice(
    source.indexOf('type ReviewTapScrollSample'),
    source.indexOf('async function activateExactReviewLink'),
  );
  assert.doesNotMatch(geometryDiagnosticSource, /textContent|innerText|innerHTML|outerHTML|href|\.value|dataset|classes:/);
  assert.match(source, /thinking-selected-count"\)\)\.toHaveText\(twoContextItemsSelectedCopy\)/);
  assert.match(source, /page\.waitForResponse\([\s\S]{0,120}contextFormat\(response\) === format,[\s\S]{0,80}\{ timeout: 30_000 \}/);
  assert.match(source, /expect\(copyResponse\.status\(\), `\$\{format\} copy context response`\)\.toBe\(200\)/);
  assert.match(source, /async function gotoOwnerKnowledgeData\([\s\S]{0,1200}attempt <= 2[\s\S]{0,500}\/account\/delete#knowledge-data[\s\S]{0,700}OWNER_DATA_CONTROLS_UNAVAILABLE/);
  const confirmationSource = source.slice(
    source.indexOf('async function clickAndAcceptConfirm('),
    source.indexOf('async function deleteSubmittedImportThroughOwnerUi('),
  );
  assert.match(confirmationSource, /html \{ scroll-behavior: auto !important; \}/);
  assert.match(confirmationSource, /scrollIntoView\(\{ behavior: "instant", block: "center", inline: "nearest" \}\)/);
  assert.match(confirmationSource, /rootClientWidth = document\.documentElement\.clientWidth/);
  assert.match(confirmationSource, /hasHorizontalLayoutOverflow\(sample\)/);
  assert.match(confirmationSource, /CONFIRM_LAYOUT_OVERFLOW/);
  assert.match(confirmationSource, /CONFIRM_TARGET_OUTSIDE_VISUAL_VIEWPORT/);
  assert.match(confirmationSource, /document\.elementFromPoint\(point\.x, point\.y\)/);
  assert.match(confirmationSource, /control\.tap\(\{ trial: true, timeout: 10_000, scroll: "none" \}\)/);
  assert.match(confirmationSource, /const confirmHandled = page\.waitForEvent\("dialog", \{ timeout: 10_000 \}\)[\s\S]*dialog\.accept\(\)[\s\S]*dialog\.dismiss\(\)/);
  assert.match(confirmationSource, /const activateControl = async \(\) => \{[\s\S]*control\.click\(\{ timeout: 10_000 \}\)[\s\S]*control\.tap\(\{ timeout: 10_000, scroll: "none" \}\)/);
  assert.doesNotMatch(confirmationSource, /control\.tap\(\{[^}]*position:/);
  assert.doesNotMatch(confirmationSource, /force:\s*true|noWaitAfter:/);
  assert.match(confirmationSource, /finally \{[\s\S]*smoothScrollOverride\.evaluate/);
  assert.match(source, /isSuccessfulReviewNavigation\(\{ committed, \.\.\.observation \}\)/);
  assert.match(source, /function safeEvidenceErrorSummary\([\s\S]{0,700}\(\?:REVIEW\|CONFIRM\)[\s\S]{0,500}safeErrorSummary\(error\)/);
  assert.match(source, /let evidenceStage = "import_submission"[\s\S]{0,7000}evidenceStage = "review_link"[\s\S]{0,7000}\$\{evidenceStage\}:\$\{safeEvidenceErrorSummary\(evidenceError\)\}/);
  assert.match(source, /Promise\.allSettled\(\[[\s\S]{0,120}confirmHandled,[\s\S]{0,80}activateControl\(\)[\s\S]{0,700}UNEXPECTED_DIALOG_TYPE/);
  assert.match(source, /async function deleteSubmittedImportThroughOwnerUi\([\s\S]{0,1600}await clickAndAcceptConfirm\([\s\S]{0,220}deleteImportCopy[\s\S]{0,220}await waitForImportSubmissionEventCount\(page, 0\)/);
  assert.doesNotMatch(source, /page\.once\("dialog"/);
  const submissionClick = source.indexOf('await page.getByRole("button", { name: /Create 2 review candidates/i }).click()');
  const exactRedirect = source.indexOf('await expect(page).toHaveURL(IMPORT_BATCH_URL_PATTERN', submissionClick);
  const batchCapture = source.indexOf('batchId = decodeURIComponent');
  const evidenceTry = source.lastIndexOf('  try {', submissionClick);
  const batchAssertion = source.indexOf('expect(batchId).toMatch', batchCapture);
  const visibilityPoll = source.indexOf('postConsentImportEvents = await waitForImportSubmissionEventCount');
  const preSubmitEvents = source.indexOf('const preSubmitImportEvents = await importSubmissionEvents');
  const messageResponseReady = source.indexOf('await expect.poll(() => messageResponses.length).toBe(1)');
  const messageBodyCapture = source.indexOf('const messageBytes = Buffer.byteLength(await messageResponses[0]!.body())');
  const firstThinkingCard = source.indexOf('const signalRoot = page.locator(".thinking-card").first()');
  const preSubmitState = source.indexOf('publishedStateBeforeSubmission = await readAuthenticatedOverlayPublishedState');
  const pendingState = source.indexOf('await inspectPendingAuthenticatedOverlayImport({', visibilityPoll);
  const pendingStateComparison = source.indexOf(').toEqual(publishedStateBeforeSubmission)', pendingState);
  const metadataExpansion = source.indexOf('await metadataSummary.click()', pendingStateComparison);
  const metadataOpenAssertion = source.indexOf('toHaveAttribute("open", "")', metadataExpansion);
  const evidenceVisibleAssertion = source.indexOf('expect(evidenceGroup).toBeVisible()', metadataOpenAssertion);
  const finallyBlock = source.indexOf('} finally {', visibilityPoll);
  const recoveryCall = source.indexOf('await waitForSubmittedImportBatchId(page, selectedQuestionA)', finallyBlock);
  const cleanupCall = source.indexOf('await deleteSubmittedImportThroughOwnerUi(', finallyBlock);
  const fallbackCall = source.indexOf('await deleteExactAuthenticatedOverlayImport({', cleanupCall);
  const safeFailure = source.indexOf('THINKING_HISTORY_EVIDENCE_FAILED', fallbackCall);
  assert.ok(evidenceTry >= 0 && evidenceTry < submissionClick, 'submission must start inside the cleanup boundary');
  assert.ok(submissionClick < exactRedirect && exactRedirect < batchCapture, 'the UUID redirect must resolve before batch capture');
  assert.ok(batchCapture < batchAssertion && batchAssertion < visibilityPoll, 'batch validation must precede telemetry polling');
  assert.ok(
    messageResponseReady >= 0
      && messageResponseReady < messageBodyCapture
      && messageBodyCapture < firstThinkingCard,
    'the message asset body must be captured before later navigations can evict it from Chromium',
  );
  assert.ok(
    preSubmitState > preSubmitEvents
      && preSubmitState < submissionClick
      && pendingState > visibilityPoll
      && pendingStateComparison > pendingState
      && metadataExpansion > pendingStateComparison
      && metadataOpenAssertion > metadataExpansion
      && evidenceVisibleAssertion > metadataOpenAssertion,
    'the exact pending batch must leave published state unchanged before review metadata opens',
  );
  assert.ok(finallyBlock > visibilityPoll && recoveryCall > finallyBlock && cleanupCall > recoveryCall, 'finally must recover and delete the exact owner batch');
  assert.ok(cleanupCall < fallbackCall && fallbackCall < safeFailure, 'UI cleanup must precede exact DB fallback and the fallback must not suppress test failure');
  assert.match(source, /fallback\.deleted !== true[\s\S]{0,300}fallback\.remainingEvents !== 0[\s\S]{0,300}databaseFallbackStatus = "verified"/);
  assert.match(source, /if \(evidenceError \|\| uiCleanupError\)[\s\S]{0,800}THINKING_HISTORY_EVIDENCE_FAILED/);
  assert.match(source, /preApprovalPublishedStateUnchanged,[\s\S]{0,120}preApprovalActivationRows/);
  assert.match(source, /failureFingerprint\(message\.text\(\)\)/);
  assert.doesNotMatch(source, /console: \$\{message\.text\(\)\}|page: \$\{error\.message\}|heading \$\{JSON\.stringify/);
  assert.doesNotMatch(source, /const postConsentImportEvents = await importSubmissionEvents\(page\)/);
});

test('owner data controls depend only on the verified Clerk session subject', async () => {
  const pageUrl = new URL(
    '../src/app/account/delete/page.tsx',
    import.meta.url,
  );
  const entrypointUrl = new URL(
    '../src/components/account-deletion-panel-entrypoint.tsx',
    import.meta.url,
  );
  const localizedPanelUrl = new URL(
    '../src/components/localized-account-deletion-panel.tsx',
    import.meta.url,
  );
  const [source, entrypoint, localizedPanel] = await Promise.all([
    fs.readFile(pageUrl, 'utf8'),
    fs.readFile(entrypointUrl, 'utf8'),
    fs.readFile(localizedPanelUrl, 'utf8'),
  ]);

  assert.match(source, /import \{ requireCurrentUser \} from '@\/lib\/auth'/);
  assert.match(source, /requireCurrentUser\('\/account\/delete'\)/);
  assert.doesNotMatch(source, /requireCurrentUserProfile|currentUser\(/);
  assert.match(source, /getKnowledgeDraftBatchesForUser\(user\.id, true/);
  assert.match(source, /const \[user, \{ t, locale \}, resolvedSearchParams\] = await Promise\.all/);
  assert.match(source, /<AccountDeletionPanelEntrypoint email=\{user\.email\} locale=\{locale\} \/>/);
  assert.match(entrypoint, /import\('\.\/localized-account-deletion-panel'\)/);
  assert.match(entrypoint, /\{ ssr: false, loading: LoadingAccountDeletionPanel \}/);
  assert.match(localizedPanel, /const localizationState = useClerkLocalization\(locale\)/);
  assert.match(localizedPanel, /localizationState\.status === 'error'[\s\S]*role="alert"[\s\S]*onClick=\{localizationState\.retry\}/);
  assert.match(localizedPanel, /<ClerkProvider localization=\{localizationState\.localization\}>[\s\S]*<AccountDeletionPanel email=\{email\} \/>[\s\S]*<\/ClerkProvider>/);
});

test('production-compatible sign-in ticket is short lived and owner scoped', async () => {
  const calls = [];
  const ticket = await createSyntheticSignInTicket({
    clerkClient: {
      signInTokens: {
        async createSignInToken(input) {
          calls.push(input);
          return { token: 'short-lived-ticket' };
        },
      },
    },
    userId: 'user_synthetic',
  });

  assert.equal(ticket, 'short-lived-ticket');
  assert.deepEqual(calls, [{ userId: 'user_synthetic', expiresInSeconds: 300 }]);
});

test('production evidence can expose live credentials only from protected main', async () => {
  const workflowUrl = new URL('../../../.github/workflows/authenticated-performance.yml', import.meta.url);
  const workflow = await fs.readFile(workflowUrl, 'utf8');

  assert.match(workflow, /RUN_REF: \$\{\{ github\.ref \}\}/);
  assert.match(workflow, /\[ "\$RUN_REF" != "refs\/heads\/main" \]/);
  assert.match(
    workflow,
    /if: inputs\.target == 'production' && github\.ref == 'refs\/heads\/main'/,
  );
});

test('preview evidence checks out the open same-repository PR head', async () => {
  const workflowUrl = new URL('../../../.github/workflows/authenticated-performance.yml', import.meta.url);
  const workflow = await fs.readFile(workflowUrl, 'utf8');

  assert.match(workflow, /pull-requests: read/);
  assert.match(workflow, /"\$GITHUB_API_URL\/repos\/\$GITHUB_REPOSITORY\/pulls\/\$PREVIEW_PR_NUMBER"/);
  assert.match(workflow, /\[ "\$state" != "open" \]/);
  assert.match(workflow, /\[ "\$head_repository" != "\$GITHUB_REPOSITORY" \]/);
  assert.match(workflow, /preview_head_sha: \$\{\{ steps\.validate-inputs\.outputs\.preview_head_sha \}\}/);
  assert.match(workflow, /ref: \$\{\{ needs\.validate\.outputs\.preview_head_sha \}\}/);
  assert.match(workflow, /VERIFY_EXPECTED_REVISION: \$\{\{ needs\.validate\.outputs\.preview_head_sha \}\}/);
  assert.match(workflow, /node apps\/web\/scripts\/verify-deployment-revision\.mjs/);
  const previewJob = workflow.slice(
    workflow.indexOf('  preview:'),
    workflow.indexOf('  production:'),
  );
  assert.match(previewJob, /E2E_REQUIRE_MCP_PAT_CLOSEOUT: 'true'/);
  const productionJob = workflow.slice(workflow.indexOf('  production:'));
  assert.doesNotMatch(productionJob, /E2E_REQUIRE_MCP_PAT_CLOSEOUT/);
});

test('deployment workflow publishes the served Git revision for Preview and production', async () => {
  const workflowUrl = new URL('../../../.github/workflows/deploy-cloudflare.yml', import.meta.url);
  const workflow = await fs.readFile(workflowUrl, 'utf8');

  assert.match(workflow, /GIRAPPHE_REVISION: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /APP_BASE_URL GIRAPPHE_REVISION/);
  const productionSecretSync = workflow.slice(
    workflow.indexOf('- name: Sync Worker runtime secrets (prod)'),
    workflow.indexOf('- name: Deploy Worker'),
  );
  assert.doesNotMatch(productionSecretSync, /GIRAPPHE_REVISION/);
  const productionDeploy = workflow.slice(
    workflow.indexOf('- name: Deploy Worker'),
    workflow.indexOf('- name: Smoke Test (prod)'),
  );
  assert.match(productionDeploy, /GIRAPPHE_REVISION: \$\{\{ github\.sha \}\}/);
  assert.match(productionDeploy, /--secrets-file "\$revision_secrets_file"/);
});
