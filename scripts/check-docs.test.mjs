import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  featureSpecFailures,
  filterExistingFiles,
  isPathInside,
  localLinkDestination,
  localLinkTarget,
  markdownHeadingIds,
  markdownLinkDestinations,
  resolvedLocalLinkTarget,
} from './check-docs.mjs';

test('filters deleted Markdown paths while retaining existing files', async () => {
  const existing = path.join(process.cwd(), 'scripts/check-docs.mjs');
  const deleted = path.join(process.cwd(), 'docs/does-not-exist.md');

  assert.deepEqual(await filterExistingFiles([deleted, existing]), [existing]);
});

test('rejects resolved documentation targets outside the repository', () => {
  const repository = path.resolve('/workspace/repository');

  assert.equal(isPathInside(repository, path.join(repository, 'docs/guide.md')), true);
  assert.equal(isPathInside(repository, repository), true);
  assert.equal(isPathInside(repository, path.resolve(repository, '..')), false);
  assert.equal(isPathInside(repository, path.resolve(repository, '../outside.md')), false);
});

test('parses local link paths and validates GitHub heading identifiers', () => {
  assert.deepEqual(localLinkDestination('./guide.md#installation'), {
    target: './guide.md',
    fragment: 'installation',
  });
  assert.deepEqual(localLinkDestination('#한국어-%ED%91%9C%ED%98%84'), {
    target: '',
    fragment: '한국어-표현',
  });
  assert.deepEqual(
    [...markdownHeadingIds([
      '# Installation',
      '## Installation',
      '## Hello, *World*!',
      '## Install <em>now</em>',
      '<a id="manual-anchor"></a>',
      '<a name="legacy-anchor"></a>',
      '<div id="section-anchor"></div>',
    ].join('\n\n'))],
    [
      'installation',
      'installation-1',
      'hello-world',
      'install-now',
      'manual-anchor',
      'legacy-anchor',
      'section-anchor',
    ],
  );
  assert.equal(
    resolvedLocalLinkTarget('/repo/docs/guide.md', ''),
    '/repo/docs/guide.md',
  );
  assert.equal(
    resolvedLocalLinkTarget('/repo/docs/guide.md', './other.md'),
    '/repo/docs/other.md',
  );
});

test('extracts inline and reference-style Markdown link destinations', () => {
  const markdown = [
    '[inline](./inline.md)',
    '[guide][guide-ref]',
    '![diagram][diagram-ref]',
    '',
    '[guide-ref]: ./guide.md "Guide"',
    '[diagram-ref]: <./images/diagram one.png>',
    '[external]: https://example.com/docs',
    '[^note]: This footnote is not a link definition.',
    '<a href="./html-guide.md">HTML guide</a>',
    '<a href="./guide&amp;notes.md">Entity guide</a>',
    "<img src='./images/html-diagram.png' alt='Diagram'>",
    '<img src="./images/diagram&#45;2.png" alt="Numeric entity">',
    '<img data-src="./missing-data-image.png" alt="Deferred">',
    "<div title='Example: href=\"./missing-title-link.md\"'></div>",
    '<!-- <a href="./missing-comment.md">Ignored</a> -->',
    '<script>const href = "./missing-script.md";</script>',
    '<code>[html-code-link](./missing-html-code-link.md)</code>',
    '',
    '\\<code>[escaped-html-code-link](./escaped-html-code-link.md)</code>',
    '',
    '```md',
    '[ignored]: ./ignored.md',
    '```',
    '',
    '   ~~~md',
    '[also-ignored](./missing.md)',
    '   ~~~',
    '',
    '`[inline-example](./missing-inline.md)`',
    '``[second-inline-example](./also-missing.md)``',
    '',
    '    [indented-code-example](./missing-indented.md)',
    '',
    '[escaped-closing\\](./missing-escaped.md)',
    '- setup',
    '    - [nested-guide](./nested-guide.md)',
    '    [nested-paragraph](./nested-paragraph.md)',
    '    ',
    '          [nested-code-example](./missing-nested-code.md)',
    '>     [quoted-code-example](./missing-quoted-code.md)',
    '',
    '[parenthesized](./release_(final).md)',
    '[angle-parenthesized](<./release(final).md>)',
    '[escaped-parenthesized](./release_\\(final\\).md)',
    "[apostrophe](./author's-notes.md)",
    '[titled](./titled.md "Titled notes")',
  ].join('\n');

  const { destinations } = markdownLinkDestinations(markdown);

  assert.deepEqual(
    destinations.map(({ rawDestination }) => rawDestination),
    [
      './inline.md',
      './guide.md',
      './images/diagram one.png',
      'https://example.com/docs',
      './html-guide.md',
      './guide&notes.md',
      './images/html-diagram.png',
      './images/diagram-2.png',
      './escaped-html-code-link.md',
      './nested-guide.md',
      './nested-paragraph.md',
      './release_(final).md',
      './release(final).md',
      './release_(final).md',
      "./author's-notes.md",
      './titled.md',
    ],
  );
  assert.equal(localLinkTarget('./release_\\(final\\).md'), './release_(final).md');
  assert.equal(localLinkTarget('./images/diagram one.png'), './images/diagram one.png');
});

