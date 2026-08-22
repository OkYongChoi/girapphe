import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '@/i18n/client';
import { MESSAGE_CATALOGS } from '@/i18n/messages';
import GlobalError from './error';

test('renders recovery controls that work without client-side navigation', () => {
  const markup = renderToStaticMarkup(
    <I18nProvider locale="en" messages={MESSAGE_CATALOGS.en}>
      <GlobalError error={new Error('test error')} />
    </I18nProvider>
  );

  assert.match(markup, /<a href=""[^>]*>Try again<\/a>/);
  assert.match(markup, /<a href="\/en"[^>]*>Return home<\/a>/);
});
