import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/navbar';
import HomeGraphScene from '@/components/home-graph-scene';
import { getCurrentUser } from '@/lib/auth';
import { getUserStats } from '@/actions/card-actions';
import { getUserKnowledgeItems } from '@/actions/user-knowledge-actions';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  const userStats = user ? await getUserStats() : null;
  const userKnowledgeItems = user ? await getUserKnowledgeItems() : [];
  const sceneStats = {
    known: userStats?.known ?? 18,
    saved: userStats?.saved ?? 7,
    notes: userKnowledgeItems.length || 5,
  };

  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <HomeGraphScene {...sceneStats} />
      <Navbar />

      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-start px-6 pb-14 pt-10 md:pb-20 md:pt-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.55fr)] lg:items-start">
          <div className="fade-up max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-sky-300/35 bg-sky-300/10 px-3 py-1 text-xs font-semibold uppercase text-sky-100 shadow-sm backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
              Live Personal STEM Brain
            </p>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">
              Train your thinking engine, not just your memory.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              Turn scattered study into a living system: practice with intent, lock in weak spots, and grow a knowledge graph that actually reflects your current level.
            </p>

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
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-100"
                  >
                    Get started for free
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>

            {user && userStats ? (
              <div
                aria-label="Your learning stats"
                className="mt-7 grid max-w-xl grid-cols-3 gap-2"
              >
                <StatBox value={userStats.known} label="Known" color="text-emerald-200" bg="bg-emerald-400/10 border-emerald-300/20" delay="0ms" />
                <StatBox value={userStats.saved} label="Saved" color="text-sky-200" bg="bg-sky-400/10 border-sky-300/20" delay="160ms" />
                <StatBox value={userKnowledgeItems.length} label="Notes" color="text-amber-200" bg="bg-amber-400/10 border-amber-300/20" delay="320ms" />
              </div>
            ) : null}
          </div>

          <div className="fade-up">
            <ArtShowcase
              known={sceneStats.known}
              saved={sceneStats.saved}
              notes={sceneStats.notes}
            />
          </div>
        </div>
        <div className="mt-10 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </section>
    </main>
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

function ArtShowcase({
  known,
  saved,
  notes,
}: {
  known: number;
  saved: number;
  notes: number;
}) {
  return (
    <div className="home-art-showcase relative min-h-[30rem] overflow-hidden rounded-lg">
      <div className="absolute inset-x-8 bottom-3 h-12 bg-cyan-500/20 blur-3xl" />
      <div className="relative min-h-[30rem] overflow-hidden rounded-lg bg-slate-950/20">
        <Image
          src="/home-art/knowledge-brain.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 420px, 100vw"
          className="home-showcase-image home-showcase-image-one object-cover"
        />
        <Image
          src="/home-art/domain-atlas.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 420px, 100vw"
          className="home-showcase-image home-showcase-image-two object-cover"
        />
        <Image
          src="/home-art/memory-vault.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 420px, 100vw"
          className="home-showcase-image home-showcase-image-three object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.42)_0%,rgba(2,6,23,0.12)_36%,rgba(2,6,23,0.9)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(45,212,191,0.24),transparent_30%),radial-gradient(circle_at_82%_62%,rgba(251,191,36,0.18),transparent_28%)]" />
        <div className="absolute left-5 right-5 top-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-300">Artful graph model</p>
            <h2 className="mt-2 max-w-xs text-2xl font-bold tracking-tight text-white">Brain graph to memory vault</h2>
          </div>
          <span className="home-status-pill mt-1 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_22px_rgba(110,231,183,0.85)]" />
        </div>
        <div className="pointer-events-none absolute left-5 top-28 flex flex-col gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/80">
          <span>Concept map</span>
          <span className="ml-10 text-amber-100/80">STEM atlas</span>
          <span className="ml-4 text-emerald-100/80">Memory vault</span>
        </div>
        <div className="absolute bottom-5 left-5 right-5">
          <p className="max-w-sm text-sm leading-6 text-slate-200">
            The scene moves through concept maps, STEM domains, and private notes while the knowledge network rebalances behind it.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs uppercase text-slate-400">
            <span><strong className="mr-1 text-base text-emerald-200">{known}</strong>known</span>
            <span className="h-1 w-1 rounded-full bg-slate-500" />
            <span><strong className="mr-1 text-base text-sky-200">{saved}</strong>review</span>
            <span className="h-1 w-1 rounded-full bg-slate-500" />
            <span><strong className="mr-1 text-base text-amber-200">{notes}</strong>notes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
