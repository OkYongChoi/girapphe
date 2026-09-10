import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type Response,
} from './authenticated-test';
import {
  AUTHENTICATED_OVERLAY_AUTH_MODES,
  resolveAuthenticatedOverlayAuthMode,
} from '../scripts/authenticated-overlay-auth.mjs';

const FIXTURE_TITLE = 'Girapphe authenticated overlay fixture A';
// Keep this literal aligned with authenticated-overlay-constants.mjs without
// loading the server-only fixture dependency graph during Playwright collection.
const DRAFT_PROBE_TITLE_PREFIX = 'Girapphe authenticated overlay draft probe';
const FIXTURE_TAGS = ['e2e', 'synthetic', 'authenticated-overlay'];
const LOCALIZED_TAGS = ['日本語', 'हिंदी', 'العَرَبِيَّة'];

function requireTestingTokenFixture(): void {
  test.skip(
    resolveAuthenticatedOverlayAuthMode() !== AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken,
    'My Notes tag mutations are limited to the isolated Preview synthetic user.',
  );
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon\.ico/i.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  return errors;
}

function fixtureItem(page: Page) {
  return page
    .getByRole('heading', { name: FIXTURE_TITLE, exact: true })
    .locator('xpath=ancestor::li[1]');
}

async function openFixtureEditor(page: Page) {
  const item = fixtureItem(page);
  await expect(item).toBeVisible();
  const details = item.locator('details');
  if ((await details.getAttribute('open')) === null) {
    await item.locator('summary').click();
  }
  const form = item.locator('form:has(input[name="version"])').first();
  await expect(form).toBeVisible();
  return form;
}

function tagPicker(form: Locator) {
  return form.locator('[data-testid$="-tag-picker"]');
}

function tagValues(form: Locator) {
  return form
    .locator('input[type="hidden"][name="tags"]')
    .inputValue()
    .then((value) => value.split(',').map((tag) => tag.trim()).filter(Boolean));
}

function isServerActionResponse(response: Response, page: Page) {
  const request = response.request();
  return request.method() === 'POST'
    && Boolean(request.headers()['next-action'])
    && new URL(response.url()).origin === new URL(page.url()).origin;
}

async function submitEdit(form: Locator, page: Page) {
  const responsePromise = page.waitForResponse((response) => isServerActionResponse(response, page));
  await form.getByRole('button', { name: 'Save changes', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), 'My Notes edit Server Action status').toBeLessThan(400);
}

async function expectTouchTargets(picker: Locator) {
  const undersized = await picker.locator('button, input:not([type="hidden"])')
    .evaluateAll((elements) => elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) {
        return [];
      }
      return rect.width < 44 || rect.height < 44
        ? [{
            tag: element.tagName,
            text: element.textContent?.trim().slice(0, 80),
            width: rect.width,
            height: rect.height,
          }]
        : [];
    }));
  expect(undersized, 'visible tag-picker controls smaller than 44 CSS px').toEqual([]);
}

async function expectNoPickerOverflow(picker: Locator) {
  const overflow = await picker.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow, 'tag picker horizontal overflow').toBeLessThanOrEqual(1);
}

async function removeFixtureTag(context: BrowserContext, value: string) {
  const cleanupPage = await context.newPage();
  try {
    await cleanupPage.goto('/en/my-notes', { waitUntil: 'domcontentloaded' });
    const form = await openFixtureEditor(cleanupPage);
    if (!(await tagValues(form)).includes(value)) return;

    const version = Number(await form.locator('input[name="version"]').inputValue());
    await tagPicker(form).getByRole('button', { name: `Remove #${value}`, exact: true }).click();
    await submitEdit(form, cleanupPage);
    await expect.poll(async () => {
      const current = await openFixtureEditor(cleanupPage);
      return Number(await current.locator('input[name="version"]').inputValue());
    }).toBe(version + 1);
    await expect.poll(async () => tagValues(await openFixtureEditor(cleanupPage)))
      .toEqual(FIXTURE_TAGS);
  } finally {
    await cleanupPage.close();
  }
}

