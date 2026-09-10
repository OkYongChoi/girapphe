import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  draftDependencies,
  includeDraftDependencies,
  parseEvidenceSelectorIndexes,
} from './draft-review-selection';

test('parses evidence indexes from every localized comma without duplicates', () => {
  assert.deepEqual(parseEvidenceSelectorIndexes('0, 2، 2， 4'), [0, 2, 4]);
  assert.deepEqual(parseEvidenceSelectorIndexes('-1، nope， 3.5'), []);
});

test('selects draft relation targets by database ID or MCP client card ID', () => {
  const dependencies = draftDependencies([
    {
      id: 'draft-a',
      clientCardId: 'client-a',
      relations: [{ targetKind: 'draft', targetId: 'draft:client-b' }],
    },
    {
      id: 'draft-b',
      clientCardId: 'client-b',
      relations: [{ targetKind: 'draft', targetId: 'draft-c' }],
    },
    { id: 'draft-c', clientCardId: 'client-c', relations: [] },
  ]);

  assert.deepEqual([...dependencies.get('draft-a') ?? []], ['draft-b']);
  assert.deepEqual([...dependencies.get('draft-b') ?? []], ['draft-c']);
});

test('expands selected drafts transitively without adding public, private, or missing targets', () => {
  const dependencies = draftDependencies([
    {
      id: 'draft-a',
      relations: [
        { targetKind: 'draft', targetId: 'draft-b' },
        { targetKind: 'draft', targetId: 'missing-draft' },
        { targetKind: 'public', targetId: 'graph_probability' },
      ],
    },
    {
      id: 'draft-b',
      relations: [
        { targetKind: 'draft', targetId: 'draft-c' },
        { targetKind: 'private', targetId: 'personal:item-1' },
      ],
    },
    { id: 'draft-c', relations: [{ targetKind: 'draft', targetId: 'draft-a' }] },
  ]);

  assert.deepEqual(
    [...includeDraftDependencies(new Set(['draft-a']), dependencies)].sort(),
    ['draft-a', 'draft-b', 'draft-c']
  );
});

test('opens the candidate resolution boundary with a locale-aware document navigation', async () => {
  const source = await readFile(new URL('./draft-review-panel.tsx', import.meta.url), 'utf8');
  const reviewLinkStart = source.indexOf('<a href={String(localizeHref(`/knowledge-inbox/');
  const reviewLinkEnd = source.indexOf('</a>', reviewLinkStart);

  assert.ok(reviewLinkStart >= 0, 'the review action must use a native anchor');
  assert.ok(reviewLinkEnd > reviewLinkStart, 'the native review anchor must be closed');
  const reviewLink = source.slice(reviewLinkStart, reviewLinkEnd);
  assert.match(reviewLink, /encodeURIComponent\(batchId\)/);
  assert.match(reviewLink, /encodeURIComponent\(id\)/);
  assert.match(reviewLink, /localizeHref\([\s\S]*, locale\)/);
  assert.doesNotMatch(reviewLink, /LocalizedLink|router\.(?:push|replace)/);
  assert.match(source, /md:sticky md:top-\[7\.5rem\]/);
  assert.doesNotMatch(source, /className="sticky top-\[7\.5rem\]/);
  assert.match(source, /<article className=\{`min-w-0 rounded-2xl/);
  assert.match(source, /block break-all font-mono text-\[10px\]/);
  assert.match(source, /grid min-w-0 gap-2 lg:grid-cols-\[minmax\(0,1fr\)_10rem_8rem_7rem_9rem_auto\]/);
  assert.match(source, /<div className="grid w-full min-w-0 grid-cols-\[minmax\(0,1fr\)\] gap-6">/);
  assert.match(source, /<div className="grid min-w-0 grid-cols-\[minmax\(0,1fr\)\] gap-4">/);
  assert.doesNotMatch(source, /sm:grid-cols-\[minmax\(0,1fr\)_10rem_8rem_7rem_9rem_auto\]/);
});

test('confirmation-driven knowledge mutations stay inert until client hydration', async () => {
  const [confirmButton, reviewPanel, resolutionPanel] = await Promise.all([
    readFile(new URL('./confirm-delete-button.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./draft-review-panel.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./draft-resolution-panel.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(confirmButton, /useEffect\(\(\) => setHydrated\(true\), \[\]\)/);
  assert.match(confirmButton, /type="submit"[\s\S]{0,100}disabled=\{!hydrated\}/);
  assert.match(confirmButton, /window\.confirm\(confirmMessage\)/);

  const approvalButton = reviewPanel.slice(
    reviewPanel.indexOf('function ConfirmApprovalButton('),
    reviewPanel.indexOf('function asRecord('),
  );
  assert.match(approvalButton, /useEffect\(\(\) => setHydrated\(true\), \[\]\)/);
  assert.match(approvalButton, /disabled=\{!hydrated \|\| pending \|\| blocked\}/);

  assert.match(resolutionPanel, /function useHydratedConfirmation\(\)[\s\S]{0,220}setHydrated\(true\)/);
  assert.match(resolutionPanel, /value="merge" disabled=\{!hydrated \|\| pending \|\| blocked\}/);
  assert.match(resolutionPanel, /value="update" disabled=\{!hydrated \|\| pending \|\| blocked\}/);
  assert.match(resolutionPanel, /type="submit" disabled=\{!hydrated \|\| pending\}[\s\S]{0,180}resolution\.ignoreConfirm/);
});

test('candidate resolution keeps long private metadata inside the mobile viewport', async () => {
  const [page, panel] = await Promise.all([
    readFile(new URL('../app/knowledge-inbox/[batchId]/[draftId]/resolve/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./draft-resolution-panel.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /mx-auto w-full min-w-0 max-w-6xl/);
  assert.match(page, /mt-1 break-all font-mono/);
  assert.match(page, /mt-1 max-w-xs break-all/);
  assert.match(page, /<div className="mt-6 min-w-0 max-w-full">/);
  assert.match(panel, /grid w-full min-w-0 grid-cols-\[minmax\(0,1fr\)\] gap-6/);
  assert.match(panel, /mt-5 grid min-w-0 max-w-full grid-cols-\[minmax\(0,1fr\)\] gap-4/);
  assert.match(panel, /grid min-w-0 grid-cols-\[minmax\(0,1fr\)\] gap-4 md:grid-cols-2/);
  assert.equal(
    panel.match(/<span className="min-w-0 \[overflow-wrap:anywhere\]">/g)?.length,
    2,
    'relation and evidence metadata must both wrap opaque identifiers',
  );
  assert.match(panel, /min-h-11 rounded-xl border border-red-200/);
});
