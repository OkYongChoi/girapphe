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
    <main id="main-content" className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#f8fafc_0%,#e0f2fe_45%,#fef3c7_100%)]">
      <div className="hero-aurora" />
      <Navbar />

      <section className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div className="fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800 shadow-sm backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Personal STEM Brain
            </p>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl">
              Train your thinking engine, not just your memory.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-700 md:text-lg">
              Turn scattered study into a living system: practice with intent, lock in weak spots, and grow a knowledge graph that actually reflects your current level.
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

          <div className="fade-up float-card rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl shadow-sky-900/10 backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">What you get</h2>
            <div className="mt-4 space-y-3">
              <Feature icon="🎯" title="Adaptive practice" description="Review what you do not know yet and reinforce what you do." tone="from-emerald-50 to-emerald-100" />
              <Feature icon="📌" title="Saved concept queue" description="Pin weak concepts and track your improvement over time." tone="from-blue-50 to-blue-100" />
              <Feature icon="📝" title="Personal knowledge vault" description="Write and manage your own private notes and frameworks." tone="from-amber-50 to-amber-100" />
              <Feature icon="🌐" title="Knowledge graph" description="See how concepts connect and spot weak links visually." tone="from-cyan-50 to-cyan-100" />
              <Feature icon="🔒" title="Private by default" description="All data is isolated to your account." tone="from-slate-100 to-slate-200" />
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

function Feature({
  icon,
  title,
  description,
  tone,
}: {
  icon: string;
  title: string;
  description: string;
  tone: string;
}) {
  return (
    <div className={`flex gap-3 rounded-xl border border-white/70 bg-gradient-to-br ${tone} p-4`}>
      <span className="text-lg leading-none mt-0.5" aria-hidden="true">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm text-slate-600">{description}</p>
      </div>
    </div>
  );
}
