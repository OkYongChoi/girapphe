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

      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-6 py-14 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.55fr)] lg:items-end">
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

          <div className="fade-up grid gap-3 lg:pb-4">
            <div className="home-command-panel rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Artful graph model</p>
                <span className="home-status-pill rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-100">
                  Alive
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                The scene moves through a brain graph, a STEM atlas, and a private memory vault while the knowledge network rebalances behind it.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Known" value={sceneStats.known} tone="text-emerald-200" />
                <MiniStat label="Review" value={sceneStats.saved} tone="text-sky-200" />
                <MiniStat label="Notes" value={sceneStats.notes} tone="text-amber-200" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <ArtPanel
                title="Brain graph"
                description="Concept cards orbit your current understanding."
                image="/home-art/knowledge-brain.png"
                tone="border-emerald-300/20"
                delay="0ms"
              />
              <ArtPanel
                title="STEM atlas"
                description="Domains become explorable landscapes."
                image="/home-art/domain-atlas.png"
                tone="border-sky-300/20"
                delay="180ms"
              />
              <ArtPanel
                title="Memory vault"
                description="Private notes stay connected to practice."
                image="/home-art/memory-vault.png"
                tone="border-amber-300/20"
                delay="360ms"
              />
            </div>
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

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/35 p-2">
      <span className={`block text-lg font-bold ${tone}`}>{value}</span>
      <span className="text-[10px] uppercase text-slate-400">{label}</span>
    </div>
  );
}

function ArtPanel({
  title,
  description,
  image,
  tone,
  delay,
}: {
  title: string;
  description: string;
  image: string;
  tone: string;
  delay: string;
}) {
  return (
    <div className={`home-art-panel overflow-hidden rounded-lg border bg-slate-950/35 backdrop-blur ${tone}`} style={{ animationDelay: delay }}>
      <div className="relative h-28 overflow-hidden">
        <Image src={image} alt="" fill sizes="(min-width: 1024px) 340px, 50vw" className="home-art-panel-image object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/20 to-transparent" />
      </div>
      <div className="p-4">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
      </div>
    </div>
  );
}
