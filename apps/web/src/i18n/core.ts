import {
  DEFAULT_LOCALE,
  LOCALE_META,
  type Locale,
  type LocaleDirection,
} from '@stem-brain/shared';
import type { MessageCatalog, MessageKey, MessageValue } from './messages';

export type TranslationPrimitive = string | number;
export type TranslationValues = Record<string, TranslationPrimitive>;
export type Translate = (key: MessageKey, values?: TranslationValues) => string;

export type I18n = {
  locale: Locale;
  direction: LocaleDirection;
  messages: MessageCatalog;
  t: Translate;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (
    value: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatList: (values: string[], options?: Intl.ListFormatOptions) => string;
};

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

function getTemplate(locale: Locale, message: MessageValue, values?: TranslationValues): string {
  if (typeof message === 'string') return message;

  const count = Number(values?.count ?? 0);
  const category = new Intl.PluralRules(locale).select(Number.isFinite(count) ? count : 0);
  return message[category] ?? message.other;
}

function interpolate(
  locale: Locale,
  template: string,
  values: TranslationValues | undefined,
): string {
  if (!values) return template;

  const numberFormatter = new Intl.NumberFormat(locale);
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, key: string) => {
    const value = values[key];
    if (value === undefined) return placeholder;
    return typeof value === 'number' ? numberFormatter.format(value) : value;
  });
}

export function createI18n(
  locale: Locale = DEFAULT_LOCALE,
  messages: MessageCatalog,
): I18n {
  const t: Translate = (key, values) => {
    const message = messages[key];
    if (!message) return key;
    return interpolate(locale, getTemplate(locale, message, values), values);
  };

  return {
    locale,
    direction: LOCALE_META[locale].direction,
    messages,
    t,
    formatNumber: (value, options) => new Intl.NumberFormat(locale, options).format(value),
    formatDate: (value, options = DEFAULT_DATE_OPTIONS) => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return t('common.never');
      return new Intl.DateTimeFormat(locale, options).format(date);
    },
    formatList: (values, options) => new Intl.ListFormat(locale, options).format(values),
  };
}
