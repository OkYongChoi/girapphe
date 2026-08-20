'use client';

import Link, { type LinkProps } from 'next/link';
import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { localizePathname } from '@stem-brain/shared';
import { useI18n } from './client';

export function localizeHref(href: LinkProps['href'], locale: ReturnType<typeof useI18n>['locale']) {
  if (typeof href === 'string') return localizePathname(href, locale);
  const pathname = href.pathname ? localizePathname(String(href.pathname), locale) : href.pathname;
  return { ...href, pathname };
}

type LocalizedLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

export const LocalizedLink = forwardRef<HTMLAnchorElement, LocalizedLinkProps>(
  function LocalizedLink({ href, ...props }, ref) {
    const { locale } = useI18n();
    const localizedHref = localizeHref(href, locale);

    // Locale-prefixed routes are rewritten by the Worker. Query-bearing client
    // navigations can be dropped by that rewrite, so keep their URL intact with
    // a normal browser navigation instead of the Next.js router.
    if (typeof localizedHref === 'string' && localizedHref.includes('?')) {
      const {
        as: _as,
        replace: _replace,
        scroll: _scroll,
        shallow: _shallow,
        passHref: _passHref,
        prefetch: _prefetch,
        locale: _nextLocale,
        legacyBehavior: _legacyBehavior,
        onNavigate: _onNavigate,
        transitionTypes: _transitionTypes,
        ...anchorProps
      } = props;
      void [_as, _replace, _scroll, _shallow, _passHref, _prefetch, _nextLocale, _legacyBehavior, _onNavigate, _transitionTypes];
      return <a ref={ref} href={localizedHref} {...anchorProps} />;
    }

    return <Link ref={ref} href={localizedHref} {...props} />;
  },
);
