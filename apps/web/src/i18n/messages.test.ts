import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_LOCALES, type Locale } from '@stem-brain/shared';
import { MESSAGE_CATALOGS, type MessageValue } from './messages';

const SCRIPT_PATTERNS: Partial<Record<Locale, RegExp>> = {
  ja: /[\u3040-\u30ff]/u,
  'zh-CN': /[\u3400-\u9fff]/u,
  ar: /[\u0600-\u06ff]/u,
  hi: /[\u0900-\u097f]/u,
};

const GENERATOR_ARTIFACT_PATTERN = /__(?:GPHOLD|PLACEHOLDER|PROTECTED)_[A-Za-z0-9_]*__/u;

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