test('reports undefined full and collapsed references outside code', () => {
  const markdown = [
    '[guide][setup]',
    '[guide][]',
    '\\[escaped][missing]',
    '`[inline-code][missing]`',
    '<code>[html-code][missing]</code>',
    '>     [quoted-code][missing]',
    '',
    '[defined][id]',
    '',
    '[id]: ./defined.md',
  ].join('\n');

  const { unresolvedReferences } = markdownLinkDestinations(markdown);

  assert.deepEqual(
    unresolvedReferences.map(({ identifier }) => identifier),
    ['setup', 'guide'],
  );
});

test('requires content in every mandatory active feature-spec section', () => {
  const featureSpec = [
    '# Feature',
    '',
    'Status: Active',
    '',
    '## User outcome',
    '## Scope',
    '## Acceptance criteria',
    '- [ ] `AC-01`: Observable behavior.',
    '## Privacy and data boundaries',
    '## Verification',
    '| Criterion | Evidence |',
    '| --- | --- |',
    '| `AC-01` | focused test. |',
    '## Rollout',
  ].join('\n');

  assert.deepEqual(
    featureSpecFailures('specs/features/example.md', featureSpec),
    [
      'specs/features/example.md has an empty "## User outcome" section',
      'specs/features/example.md has an empty "## Scope" section',
      'specs/features/example.md has an empty "## Privacy and data boundaries" section',
      'specs/features/example.md has an empty "## Rollout" section',
    ],
  );
});

test('ignores feature-spec structures inside code blocks', () => {
  const featureSpec = [
    '# Feature',
    '',
    '```md',
    'Status: Implemented',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '- [x] `AC-01`: Hidden criterion.',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '| `AC-01` | hidden evidence. |',
    '## Rollout',
    'Rollout.',
    '```',
  ].join('\n');

  const failures = featureSpecFailures('specs/features/example.md', featureSpec);

  assert.ok(failures.includes(
    'specs/features/example.md must declare Status: Draft, Active, Implemented, or Superseded',
  ));
  for (const section of [
    'User outcome',
    'Scope',
    'Acceptance criteria',
    'Privacy and data boundaries',
    'Verification',
    'Rollout',
  ]) {
    assert.ok(failures.includes(`specs/features/example.md is missing the "## ${section}" section`));
  }
  assert.ok(failures.includes(
    'specs/features/example.md must define checkbox criteria with stable AC-01 style identifiers',
  ));
});

test('ignores feature-spec status and evidence inside multiline inline code', () => {
  const featureSpec = [
    '# Feature',
    '',
    '``',
    'Status: Implemented',
    '``',
    '',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '- [x] `AC-01`: Visible criterion.',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '``',
    '| `AC-01` | hidden evidence. |',
    '``',
    '## Rollout',
    'Rollout.',
  ].join('\n');

  const failures = featureSpecFailures('specs/features/example.md', featureSpec);

  assert.ok(failures.includes(
    'specs/features/example.md must declare Status: Draft, Active, Implemented, or Superseded',
  ));
  assert.ok(failures.includes(
    'specs/features/example.md does not map AC-01 to non-empty evidence in the Verification table',
  ));
});

