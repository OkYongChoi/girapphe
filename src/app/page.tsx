import Link from 'next/link';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import { getUserStats } from '@/actions/card-actions';
import { getUserKnowledgeItems } from '@/actions/user-knowledge-actions';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  const userStats = user ? await getUserStats() : null;
  const userKnowledgeItems = user ? await getUserKnowledgeItems() : [];

  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50 to-white">
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="inline-flex rounded-full border border-sky-200 bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-sky-700">
              Personal STEM Brain
            </p>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl">
              Build your own knowledge operating system.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-600 md:text-lg">
              Practice cards daily, save weak concepts, and watch your mastery graph grow over time. Everything is scoped to your account.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <>
                  <Link
                    href="/practice"
                    className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Keep practicing →
                  </Link>
                  <Link
                    href="/knowledge"
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    View knowledge graph
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Progress dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Get started for free
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>

            {user && userStats ? (
              <div
                aria-label="Your learning stats"
                className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                <StatBox value={userStats.known} label="Known" color="text-emerald-700" bg="bg-emerald-50 border-emerald-100" />
                <StatBox value={userStats.saved} label="Saved" color="text-blue-700" bg="bg-blue-50 border-blue-100" />
                <StatBox value={userStats.unknown} label="Unknown" color="text-red-700" bg="bg-red-50 border-red-100" />
                <StatBox value={userKnowledgeItems.length} label="Notes" color="text-slate-700" bg="bg-slate-50 border-slate-200" />
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
              What you get
            </h2>
            <div className="mt-4 space-y-3">
              <Feature icon="🎯" title="Adaptive practice" description="Review what you don't know yet and reinforce what you do." />
              <Feature icon="📌" title="Saved concept queue" description="Pin weak concepts and track your improvement over time." />
              <Feature icon="📝" title="Personal knowledge vault" description="Write and manage your own private notes and frameworks." />
              <Feature icon="🌐" title="Knowledge graph" description="See how concepts connect and spot your weak links visually." />
              <Feature icon="🔒" title="Private by default" description="All data is isolated to your account — nothing is shared." />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatBox({
  value,
  label,
  color,
  bg,
}: {
  value: number;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${bg}`}>
      <span className={`block text-xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
      <span className="text-lg leading-none mt-0.5" aria-hidden="true">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm text-slate-600">{description}</p>
      </div>
    </div>
  );
}
