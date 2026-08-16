import { expect, test } from '@playwright/test';
import { SUPPORTED_LOCALES, type Locale } from '@stem-brain/shared';
import { createI18n } from '../src/i18n/core';

const LOCALE_CASES: Array<{ locale: Locale; direction: 'ltr' | 'rtl'; script: RegExp }> = [
  { locale: 'en', direction: 'ltr', script: /[A-Za-z]/ },
  { locale: 'ja', direction: 'ltr', script: /[\u3040-\u30ff]/ },
  { locale: 'zh-CN', direction: 'ltr', script: /[\u4e00-\u9fff]/ },
  { locale: 'es', direction: 'ltr', script: /[A-Za-záéíóúüñ¿¡]/i },
  { locale: 'ar', direction: 'rtl', script: /[\u0600-\u06ff]/ },
  { locale: 'hi', direction: 'ltr', script: /[\u0900-\u097f]/ },
];

test.describe('localized web routes', () => {
  test('bounded public content uses stable ids without authentication', async ({ request }) => {
    const response = await request.get('/api/content?locale=en&ids=linear_algebra');

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.requested_locale).toBe('en');
    expect(payload.items).toEqual([
      expect.objectContaining({
        id: 'linear_algebra',
        source_locale: 'en',
        resolved_locale: 'en',
        translation_status: 'source',
      }),
    ]);
  });

  test('public content rejects unknown ids and oversized batches', async ({ request }) => {
    const unknown = await request.get('/api/content?locale=ja&ids=not-a-public-node');
    expect(unknown.status()).toBe(404);

    const tooManyIds = Array.from({ length: 13 }, (_, index) => `node-${index}`).join(',');
    const oversized = await request.get(`/api/content?locale=ja&ids=${tooManyIds}`);
    expect(oversized.status()).toBe(400);
  });

  test('public content keeps stable taxonomy keys with a localized deterministic label', async ({ request }) => {
    const response = await request.get('/api/content?locale=ja&ids=linear_algebra');

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.items[0]).toEqual(expect.objectContaining({
      id: 'linear_algebra',
      domain: 'Linear Algebra',
      domain_label: '線形代数',
      type: 'concept',
      type_label: '概念',
    }));
  });

  test('public content preserves canonical node ids that begin with graph_', async ({ request }) => {
    const canonicalIds = [
      'graph_algorithms',
      'graph_neural_network',
      'graph_theory_basics',
      'graph_traversal_algo',
    ];
    const response = await request.get(`/api/content?locale=en&ids=${canonicalIds.join(',')}`);

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.generation_mode).toBe('cache-only');
    expect(payload.items.map((item: { id: string }) => item.id)).toEqual(canonicalIds);
  });

  for (const { locale, direction, script } of LOCALE_CASES) {
    test(`${locale} renders its localized document and home copy`, async ({ page }) => {
      const i18n = createI18n(locale);

      await page.goto(`/${locale}`);

      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('dir', direction);
      const heading = page.getByRole('heading', {
        level: 1,
        name: new RegExp(i18n.t('home.heroTitle').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      });
      await expect(heading).toBeVisible();
      expect(await heading.textContent()).toMatch(script);
      await expect(page.getByRole('combobox', { name: i18n.t('locale.select') })).toHaveValue(locale);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.girapphe.com/${locale}`);
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
        'href',
        'https://www.girapphe.com/en',
      );
    });
  }

  test('every supported locale has distinct home copy', () => {
    const heroCopy = SUPPORTED_LOCALES.map((locale) => {
      const i18n = createI18n(locale);
      return `${i18n.t('home.heroTitle')} ${i18n.t('home.heroAccent')}`;
    });

    expect(new Set(heroCopy).size).toBe(SUPPORTED_LOCALES.length);
  });

  test('language switcher preserves the route, query string, and fragment', async ({ page, context }) => {
    await page.goto('/en/practice?mode=review#practice-card');
    await page.getByRole('combobox', { name: 'Choose language' }).selectOption('ja');

    await expect(page).toHaveURL(/\/ja\/practice\?mode=review#practice-card$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: createI18n('ja').t('practice.title') })).toBeVisible();

    const preference = (await context.cookies()).find((cookie) => cookie.name === 'girapphe_locale');
    expect(preference?.value).toBe('ja');
  });

  test('unprefixed routes negotiate the preferred supported language', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      locale: 'es-ES',
      extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.5' },
    });
    const page = await context.newPage();

    try {
      await page.goto('/');

      await expect(page).toHaveURL(/\/es$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    } finally {
      await context.close();
    }
  });

  test('public content negotiates locale from Accept-Language without a query parameter', async ({ request }) => {
    const response = await request.get('/api/content?ids=linear_algebra', {
      headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.5' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-language']?.split(/\s*,\s*/)).toContain('zh-CN');
    expect((await response.json()).requested_locale).toBe('zh-CN');
  });

  test('locale aliases redirect to their canonical public URL', async ({ page }) => {
    await page.goto('/zh-cn/practice');

    await expect(page).toHaveURL(/\/zh-CN\/practice$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  });
});
