import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import GlobalError from './error';

test('renders recovery controls that work without client-side navigation', () => {
  const markup = renderToStaticMarkup(<GlobalError error={new Error('test error')} />);

  assert.match(markup, /<form action="" method="get">/);
  assert.match(markup, /<button type="submit"[^>]*>Try again<\/button>/);
  assert.match(markup, /<a href="\/en"[^>]*>Return home<\/a>/);
});
