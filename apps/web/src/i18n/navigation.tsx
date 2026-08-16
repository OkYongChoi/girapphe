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
    return <Link ref={ref} href={localizeHref(href, locale)} {...props} />;
  },
);
