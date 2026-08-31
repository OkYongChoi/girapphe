import assert from 'node:assert/strict';
import test from 'node:test';
import {
  featureSpecFailures,
  localLinkTarget,
  markdownLinkDestinations,
} from './check-docs.mjs';

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
  assert.equal(localLinkTarget('./titled.md "Titled notes"'), './titled.md');
});

test('reports undefined full and collapsed references outside code', () => {
  const markdown = [
    '[guide][setup]',
    '[guide][]',
    '\\[escaped][missing]',
    '`[inline-code][missing]`',
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
    '- [x] `AC-1`: Invalid identifier.',
    '- [x] `AC-03` Missing colon.',
    '   * [ ] `AC-4`: Invalid indented criterion.',
    '## Privacy and data boundaries',
    'Boundary.',
    '## Verification',
    '| Criterion | Evidence |',
    '| --- | --- |',
    '| `AC-01` | covered. |',
    '| `AC-02` | covered. |',
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
