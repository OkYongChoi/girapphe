import { expect, test } from '@playwright/test';
import { GUEST_KNOWLEDGE_WRITES_PER_HOUR } from '../src/lib/guest-knowledge-admission';

const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const usesDeployedPreview = Boolean(
  configuredBaseUrl
  && !['127.0.0.1', 'localhost', '::1'].includes(new URL(configuredBaseUrl).hostname),
);

test.describe('main stabilization regressions', () => {
  test('clearing filters in My Notes trash keeps the trash view', async ({ page }) => {
    await page.goto('/my-notes?view=trash&q=no-match');

    await expect(page.getByRole('heading', { name: 'Knowledge Trash' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clear', exact: true })).toHaveAttribute(
      'href',
      /\/(?:en\/)?my-notes\?view=trash$/
    );
  });

  test('a guest note appears as one private Concepts card', async ({ page }, testInfo) => {
    test.skip(
      usesDeployedPreview,
      'Guest-note mutations are covered by the isolated local in-memory browser suite.',
    );

    const title = `Guest concept injection ${testInfo.project.name} ${Date.now()}`;

    await page.goto('/my-notes');
    await page.locator('#new-title').fill(title);
    await page.locator('#new-topic').fill('machine-learning');
    await page.locator('#new-summary').fill('A private note rendered in Concepts.');
    await page.locator('#new-tags').fill('optimization');
    await page.getByRole('button', { name: 'Save item' }).click();

    await expect(page.getByRole('heading', { name: title, level: 3 })).toBeVisible();

    await page.goto('/grid');
    const privateCard = page.getByTestId('concept-card').filter({ hasText: title });
    await expect(privateCard).toHaveCount(1);
    await expect(privateCard).toContainText('Private card');
    await expect(privateCard).toContainText('Machine Learning');
    await expect(privateCard).toContainText('#optimization');
  });

  test('guest hourly write denial stays inline and preserves the retry draft', async ({ page, browser }, testInfo) => {
    test.skip(
      usesDeployedPreview,
      'The bounded hourly-limit saturation regression runs only against isolated local memory.',
    );

    const rateMessage = 'Guest saving from this network has reached its hourly limit. Try again in up to an hour.';
    await page.goto('/my-notes');

    const createForm = page.getByTestId('knowledge-create-form');
    const titleInput = page.locator('#new-title');
    const requestIdInput = createForm.locator('input[name="request_id"]');

    for (let index = 0; index < GUEST_KNOWLEDGE_WRITES_PER_HOUR; index += 1) {
      const requestId = await requestIdInput.inputValue();
      await titleInput.fill(`Rate admission ${testInfo.project.name} ${index + 1}`);
      await createForm.getByRole('button', { name: 'Save item' }).click();
      await expect(titleInput).toHaveValue('');
      await expect.poll(() => requestIdInput.inputValue()).not.toBe(requestId);
    }

    const blockedTitle = `Blocked retry draft ${testInfo.project.name}`;
    const blockedRequestId = await requestIdInput.inputValue();
    await titleInput.fill(blockedTitle);
    await page.locator('#new-topic').fill('rate-limit-proof');
    await page.locator('#new-summary').fill('This summary must remain editable.');
    await page.locator('#new-content').fill('Private draft content must not enter the URL.');
    await page.locator('#new-tags').fill('draft-preserved');
    await page.locator('#new-tags').press('Enter');
    await createForm.locator('select[name="knowledge_type"]').selectOption('concept');
    await createForm.locator('input[name="central_question"]').fill('What survives a rate denial?');
    await createForm.getByLabel('Definition').fill('Every hydrated draft field.');
    await createForm.getByRole('button', { name: 'Save item' }).click();

    await expect(createForm.getByTestId('knowledge-create-alert')).toHaveText(rateMessage);
    await expect(titleInput).toHaveValue(blockedTitle);
    await expect(page.locator('#new-topic')).toHaveValue('rate-limit-proof');
    await expect(page.locator('#new-summary')).toHaveValue('This summary must remain editable.');
    await expect(page.locator('#new-content')).toHaveValue('Private draft content must not enter the URL.');
    await expect(createForm.locator('#new-tags-value')).toHaveValue('draft-preserved');
    await expect(createForm.locator('select[name="knowledge_type"]')).toHaveValue('concept');
    await expect(createForm.locator('input[name="central_question"]')).toHaveValue('What survives a rate denial?');
    await expect(createForm.getByLabel('Definition')).toHaveValue('Every hydrated draft field.');
    await expect(requestIdInput).toHaveValue(blockedRequestId);
    await expect(page.getByRole('heading', { name: blockedTitle, level: 3 })).toHaveCount(0);

    const storageState = await page.context().storageState();
    const noJavaScriptContext = await browser.newContext({
      javaScriptEnabled: false,
      storageState,
    });
    try {
      const noJavaScriptPage = await noJavaScriptContext.newPage();
      const urlSecret = `url-secret-${Date.now()}`;
      await noJavaScriptPage.goto('/my-notes');
      await noJavaScriptPage.locator('#new-title').fill(urlSecret);
      await noJavaScriptPage.locator('#new-content').fill('must-never-appear-in-the-url');
      await Promise.all([
        noJavaScriptPage.waitForURL(/createStatus=guest_write_rate_limited/),
        noJavaScriptPage.getByTestId('knowledge-create-form').evaluate((form) => {
          (form as HTMLFormElement).requestSubmit();
        }),
      ]);
      const fallbackUrl = new URL(noJavaScriptPage.url());
      expect(fallbackUrl.searchParams.toString()).toBe('createStatus=guest_write_rate_limited');
      expect(noJavaScriptPage.url()).not.toContain(urlSecret);
      expect(noJavaScriptPage.url()).not.toContain('must-never-appear-in-the-url');
      await expect(noJavaScriptPage.getByRole('alert')).toHaveText(rateMessage);
    } finally {
      await noJavaScriptContext.close();
    }

    await page.goto('/grid');
    const publicCard = page.getByTestId('concept-card').first();
    await publicCard.getByRole('button', { name: /^Edit / }).click();
    const editor = publicCard.getByTestId('concept-card-editor');
    const privateCopyTitle = `Blocked private copy ${testInfo.project.name}`;
    await editor.getByLabel('Title').fill(privateCopyTitle);
    await editor.getByRole('button', { name: 'Save private copy' }).click();
    await expect(editor.getByTestId('concept-card-save-alert')).toHaveText(rateMessage);
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('Title')).toHaveValue(privateCopyTitle);
    await expect(page.getByRole('heading', { name: privateCopyTitle, level: 3 })).toHaveCount(0);
  });

  test('My Notes keeps the complete tag list natively editable before hydration', async ({ browser }, testInfo) => {
    test.skip(
      usesDeployedPreview,
      'The no-JavaScript guest mutation is covered by the isolated local in-memory browser suite.',
    );

    const hydrationContext = await browser.newContext();
    const hydrationPage = await hydrationContext.newPage();
    await hydrationPage.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const input = document.querySelector<HTMLInputElement>('#new-tags');
        if (!input) return;
        observer.disconnect();
        input.value = '!!!';
        input.focus();
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    await hydrationPage.goto('/my-notes');
    await expect(hydrationPage.locator('#new-tags')).toHaveValue('!!!');
    await expect(hydrationPage.locator('#new-tags')).toBeFocused();
    await expect(hydrationPage.getByRole('status')).toContainText('cannot be used');
    await hydrationContext.close();

    const setupContext = await browser.newContext();
    const setupPage = await setupContext.newPage();
    const title = `Progressive tag edit ${testInfo.project.name} ${Date.now()}`;
    await setupPage.goto('/my-notes');
    await setupPage.locator('#new-title').fill(title);
    await setupPage.locator('#new-tags').fill('original');
    await setupPage.locator('#new-tags').press('Enter');
    await setupPage.getByRole('button', { name: 'Save item' }).click();
    await expect(setupPage.getByRole('heading', { name: title, level: 3 })).toBeVisible();
    const storageState = await setupContext.storageState();
    await setupContext.close();

    const context = await browser.newContext({ javaScriptEnabled: false, storageState });
    const page = await context.newPage();
    try {
      await page.goto('/my-notes');
      await page.locator('#new-tags').fill('before-hydration،日本語');
      const createTagFields = await page.locator('form').filter({ has: page.locator('#new-title') })
        .evaluate((form) => new FormData(form as HTMLFormElement).getAll('tags').map(String));
      expect(createTagFields).toEqual(['before-hydration،日本語']);

      const note = page.locator('li').filter({ has: page.getByRole('heading', { name: title, level: 3 }) });
      await note.locator('details').evaluate((details) => {
        (details as HTMLDetailsElement).open = true;
      });
      const editForm = note.locator('form:has(input[name="version"])').first();
      const nativeTags = editForm.locator('input[type="text"][name="tags"]');
      await expect(nativeTags).toHaveValue('original');
      await nativeTags.fill('replacement, 日本語');
      const editTagFields = await editForm
        .evaluate((form) => new FormData(form as HTMLFormElement).getAll('tags').map(String));
      expect(editTagFields).toEqual(['replacement, 日本語']);
    } finally {
      await context.close();
    }
  });

  test('My Notes reuses owned tags without stale, oversized, or IME-broken input', async ({ page }, testInfo) => {
    test.skip(
      usesDeployedPreview,
      'Guest-note mutations are covered by the isolated local in-memory browser suite.',
    );

    const seedTitle = `Tag suggestion seed ${testInfo.project.name} ${Date.now()}`;
    const noteTitle = `Tag suggestion note ${testInfo.project.name} ${Date.now()}`;
    const seedTags = [
      'existing-category',
      'another-category',
      ...Array.from({ length: 23 }, (_, index) => `search-bound-${index + 1}`),
    ];

    await page.goto('/my-notes');
    for (let index = 0; index < seedTags.length; index += 12) {
      const chunkTitle = `${seedTitle} ${index / 12 + 1}`;
      await page.locator('#new-title').fill(chunkTitle);
      await page.locator('#new-tags').fill(`${seedTags.slice(index, index + 12).join(',')},`);
      await page.getByRole('button', { name: 'Save item' }).click();
      await expect(page.getByRole('heading', { name: chunkTitle, level: 3 })).toBeVisible();
    }

    const createPicker = page.getByTestId('new-tags-tag-picker');
    const tagInput = createPicker.locator('#new-tags');
    await expect(createPicker.locator('#new-tags')).toHaveValue('');
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('');
    await expect(createPicker.locator('#new-tags-suggestions')).toHaveCount(0);

    const suggestionsButton = createPicker.getByRole('button', { name: 'Choose from frequent tags' });
    const buttonBox = await suggestionsButton.boundingBox();
    expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await suggestionsButton.click();
    const suggestionPanel = createPicker.locator('#new-tags-suggestions');
    const suggestionSearch = createPicker.getByRole('searchbox', { name: 'Search frequent tags' });
    await expect(suggestionSearch).toBeFocused();
    await expect(createPicker.getByTestId('new-tags-suggestion-list').locator('li')).toHaveCount(24);

    await suggestionsButton.click();
    await expect(suggestionPanel).toHaveCount(0);
    await suggestionsButton.click();
    await suggestionSearch.press('Escape');
    await expect(suggestionPanel).toHaveCount(0);
    await expect(suggestionsButton).toBeFocused();

    await suggestionsButton.click();
    await suggestionSearch.fill('another');
    await tagInput.fill('temporary');
    await expect(suggestionPanel).toHaveCount(0);
    await tagInput.fill('');

    await suggestionsButton.click();
    await expect(suggestionSearch).toHaveValue('');
    await suggestionSearch.fill('existing category');
    await page.locator('#new-title').fill(noteTitle);
    await suggestionSearch.dispatchEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      isComposing: true,
      bubbles: true,
    });
    await expect(suggestionPanel).toBeVisible();
    await suggestionSearch.press('Enter');
    await expect(suggestionPanel).toBeVisible();
    await expect(page.getByRole('heading', { name: noteTitle, level: 3 })).toHaveCount(0);
    const createTagSuggestion = createPicker.getByRole('button', { name: '#existing-category', exact: true });
    const suggestionBox = await createTagSuggestion.boundingBox();
    expect(suggestionBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await createTagSuggestion.click();
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('existing-category');

    const removeExisting = createPicker.getByRole('button', { name: 'Remove #existing-category' });
    const removeBox = await removeExisting.boundingBox();
    expect(removeBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(removeBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    await removeExisting.click();
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('');
    await expect(createPicker.locator('#new-tags')).toBeFocused();

    await tagInput.evaluate((element) => {
      const input = element as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      valueSetter?.call(input, 'rapid-enter');
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: 'rapid-enter',
        inputType: 'insertText',
      }));
      input.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
      }));
    });
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('rapid-enter');
    await createPicker.getByRole('button', { name: 'Remove #rapid-enter' }).click();
    await expect(tagInput).toHaveValue('');
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect(page.getByRole('heading', { name: noteTitle, level: 3 })).toHaveCount(0);
    await expect(page.locator('#new-title')).toHaveValue(noteTitle);

    await createPicker.getByRole('button', { name: 'Choose from frequent tags' }).click();
    await createPicker.getByRole('button', { name: '#existing-category', exact: true }).click();
    await tagInput.fill('日本語');
    await tagInput.dispatchEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      isComposing: true,
      bubbles: true,
    });
    await expect(tagInput).toHaveValue('日本語');
    await tagInput.press('Enter');
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('existing-category, 日本語');

    await page.getByRole('button', { name: 'Save item' }).click();
    const note = page.locator('li').filter({ hasText: noteTitle });
    await expect(note).toContainText('#existing-category');
    await expect(note).toContainText('#日本語');
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('');

    const preservedDraftTitle = `Preserved create draft ${testInfo.project.name} ${Date.now()}`;
    const createForm = page.locator('form').filter({ has: page.locator('#new-title') });
    await page.locator('#new-title').fill(preservedDraftTitle);
    await tagInput.fill('draft-preserved');
    await tagInput.press('Enter');
    await createForm.locator('select[name="knowledge_type"]').selectOption('concept');
    await createForm.locator('input[name="central_question"]').fill('What must survive an unrelated revalidation?');
    await createForm.getByLabel('Definition').fill('The in-progress create form must survive.');

    await page.getByRole('heading', { name: noteTitle, level: 3 }).click();
    const editPicker = note.locator('[data-testid$="-tag-picker"]');
    await editPicker.getByRole('button', { name: 'Choose from frequent tags' }).click();
    await editPicker.getByRole('button', { name: '#another-category', exact: true }).click();
    await note.getByRole('button', { name: 'Save changes' }).click();
    await expect(note).toContainText('#another-category');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#new-title')).toHaveValue(preservedDraftTitle);
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('draft-preserved');
    await expect(createForm.locator('select[name="knowledge_type"]')).toHaveValue('concept');
    await expect(createForm.locator('input[name="central_question"]')).toHaveValue('What must survive an unrelated revalidation?');
    await expect(createForm.getByLabel('Definition')).toHaveValue('The in-progress create form must survive.');

    await createForm.getByRole('button', { name: 'Save item' }).click();
    await expect(page.getByRole('heading', { name: preservedDraftTitle, level: 3 })).toBeVisible();
    await expect(page.locator('#new-title')).toHaveValue('');
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('');
    await expect(createForm.locator('select[name="knowledge_type"]')).toHaveValue('');
    await expect(createForm.locator('input[name="central_question"]')).toHaveCount(0);

    await tagInput.evaluate((element) => {
      const input = element as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      input.dispatchEvent(new CompositionEvent('compositionstart', {
        bubbles: true,
        data: '入力，',
      }));
      valueSetter?.call(input, '入力，');
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: '入力，',
        inputType: 'insertCompositionText',
        isComposing: true,
      }));
    });
    await expect(tagInput).toHaveValue('入力，');
    await expect(createPicker.getByRole('button', { name: 'Remove #入力' })).toHaveCount(0);
    await tagInput.dispatchEvent('compositionend', { bubbles: true, data: '入力，' });
    await expect(tagInput).toHaveValue('');
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('入力');
    await createPicker.getByRole('button', { name: 'Remove #入力' }).click();

    await tagInput.fill('हिंदी،العَرَبِيَّة，日本語,');
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('हिंदी, العَرَبِيَّة, 日本語');
    for (const tag of ['हिंदी', 'العَرَبِيَّة', '日本語']) {
      await createPicker.getByRole('button', { name: `Remove #${tag}` }).click();
    }

    await tagInput.fill('Machine Learning,machine/learning,!!!,general,');
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('machine-learning');
    await expect(createPicker.getByRole('button', { name: 'Remove #machine-learning' })).toHaveCount(1);
    await expect(createPicker.getByRole('status')).toContainText('cannot be used');
    await createPicker.getByRole('button', { name: 'Remove #machine-learning' }).click();
    await expect(tagInput).toBeFocused();

    await tagInput.fill(`${'!'.repeat(60)}Tail Value`);
    await tagInput.press('Enter');
    await expect(createPicker.locator('#new-tags-value')).toHaveValue('tail-value');
    await createPicker.getByRole('button', { name: 'Remove #tail-value' }).click();

    const longTag = '知'.repeat(49);
    const boundedLongTag = '知'.repeat(48);
    await tagInput.fill(longTag);
    await expect(tagInput).toHaveValue(boundedLongTag);
    await expect(createPicker.getByRole('status')).toContainText('48 characters');
    await tagInput.press('Enter');
    await expect(createPicker.locator('#new-tags-value')).toHaveValue(boundedLongTag);
    const pickerBox = await createPicker.boundingBox();
    const longChipBox = await createPicker.locator('li', { hasText: `#${boundedLongTag}` }).boundingBox();
    expect((longChipBox?.x ?? 0) + (longChipBox?.width ?? 0))
      .toBeLessThanOrEqual((pickerBox?.x ?? 0) + (pickerBox?.width ?? 0) + 1);
    await createPicker.getByRole('button', { name: `Remove #${boundedLongTag}` }).click();
    await expect(tagInput).toBeFocused();

    const limitValues = Array.from({ length: 13 }, (_, index) => `limit-${index + 1}`);
    await createPicker.locator('#new-tags').fill(`${limitValues.join(',')},`);
    await expect(createPicker.locator('#new-tags-value')).toHaveValue(limitValues.slice(0, 12).join(', '));
    await expect(createPicker.locator('#new-tags')).toHaveJSProperty('readOnly', true);
    await expect(createPicker.locator('#new-tags')).toHaveAttribute('aria-disabled', 'true');
    await expect(createPicker.locator('#new-tags')).toBeFocused();
    await expect(createPicker.getByRole('status')).toContainText('12-tag limit');
  });

  test('a stale My Notes editor reloads the winning tags before a retry', async ({ page }, testInfo) => {
    test.skip(
      usesDeployedPreview,
      'Guest-note concurrency is covered by the isolated local in-memory browser suite.',
    );

    const title = `Stale tag editor ${testInfo.project.name} ${Date.now()}`;
    await page.goto('/my-notes');
    await page.locator('#new-title').fill(title);
    await page.locator('#new-tags').fill('original');
    await page.locator('#new-tags').press('Enter');
    await page.getByRole('button', { name: 'Save item' }).click();
    await expect(page.getByRole('heading', { name: title, level: 3 })).toBeVisible();

    const secondPage = await page.context().newPage();
    try {
      await secondPage.goto('/my-notes');
      const firstNote = page.locator('li').filter({ has: page.getByRole('heading', { name: title, level: 3 }) });
      const secondNote = secondPage.locator('li').filter({ has: secondPage.getByRole('heading', { name: title, level: 3 }) });
      await firstNote.getByRole('heading', { name: title, level: 3 }).click();
      await secondNote.getByRole('heading', { name: title, level: 3 }).click();

      const secondPicker = secondNote.locator('[data-testid$="-tag-picker"]');
      await secondPicker.locator('input[type="text"]').fill('winner');
      await secondPicker.locator('input[type="text"]').press('Enter');
      await secondNote.getByRole('button', { name: 'Save changes' }).click();
      await expect(secondNote).toContainText('#winner');

      const firstPicker = firstNote.locator('[data-testid$="-tag-picker"]');
      await firstPicker.locator('input[type="text"]').fill('stale-loser');
      await firstPicker.locator('input[type="text"]').press('Enter');
      await firstNote.getByRole('button', { name: 'Save changes' }).click();
      await expect(page).toHaveURL(/editStatus=stale/);
      await expect(page.locator('main [role="alert"]')).toContainText('Reloaded values are shown');

      const reloadedNote = page.locator('li').filter({ has: page.getByRole('heading', { name: title, level: 3 }) });
      const reloadedDetails = reloadedNote.locator('details');
      if (await reloadedDetails.getAttribute('open') === null) {
        await reloadedNote.getByRole('heading', { name: title, level: 3 }).click();
      }
      const reloadedPicker = reloadedNote.locator('[data-testid$="-tag-picker"]');
      await expect(reloadedPicker.locator('input[type="hidden"][name="tags"]')).toHaveValue('original, winner');
      await expect(reloadedNote).not.toContainText('#stale-loser');
      await expect(reloadedPicker.locator('input[type="text"]')).toBeVisible();

      await reloadedPicker.locator('input[type="text"]').fill('retry');
      await reloadedPicker.locator('input[type="text"]').press('Enter');
      await reloadedNote.getByRole('button', { name: 'Save changes' }).click();
      await expect(reloadedNote).toContainText('#winner');
      await expect(reloadedNote).toContainText('#retry');
      await expect(reloadedNote).not.toContainText('#stale-loser');
    } finally {
      await secondPage.close();
    }
  });

});
