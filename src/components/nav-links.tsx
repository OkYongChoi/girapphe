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
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto text-sm font-medium text-slate-700">
      {NAV_ITEMS.map((item, index) => (
        <div key={item.href} className="flex items-center gap-2">
          <Link
            href={item.href}
            className={`transition-colors ${
              isActive(pathname, item.href) ? 'text-blue-700' : 'hover:text-blue-600'
            }`}
          >
            {item.label}
          </Link>
          {index < NAV_ITEMS.length - 1 ? <span className="text-slate-300">•</span> : null}
        </div>
      ))}
    </div>
  );
}
