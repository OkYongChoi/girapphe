import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const specUrl = new URL(
  '../e2e-authenticated/authenticated-mobile-api.spec.ts',
  import.meta.url,
);
const configUrl = new URL('../../../playwright.authenticated.config.ts', import.meta.url);
const packageUrl = new URL('../../../package.json', import.meta.url);
const routeUrl = new URL('../src/app/api/mobile/route.ts', import.meta.url);

test('deployed mobile API evidence is isolated, owner-scoped, and cleanup-bound', async () => {
  const [source, config, packageSource, route] = await Promise.all([
    fs.readFile(specUrl, 'utf8'),
    fs.readFile(configUrl, 'utf8'),
    fs.readFile(packageUrl, 'utf8'),
    fs.readFile(routeUrl, 'utf8'),
  ]);

  const desktopProject = config.indexOf("name: 'authenticated-desktop'");
  const mobileProject = config.indexOf("name: 'authenticated-mobile'");
  assert.ok(desktopProject >= 0 && mobileProject > desktopProject);
  assert.doesNotMatch(config.slice(desktopProject, mobileProject), /mobile-api/);
  assert.match(config.slice(mobileProject), /testMatch:[\s\S]{0,240}mobile-api/);

  assert.match(source, /resolveAuthenticatedOverlayAuthMode\(\)/);
  assert.match(source, /projectName !== 'authenticated-mobile'[\s\S]{0,160}AUTHENTICATED_OVERLAY_AUTH_MODES\.testingToken/);
  assert.match(source, /cache-control[\s\S]{0,120}PRIVATE_CACHE/);
  assert.match(source, /E2E_MOBILE_API_\$\{randomBytes\(16\)\.toString\('hex'\)\}/);
  assert.match(source, /try \{[\s\S]*\} catch \(error\) \{[\s\S]{0,120}evidenceError = error;[\s\S]{0,80}\} finally \{[\s\S]{0,500}cleanupAuthenticatedMobileApiFixture/);
  assert.match(source, /expect\(cleanup\.remainingRows\)\.toBe\(0\)[\s\S]{0,120}evidence\.cleanup = true/);
  assert.match(source, /new AggregateError\(failures/);
  assert.match(source, /currentRows[\s\S]{0,220}fixture\.expectedParticipantId/);
  assert.match(source, /participantId[\s\S]{0,80}\^\[0-9a-f\]\{12\}\$/);
  assert.match(source, /test-results\/authenticated-overlay-performance\/mobile-api/);
  assert.match(source, /JSON\.stringify\(evidence, null, 2\)/);
  assert.doesNotMatch(source, /evidence\.(?:marker|userId|noteId|batchId|email|title)/);

  assert.equal((route.match(/NextResponse\.json/g) ?? []).length, 1);
  assert.match(route, /function privateJson[\s\S]{0,240}Cache-Control['"], 'private, no-store'/);
  assert.match(source, /postMobile\(page, createNotePayload\)[\s\S]{0,100}'create note',[\s\S]{0,40}201/);
  assert.match(source, /const editedRetryPayload = \{[\s\S]{0,800}\.\.\.createNotePayload,[\s\S]{0,800}edited-retry/);
  assert.match(source, /editedRetryPayload\.requestId\)\.toBe\(createNotePayload\.requestId\)/);
  assert.match(source, /postMobile\(page, editedRetryPayload\)[\s\S]{0,100}'replay edited create note',[\s\S]{0,40}200/);
  assert.match(source, /createdPayload\.outcome\)\.toBe\('inserted'\)/);
  assert.match(source, /replayedPayload\.outcome\)\.toBe\('replayed'\)/);
  assert.match(source, /matchingNotes[\s\S]{0,160}toHaveLength\(1\)/);
  assert.match(source, /created\?\.content\)\.toBe\('Definition\\nA temporary synthetic private note\.'\)/);
  assert.match(source, /created\?\.summary\)\.toBe\(createNotePayload\.summary\)[\s\S]{0,400}created\?\.structured_content\)\.toEqual\(createNotePayload\.structured_content\)/);
  assert.match(source, /expect\(version\)\.toBe\(1\)/);
  assert.match(source, /const staleApprove = await privateJson\([\s\S]{0,500}\), 'reject stale approved candidate', 409\)/);

  const packageJson = JSON.parse(packageSource);
  const runScript = packageJson.scripts['browser:authenticated-overlay'];
  assert.match(runScript, /playwright_status=\$\?/);
  assert.match(runScript, /summarize-authenticated-overlay-results\.mjs/);
  assert.match(runScript, /summary_status=\$\?/);
  assert.ok(
    runScript.indexOf('playwright_status=$?')
      < runScript.indexOf('summarize-authenticated-overlay-results.mjs'),
  );

  for (const contract of [
    "action: 'create-note'",
    "action: 'update-note'",
    "action: 'archive-note'",
    "action: 'restore-archived-note'",
    "action: 'delete-note'",
    "action: 'restore-note'",
    "resource=topics",
    "resource=topic-hub",
    "resource=ranking",
    "resource=practice",
    "resource=candidate-inbox",
    "resource=candidate-batch",
    "action: 'approve-candidate'",
    "action: 'ignore-candidate'",
    "'CANDIDATE_STALE'",
  ]) {
    assert.ok(source.includes(contract), `missing deployed mobile contract evidence: ${contract}`);
  }
});
