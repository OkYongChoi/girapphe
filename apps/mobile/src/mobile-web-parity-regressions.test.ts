import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createPublicConceptDraftLocalizationGuard,
  resolvePublicConceptCopyContinuation,
  resolvePublicConceptDraft,
  withTrustedLocalizedPublicConceptContent,
} from './public-concept-copy';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const mobileApiSource = readFileSync(join(sourceDir, 'api.ts'), 'utf8');
const mobileRouteSource = readFileSync(join(sourceDir, '../../web/src/app/api/mobile/route.ts'), 'utf8');
const rootLayoutSource = readFileSync(join(sourceDir, '../app/_layout.tsx'), 'utf8');
const notesSource = readFileSync(join(sourceDir, '../app/(tabs)/notes.tsx'), 'utf8');
const rankingSource = readFileSync(join(sourceDir, '../app/(tabs)/ranking.tsx'), 'utf8');
const signInSource = readFileSync(join(sourceDir, '../app/sign-in.tsx'), 'utf8');
const topicDetailSource = readFileSync(join(sourceDir, '../app/topic/[id].tsx'), 'utf8');
const publicConceptCopySource = readFileSync(join(sourceDir, 'public-concept-copy.ts'), 'utf8');
const topicsScreenPath = join(sourceDir, '../app/knowledge-topics.tsx');

