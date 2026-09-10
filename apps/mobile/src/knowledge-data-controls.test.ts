import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildKnowledgeDataControlsHandoffUrl,
  KNOWLEDGE_DATA_CONTROLS_HANDOFF_PATH,
} from './knowledge-data-controls';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const accountSource = readFileSync(join(sourceDir, '../app/(tabs)/account.tsx'), 'utf8');
const apiClientSource = readFileSync(join(sourceDir, 'api.ts'), 'utf8');
const mobileRouteSource = readFileSync(join(sourceDir, '../../web/src/app/api/mobile/route.ts'), 'utf8');
const rootLayoutSource = readFileSync(join(sourceDir, '../app/_layout.tsx'), 'utf8');
const screenSource = readFileSync(join(sourceDir, '../app/knowledge-data-controls.tsx'), 'utf8');
const handoffPageSource = readFileSync(
  join(sourceDir, '../../web/src/app/account/data-controls-handoff/page.tsx'),
  'utf8',
);

test('builds a fixed handoff on the configured web origin and rejects unsafe bases', () => {
  assert.equal(KNOWLEDGE_DATA_CONTROLS_HANDOFF_PATH, '/account/data-controls-handoff');
  assert.equal(
    buildKnowledgeDataControlsHandoffUrl('https://www.girapphe.com/base?query=ignored#ignored'),
    'https://www.girapphe.com/account/data-controls-handoff',
  );
  assert.equal(
    buildKnowledgeDataControlsHandoffUrl('http://localhost:3000/'),
    'http://localhost:3000/account/data-controls-handoff',
  );
  assert.equal(buildKnowledgeDataControlsHandoffUrl('javascript:alert(1)'), null);
  assert.equal(buildKnowledgeDataControlsHandoffUrl('https://user:pass@example.com'), null);
  assert.equal(buildKnowledgeDataControlsHandoffUrl('not a URL'), null);
  assert.equal(buildKnowledgeDataControlsHandoffUrl(undefined), null);
});

