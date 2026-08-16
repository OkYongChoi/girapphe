import assert from 'node:assert/strict';
import { catalogs } from '../src/i18n/catalogs.ts';

const locales = ['en', 'ja', 'zh-CN', 'es', 'ar', 'hi'];
const scripts = {
  ja: /[\u3040-\u30ff]/u,
  'zh-CN': /[\u4e00-\u9fff]/u,
  es: /[áéíóúüñ¿¡]/iu,
  ar: /[\u0600-\u06ff]/u,
  hi: /[\u0900-\u097f]/u,
};
const artifact = /__(?:GPHOLD|PLACEHOLDER|PROTECTED)_[A-Za-z0-9_]*__/u;

function placeholders(message) {
  return [...message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
    .map((match) => match[1])
    .sort();
}

const englishKeys = Object.keys(catalogs.en).sort();
assert.deepEqual(Object.keys(catalogs).sort(), [...locales].sort());

for (const locale of locales) {
  const catalog = catalogs[locale];
  const keys = Object.keys(catalog).sort();
  assert.deepEqual(keys, englishKeys, `${locale} must have exactly the English message keys`);

  let identical = 0;
  for (const key of englishKeys) {
    const message = catalog[key];
    assert.equal(typeof message, 'string', `${locale}.${key} must be a string`);
    assert.ok(message.trim(), `${locale}.${key} must not be blank`);
    assert.doesNotMatch(message, artifact, `${locale}.${key} contains a generator artifact`);
    assert.deepEqual(
      placeholders(message),
      placeholders(catalogs.en[key]),
      `${locale}.${key} must preserve placeholders`,
    );
    if (locale !== 'en' && message === catalogs.en[key]) identical += 1;
  }

  if (locale !== 'en') {
    assert.match(Object.values(catalog).join(' '), scripts[locale], `${locale} must use its expected script`);
    assert.ok(
      identical / englishKeys.length < 0.15,
      `${locale} contains too much unchanged English (${identical}/${englishKeys.length})`,
    );
  }
}

globalThis.console.log(
  `Mobile localization catalogs verified: ${locales.length} locales, ${englishKeys.length} keys each.`,
);
