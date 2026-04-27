import Link from 'next/link';
import Navbar from '@/components/navbar';
import HomeGraphScene from '@/components/home-graph-scene';
import { getCurrentUser } from '@/lib/auth';
import { getUserStats } from '@/actions/card-actions';
import { getUserKnowledgeItems } from '@/actions/user-knowledge-actions';
import GuestStartButton from '@/components/guest-start-button';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  const userStats = user ? await getUserStats() : null;
  const userKnowledgeItems = user ? await getUserKnowledgeItems() : [];
  const sceneStats = {
    explainable: userStats?.explainable ?? 18,
    unclear: userStats?.unclear ?? 7,
    notes: userKnowledgeItems.length || 5,
  };

  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_24%,rgba(14,165,233,0.13),transparent_30%),radial-gradient(circle_at_22%_58%,rgba(20,184,166,0.1),transparent_28%),linear-gradient(135deg,#020617_0%,#0b1120_54%,#111827_100%)]" />
        <div className="home-grid-lines absolute inset-0 opacity-45" />
        <div className="home-map-contours absolute inset-0 opacity-20" />
      </div>
      <Navbar />

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-start px-6 pb-14 pt-10 md:pb-20 md:pt-14">
        <div className="relative z-10 grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.55fr)] lg:items-start">
          <div className="fade-up min-w-0 max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase text-slate-300 shadow-sm backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-200/80 shadow-[0_0_16px_rgba(125,211,252,0.65)]" />
              Multidisciplinary Practice Graph
            </p>
            <h1 className="mt-5 max-w-[19rem] text-2xl font-black leading-tight tracking-tight text-white sm:max-w-2xl sm:text-4xl md:text-6xl">
              Practice STEM concepts and build your knowledge graph.
            </h1>
            <p className="mt-5 max-w-[20rem] text-sm leading-7 text-slate-300 sm:max-w-2xl sm:text-base md:text-lg">
              Learn with focused concept cards, save weak spots for review, and see your progress across science, engineering, medicine, computing, economics, and design.
            </p>

            <div className="home-discipline-rail mt-7 flex max-w-2xl gap-2 overflow-hidden text-xs font-semibold uppercase text-slate-300">
              {['Biology', 'Computer science', 'Semiconductor', 'Bio-chemistry', 'Medicine', 'Statistics', 'Economics', 'Architecture'].map((label) => (
                <span key={label} className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 backdrop-blur">
                  {label}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <>
                  <Link
                    href="/practice"
                    className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-100"
                  >
                    Keep practicing
                  </Link>
                  <Link
                    href="/knowledge"
                    className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                  >
                    View knowledge graph
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                  >
                    Progress dashboard
                  </Link>
                  <Link
                    href="#knowledge-graph"
                    className="rounded-lg border border-cyan-200/25 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-50 backdrop-blur transition hover:bg-cyan-300/15"
                  >
                    See live graph
                  </Link>
                </>
              ) : (
                <>
                  <GuestStartButton />
                  <Link
                    href="/signup"
                    className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                  >
                    Create account
                  </Link>
                  <Link
                    href="#knowledge-graph"
                    className="rounded-lg border border-cyan-200/25 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-50 backdrop-blur transition hover:bg-cyan-300/15"
                  >
                    See live graph
                  </Link>
                </>
              )}
            </div>

            {user && userStats ? (
              <div
                aria-label="Your learning stats"
                className="mt-7 grid max-w-xl grid-cols-3 gap-2"
              >
                <StatBox value={userStats.explainable} label="Explainable" color="text-emerald-200" bg="bg-emerald-400/10 border-emerald-300/20" delay="0ms" />
                <StatBox value={userStats.unclear} label="Unclear" color="text-sky-200" bg="bg-sky-400/10 border-sky-300/20" delay="160ms" />
                <StatBox value={userKnowledgeItems.length} label="Notes" color="text-amber-200" bg="bg-amber-400/10 border-amber-300/20" delay="320ms" />
              </div>
            ) : null}
          </div>

          <div className="fade-up min-w-0">
            <KnowledgeSurface
              explainable={sceneStats.explainable}
              unclear={sceneStats.unclear}
              notes={sceneStats.notes}
            />
          </div>
        </div>
        <div className="mt-10 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </section>

      <section id="knowledge-graph" className="relative z-10 scroll-mt-6 border-t border-white/10 px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase text-cyan-100/70">Scroll graph view</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
                A live map across disciplines.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Concepts from biology, computer science, semiconductors, medicine, statistics, economics, architecture, and chemistry connect in one moving knowledge graph.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <MiniMetric value={sceneStats.explainable} label="Explainable" />
              <MiniMetric value={sceneStats.unclear} label="Review" />
              <MiniMetric value={sceneStats.notes} label="Notes" />
            </div>
          </div>

          <div className="relative mt-8 h-[34rem] overflow-hidden rounded-lg border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/30 md:h-[38rem]">
            <HomeGraphScene {...sceneStats} />
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur">
      <span className="block text-2xl font-bold text-white">{value}</span>
      <span className="text-xs uppercase text-slate-400">{label}</span>
    </div>
  );
}

