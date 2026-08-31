import assert from 'node:assert/strict';
import test from 'node:test';
import { featureSpecFailures, markdownLinkDestinations } from './check-docs.mjs';

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
  ].join('\n');

  const { destinations } = markdownLinkDestinations(markdown);

  assert.deepEqual(
    destinations.map(({ rawDestination }) => rawDestination),
    [
      './inline.md',
      './guide.md',
      '<./images/diagram one.png>',
      'https://example.com/docs',
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
    '- AC-01: covered.',
    '- AC-02: covered.',
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
