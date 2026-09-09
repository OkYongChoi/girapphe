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
  const postHandler = mobileRoute.slice(mobileRoute.indexOf('export async function POST'));
  const practiceBranch = mobileRoute.match(
    /if \(request\.nextUrl\.searchParams\.get\('resource'\) === 'practice'\) \{([\s\S]*?)\n {2}\}\n\n {2}const parsedBody = await readBody/,
  )?.[1] ?? '';
  assert.ok(postHandler.indexOf('requireMobileUser()') < postHandler.indexOf("resource') === 'practice'"));
  assert.match(practiceBranch, /return handleMobilePracticePost\(request/);
  assert.match(practiceHandler, /readBoundedJson\(request, MAX_MOBILE_PRACTICE_BODY_BYTES\)/);
  assert.match(practiceHandler, /decodeMobilePracticeCursor\(input\.cursor, input\.mode\)/);
  assert.match(practiceHandler, /nextCursor: next\.nextCursor \? encodeMobilePracticeCursor/);
  assert.match(practiceHandler, /privateResponse/);
});

test('legacy Practice GET fails explicitly instead of silently truncating exclusions', () => {
  assert.match(mobileRoute, /parseLegacyMobilePracticeExcludeIds\(legacyExcludeIds\)/);
  assert.match(mobileRoute, /MAX_LEGACY_MOBILE_PRACTICE_EXCLUDE_IDS/);
  assert.match(mobileRoute, /PRACTICE_EXCLUSIONS_TOO_LARGE/);
  assert.doesNotMatch(mobileRoute, /slice\(0, 100\)/);
});

test('saved cards carry authoritative reviewable stats in the same response', () => {
  assert.match(mobileRoute, /case 'saved':[\s\S]*?Promise\.all\(\[[\s\S]*?getSavedCards\(locale\)[\s\S]*?getUserStats\(\)[\s\S]*?privateJson\(\{[\s\S]*?stats/);
  assert.match(mobileApi, /saved: \(\) => request<\{ cards: MobileCard\[\]; stats: MobilePracticeStats \}>/);
});
