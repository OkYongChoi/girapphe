import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import GlobalError from './error';

test('renders recovery controls that work without client-side navigation', () => {
  const markup = renderToStaticMarkup(<GlobalError error={new Error('test error')} reset={() => {}} />);

  assert.match(markup, /<a href=""[^>]*>Try again<\/a>/);
  assert.match(markup, /<a href="\/en"[^>]*>Return home<\/a>/);
});
