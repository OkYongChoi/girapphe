import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GRAPH_NODES } from '@stem-brain/graph-engine';
import { CARD_CONTENT } from '@stem-brain/graph-engine/card-content';
import { localizeDomain, localizeLevel, localizeType } from '@stem-brain/shared';
import { selectContentCursorBatch } from './content-localization-cursor';
import {
  maskProtectedContent,
  parseContentLocale,
  ProtectedContentError,
  restoreProtectedContent,
  splitContentForTranslation,
} from './content-translation-guards';
import { normalizeKnowledgeTopic } from './topic-normalization';

test('public card reads cannot request AI translation generation', () => {
  const source = readFileSync(new URL('../actions/card-actions.ts', import.meta.url), 'utf8');
  const publicRead = source.slice(
    source.indexOf('type GetAllCardsWithStatusOptions'),
    source.indexOf('export async function getKnowledgeMapCardPage'),
  );
  assert.doesNotMatch(publicRead, /generateTranslations|maxTranslationGenerations/);
  assert.match(publicRead, /generateMissing: false/);
});

test('public home and guest graph reads avoid eager full-catalog server work', () => {
  const homeSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const cardActionsSource = readFileSync(new URL('../actions/card-actions.ts', import.meta.url), 'utf8');

  assert.match(homeSource, /import\('\@\/lib\/home-personalization'\)/);
  assert.doesNotMatch(homeSource, /import \{[^}]*getUserStats[^}]*\} from '\@\/actions\/card-actions'/);
  assert.match(cardActionsSource, /function getGuestMockCards\(\)/);
  assert.match(cardActionsSource, /return isGuest \? getGuestMockCards\(\) : getMockCards\(\)/);
});

test('normalizes only supported content locales', () => {
  assert.equal(parseContentLocale('ja-JP'), 'ja');
  assert.equal(parseContentLocale('zh_Hans'), 'zh-CN');
  assert.equal(parseContentLocale('es-MX'), 'es');
  assert.equal(parseContentLocale('ko'), null);
});

test('keeps Unicode letters and marks in explicit topic tags', () => {
  assert.equal(normalizeKnowledgeTopic('  機械 学習!  '), '機械-学習');
  assert.equal(normalizeKnowledgeTopic('الذكاء الاصطناعي'), 'الذكاء-الاصطناعي');
  assert.equal(normalizeKnowledgeTopic('हिन्दी विषय'), 'हिन्दी-विषय');
});

test('provides deterministic localized taxonomy when machine content is unavailable', () => {
  assert.equal(localizeDomain('ja', 'Linear Algebra'), '線形代数');
  assert.equal(localizeDomain('zh-CN', 'Probability & Statistics'), '概率与统计');
  assert.equal(localizeDomain('ja', 'IoT'), 'モノのインターネット');
  assert.equal(localizeType('ar', 'theorem'), 'مبرهنة');
  assert.equal(localizeLevel('hi', 'apply'), 'लागू करें');

  const domains = Array.from(new Set(GRAPH_NODES.map((node) => node.domain)));
  for (const locale of ['ja', 'zh-CN', 'es', 'ar', 'hi'] as const) {
    const untranslated = domains.filter(
      (domain) => localizeDomain(locale, domain) === localizeDomain('en', domain)
    );
    assert.deepEqual(untranslated, [], `${locale} is missing domain labels`);
  }
});

test('static-content backfill cursors cover full allowlists without database source rows', () => {
  const approvedCards = GRAPH_NODES
    .filter((node) => CARD_CONTENT[node.id]?.summary && CARD_CONTENT[node.id]?.explanation)
    .map((node) => ({ id: `graph_${node.id}` }));
  assert.ok(approvedCards.length > 600);

  const visited = new Set<string>();
  let after = '';
  let complete = false;
  while (!complete) {
    const batch = selectContentCursorBatch(approvedCards, after, 3);
    assert.ok(batch.items.length > 0);
    for (const card of batch.items) {
      assert.equal(visited.has(card.id), false);
      visited.add(card.id);
    }
    after = batch.nextCursor;
    complete = batch.complete;
  }

  assert.equal(visited.size, approvedCards.length);

  const visitedNodes = new Set<string>();
  after = '';
  complete = false;
  while (!complete) {
    const batch = selectContentCursorBatch(GRAPH_NODES, after, 8);
    assert.ok(batch.items.length > 0);
    for (const node of batch.items) {
      assert.equal(visitedNodes.has(node.id), false);
      visitedNodes.add(node.id);
    }
    after = batch.nextCursor;
    complete = batch.complete;
  }
  assert.equal(visitedNodes.size, GRAPH_NODES.length);
});

