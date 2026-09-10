import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const mobileApi = readFileSync(join(sourceDir, 'api.ts'), 'utf8');
const mobileRoute = readFileSync(
  join(sourceDir, '../../web/src/app/api/mobile/route.ts'),
  'utf8',
);
const practiceHandler = readFileSync(
  join(sourceDir, '../../web/src/lib/mobile-practice-handler.ts'),
  'utf8',
);
const practiceContract = readFileSync(
  join(sourceDir, '../../web/src/lib/mobile-practice-contract.ts'),
  'utf8',
);
const webPackageJson = readFileSync(
  join(sourceDir, '../../web/package.json'),
  'utf8',
);

test('native Practice sends its opaque cursor in a bounded POST body, not the URL', () => {
  const practiceClient = mobileApi.match(
    /practice: \(mode:[\s\S]*?\n {2}saved:/,
  )?.[0] ?? '';
  assert.match(practiceClient, /const body: MobilePracticeRequest = \{ mode, cursor, cycleOnEmpty \}/);
  assert.match(practiceClient, /request<MobilePracticeResponse<MobileCard>>/);
  assert.match(practiceClient, /withLocale\(['"]\/api\/mobile\?resource=practice['"]\)/);
  assert.match(practiceClient, /method: 'POST'/);
  assert.match(practiceClient, /JSON\.stringify\(body\)/);
  assert.doesNotMatch(practiceClient, /&exclude=/);
  assert.doesNotMatch(practiceClient, /excludeIds/);
});

test('server authenticates before delegating Practice POST to the bounded handler', () => {
  const postStart = mobileRoute.indexOf('export async function POST');
  assert.notEqual(postStart, -1, 'POST handler must exist');
  const postHandler = mobileRoute.slice(postStart);
  const practiceBranch = mobileRoute.match(
    /if \(request\.nextUrl\.searchParams\.get\('resource'\) === 'practice'\) \{([\s\S]*?)\n {2}\}\n\n {2}const parsedBody = await readBody/,
  )?.[1] ?? '';
  const authentication = postHandler.indexOf('requireMobileUser()');
  const practiceDispatch = postHandler.indexOf("resource') === 'practice'");
  assert.notEqual(authentication, -1, 'POST authentication must exist');
  assert.notEqual(practiceDispatch, -1, 'Practice dispatch must exist');
  assert.ok(authentication < practiceDispatch);
  assert.match(practiceBranch, /return handleMobilePracticePost\(request/);
  assert.match(practiceHandler, /readBoundedJson\(request, MAX_MOBILE_PRACTICE_BODY_BYTES\)/);
  assert.match(practiceHandler, /decodeMobilePracticeCursor\(input\.cursor, input\.mode\)/);
  assert.match(practiceHandler, /nextCursor: next\.nextCursor \? encodeMobilePracticeCursor/);
  assert.match(practiceHandler, /'Cache-Control': 'private, no-store'/);
  assert.doesNotMatch(practiceHandler, /privateResponse/);
});

test('web server test script preserves main and mobile-practice test unions', () => {
  for (const testPath of [
    'src/lib/knowledge-tag-normalization.test.ts',
    'src/lib/knowledge-tag-suggestions.test.ts',
    'src/lib/mobile-practice-contract.test.ts',
    'src/lib/mobile-practice-cursor.test.ts',
    'src/lib/mobile-practice-handler.test.ts',
    'src/lib/mobile-practice-selector.test.ts',
  ]) {
    assert.match(webPackageJson, new RegExp(testPath.replaceAll('.', '\\.')));
  }
});

test('legacy Practice GET fails explicitly instead of silently truncating exclusions', () => {
  assert.match(mobileRoute, /parseLegacyMobilePracticeExcludeIds\(legacyExcludeIds\)/);
  assert.match(mobileRoute, /PRACTICE_EXCLUSIONS_TOO_LARGE/);
  assert.match(mobileRoute, /INVALID_PRACTICE_EXCLUSIONS/);
  assert.doesNotMatch(mobileRoute, /slice\(0, 100\)/);
  assert.match(practiceContract, /MAX_LEGACY_MOBILE_PRACTICE_EXCLUDE_IDS = 100/);
  assert.match(practiceContract, /values\.length > MAX_LEGACY_MOBILE_PRACTICE_EXCLUDE_IDS/);
});

test('saved cards carry authoritative reviewable stats in the same response', () => {
  assert.match(mobileRoute, /case 'saved':[\s\S]*?Promise\.all\(\[[\s\S]*?getSavedCards\(locale\)[\s\S]*?getUserStats\(\)[\s\S]*?privateJson\(\{[\s\S]*?stats/);
  assert.match(mobileApi, /saved: \(\) => request<\{ cards: MobileCard\[\]; stats: MobilePracticeStats \}>/);
});
