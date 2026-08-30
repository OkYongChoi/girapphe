import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [cardActionsSource, cardViewerSource] = await Promise.all([
  readFile(new URL('../src/actions/card-actions.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/card-viewer.tsx', import.meta.url), 'utf8'),
]);

test('practice graph state and evidence share one guarded secondary transaction', () => {
  const syncStart = cardActionsSource.indexOf('// Sync knowledge graph');
  const syncEnd = cardActionsSource.indexOf('} catch (knowledgeErr)', syncStart);
  assert.ok(syncStart > 0 && syncEnd > syncStart);
  const graphSync = cardActionsSource.slice(syncStart, syncEnd);
  assert.equal(
    (graphSync.match(/accountTransaction\(user\.id/g) ?? []).length,
    1,
  );
  assert.match(graphSync, /INSERT INTO user_knowledge_states/);
  assert.match(graphSync, /INSERT INTO user_knowledge_evidence/);
});

test('a practice rating advances through one client-facing server action', () => {
  const actionStart = cardActionsSource.indexOf('export async function rateCardAndAdvance');
  const actionEnd = cardActionsSource.indexOf('type GetAllCardsWithStatusOptions', actionStart);
  assert.ok(actionStart > 0 && actionEnd > actionStart);
  const actionSource = cardActionsSource.slice(actionStart, actionEnd);
  assert.match(actionSource, /return runPracticeAdvance\(\{/);
  assert.match(actionSource, /loadNext: \(ids\) => getNextCard/);
  assert.match(actionSource, /loadStats: \(\) => getUserStats\(\)/);
  assert.match(cardViewerSource, /await rateCardAndAdvance\(\{/);
  assert.doesNotMatch(cardViewerSource, /await saveCardState\(/);
});

test('disabled drill generation does not repeat the exhausted card query', () => {
  const exhaustedStart = cardActionsSource.indexOf('// If the user has exhausted all "new" candidates');
  const retryStart = cardActionsSource.indexOf('const retryRes = await pool.query', exhaustedStart);
  assert.ok(exhaustedStart > 0 && retryStart > exhaustedStart);
  const exhaustion = cardActionsSource.slice(exhaustedStart, retryStart);
  const disabledGuard = exhaustion.indexOf('if (!ALLOW_DRILL_CARDS) return null;');
  const generate = exhaustion.indexOf('await ensureMoreGeneratedCards(1);');
  assert.ok(disabledGuard >= 0 && disabledGuard < generate);
});