test('restores formulas, code, URLs and exact line structure', () => {
  const source = 'Use `softmax(x)` where p_i = e^x / Σe^x.\nSee https://example.com/a?q=1\nAPI_RESPONSE stays fixed.';
  const masked = maskProtectedContent(source);
  const simulatedTranslation = masked.masked.replace('Use', 'Utilice').replace('where', 'donde').replace('See', 'Consulte');
  const restored = restoreProtectedContent(simulatedTranslation, masked);

  assert.match(restored, /`softmax\(x\)`/);
  assert.match(restored, /p_i = e\^x/);
  assert.match(restored, /https:\/\/example\.com\/a\?q=1/);
  assert.equal(restored.match(/\n/g)?.length, 2);
});

test('preserves explicit chemistry, unit, and fenced-code notation byte-for-byte', () => {
  const source = 'Balance \\(\\ce{2H2 + O2 -> 2H2O}\\) with \\(\\pu{5 mol}\\).\n```ts\nconst amount = 5;\n```';
  const masked = maskProtectedContent(source);
  const protectedValues = masked.placeholders.map((placeholder) => placeholder.value);

  assert.ok(protectedValues.includes('\\(\\ce{2H2 + O2 -> 2H2O}\\)'));
  assert.ok(protectedValues.includes('\\(\\pu{5 mol}\\)'));
  assert.ok(protectedValues.includes('```ts\nconst amount = 5;\n```'));
  assert.equal(restoreProtectedContent(masked.masked.replace('Balance', 'Equilibre'), masked), source.replace('Balance', 'Equilibre'));
});

test('preserves unquoted commands, flags, property paths and file paths', () => {
  const source = 'Run npm install, then keep process.env.API_KEY, --frozen-lockfile, src/lib/foo.ts, ./scripts/check.sh, and C:\\repo\\file.ts.';
  const masked = maskProtectedContent(source);
  const protectedValues = masked.placeholders.map((placeholder) => placeholder.value);

  assert.ok(protectedValues.some((value) => value.startsWith('npm install')));
  assert.ok(protectedValues.includes('process.env.API_KEY'));
  assert.ok(protectedValues.includes('--frozen-lockfile'));
  assert.ok(protectedValues.includes('src/lib/foo.ts'));
  assert.ok(protectedValues.includes('./scripts/check.sh'));
  assert.ok(protectedValues.some((value) => value.startsWith('C:\\repo\\file.ts')));

  const translated = masked.masked.replace('Run', 'Ejecute').replace('then keep', 'luego conserve');
  assert.equal(restoreProtectedContent(translated, masked), source.replace('Run', 'Ejecute').replace('then keep', 'luego conserve'));
});

test('rejects a translation that corrupts a protected token', () => {
  const masked = maskProtectedContent('Formula: y = mx + b');
  assert.ok(masked.placeholders.some((placeholder) => placeholder.value === 'y = mx + b'));
  const corrupted = masked.masked.replace(masked.placeholders[0].token, '');
  assert.throws(() => restoreProtectedContent(corrupted, masked), ProtectedContentError);
});

test('translation chunks concatenate to the exact source', () => {
  const source = `${'A sentence with prose. '.repeat(160)}\n${'B'.repeat(900)}`;
  const chunks = splitContentForTranslation(source, 500);
  assert.equal(chunks.join(''), source);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 500));
});

test('chunking never cuts a masked long code or formula span', () => {
  const source = `Translate this introduction.\n\`\`\`ts\n${'const x = formula();\n'.repeat(300)}\`\`\`\nThen explain $y = mx + b$.`;
  const masked = maskProtectedContent(source);
  const tokens = masked.placeholders.map((placeholder) => placeholder.token);
  const chunks = splitContentForTranslation(masked.masked, 80, tokens);

  assert.equal(chunks.join(''), masked.masked);
  for (const token of tokens) {
    assert.equal(chunks.filter((chunk) => chunk.includes(token)).length, 1);
  }
  assert.equal(restoreProtectedContent(chunks.join(''), masked), source);
});
