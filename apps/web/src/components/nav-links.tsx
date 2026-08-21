'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { stripLocaleFromPathname } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';
import { LocalizedLink } from '@/i18n/navigation';

const NAV_ITEMS = [
  { href: '/practice', label: 'nav.practice' },
  { href: '/saved', label: 'nav.reviewQueue' },
  { href: '/knowledge', label: 'nav.knowledgeMap' },
  { href: '/grid', label: 'nav.concepts' },
  { href: '/dashboard', label: 'nav.dashboard' },
  { href: '/my-knowledge', label: 'nav.myNotes' },
  { href: '/knowledge-inbox', label: 'nav.knowledgeInbox' },
  { href: '/ranking', label: 'nav.ranking' },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavLinks({
  variant = 'default',
  isAuthenticated = false,
  isAdmin = false,
}: {
  variant?: 'default' | 'home';
  isAuthenticated?: boolean;
  isAdmin?: boolean;
}) {
  const pathname = stripLocaleFromPathname(usePathname());
  const { t } = useI18n();
  const isHome = variant === 'home';
  const activeLinkRef = useRef<HTMLAnchorElement>(null);
  const navListRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const keepActiveLinkVisible = () => {
      activeLinkRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    keepActiveLinkVisible();

    const navList = navListRef.current;
    if (!navList || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(keepActiveLinkVisible);
    resizeObserver.observe(navList);
    return () => resizeObserver.disconnect();
  }, [pathname]);

  return (
    <nav aria-label={t('nav.main')} className="min-w-0 overflow-hidden">
      <ul ref={navListRef} className={`no-scrollbar flex w-full min-w-0 items-center gap-1 overflow-x-auto rounded-lg p-1 text-sm font-medium ${isHome ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
        {NAV_ITEMS.filter((item) => item.href !== '/knowledge-inbox' || isAuthenticated).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <LocalizedLink
                href={item.href}
                ref={active ? activeLinkRef : undefined}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-8 items-center rounded-md px-3 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${isHome ? 'focus:ring-offset-slate-950' : 'focus:ring-offset-2 focus:ring-offset-white'} ${
                  active
                    ? isHome ? 'bg-white/12 text-cyan-100 shadow-sm ring-1 ring-white/10' : 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                    : isHome ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-white/70 hover:text-slate-950'
                }`}
              >
                {t(item.label)}
              </LocalizedLink>
            </li>
          );
        })}
        {isAdmin ? (
          <li className="shrink-0">
            <LocalizedLink
              href="/admin/ops"
              className={`inline-flex min-h-8 items-center rounded-md border px-3 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${isHome ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20 focus:ring-offset-slate-950' : 'border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 focus:ring-offset-2 focus:ring-offset-white'}`}
            >
              {t('nav.adminOps')}
            </LocalizedLink>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
