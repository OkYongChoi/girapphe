import Link from 'next/link';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50 to-white">
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
              Practice cards daily, save weak concepts, and see your mastery graph evolve over time. Your data is scoped to your account.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <>
                  <Link
                    href="/practice"
                    className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Continue practicing
                  </Link>
                  <Link
                    href="/my-knowledge"
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Open my knowledge
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Create account
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
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
              What you get
            </h2>
            <div className="mt-4 space-y-3">
              <Feature title="Adaptive practice" description="Review what you do not know yet and keep what you know fresh." />
              <Feature title="Saved concept queue" description="Pin concepts you want to revisit and track improvement." />
              <Feature title="Personal knowledge vault" description="Create, edit, and delete your own private knowledge notes." />
              <Feature title="Knowledge graph" description="Visualize how concepts connect and where your weak links are." />
              <Feature title="Private progress" description="Every account has isolated knowledge states and stats." />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
}
