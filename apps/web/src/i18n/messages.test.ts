import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SUPPORTED_LOCALES, type Locale } from '@stem-brain/shared';
import { loadClerkLocalization } from './clerk';
import { MESSAGE_CATALOGS, type MessageValue } from './messages';

const SCRIPT_PATTERNS: Partial<Record<Locale, RegExp>> = {
  ja: /[\u3040-\u30ff]/u,
  'zh-CN': /[\u3400-\u9fff]/u,
  ar: /[\u0600-\u06ff]/u,
  hi: /[\u0900-\u097f]/u,
};

const GENERATOR_ARTIFACT_PATTERN = /__(?:GPHOLD|PLACEHOLDER|PROTECTED)_[A-Za-z0-9_]*__/u;

test('server message loading stays locale-lazy', () => {
  const serverSource = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(serverSource, /MESSAGE_CATALOGS/u);
  assert.doesNotMatch(serverSource, /^import\s+.+from\s+['"]\.\/catalogs\//mu);

  for (const catalog of ['en', 'ja', 'zh-CN', 'es', 'ar', 'hi']) {
    assert.match(
      serverSource,
      new RegExp(`import\\(['"]\\./catalogs/${catalog}['"]\\)`, 'u'),
      `${catalog} must be loaded through its own dynamic import`,
    );

    const catalogSource = readFileSync(new URL(`./catalogs/${catalog}.ts`, import.meta.url), 'utf8');
    assert.doesNotMatch(
      catalogSource,
      /from\s+['"]\.\/extended['"]/u,
      `${catalog} must not initialize the aggregate extended catalog`,
    );
    assert.match(
      catalogSource,
      new RegExp(`from\\s+['"]\\./extended/${catalog}['"]`, 'u'),
      `${catalog} must import only its locale extension`,
    );
  }
});

test('Clerk localization loading stays outside the server graph and maps every supported locale', async () => {
  const clerkSource = readFileSync(new URL('./clerk.ts', import.meta.url), 'utf8');
  const exporterSource = readFileSync(
    new URL('../../../../scripts/export-clerk-localization-assets.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(clerkSource, /@clerk\/localizations\//u);

  const expected = {
    en: ['en-US', 'en-US'],
    ja: ['ja-JP', 'ja-JP'],
    'zh-CN': ['zh-CN', 'zh-CN'],
    es: ['es-ES', 'es-ES'],
    ar: ['ar-SA', 'ar-SA'],
    hi: ['hi-IN', 'hi-IN'],
  } satisfies Record<Locale, [modulePath: string, resolvedLocale: string]>;

  for (const locale of SUPPORTED_LOCALES) {
    const [modulePath, resolvedLocale] = expected[locale];
    assert.match(
      exporterSource,
      new RegExp(`from ['"]@clerk/localizations/${modulePath}['"]`, 'u'),
      `${locale} must be exported from the matching Clerk dictionary`,
    );
    const requests: string[] = [];
    const localization = await loadClerkLocalization(locale, {
      fetcher: async (input) => {
        requests.push(input);
        return new Response(JSON.stringify({ locale: resolvedLocale }), { status: 200 });
      },
      retryDelayMs: 0,
    });
    assert.equal(localization.locale, resolvedLocale);
    assert.deepEqual(requests, [`/localization/clerk/${locale}.json`]);
  }
});

test('Clerk localization loading retries once and then fails closed', async () => {
  let transientAttempts = 0;
  const recovered = await loadClerkLocalization('en', {
    fetcher: async () => {
      transientAttempts += 1;
      return transientAttempts === 1
        ? new Response(null, { status: 503 })
        : new Response(JSON.stringify({ locale: 'en-US' }), { status: 200 });
    },
    retryDelayMs: 0,
  });
  assert.equal(recovered.locale, 'en-US');
  assert.equal(transientAttempts, 2);

  let permanentAttempts = 0;
  await assert.rejects(
    loadClerkLocalization('en', {
      fetcher: async () => {
        permanentAttempts += 1;
        return new Response(null, { status: 503 });
      },
      retryDelayMs: 0,
    }),
    /Unable to load Clerk localization after two attempts/u,
  );
  assert.equal(permanentAttempts, 2);
});

test('Clerk localization loading times out hanging requests and preserves unmount cancellation', async () => {
  let timeoutAttempts = 0;
  await assert.rejects(
    loadClerkLocalization('en', {
      fetcher: () => {
        timeoutAttempts += 1;
        return new Promise<Response>(() => undefined);
      },
      retryDelayMs: 0,
      timeoutMs: 5,
    }),
    /Unable to load Clerk localization after two attempts/u,
  );
  assert.equal(timeoutAttempts, 2);

  const controller = new AbortController();
  let abortedAttempts = 0;
  const abortedLoad = loadClerkLocalization('en', {
    fetcher: () => {
      abortedAttempts += 1;
      return new Promise<Response>(() => undefined);
    },
    retryDelayMs: 0,
    signal: controller.signal,
    timeoutMs: 1_000,
  });
  controller.abort();
  await assert.rejects(abortedLoad, { name: 'AbortError' });
  assert.equal(abortedAttempts, 1);
});

test('Turbo build caching restores every generated public localization asset', () => {
  const turbo = JSON.parse(
    readFileSync(new URL('../../../../turbo.json', import.meta.url), 'utf8'),
  ) as { tasks?: { build?: { outputs?: string[] } } };
  const outputs = turbo.tasks?.build?.outputs ?? [];

  assert.ok(outputs.includes('public/localization/card-content.json'));
  assert.ok(outputs.includes('public/localization/clerk/**'));
});

function variants(message: MessageValue): string[] {
  return typeof message === 'string'
    ? [message]
    : Object.values(message).filter((value): value is string => typeof value === 'string');
}

function placeholders(message: MessageValue): Set<string> {
  return new Set(
    variants(message).flatMap((value) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
      .map((match) => match[1])),
  );
}

test('every locale has a complete, structurally valid message catalog', () => {
  const english = MESSAGE_CATALOGS.en;
  const englishKeys = Object.keys(english).sort();

  for (const locale of SUPPORTED_LOCALES) {
    const catalog = MESSAGE_CATALOGS[locale];
    assert.deepEqual(Object.keys(catalog).sort(), englishKeys, `${locale} message keys differ from English`);

    for (const key of englishKeys) {
      const source = english[key as keyof typeof english];
      const target = catalog[key as keyof typeof catalog];
      assert.equal(typeof target, typeof source, `${locale}.${key} changed message structure`);
      if (typeof target !== 'string') assert.equal(typeof target.other, 'string', `${locale}.${key} needs an other plural`);

      for (const value of variants(target)) {
        assert.doesNotMatch(
          value,
          GENERATOR_ARTIFACT_PATTERN,
          `${locale}.${key} contains an internal translation placeholder`,
        );
      }

      const allowed = placeholders(source);
      const required = allowed;
      const actual = placeholders(target);
      for (const placeholder of actual) {
        assert.ok(allowed.has(placeholder), `${locale}.${key} introduced unknown {${placeholder}}`);
      }
      for (const placeholder of required) {
        assert.ok(actual.has(placeholder), `${locale}.${key} dropped required {${placeholder}}`);
      }
    }
  }
});

test('non-English catalogs are genuine locale-specific translations', () => {
  const english = MESSAGE_CATALOGS.en;
  const heroCopy = new Set<string>();

  for (const locale of SUPPORTED_LOCALES) {
    const catalog = MESSAGE_CATALOGS[locale];
    heroCopy.add(`${variants(catalog['home.heroTitle']).join(' ')} ${variants(catalog['home.heroAccent']).join(' ')}`);
    if (locale === 'en') continue;

    const keys = Object.keys(english) as Array<keyof typeof english>;
    const unchanged = keys.filter((key) => JSON.stringify(catalog[key]) === JSON.stringify(english[key]));
    assert.ok(
      unchanged.length / keys.length < 0.15,
      `${locale} left ${unchanged.length}/${keys.length} messages identical to English`,
    );

    const script = SCRIPT_PATTERNS[locale];
    if (script) {
      const localizedValues = keys.flatMap((key) => variants(catalog[key])).filter((value) => /[\p{L}]/u.test(value));
      const matchingValues = localizedValues.filter((value) => script.test(value));
      assert.ok(
        matchingValues.length / localizedValues.length > 0.55,
        `${locale} does not contain enough text in its expected script`,
      );
    }
  }

  assert.equal(heroCopy.size, SUPPORTED_LOCALES.length, 'every locale needs distinct home copy');
});

test('ChatGPT quick guides separate web OAuth from server-side PAT use', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const guide = variants(MESSAGE_CATALOGS[locale]['settings.aiGuide.chatgpt']).join(' ');
    assert.match(guide, /OAuth/u, `${locale} ChatGPT guide must name the web OAuth route`);
    assert.match(guide, /PAT/u, `${locale} ChatGPT guide must warn about PAT handling`);
    assert.match(guide, /Responses API/u, `${locale} ChatGPT guide must reserve PAT use for an API client`);
  }

  assert.match(
    variants(MESSAGE_CATALOGS.en['settings.aiGuide.chatgpt']).join(' '),
    /do not paste a Girapphe PAT/u,
  );
});
