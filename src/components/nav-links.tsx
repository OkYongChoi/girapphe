'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/practice', label: 'Practice' },
  { href: '/saved', label: 'Saved' },
  { href: '/my-knowledge', label: 'My Knowledge' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/knowledge', label: 'Knowledge Map' },
  { href: '/dashboard', label: 'Dashboard' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation">
      <ul className="no-scrollbar flex items-center gap-1 overflow-x-auto text-sm font-medium text-slate-700">
        {NAV_ITEMS.map((item, index) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex items-center gap-1 shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-md px-2 py-1 transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
              {index < NAV_ITEMS.length - 1 ? (
                <span aria-hidden="true" className="text-slate-200 select-none">•</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