test('ignores feature-spec structures inside HTML comments', () => {
  const featureSpec = [
    '# Feature',
    '',
    '<!--',
    'Status: Implemented',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '- [x] `AC-01`: Hidden criterion.',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '| `AC-01` | hidden evidence. |',
    '## Rollout',
    'Rollout.',
    '-->',
  ].join('\n');

  const failures = featureSpecFailures('specs/features/example.md', featureSpec);

  assert.ok(failures.includes(
    'specs/features/example.md must declare Status: Draft, Active, Implemented, or Superseded',
  ));
  assert.ok(failures.includes(
    'specs/features/example.md is missing the "## Acceptance criteria" section',
  ));
  assert.ok(failures.includes(
    'specs/features/example.md must define checkbox criteria with stable AC-01 style identifiers',
  ));
});

test('ignores feature-spec structures inside raw HTML blocks', () => {
  const featureSpec = [
    '# Feature',
    '',
    '<pre>',
    'Status: Implemented',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '- [x] `AC-01`: Hidden criterion.',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '| `AC-01` | hidden evidence. |',
    '## Rollout',
    'Rollout.',
    '</pre>',
  ].join('\n');

  const failures = featureSpecFailures('specs/features/example.md', featureSpec);

  assert.ok(failures.includes(
    'specs/features/example.md must declare Status: Draft, Active, Implemented, or Superseded',
  ));
  assert.ok(failures.includes(
    'specs/features/example.md is missing the "## Acceptance criteria" section',
  ));
  assert.ok(failures.includes(
    'specs/features/example.md must define checkbox criteria with stable AC-01 style identifiers',
  ));
});

test('ignores feature-spec structures inside inert HTML templates', () => {
  const featureSpec = [
    '<template>',
    '',
    'Status: Implemented',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '- [x] `AC-01`: Hidden criterion.',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '| `AC-01` | hidden evidence. |',
    '## Rollout',
    'Rollout.',
    '',
    '</template>',
  ].join('\n');

  const failures = featureSpecFailures('specs/features/example.md', featureSpec);

  assert.ok(failures.includes(
    'specs/features/example.md must declare Status: Draft, Active, Implemented, or Superseded',
  ));
  assert.ok(failures.includes(
    'specs/features/example.md must define checkbox criteria with stable AC-01 style identifiers',
  ));
});

test('ignores feature-spec criteria inside inline HTML code elements', () => {
  const featureSpec = [
    '# Feature',
    '',
    'Status: Implemented',
    '',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '<code>- [x] `AC-01`: Hidden criterion.</code>',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '<code>| `AC-01` | hidden evidence. |</code>',
    '## Rollout',
    'Rollout.',
  ].join('\n');

  assert.ok(featureSpecFailures('specs/features/example.md', featureSpec).includes(
    'specs/features/example.md must define checkbox criteria with stable AC-01 style identifiers',
  ));
});

test('rejects every malformed acceptance-criterion checkbox', () => {
  const featureSpec = [
    '# Feature',
    '',
    'Status: Implemented',
    '',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '- [x] `AC-01`: Valid criterion.',
    '+ [x] `AC-02`: Valid alternative bullet.',
    '1. [x] `AC-03`: Valid ordered criterion.',
    '- [x] `AC-1`: Invalid identifier.',
    '- [x] `AC-03` Missing colon.',
    '   * [ ] `AC-4`: Invalid indented criterion.',
    '   2) [ ] `AC-5`: Invalid ordered criterion.',
    '- [Design notes](../design.md)',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '| Criterion | Evidence |',
    '| --- | --- |',
    '| `AC-01` | covered. |',
    '| `AC-02` | covered. |',
    '| `AC-03` | covered. |',
    '## Rollout',
    'Rollout.',
  ].join('\n');

  assert.deepEqual(
    featureSpecFailures('specs/features/example.md', featureSpec),
    [
      'specs/features/example.md has malformed acceptance criterion checkbox: '
        + '- [x] `AC-1`: Invalid identifier.',
      'specs/features/example.md has malformed acceptance criterion checkbox: '
        + '- [x] `AC-03` Missing colon.',
      'specs/features/example.md has malformed acceptance criterion checkbox: '
        + '   * [ ] `AC-4`: Invalid indented criterion.',
      'specs/features/example.md has malformed acceptance criterion checkbox: '
        + '   2) [ ] `AC-5`: Invalid ordered criterion.',
    ],
  );
});