test('Account exposes authenticated native data controls with deletion safeguards', () => {
  assert.match(accountSource, /account\.knowledgeDataControls[\s\S]*?router\.push\('\/knowledge-data-controls'\)/);
  assert.match(rootLayoutSource, /Stack\.Screen name="knowledge-data-controls"/);
  assert.match(
    screenSource,
    /<AuthRequired continuation=\{\{ destination: 'knowledge-data-controls' \}\}>/,
  );
  assert.match(screenSource, /mobileApi\.knowledgeDataControls\(targetPage\)/);
  assert.match(screenSource, /mobileApi\.deleteKnowledgeImportBatch\(job\.id\)/);
  assert.match(screenSource, /Alert\.alert\([\s\S]*?style: 'destructive'/);
  assert.match(screenSource, /approvedKnowledgePreserved/);
  assert.match(screenSource, /accessibilityLiveRegion="polite"/);
  assert.match(
    screenSource,
    /exportError \|\| !dataControlsUrl \? \([\s\S]*?accessibilityRole="alert"[\s\S]*?dataControls\.exportError/,
  );
  assert.match(
    screenSource,
    /<View style=\{styles\.errorCard\}>[\s\S]*?<Text accessibilityRole="alert" accessibilityLiveRegion="assertive"[\s\S]*?<Pressable[\s\S]*?accessibilityRole="button"/,
  );
  assert.match(screenSource, /deleteButton: \{ minHeight: 44/);
  assert.match(screenSource, /pageButton: \{ minHeight: 44/);
  assert.match(screenSource, /statusLabel\(job\.status\)/);
  assert.match(screenSource, /total: formatNumber\(job\.draft_count\)/);
  assert.match(screenSource, /ListEmptyComponent=\{!loading && !listError/);
  assert.match(screenSource, /disabled: deletingId !== null \|\| loading/);
  assert.match(screenSource, /if \(deletingIdRef\.current\) return;/);
  assert.match(screenSource, /if \(pageIntent\.current === deletionPage\)/);
  assert.match(screenSource, /disabled=\{loading \|\| deletingId !== null \|\| page <= 1\}/);
  assert.match(screenSource, /disabled=\{loading \|\| deletingId !== null \|\| !hasNextPage\}/);
});

test('mobile API lists only bounded owner-scoped import-job metadata and deletes idempotently', () => {
  const listStart = mobileRouteSource.indexOf("case 'knowledge-data-controls'");
  const listEnd = mobileRouteSource.indexOf("case 'candidate-inbox'", listStart);
  const listHandler = mobileRouteSource.slice(listStart, listEnd);
  assert.ok(listStart >= 0 && listEnd > listStart);
  assert.match(listHandler, /parseDataControlsPage/);
  assert.match(listHandler, /const pageSize = 50/);
  assert.match(listHandler, /getKnowledgeDraftBatchesForUser\(mobileUser\.id, true/);
  assert.match(listHandler, /limit: pageSize \+ 1/);
  assert.match(listHandler, /offset: \(page - 1\) \* pageSize/);
  assert.match(listHandler, /batches\.slice\(0, pageSize\)\.map/);
  assert.match(listHandler, /hasNextPage: batches\.length > pageSize/);
  assert.match(listHandler, /return privateJson\(\{/);
  assert.doesNotMatch(listHandler, /source_url|conversation_ref|request_id/);

  const deleteStart = mobileRouteSource.indexOf("if (action === 'delete-import-batch')");
  const deleteEnd = mobileRouteSource.indexOf("if (action === 'approve-candidate'", deleteStart);
  const deleteHandler = mobileRouteSource.slice(deleteStart, deleteEnd);
  assert.ok(deleteStart >= 0 && deleteEnd > deleteStart);
  assert.match(deleteHandler, /deleteKnowledgeImportBatchForUser\(mobileUser\.id, batchId\)/);
  assert.match(
    deleteHandler,
    /return privateJson\((?:await )?deleteKnowledgeImportBatchForUser\(mobileUser\.id, batchId\)\)/,
  );
  assert.doesNotMatch(deleteHandler, /\.test\(batchId\)/);
  assert.match(mobileRouteSource, /headers\.set\('Cache-Control', 'private, no-store'\)/);
  assert.match(mobileRouteSource, /headers\.set\('X-Content-Type-Options', 'nosniff'\)/);
  assert.match(mobileRouteSource, /headers\.set\('Vary', 'Cookie, Authorization'\)/);

  assert.match(apiClientSource, /knowledgeDataControls: \(page = 1\)[\s\S]*?resource=knowledge-data-controls/);
  assert.match(
    apiClientSource,
    /deleteKnowledgeImportBatch: \(batchId: string\)[\s\S]*?action: 'delete-import-batch', batchId/,
  );
});

test('complete export uses a fixed authenticated web destination without URL credentials', () => {
  assert.match(screenSource, /buildKnowledgeDataControlsHandoffUrl/);
  assert.match(screenSource, /Linking\.openURL\(dataControlsUrl\)/);
  assert.doesNotMatch(screenSource, /getToken\(|Authorization:|Bearer \$\{/);

  assert.match(handoffPageSource, /export const dynamic = 'force-dynamic'/);
  assert.match(handoffPageSource, /if \(!user\) redirect\(accountSwitchDestination\)/);
  assert.match(handoffPageSource, /getServerI18n/);
  assert.match(handoffPageSource, /account\.dataControlsHandoff\.title/);
  assert.match(handoffPageSource, /user\.email \|\| user\.id/);
  assert.match(handoffPageSource, /account\.dataControlsHandoff\.bodyAfterIdentity/);
  assert.match(handoffPageSource, /<LogoutButton/);
  assert.match(
    handoffPageSource,
    /encodeURIComponent\('\/account\/data-controls-handoff'\)/,
  );
  assert.doesNotMatch(handoffPageSource, /searchParams|returnTo\?:/);
});