function StatBox({
  value,
  label,
  color,
  bg,
  delay,
}: {
  value: number;
  label: string;
  color: string;
  bg: string;
  delay: string;
}) {
  return (
    <div
      className={`home-stat-tile rounded-lg border px-3 py-2 text-center backdrop-blur ${bg}`}
      style={{ animationDelay: delay }}
    >
      <span className={`block text-xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

function KnowledgeSurface({
  explainable,
  unclear,
  notes,
}: {
  explainable: number;
  unclear: number;
  notes: number;
}) {
  const rows = [
    { label: 'Linear systems', value: 82, tone: 'bg-emerald-300' },
    { label: 'Bayes rule', value: 64, tone: 'bg-sky-300' },
    { label: 'Fourier analysis', value: 48, tone: 'bg-amber-300' },
    { label: 'Graph search', value: 72, tone: 'bg-cyan-300' },
  ];

  return (
    <div className="home-knowledge-surface relative min-h-[30rem] overflow-hidden rounded-lg border border-white/10 bg-slate-950/35 p-5 shadow-2xl shadow-black/25 backdrop-blur">
      <div className="home-surface-grid absolute inset-0 opacity-70" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />
      <div className="relative flex h-full min-h-[27.5rem] flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Knowledge system</p>
              <h2 className="mt-2 max-w-xs text-2xl font-bold tracking-tight text-white">Your concepts, review queue, and notes in one map</h2>
            </div>
            <span className="home-status-pill mt-1 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.72)]" />
          </div>

          <div className="home-node-map relative mt-8 h-52 rounded-lg border border-white/10 bg-slate-900/30">
            <span className="home-map-node home-map-node-core left-[45%] top-[38%] h-16 w-16 border-white/30 bg-white/12 text-white">
              Core
            </span>
            <span className="home-map-node left-[12%] top-[18%] border-emerald-200/30 bg-emerald-300/12 text-emerald-100">Explain</span>
            <span className="home-map-node right-[13%] top-[14%] border-sky-200/30 bg-sky-300/12 text-sky-100">Review</span>
            <span className="home-map-node bottom-[12%] left-[18%] border-amber-200/30 bg-amber-300/12 text-amber-100">Notes</span>
            <span className="home-map-node bottom-[18%] right-[16%] border-cyan-200/30 bg-cyan-300/12 text-cyan-100">Links</span>
            <span className="home-map-line left-[26%] top-[31%] w-[30%] rotate-[18deg]" />
            <span className="home-map-line right-[27%] top-[32%] w-[24%] rotate-[-22deg]" />
            <span className="home-map-line bottom-[31%] left-[28%] w-[28%] rotate-[-20deg]" />
            <span className="home-map-line bottom-[34%] right-[26%] w-[28%] rotate-[22deg]" />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 text-xs">
              <span className="text-slate-400">{row.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <span
                  className={`home-progress-line block h-full rounded-full ${row.tone}`}
                  style={{ width: `${row.value}%` }}
                />
              </span>
              <span className="text-right text-slate-500">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <p className="max-w-sm text-sm leading-6 text-slate-200">
            Your graph updates as you mark concepts explainable, keep review items, and add your own notes.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs uppercase text-slate-400">
            <span><strong className="mr-1 text-base text-emerald-200">{explainable}</strong>explainable</span>
            <span className="h-1 w-1 rounded-full bg-slate-500" />
            <span><strong className="mr-1 text-base text-sky-200">{unclear}</strong>review</span>
            <span className="h-1 w-1 rounded-full bg-slate-500" />
            <span><strong className="mr-1 text-base text-amber-200">{notes}</strong>notes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
