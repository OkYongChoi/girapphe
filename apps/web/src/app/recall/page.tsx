import Navbar from '@/components/navbar';
import RecallReviewSession from '@/components/recall-review-session';
import { getServerI18n } from '@/i18n/server';
import { requireCurrentUser } from '@/lib/auth';
import { getManualRecallOverviewForUser } from '@/lib/recall-runtime';
import { recallRuntimeEnrollmentDecision } from '@/lib/recall-runtime-rollout';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RecallPage() {
  const user = await requireCurrentUser();
  const [{ t }, rollout] = await Promise.all([
    getServerI18n(),
    Promise.resolve(recallRuntimeEnrollmentDecision(user.id)),
  ]);
  const overview = await getManualRecallOverviewForUser(user.id, {
    enrollmentEnabled: rollout.enabled,
  });

  return (
    <main
      id="main-content"
      className="min-h-screen bg-slate-50"
      data-recall-runtime-rollout="true"
      data-recall-rollout-mode={rollout.mode}
      data-recall-rollout-enabled={String(rollout.enabled)}
      data-recall-rollout-exact-single-owner={String(rollout.exactSingleAllowedOwner)}
      data-recall-rollout-distinct-candidate-denied={String(rollout.distinctCandidateDenied)}
    >
      <Navbar user={user} />
      <section className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{t('recall.eyebrow')}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{t('recall.title')}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">{t('recall.subtitle')}</p>
        </header>
        <RecallReviewSession
          initialOverview={overview}
          enrollmentEnabled={rollout.enabled}
        />
      </section>
    </main>
  );
}