test('requires exact, non-empty verification table evidence', () => {
  const featureSpec = [
    '# Feature',
    '',
    'Status: Implemented',
    '',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '- [x] `AC-01`: First criterion.',
    '- [x] `AC-02`: Second criterion.',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '| Criterion | Evidence |',
    '| --- | --- |',
    '| `AC-010` | Wrong identifier. |',
    '| `AC-02` | |',
    '## Rollout',
    'Rollout.',
  ].join('\n');

  assert.deepEqual(
    featureSpecFailures('specs/features/example.md', featureSpec),
    [
      'specs/features/example.md does not map AC-01 to non-empty evidence '
        + 'in the Verification table',
      'specs/features/example.md does not map AC-02 to non-empty evidence '
        + 'in the Verification table',
    ],
  );
});

test('requires a rendered acceptance-criterion description', () => {
  const featureSpec = [
    '# Feature',
    '',
    'Status: Implemented',
    '',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '- [x] `AC-01`:',
    '- [x] `AC-02`:',
    '  Observable continuation description.',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '| `AC-01` | covered. |',
    '| `AC-02` | covered. |',
    '## Rollout',
    'Rollout.',
  ].join('\n');

  assert.deepEqual(
    featureSpecFailures('specs/features/example.md', featureSpec),
    ['specs/features/example.md has no description for AC-01'],
  );
});

test('rejects duplicate required feature-spec sections', () => {
  const featureSpec = [
    '# Feature',
    '',
    'Status: Implemented',
    '',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '- [x] `AC-01`: Observable behavior.',
    '## Acceptance criteria',
    '- [ ] `AC-02`: This duplicate must not be ignored.',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '| `AC-01` | covered. |',
    '## Rollout',
    'Rollout.',
  ].join('\n');

  assert.ok(featureSpecFailures('specs/features/example.md', featureSpec).includes(
    'specs/features/example.md repeats the "## Acceptance criteria" section',
  ));
});

test('requires exactly one visible feature-spec status', () => {
  const featureSpec = [
    '# Feature',
    '',
    'Status: Draft',
    'Status: Implemented',
    '',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '- [ ] `AC-01`: Observable behavior.',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '| `AC-01` | focused test. |',
    '## Rollout',
    'Rollout.',
  ].join('\n');

  assert.deepEqual(
    featureSpecFailures('specs/features/example.md', featureSpec),
    ['specs/features/example.md must declare exactly one Status value'],
  );
});

test('accepts optional outer table pipes and escaped pipes in evidence', () => {
  const featureSpec = [
    '# Feature',
    '',
    'Status: Implemented',
    '',
    '## User outcome',
    'Outcome.',
    '## Scope',
    'Scope.',
    '## Acceptance criteria',
    '1. [x] `AC-01`: Ordered criterion.',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    'Criterion | Evidence',
    '--- | ---',
    '`AC-01` | `pnpm test` \\| `tee results.log`',
    '## Rollout',
    'Rollout.',
  ].join('\n');

  assert.deepEqual(featureSpecFailures('specs/features/example.md', featureSpec), []);
});

test('accepts valid ATX section heading indentation and closing hashes', () => {
  const featureSpec = [
    '# Feature',
    '',
    'Status: Active',
    '',
    '  ## User outcome ##',
    'Outcome.',
    '  ## Scope ##',
    'Scope.',
    '  ## Acceptance criteria ##',
    '- [ ] `AC-01`: Observable behavior.',
    '## Privacy and data boundaries ##',
    'Boundary.',
    '  ## Verification ##',
    '`AC-01` | focused test',
    '  ## Rollout ##',
    'Rollout.',
  ].join('\n');

  assert.deepEqual(featureSpecFailures('specs/features/example.md', featureSpec), []);
});
