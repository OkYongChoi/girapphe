import Link from 'next/link';
import type { ReactNode } from 'react';

export function LegalPage({
  title,
  eyebrow,
  updated,
  children,
}: {
  title: string;
  eyebrow: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900 sm:py-16">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <nav aria-label="Legal and support" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-blue-700">
          <Link href="/">Girapphe</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Support</Link>
        </nav>
        <header className="mt-10 border-b border-slate-200 pb-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-slate-500">Effective and last updated: {updated}</p>
        </header>
        <div className="mt-8 space-y-8 text-[15px] leading-7 text-slate-700 [&_a]:font-semibold [&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-slate-950 [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-2">
          {children}
        </div>
      </article>
    </main>
  );
}