test('renders the tag picker and normalizes search, localized separators, and form reset', async ({
  page,
}, testInfo) => {
  requireTestingTokenFixture();
  const browserErrors = collectBrowserErrors(page);
  await page.goto('/en/my-notes', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'My Notes', level: 1 })).toBeVisible();

  const createForm = page.locator('form').filter({
    has: page.getByRole('heading', { name: 'Add knowledge item', exact: true }),
  });
  const picker = page.getByTestId('new-tags-tag-picker');
  await expect(picker).toBeVisible();
  await expectTouchTargets(picker);
  await expectNoPickerOverflow(picker);

  const suggestionTrigger = picker.getByRole('button', {
    name: 'Choose from frequent tags',
    exact: true,
  });
  await suggestionTrigger.click();
  const suggestionSearch = picker.getByPlaceholder('Search frequent tags', { exact: true });
  await suggestionSearch.fill('authenticated overlay');
  const suggestionList = picker.getByTestId('new-tags-suggestion-list');
  await expect(suggestionList.getByRole('button', {
    name: '#authenticated-overlay',
    exact: true,
  })).toBeVisible();
  expect(await suggestionList.getByRole('button').count()).toBeLessThanOrEqual(24);
  await suggestionSearch.press('Escape');
  await expect(suggestionTrigger).toBeFocused();

  const input = picker.locator('input[type="text"]');
  await input.fill(`${LOCALIZED_TAGS[0]}，${LOCALIZED_TAGS[1]}،${LOCALIZED_TAGS[2]},`);
  await expect(picker.locator('input[type="hidden"][name="tags"]')).toHaveValue(LOCALIZED_TAGS.join(', '));
  await expect(picker.locator('li')).toHaveCount(LOCALIZED_TAGS.length);
  await expectTouchTargets(picker);
  await expectNoPickerOverflow(picker);

  const localizedTagsScreenshot = testInfo.outputPath('my-notes-localized-tags.png');
  await page.screenshot({ path: localizedTagsScreenshot, fullPage: true });
  await testInfo.attach('my-notes-localized-tags', {
    path: localizedTagsScreenshot,
    contentType: 'image/png',
  });

  await createForm.locator('input[name="title"]').fill('Unsaved reset probe');
  await createForm.evaluate((form: HTMLFormElement) => form.reset());
  await expect(createForm.locator('input[name="title"]')).toHaveValue('');
  await expect(picker.locator('input[type="hidden"][name="tags"]')).toHaveValue('');
  await expect(picker.locator('li')).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test('preserves an unsaved create tag across an edit and rejects a stale second-tab edit', async ({
  context,
  page,
}, testInfo) => {
  requireTestingTokenFixture();
  const browserErrors = collectBrowserErrors(page);
  const stalePage = await context.newPage();
  const stalePageErrors = collectBrowserErrors(stalePage);
  const mutationTag = `tag-${testInfo.project.name}`;
  const staleAttemptTag = `stale-${testInfo.project.name}`;
  const createDraftTag = `draft-${testInfo.project.name}`;
  const createDraftTitle = `${DRAFT_PROBE_TITLE_PREFIX} ${testInfo.project.name}`;

  try {
    await Promise.all([
      page.goto('/en/my-notes', { waitUntil: 'domcontentloaded' }),
      stalePage.goto('/en/my-notes', { waitUntil: 'domcontentloaded' }),
    ]);

    const createForm = page.locator('form').filter({
      has: page.getByRole('heading', { name: 'Add knowledge item', exact: true }),
    });
    await createForm.locator('input[name="title"]').fill(createDraftTitle);
    const createPicker = page.getByTestId('new-tags-tag-picker');
    const createTagValue = createPicker.locator('input[type="hidden"][name="tags"]');
    await expect(createTagValue).toBeAttached();
    const createTagInput = createPicker.locator('input[type="text"]');
    await createTagInput.fill(createDraftTag);
    await createTagInput.press('Enter');
    await expect(createTagValue).toHaveValue(createDraftTag);
    await expect(page.getByRole('heading', { name: createDraftTitle, level: 3 })).toHaveCount(0);

    const currentForm = await openFixtureEditor(page);
    const staleForm = await openFixtureEditor(stalePage);
    expect(await tagValues(currentForm)).toEqual(FIXTURE_TAGS);
    expect(await tagValues(staleForm)).toEqual(FIXTURE_TAGS);
    const initialVersion = Number(await currentForm.locator('input[name="version"]').inputValue());

    const currentPicker = tagPicker(currentForm);
    await currentPicker.locator('input[type="text"]').fill(mutationTag);
    await currentPicker.locator('input[type="text"]').press('Enter');
    expect(await tagValues(currentForm)).toEqual([...FIXTURE_TAGS, mutationTag]);
    await submitEdit(currentForm, page);

    await expect.poll(async () => {
      const refreshedForm = await openFixtureEditor(page);
      return Number(await refreshedForm.locator('input[name="version"]').inputValue());
    }).toBe(initialVersion + 1);
    await expect.poll(async () => tagValues(await openFixtureEditor(page)))
      .toEqual([...FIXTURE_TAGS, mutationTag]);

    await expect(createForm.locator('input[name="title"]')).toHaveValue(createDraftTitle);
    await expect(createPicker.locator('input[type="hidden"][name="tags"]')).toHaveValue(createDraftTag);

    const stalePicker = tagPicker(staleForm);
    await stalePicker.locator('input[type="text"]').fill(staleAttemptTag);
    await stalePicker.locator('input[type="text"]').press('Enter');
    await submitEdit(staleForm, stalePage);
    await expect(stalePage).toHaveURL(/\/(?:en\/)?my-notes\?editStatus=stale$/);
    await expect(stalePage.locator('main [role="alert"]')).toContainText('changed in another session');
    await expect.poll(async () => tagValues(await openFixtureEditor(stalePage)))
      .toEqual([...FIXTURE_TAGS, mutationTag]);

    await expectTouchTargets(tagPicker(await openFixtureEditor(stalePage)));
    await expectNoPickerOverflow(tagPicker(await openFixtureEditor(stalePage)));
    expect(browserErrors).toEqual([]);
    expect(stalePageErrors).toEqual([]);

    const staleScreenshot = testInfo.outputPath('my-notes-stale-edit.png');
    await stalePage.screenshot({ path: staleScreenshot, fullPage: true });
    await testInfo.attach('my-notes-tag-mutation', {
      body: Buffer.from(JSON.stringify({
        schemaVersion: 1,
        project: testInfo.project.name,
        route: '/en/my-notes',
        mutationPersisted: true,
        createDraftPreserved: true,
        staleWriteRejected: true,
        refreshedTags: [...FIXTURE_TAGS, mutationTag],
      }, null, 2)),
      contentType: 'application/json',
    });
    await testInfo.attach('my-notes-stale-edit', {
      path: staleScreenshot,
      contentType: 'image/png',
    });
  } finally {
    await stalePage.close();
    await removeFixtureTag(context, mutationTag);
  }
});
