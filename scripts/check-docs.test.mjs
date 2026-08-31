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
    '[parenthesized](./release_(final).md)',
    '[angle-parenthesized](<./release(final).md>)',
    '[escaped-parenthesized](./release_\\(final\\).md)',
  ].join('\n');

  const { destinations } = markdownLinkDestinations(markdown);

  assert.deepEqual(
    destinations.map(({ rawDestination }) => rawDestination),
    [
      './inline.md',
      './release_(final).md',
      '<./release(final).md>',
      './release_\\(final\\).md',
      './guide.md',
      '<./images/diagram one.png>',
      'https://example.com/docs',
    ],
  );
  assert.equal(localLinkTarget('./release_\\(final\\).md'), './release_(final).md');
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
