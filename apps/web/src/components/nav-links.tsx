'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/practice', label: 'Practice' },
  { href: '/saved', label: 'Review Queue' },
  { href: '/knowledge', label: 'Knowledge Map' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/my-knowledge', label: 'My Knowledge' },
  { href: '/knowledge-inbox', label: 'Knowledge Inbox' },
  { href: '/ranking', label: 'Ranking' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavLinks({
  variant = 'default',
  isAuthenticated = false,
}: {
  variant?: 'default' | 'home';
  isAuthenticated?: boolean;
}) {
  const pathname = usePathname();
  const isHome = variant === 'home';

  return (
    <nav aria-label="Main navigation" className="min-w-0 overflow-hidden">
      <ul className={`no-scrollbar flex w-full min-w-0 items-center gap-1 overflow-x-auto rounded-lg p-1 text-sm font-medium ${isHome ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
        {NAV_ITEMS.filter((item) => item.href !== '/knowledge-inbox' || isAuthenticated).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-8 items-center rounded-md px-3 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${isHome ? 'focus:ring-offset-slate-950' : 'focus:ring-offset-2 focus:ring-offset-white'} ${
                  active
                    ? isHome ? 'bg-white/12 text-cyan-100 shadow-sm ring-1 ring-white/10' : 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                    : isHome ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-white/70 hover:text-slate-950'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