test('mobile exposes the owner-scoped Topic index and a route from My Notes', () => {
  assert.match(mobileApiSource, /export type MobileTopicSummary = \{/);
  assert.match(mobileApiSource, /topics: \(\) => request<\{ topics: MobileTopicSummary\[\] \}>/);
  assert.match(
    mobileRouteSource,
    /case 'topics':[\s\S]*?privateJson\(\{ topics: await getActiveKnowledgeTopicSummariesForUser\(mobileUser\.id\) \}\)/,
  );
  assert.match(rootLayoutSource, /Stack\.Screen name="knowledge-topics"/);
  assert.match(notesSource, /router\.push\('\/knowledge-topics'\)/);
  assert.equal(existsSync(topicsScreenPath), true);
  const topicsScreenSource = readFileSync(topicsScreenPath, 'utf8');
  assert.match(
    topicsScreenSource,
    /<AuthRequired continuation=\{\{ destination: 'topics' \}\}><TopicsContent \/><\/AuthRequired>/,
  );
  assert.match(topicsScreenSource, /<FlatList/);
  assert.match(topicsScreenSource, /accessibilityRole="link"/);
  const topicAccessibilityLabel = topicsScreenSource.match(
    /accessibilityLabel=\{\[([\s\S]*?)\]\.join\('\. '\)\}/,
  )?.[1] ?? '';
  for (const field of [
    'item.item_count',
    'item.open_question_count',
    'item.decision_count',
    'item.event_count',
    'item.source_count',
    '...item.sample_titles',
    'item.last_updated_at',
  ]) {
    assert.ok(topicAccessibilityLabel.includes(field), `Topics accessibility label includes ${field}`);
  }
  assert.match(topicsScreenSource, /pathname: '\/knowledge-topic\/\[topic\]'/);
});

test('mobile ranking preserves anonymous participant identity and identifies the current user', () => {
  assert.match(mobileRouteSource, /rank: row\.rank,[\s\S]*?label: `Learner \$\{row\.rank\}`/);
  assert.match(
    mobileRouteSource,
    /case 'ranking':[\s\S]*?return privateJson\([\s\S]*?participantId: row\.participantId[\s\S]*?isCurrentUser: row\.isCurrentUser/,
  );
  assert.match(mobileApiSource, /label: string;[\s\S]*?participantId: string;[\s\S]*?isCurrentUser: boolean/);
  assert.match(rankingSource, /item\.isCurrentUser \? t\('ranking\.you'\) : t\('ranking\.user'/);
  assert.match(rankingSource, /styles\.currentUserRow/);
  assert.match(rankingSource, /<View\s+accessible\s+accessibilityLabel=\{t\('ranking\.rowA11y'/);
  assert.match(rankingSource, /const loadRequest = useRef\(0\)/);
  assert.match(
    rankingSource,
    /const request = \+\+loadRequest\.current;[\s\S]*?const nextRows = \(await mobileApi\.ranking\(\)\)\.rows;[\s\S]*?if \(request === loadRequest\.current\) setRows\(nextRows\)/,
  );
  assert.match(
    rankingSource,
    /catch \(reason\) \{[\s\S]*?if \(request === loadRequest\.current\)[\s\S]*?setError\(/,
  );
  assert.match(
    rankingSource,
    /finally \{[\s\S]*?if \(request === loadRequest\.current\) setLoading\(false\)/,
  );
  assert.match(
    rankingSource,
    /useFocusEffect\(useCallback\(\(\) => \{[\s\S]*?void load\(\);[\s\S]*?return \(\) => \{[\s\S]*?loadRequest\.current \+= 1;[\s\S]*?\};[\s\S]*?\}, \[load, locale\]\)\)/,
  );
});

test('a public concept can be reviewed as a prefilled private-copy draft on mobile', () => {
  assert.match(topicDetailSource, /topic\.savePrivateCopy/);
  assert.match(topicDetailSource, /pathname: '\/\(tabs\)\/notes'/);
  assert.match(topicDetailSource, /draftSourceId:/);
  assert.match(topicDetailSource, /continueAction: 'copy-public-concept'/);
  assert.doesNotMatch(topicDetailSource, /draftTitle:|draftSummary:|draftContent:/);
  assert.match(signInSource, /resolvePublicConceptCopyContinuation\(continuationParams\)/);
  assert.match(signInSource, /pathname: '\/\(tabs\)\/notes'/);
  assert.doesNotMatch(signInSource, /router\.replace\('\/'\)/);
  const finalizeSignIn = signInSource.match(
    /async function finalizeSignIn\(\): Promise<boolean> \{([\s\S]*?)\n {2}\}/,
  )?.[1] ?? '';
  const finalizeSignUp = signInSource.match(
    /async function finalizeSignUp\(\): Promise<boolean> \{([\s\S]*?)\n {2}\}/,
  )?.[1] ?? '';
  assert.match(finalizeSignIn, /navigateAfterAuthentication\(\)/);
  assert.match(finalizeSignUp, /navigateAfterAuthentication\(\)/);
  assert.match(notesSource, /useLocalSearchParams/);
  assert.match(notesSource, /resolvePublicConceptDraft\(/);
  assert.match(notesSource, /mobileApi\.content\(\[publicCopyDraft\.sourceId\]\)/);
  assert.match(notesSource, /withTrustedLocalizedPublicConceptContent\(/);
  assert.ok(
    notesSource.indexOf('setTitle(publicCopyDraft.title)') < notesSource.indexOf('mobileApi.content([publicCopyDraft.sourceId])'),
    'the validated bundled draft is installed before optional localization starts',
  );
  assert.match(notesSource, /publicCopyDraftLocalizationGuard\.current\.isCurrent\(localizationRevision\)/);
  assert.match(notesSource, /consumedDraftKey\.current === draftKey/);
  assert.match(notesSource, /router\.setParams\(\{ draftKey: '', draftSourceId: '' \}\)/);
  assert.match(notesSource, /setCopyDraftSourceId\(publicCopyDraft\.sourceId\)/);
  assert.match(notesSource, /t\('notes\.copyDraftNotice'\)/);
  assert.match(publicConceptCopySource, /getAccessiblePublicNodeById\(route\.sourceId, fullPublicMap\)/);
  assert.doesNotMatch(topicDetailSource, /action: 'create-note'/);

  const trusted = resolvePublicConceptDraft({
    draftKey: 'trusted-copy',
    draftSourceId: 'engineering_science',
  });
  assert.ok(trusted);
  assert.equal(trusted.sourceId, 'engineering_science');

  const injectedRoute = {
    draftKey: 'trusted-copy',
    draftSourceId: 'engineering_science',
    draftTitle: 'Spoofed by a deep link',
    draftContent: 'Untrusted attacker content',
  };
  const resolvedInjectedRoute = resolvePublicConceptDraft(injectedRoute);
  assert.deepEqual(resolvedInjectedRoute, trusted);
  assert.notEqual(resolvedInjectedRoute?.title, injectedRoute.draftTitle);
  assert.notEqual(resolvedInjectedRoute?.content, injectedRoute.draftContent);
  assert.equal(resolvePublicConceptDraft({
    draftKey: 'unknown-copy',
    draftSourceId: 'not-a-public-node',
  }), null);

  assert.deepEqual(resolvePublicConceptCopyContinuation({
    continueAction: 'copy-public-concept',
    draftKey: 'trusted-copy',
    draftSourceId: 'engineering_science',
  }), { draftKey: 'trusted-copy', sourceId: 'engineering_science' });
  assert.equal(resolvePublicConceptCopyContinuation({
    continueAction: 'https://attacker.invalid',
    draftKey: 'trusted-copy',
    draftSourceId: 'engineering_science',
  }), null);

  const localized = withTrustedLocalizedPublicConceptContent(trusted, {
    id: trusted.sourceId,
    label: '工学科学',
    summary: '信頼された日本語の要約',
    explanation: '信頼された日本語の説明',
  });
  assert.equal(localized.title, '工学科学');
  assert.equal(localized.summary, '信頼された日本語の要約');
  assert.equal(localized.content, '信頼された日本語の説明');
  assert.deepEqual(withTrustedLocalizedPublicConceptContent(trusted, {
    id: 'different-public-node',
    label: 'Spoofed mismatch',
  }), trusted);

  const localizationGuard = createPublicConceptDraftLocalizationGuard();
  const draftRevision = localizationGuard.begin();
  assert.equal(localizationGuard.isCurrent(draftRevision), true);
  localizationGuard.invalidate();
  assert.equal(localizationGuard.isCurrent(draftRevision), false);
});
