import { expect, test, type Page } from '@playwright/test';

const toleratedConsoleErrors = [
  /favicon\.ico/i,
];
const usesDeployedPreview = Boolean(process.env.PLAYWRIGHT_BASE_URL);

const authEntrypointOrConfigFallback = /Sign in|Sign up|Authentication is (?:unavailable|not available)|Clerk keys are missing|Live Clerk keys cannot be used/i;
const errorRecoveryMarkup = `
  <main id="main-content">
    <a href="">Try again</a>
    <a href="/en">Return home</a>
  </main>
`;

function attachBrowserFailureGuards(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;

    const text = message.text();
    if (toleratedConsoleErrors.some((pattern) => pattern.test(text))) return;

    consoleErrors.push(text);
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  return async () => {
    // Give late hydration and browser console events a moment to surface.
    await page.waitForTimeout(250);
    expect(pageErrors, 'uncaught browser page errors').toEqual([]);
    expect(consoleErrors, 'browser console errors').toEqual([]);
  };
}

test.describe('browser smoke', () => {
  test('error recovery controls work before client-side hydration', async ({ page }) => {
    await page.goto('/practice?error-recovery=1');
    await page.setContent(errorRecoveryMarkup);

    const retry = page.getByRole('link', { name: 'Try again' });
    await expect(retry).toBeVisible();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      retry.click(),
    ]);
    await expect(page).toHaveURL(/\/en\/practice\?error-recovery=1$/);

    await page.setContent(errorRecoveryMarkup);
    const returnHome = page.getByRole('link', { name: 'Return home' });
    await expect(returnHome).toHaveAttribute('href', '/en');
    await Promise.all([
      page.waitForURL(/\/en$/),
      returnHome.click(),
    ]);
    await expect(page.getByRole('heading', { name: /Practice STEM concepts/i })).toBeVisible();
  });

  test('health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(response.headers()['strict-transport-security']).toContain('max-age=63072000');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers()['permissions-policy']).toContain('camera=()');
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });

  test('account deletion rejects unauthenticated callers', async ({ request }) => {
    const response = await request.delete('/api/account');
    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Sign in is required.',
      code: 'AUTH_REQUIRED',
    });
  });

  test('quiz mutation rejects unauthenticated callers', async ({ request }) => {
    const response = await request.post('/api/quiz_result', {
      data: { node_id: 'math_derivative', result: 1 },
    });

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  test('mobile API rejects unauthenticated callers', async ({ request }) => {
    const response = await request.get('/api/mobile?resource=notes');
    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Sign in is required.',
      code: 'AUTH_REQUIRED',
    });
  });

  test('personal knowledge purge rejects unauthenticated callers', async ({ request }) => {
    const response = await request.post('/api/internal/personal-knowledge-purge');
    expect(response.status()).toBe(401);
  });

  test('MCP draft ingestion rejects callers without a scoped token', async ({ request }) => {
    const response = await request.post('/api/mcp', {
      headers: {
        Accept: 'application/json, text/event-stream',
      },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'browser-smoke', version: '1.0.0' },
        },
      },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['www-authenticate']).toContain('Bearer');
  });

  test('MCP OAuth discovery is public and fails closed when Clerk is unavailable', async ({ request }) => {
    const resource = await request.get('/.well-known/oauth-protected-resource/mcp');
    expect([200, 503]).toContain(resource.status());
    expect(resource.headers()['access-control-allow-origin']).toBe('*');
    const body = await resource.json() as Record<string, unknown>;
    if (resource.status() === 200) {
      expect(typeof body.resource).toBe('string');
      expect(Array.isArray(body.authorization_servers)).toBe(true);
    } else {
      expect(body).toEqual({ error: 'oauth_unavailable' });
    }

    const preflight = await request.fetch('/.well-known/oauth-protected-resource/mcp', {
      method: 'OPTIONS',
    });
    expect(preflight.status()).toBe(200);
    expect(preflight.headers()['access-control-allow-origin']).toBe('*');
  });

  test('home page renders the app shell', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/');
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Practice STEM concepts/i })).toBeVisible();
    const disciplines = page.getByRole('list', { name: 'STEM disciplines' });
    const disciplineItems = disciplines.getByRole('listitem');
    await expect(disciplineItems).toHaveCount(8);
    const disciplineLabels = await disciplineItems.allTextContents();
    expect(new Set(disciplineLabels).size, 'home disciplines are not duplicated').toBe(disciplineLabels.length);

    const viewport = page.viewportSize();
    const disciplineBoxes = await disciplineItems.evaluateAll((items) => items.map((item) => {
      const box = item.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }));
    expect(disciplineBoxes.every((box) => box.left >= 0 && box.right <= (viewport?.width ?? 0)), 'discipline chips stay inside the viewport').toBe(true);

    await assertNoBrowserFailures();
  });

  test('free practice inserts one sponsored card after exactly five advances', async ({ page }) => {
    await page.goto('/practice');
    const skip = page.getByRole('button', { name: 'Skip this card' });
    await expect(skip).toBeVisible();
    await expect(page.getByRole('region', { name: 'Sponsored practice card' })).toHaveCount(0);

    for (let completed = 1; completed <= 4; completed += 1) {
      await skip.click();
      await expect(skip).toBeEnabled();
      await expect(page.getByRole('region', { name: 'Sponsored practice card' })).toHaveCount(0);
    }

    await skip.click();
    const sponsoredCard = page.getByRole('region', { name: 'Sponsored practice card' });
    await expect(sponsoredCard).toBeVisible();
    await expect(sponsoredCard).toContainText('After 5 cards');
    await sponsoredCard.getByRole('button', { name: 'Continue reviewing' }).click();
    await expect(skip).toBeVisible();
  });

  test('practice mode navigation identifies the active mode', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/practice?mode=review');

    const practiceMode = page.getByRole('navigation', { name: 'Practice mode' });
    await expect(practiceMode.getByRole('link', { name: /Review .*card.*needing review/i })).toHaveAttribute('aria-current', 'page');
    await expect(practiceMode.getByRole('link', { name: 'Learn New' })).not.toHaveAttribute('aria-current');

    await assertNoBrowserFailures();
  });

  test('practice answer control exposes its reveal state', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/practice');

    for (const control of [
      page.getByRole('button', { name: 'Go to previous card' }),
      page.getByRole('button', { name: 'Skip this card' }),
    ]) {
      const box = await control.boundingBox();
      expect(box?.width ?? 0, 'practice navigation touch target width').toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, 'practice navigation touch target height').toBeGreaterThanOrEqual(44);
    }

    const revealButton = page.getByRole('button', { name: 'Show answer' });
    await expect(revealButton).toHaveAttribute('aria-expanded', 'false');
    await revealButton.click();

    const hideButton = page.getByRole('button', { name: 'Hide answer' });
    await expect(hideButton).toHaveAttribute('aria-expanded', 'true');
    await hideButton.click();
    await expect(page.getByRole('button', { name: 'Show answer' })).toHaveAttribute('aria-expanded', 'false');

    await assertNoBrowserFailures();
  });

  test('home respects reduced-motion preferences', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await expect(page.locator('.home-scroll-cue')).toHaveCSS('animation-iteration-count', '1');
    await assertNoBrowserFailures();
  });

  test('unknown routes provide a usable not-found recovery', async ({ page }) => {
    test.skip(
      usesDeployedPreview,
      'Not-found recovery is covered by the local Next.js browser suite.',
    );

    await page.goto('/this-route-does-not-exist');

    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return Home' })).toHaveAttribute('href', '/en');
  });
  test('login page renders an auth entrypoint or local config fallback', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/login');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('body')).toContainText(authEntrypointOrConfigFallback);

    await assertNoBrowserFailures();
  });

  test('signup page renders an auth entrypoint or local config fallback', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/signup');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('body')).toContainText(authEntrypointOrConfigFallback);

    await assertNoBrowserFailures();
  });

  test('capacity dashboard stays behind admin authentication', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/admin/ops');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('body')).toContainText(authEntrypointOrConfigFallback);

    await assertNoBrowserFailures();
  });

  test('knowledge graph renders a non-empty graph surface', async ({ page }, testInfo) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/knowledge');
    await expect(page.getByRole('heading', { name: 'Knowledge Graph' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('graph-access-summary')).toContainText('Free map');
    await expect(page.getByRole('link', { name: 'Unlock full public map' })).toHaveAttribute('href', '/subscription');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeAttached({ timeout: 20_000 });

    const box = await canvas.boundingBox();
    expect(box?.width ?? 0, 'knowledge graph canvas width').toBeGreaterThan(0);
    expect(box?.height ?? 0, 'knowledge graph canvas height').toBeGreaterThan(0);

    const legend = page.getByTestId('graph-legend');
    const legendContent = page.locator('#knowledge-graph-legend-content');
    const legendToggle = page.getByRole('button', { name: 'Show legend' });

    if (testInfo.project.name === 'chromium-mobile') {
      await expect(legendToggle).toBeVisible();
      await expect(legendToggle).toHaveAttribute('aria-expanded', 'false');
      await expect(legendContent).toBeHidden();

      const controlsBox = await page.getByTestId('graph-controls').boundingBox();
      const legendBox = await legend.boundingBox();
      expect(
        (legendBox?.y ?? 0) - ((controlsBox?.y ?? 0) + (controlsBox?.height ?? 0)),
        'collapsed mobile legend leaves room to manipulate the graph',
      ).toBeGreaterThan(350);

      await legendToggle.click();
      await expect(page.getByRole('button', { name: 'Hide legend' })).toHaveAttribute('aria-expanded', 'true');
      await expect(legendContent).toBeVisible();
      expect(
        await legendContent.evaluate((element) => element.scrollHeight > element.clientHeight),
        'expanded mobile legend has a bounded scroll region',
      ).toBe(true);
      await legendContent.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
      await expect(legendContent.getByText('Moving particles and arrowheads show direction.')).toBeVisible();
      await page.getByRole('button', { name: 'Hide legend' }).click();
      await expect(legendContent).toBeHidden();
    } else {
      await expect(legendToggle).toBeHidden();
      await expect(legendContent).toBeVisible();
    }

    await assertNoBrowserFailures();
  });

  test('concepts has its own navigation tab and can open the graph view', async ({ page }, testInfo) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);
    const exercisesViewportResize = testInfo.project.name === 'chromium-mobile';

    if (exercisesViewportResize) {
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    await page.goto('/grid');
    const homeLink = page.getByRole('link', { name: 'Girapphe — go to home' });
    const brandWordmark = page.getByTestId('brand-wordmark');
    await expect(homeLink.locator('svg')).toBeVisible();
    await expect(brandWordmark).toBeVisible();

    const conceptsTab = page.getByRole('link', { name: 'Concepts' });
    await expect(conceptsTab).toHaveAttribute('aria-current', 'page');
    await expect.poll(async () => {
      const box = await conceptsTab.boundingBox();
      const viewport = page.viewportSize();
      return Boolean(
        box
        && viewport
        && box.x >= 0
        && box.x + box.width <= viewport.width,
      );
    }, { message: 'active Concepts navigation tab is fully visible' }).toBe(true);

    if (exercisesViewportResize) {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(brandWordmark).toBeHidden();
      await expect(homeLink.locator('svg')).toBeVisible();
      for (const control of [
        homeLink,
        page.getByRole('combobox', { name: 'Choose language' }),
        page.getByRole('link', { name: 'Log in' }),
        page.getByRole('link', { name: 'Sign up' }),
      ]) {
        const box = await control.boundingBox();
        expect(box?.width ?? 0, 'site header touch target width').toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0, 'site header touch target height').toBeGreaterThanOrEqual(44);
      }
      await expect.poll(async () => {
        const box = await conceptsTab.boundingBox();
        return Boolean(box && box.x >= 0 && box.x + box.width <= 390);
      }, { message: 'active Concepts navigation tab stays visible after resize' }).toBe(true);
      const alignedConceptsBox = await conceptsTab.boundingBox();
      expect(alignedConceptsBox?.x ?? Number.POSITIVE_INFINITY, 'active Concepts tab left alignment').toBeLessThanOrEqual(24);
      expect(alignedConceptsBox?.width ?? 0, 'main navigation touch target width').toBeGreaterThanOrEqual(44);
      expect(alignedConceptsBox?.height ?? 0, 'main navigation touch target height').toBeGreaterThanOrEqual(44);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.locator('html').evaluate((element) => element.setAttribute('dir', 'rtl'));
      await page.setViewportSize({ width: 390, height: 844 });
      await expect.poll(async () => {
        const box = await conceptsTab.boundingBox();
        return Boolean(box && box.x + box.width >= 366 && box.x + box.width <= 390);
      }, { message: 'active Concepts tab aligns to the logical start in RTL' }).toBe(true);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.locator('html').evaluate((element) => element.setAttribute('dir', 'ltr'));
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await expect(page.getByRole('heading', { name: 'Concepts' })).toBeVisible();
    const wikiLink = page.getByRole('link', { name: 'Wiki →' }).first();
    const wikiLinkBox = await wikiLink.boundingBox();
    expect(wikiLinkBox?.width ?? 0, 'concept source touch target width').toBeGreaterThanOrEqual(44);
    expect(wikiLinkBox?.height ?? 0, 'concept source touch target height').toBeGreaterThanOrEqual(44);

    const groupBy = page.getByLabel('Group by');
    await expect(groupBy).toHaveValue('domain');
    const sort = page.getByLabel('Sort concepts');
    const filters = page.locator('summary').filter({ hasText: 'Filters' });
    if (exercisesViewportResize) {
      for (const control of [
        page.getByRole('button', { name: '3D Graph View' }),
        page.locator('#concept-search'),
        sort,
        groupBy,
        filters,
      ]) {
        const box = await control.boundingBox();
        expect(box?.height ?? 0, 'concept discovery touch target height').toBeGreaterThanOrEqual(44);
      }
    }
    expect(await page.getByTestId('concept-group').count(), 'domain sections render by default').toBeGreaterThan(1);

    const domainCardIds = await page.getByTestId('concept-card').evaluateAll((cards) => (
      cards.map((card) => card.getAttribute('data-concept-id')).filter(Boolean)
    ));
    expect(new Set(domainCardIds).size, 'domain grouping does not duplicate multi-domain cards').toBe(domainCardIds.length);
    const visibleCardCount = domainCardIds.length;

    await groupBy.selectOption('tag');
    await expect(page.getByRole('heading', { name: 'Untagged', exact: true })).toBeVisible();
    expect(await page.getByTestId('concept-card').count(), 'tag grouping keeps tagless public concepts visible').toBe(visibleCardCount);

    await groupBy.selectOption('none');
    await expect(page.getByTestId('concept-grid')).toBeVisible();
    await expect(page.getByTestId('concept-group')).toHaveCount(0);

    await expect(sort).toHaveValue('newest');
    await sort.selectOption('title');
    await expect(sort).toHaveValue('title');
    const titles = await page.getByTestId('concept-card').locator('h3').allTextContents();
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));

    await filters.click();
    const addedWithin = page.getByLabel('Added within');
    await expect(addedWithin).toHaveValue('all');
    if (exercisesViewportResize) {
      for (const control of [
        page.locator('#concept-domain'),
        page.locator('#concept-status'),
        addedWithin,
        page.locator('label[for="toggle-generated"]'),
        page.getByRole('button', { name: 'Reset all' }),
      ]) {
        const box = await control.boundingBox();
        expect(box?.height ?? 0, 'concept filter touch target height').toBeGreaterThanOrEqual(44);
      }
    }
    await addedWithin.selectOption('month');
    await expect(addedWithin).toHaveValue('month');
    expect(await page.getByTestId('concept-card').count(), 'undated guest concepts remain visible when filtering by date').toBeGreaterThan(0);
    const filterPanel = await page.getByTestId('concept-filters').boundingBox();
    const viewport = page.viewportSize();
    expect(filterPanel?.x ?? -1, 'filter panel left edge').toBeGreaterThanOrEqual(0);
    expect((filterPanel?.x ?? 0) + (filterPanel?.width ?? 0), 'filter panel right edge').toBeLessThanOrEqual(viewport?.width ?? 0);
    await page.getByRole('button', { name: 'Reset all' }).click();
    await expect(sort).toHaveValue('newest');
    await expect(groupBy).toHaveValue('domain');
    await expect(addedWithin).toHaveValue('all');
    await filters.click();

    await page.getByRole('button', { name: '3D Graph View' }).click();
    await expect(page.getByRole('heading', { name: 'Knowledge Graph' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Back to Concepts' }).click();
    await expect(page.getByRole('heading', { name: 'Concepts' })).toBeVisible();

    await assertNoBrowserFailures();
  });

  test('concept cards save public edits as a private copy', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/grid');
    const firstCard = page.getByTestId('concept-card').first();
    await firstCard.getByRole('button', { name: /^Edit / }).click();

    const editor = firstCard.getByTestId('concept-card-editor');
    await expect(editor).toBeVisible();
    await expect(editor.getByText('Edits to public concepts are saved as a private copy.')).toBeVisible();
    for (const control of [
      editor.getByLabel('Title'),
      editor.getByLabel('Topic'),
      editor.getByLabel('Tags'),
      editor.getByRole('button', { name: 'Save private copy' }),
      editor.getByRole('button', { name: 'Cancel' }),
    ]) {
      const box = await control.boundingBox();
      expect(box?.height ?? 0, 'concept editor touch target height').toBeGreaterThanOrEqual(44);
    }
    await editor.getByLabel('Title').fill('   ');
    await editor.getByRole('button', { name: 'Save private copy' }).click();
    await expect(editor.getByRole('alert')).toHaveText('Enter a title before saving.');
    await expect(editor.getByLabel('Summary')).toBeVisible();
    await expect(editor.getByLabel('Tags')).toBeVisible();
    await editor.getByLabel('Title').fill('Editable private copy');
    await editor.getByRole('button', { name: 'Save private copy' }).click();

    await expect(editor).toBeHidden();
    const personalCard = page.getByTestId('concept-card').filter({ hasText: 'Editable private copy' });
    await expect(personalCard).toHaveCount(1);
    await personalCard.getByRole('button', { name: /^Edit / }).click();
    const personalEditor = personalCard.getByTestId('concept-card-editor');
    await personalEditor.getByLabel('Summary').fill('');
    await personalEditor.getByRole('button', { name: 'Save changes' }).click();
    await expect(personalEditor).toBeHidden();

    await personalCard.getByRole('button', { name: /^Edit / }).click();
    const reopenedEditor = personalCard.getByTestId('concept-card-editor');
    await expect(reopenedEditor.getByLabel('Summary')).toHaveValue('');
    await reopenedEditor.getByLabel('Title').fill('Editable private copy updated');
    await reopenedEditor.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByTestId('concept-card').filter({ hasText: 'Editable private copy updated' })).toHaveCount(1);
    await assertNoBrowserFailures();
  });

  test('personal knowledge exposes date controls and a trash view', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/my-knowledge');
    await expect(page.getByRole('heading', { name: 'My Notes' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Added date range' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Group cards by date' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Trash' })).toBeVisible();

    await page.getByRole('link', { name: 'Trash' }).click();
    await expect(page.getByRole('heading', { name: 'Knowledge Trash' })).toBeVisible();

    await assertNoBrowserFailures();
  });

  test('structured knowledge exposes all six editors and round-trips a procedure', async ({ page }) => {
    test.slow();
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);
    const title = `Typed release procedure ${Date.now()}`;

    await page.goto('/my-knowledge');
    const createForm = page.getByRole('heading', { name: 'Add knowledge item' }).locator('..');
    const format = createForm.getByRole('combobox', { name: 'Format' });
    const typeFields = [
      ['concept', 'Definition'],
      ['procedure', 'Goal'],
      ['comparison', 'Targets'],
      ['mechanism', 'Causes'],
      ['structure', 'Purpose'],
      ['claim_evidence', 'Claim'],
    ] as const;
    for (const [type, field] of typeFields) {
      await format.selectOption(type);
      await expect(createForm.getByLabel(field, { exact: true })).toBeVisible();
    }

    await format.selectOption('procedure');
    await page.locator('#new-title').fill(title);
    await page.locator('#new-topic').fill('release');
    await createForm.getByLabel('Central question', { exact: true }).fill('How do I release safely?');
    await createForm.getByLabel('Goal', { exact: true }).fill('Ship without skipping verification.');
    await createForm.getByRole('textbox', { name: /^Steps/ }).fill('Deploy :: Use the protected release flow.');
    await createForm.getByLabel('Done when', { exact: true }).fill('Production smoke passes');
    await createForm.getByLabel('Summary', { exact: true }).fill('A verified release procedure.');
    await createForm.getByRole('button', { name: 'Save item' }).click();

    let item = page.locator('details').filter({ hasText: title });
    await expect(item).toHaveCount(1);
    await item.locator('summary').click();
    const structuredView = item.getByLabel('Structured knowledge');
    await expect(structuredView.getByText('Procedure', { exact: true })).toBeVisible();
    await expect(structuredView.getByText('How do I release safely?', { exact: true })).toBeVisible();
    await expect(structuredView.getByText('Deploy', { exact: true })).toBeVisible();
    await expect(structuredView.getByText('Use the protected release flow.', { exact: true })).toBeVisible();

    const filters = page.getByRole('search');
    await filters.getByRole('combobox', { name: 'Format' }).selectOption('procedure');
    await filters.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('details').filter({ hasText: title })).toHaveCount(1);

    item = page.locator('details').filter({ hasText: title });
    await item.locator('summary').click();
    const itemEditor = item.getByRole('group', { name: 'Knowledge format' });
    await itemEditor.locator('input[name="central_question"]').fill('What makes a release verifiable?');
    await itemEditor.locator('textarea').first().fill('Ship with verifiable evidence.');
    await item.getByRole('button', { name: 'Save changes' }).click();

    item = page.locator('details').filter({ hasText: title });
    await expect(item.getByLabel('Structured knowledge').getByText('What makes a release verifiable?', { exact: true })).toBeVisible();
    await expect(item.getByLabel('Structured knowledge').getByText('Ship with verifiable evidence.', { exact: true })).toBeVisible();
    await assertNoBrowserFailures();
  });
});
