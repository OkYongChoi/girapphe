import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const navLinksSource = await readFile(
  new URL('../src/components/nav-links.tsx', import.meta.url),
  'utf8',
);
const navbarSource = await readFile(
  new URL('../src/components/navbar.tsx', import.meta.url),
  'utf8',
);
const graphSource = await readFile(
  new URL('../src/components/knowledge-graph-3d.tsx', import.meta.url),
  'utf8',
);
const headersSource = await readFile(
  new URL('../public/_headers', import.meta.url),
  'utf8',
);

test('primary navigation prefetches localized inactive routes only on user intent', () => {
  const navItemsStart = navLinksSource.indexOf('{NAV_ITEMS.filter');
  const adminLinkStart = navLinksSource.indexOf('{isAdmin ?', navItemsStart);
  assert.notEqual(navItemsStart, -1);
  assert.notEqual(adminLinkStart, -1);
  const navItemsMarkup = navLinksSource.slice(navItemsStart, adminLinkStart);

  assert.match(navLinksSource, /const localizedHref = localizePathname\(item\.href, locale\);/);
  assert.match(navLinksSource, /router\.prefetch\(href\);/);
  assert.match(navItemsMarkup, /prefetch=\{false\}/);
  assert.match(
    navItemsMarkup,
    /onMouseEnter=\{active \? undefined : \(\) => prefetchOnIntent\(localizedHref\)\}/,
  );
  assert.match(
    navItemsMarkup,
    /onFocus=\{active \? undefined : \(\) => prefetchOnIntent\(localizedHref\)\}/,
  );
});

test('shared home and auth links do not prefetch dynamic routes on every page', () => {
  for (const href of ['/', '/login', '/signup']) {
    assert.match(
      navbarSource,
      new RegExp(`<LocalizedLink href="${href.replace('/', '\\/')}" prefetch=\\{false\\}`),
    );
  }
});

test('knowledge graph destination links prefetch only on user intent', () => {
  assert.ok((graphSource.match(/prefetch=\{false\}/g) ?? []).length >= 3);
  for (const href of ['/subscription', '/practice', '/']) {
    assert.match(graphSource, new RegExp(`prefetchOnIntent\\('${href.replace('/', '\\/')}'\\)`));
  }
});

test('Cloudflare caches only Next fingerprinted static assets as immutable for one year', () => {
  assert.deepEqual(headersSource.trim().split(/\r?\n/), [
    '/_next/static/*',
    '  Cache-Control: public, max-age=31536000, immutable',
  ]);
});
