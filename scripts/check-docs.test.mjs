import assert from 'node:assert/strict';
import test from 'node:test';
import { markdownLinkDestinations } from './check-docs.mjs';

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
