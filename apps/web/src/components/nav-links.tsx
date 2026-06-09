'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/practice', label: 'Practice' },
  { href: '/saved', label: 'Review Queue' },
  { href: '/knowledge', label: 'Knowledge Map' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/my-knowledge', label: 'My Knowledge' },
  { href: '/ranking', label: 'Ranking' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation">
      <ul className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 text-sm font-medium text-slate-600">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-8 items-center rounded-md px-3 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white ${
                  active
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                    : 'hover:bg-white/70 hover:text-slate-950'
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
