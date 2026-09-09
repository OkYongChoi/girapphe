'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  cancelManualRecall,
  completeManualRecall,
  enrollManualRecall,
  revealManualRecall,
  selectManualRecallConfidence,
  startManualRecall,
} from '@/actions/recall-actions';
import KnowledgeBundleView from '@/components/knowledge-bundle-view';
import KnowledgeText from '@/components/knowledge-text';
import { useI18n } from '@/i18n/client';
import { LocalizedLink } from '@/i18n/navigation';
import type {
  ManualRecallCandidate,
  ManualRecallOverview,
  ManualRecallScheduleCard,
  ManualRecallSession,
  RecallSourceSummary,
} from '@/lib/recall-runtime';

type RecallReviewSessionProps = {
  initialOverview: ManualRecallOverview;
  enrollmentEnabled: boolean;
};

const PROMPT_KEYS = {
  concept: 'recall.prompt.concept',
  procedure: 'recall.prompt.procedure',
  comparison: 'recall.prompt.comparison',
} as const;

const CONFIDENCE_VALUES = ['low', 'medium', 'high'] as const;
const OUTCOME_VALUES = ['remembered', 'partial', 'missed'] as const;

function providerLabel(provider: RecallSourceSummary['provider']): string {
  if (provider === 'chatgpt') return 'ChatGPT';
  if (provider === 'claude') return 'Claude';
  if (provider === 'gemini') return 'Gemini';
  return 'AI';
}

export default function RecallReviewSession({
  initialOverview,
  enrollmentEnabled,
}: RecallReviewSessionProps) {
  const { formatDate, t } = useI18n();
  const router = useRouter();
  const [session, setSession] = useState<ManualRecallSession | null>(null);
  const [recallText, setRecallText] = useState('');
  const [completionDueAt, setCompletionDueAt] = useState<string | null>(null);
  const [hiddenCandidateIds, setHiddenCandidateIds] = useState<Set<string>>(() => new Set());
  const [cancelledScheduleIds, setCancelledScheduleIds] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState('');
  const [isPending, startTransition] = useTransition();

  const candidates = initialOverview.candidates.filter(
    (candidate) => !hiddenCandidateIds.has(candidate.knowledgeItemId),
  );
  const schedules = initialOverview.schedules.filter(
    (schedule) => !cancelledScheduleIds.has(schedule.knowledgeItemId),
  );

  const formatInstant = (value: string) => formatDate(value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const showGenericFailure = () => setStatus(t('recall.genericError'));

  function enroll(candidate: ManualRecallCandidate) {
    setStatus('');
    startTransition(async () => {
      try {
        const result = await enrollManualRecall({
          knowledgeItemId: candidate.knowledgeItemId,
          itemVersion: candidate.itemVersion,
        });
        if (result.kind === 'enrolled' || result.kind === 'unchanged') {
          setHiddenCandidateIds((current) => new Set(current).add(candidate.knowledgeItemId));
          setStatus(t(result.kind === 'enrolled' ? 'recall.enrolled' : 'recall.alreadyEnrolled'));
          router.refresh();
          return;
        }
        setStatus(t(result.kind === 'disabled' ? 'recall.rolloutPausedBody' : 'recall.unavailable'));
      } catch {
        showGenericFailure();
      }
    });
  }

  function start(schedule: ManualRecallScheduleCard) {
    setStatus('');
    setCompletionDueAt(null);
    startTransition(async () => {
      try {
        const result = await startManualRecall({ knowledgeItemId: schedule.knowledgeItemId });
        if (result.session) {
          setRecallText('');
          setSession(result.session);
          return;
        }
        setStatus(t('recall.unavailable'));
        router.refresh();
      } catch {
        showGenericFailure();
      }
    });
  }

  function chooseConfidence(confidence: typeof CONFIDENCE_VALUES[number]) {
    if (!session) return;
    setStatus('');
    startTransition(async () => {
      try {
        const result = await selectManualRecallConfidence({
          attemptId: session.attemptId,
          confidence,
        });
        if (result.session) {
          setSession(result.session);
          return;
        }
        setSession(null);
        setRecallText('');
        setStatus(t('recall.unavailable'));
        router.refresh();
      } catch {
        showGenericFailure();
      }
    });
  }

  function reveal() {
    if (!session || session.phase === 'revealed') return;
    if (!session.confidence) {
      setStatus(t('recall.confidenceRequired'));
      return;
    }
    setStatus('');
    startTransition(async () => {
      try {
        const result = await revealManualRecall({ attemptId: session.attemptId });
        if (result.session) {
          setSession(result.session);
          return;
        }
        setSession(null);
        setRecallText('');
        setStatus(t(result.kind === 'confidence_required'
          ? 'recall.confidenceRequired'
          : 'recall.unavailable'));
        router.refresh();
      } catch {
        showGenericFailure();
      }
    });
  }

  function complete(outcome: typeof OUTCOME_VALUES[number]) {
    if (!session || session.phase !== 'revealed') return;
    setStatus('');
    startTransition(async () => {
      try {
        const result = await completeManualRecall({ attemptId: session.attemptId, outcome });
        if ((result.kind === 'completed' || result.kind === 'unchanged') && result.resultingDueAt) {
          setRecallText('');
          setSession(null);
          setCompletionDueAt(result.resultingDueAt);
          router.refresh();
          return;
        }
        setSession(null);
        setRecallText('');
        setStatus(t(result.kind === 'conflict'
          ? 'recall.completedElsewhere'
          : 'recall.unavailable'));
        router.refresh();
      } catch {
        showGenericFailure();
      }
    });
  }

  function cancel(schedule: ManualRecallScheduleCard | ManualRecallSession) {
    if (!window.confirm(t('recall.stopConfirm'))) return;
    setStatus('');
    startTransition(async () => {
      try {
        const result = await cancelManualRecall({
          knowledgeItemId: schedule.knowledgeItemId,
          itemVersion: schedule.itemVersion,
          scheduleVersion: schedule.scheduleVersion,
          enrolledAt: schedule.enrolledAt,
        });
        if (result.kind === 'cancelled' || result.kind === 'unchanged') {
          setCancelledScheduleIds((current) => new Set(current).add(schedule.knowledgeItemId));
          if (session?.knowledgeItemId === schedule.knowledgeItemId) setSession(null);
          setRecallText('');
          setStatus(t('recall.stopped'));
          router.refresh();
          return;
        }
        setSession(null);
        setRecallText('');
        setStatus(t(result.kind === 'conflict' ? 'recall.completedElsewhere' : 'recall.unavailable'));
        router.refresh();
      } catch {
        showGenericFailure();
      }
    });
  }

  function closeSession() {
    setSession(null);
    setRecallText('');
    setStatus('');
  }

  if (!initialOverview.databaseAvailable) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h2 className="text-lg font-black">{t('recall.databaseUnavailableTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed">{t('recall.databaseUnavailableBody')}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <aside className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-relaxed text-cyan-950">
        <strong>{t('recall.manualBadge')}</strong> {t('recall.privacyBoundary')}
      </aside>

      {status ? (
        <p role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          {status}
        </p>
      ) : null}

      {completionDueAt ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
          <h2 className="text-xl font-black">{t('recall.completeTitle')}</h2>
          <p className="mt-2 text-sm leading-relaxed">
            {t('recall.completeBody', { date: formatInstant(completionDueAt) })}
          </p>
          <button
            type="button"
            onClick={() => setCompletionDueAt(null)}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
          >
            {t('recall.backToQueue')}
          </button>
        </section>
      ) : null}

      {session ? (
        <section aria-labelledby="recall-session-title" className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
          <header className="border-b border-white/10 p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                  {t('recall.sessionMilestone', {
                    milestone: t(session.milestone === 'd1' ? 'recall.milestone.d1' : 'recall.milestone.d7'),
                  })}
                </p>
                <h2 id="recall-session-title" className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  <KnowledgeText text={session.centralQuestion} />
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  {t(PROMPT_KEYS[session.exerciseType])}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSession}
                disabled={isPending}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/20 px-3 text-sm font-bold text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:opacity-50"
              >
                {t('common.close')}
              </button>
            </div>

            <dl className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
              <div className="rounded-full bg-white/10 px-3 py-1.5">
                <dt className="sr-only">{t('recall.sourceProvider')}</dt>
                <dd>{providerLabel(session.source.provider)}</dd>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1.5">
                <dt className="sr-only">{t('recall.approvalStatus')}</dt>
                <dd>{t('recall.approved')}</dd>
              </div>
              {session.source.discussedAt ? (
                <div className="rounded-full bg-white/10 px-3 py-1.5">
                  <dt className="sr-only">{t('recall.discussedAt')}</dt>
                  <dd>{formatInstant(session.source.discussedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </header>

          {session.phase === 'reconstruct' ? (
            <div className="space-y-6 p-5 md:p-7">
              <div>
                <label htmlFor="recall-workspace" className="text-sm font-bold text-slate-100">
                  {t('recall.workspaceLabel')}
                </label>
                <textarea
                  id="recall-workspace"
                  value={recallText}
                  onChange={(event) => setRecallText(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  rows={7}
                  placeholder={t('recall.workspacePlaceholder')}
                  className="mt-2 min-h-44 w-full resize-y rounded-2xl border border-slate-600 bg-slate-900 p-4 text-base leading-relaxed text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                />
                <p className="mt-2 text-xs leading-relaxed text-cyan-200">{t('recall.workspacePrivacy')}</p>
              </div>

              <fieldset>
                <legend className="text-sm font-bold text-slate-100">{t('recall.confidenceLegend')}</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {CONFIDENCE_VALUES.map((confidence) => (
                    <button
                      key={confidence}
                      type="button"
                      aria-pressed={session.confidence === confidence}
                      disabled={isPending}
                      onClick={() => chooseConfidence(confidence)}
                      className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:opacity-50 ${session.confidence === confidence
                        ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                        : 'border-slate-600 bg-slate-900 text-slate-200 hover:border-cyan-400'}`}
                    >
                      {t(`recall.confidence.${confidence}`)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => chooseConfidence('low')}
                  className="min-h-11 rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:opacity-50"
                >
                  {t('recall.dontKnow')}
                </button>
                <button
                  type="button"
                  disabled={isPending || !session.confidence}
                  onClick={reveal}
                  className="min-h-11 rounded-xl bg-cyan-400 px-5 py-2 text-sm font-black text-slate-950 hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t(isPending ? 'recall.revealing' : 'recall.reveal')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 bg-white p-5 text-slate-900 md:p-7">
              <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                <h3 className="text-sm font-black text-cyan-950">{t('recall.yourRecall')}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-cyan-950">
                  {recallText || t('recall.emptyRecall')}
                </p>
              </section>

              <section aria-labelledby="recall-correction-title" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:p-5">
                <h3 id="recall-correction-title" className="text-lg font-black text-amber-950">
                  {t('recall.correctionTitle')}
                </h3>
                <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                  <KnowledgeBundleView
                    type={session.bundle.type}
                    centralQuestion={session.bundle.centralQuestion}
                    content={session.bundle.content}
                  />
                </div>
              </section>

              <section aria-labelledby="recall-source-title" className="rounded-2xl border border-slate-200 p-4">
                <h3 id="recall-source-title" className="text-sm font-black text-slate-900">
                  {t('recall.sourceDetails')}
                </h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="font-semibold text-slate-500">{t('recall.sourceProvider')}</dt><dd>{providerLabel(session.sourceDetails.provider)}</dd></div>
                  <div><dt className="font-semibold text-slate-500">{t('recall.approvalStatus')}</dt><dd>{t('recall.approved')}</dd></div>
                  <div><dt className="font-semibold text-slate-500">{t('recall.discussedAt')}</dt><dd>{session.sourceDetails.discussedAt ? formatInstant(session.sourceDetails.discussedAt) : t('recall.notRecorded')}</dd></div>
                  <div><dt className="font-semibold text-slate-500">{t('recall.selectorCount')}</dt><dd>{session.sourceDetails.selectorCount}</dd></div>
                  <div><dt className="font-semibold text-slate-500">{t('recall.itemVersion')}</dt><dd>{session.sourceDetails.supportedItemVersion}</dd></div>
                  <div><dt className="font-semibold text-slate-500">{t('recall.verificationStatus')}</dt><dd>{t('recall.verificationNotRecorded')}</dd></div>
                </dl>
                {session.sourceDetails.sourceUrl ? (
                  <a
                    href={session.sourceDetails.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-blue-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {t('recall.openSource')}
                  </a>
                ) : null}
              </section>

              <fieldset>
                <legend className="text-sm font-black text-slate-900">{t('recall.outcomeLegend')}</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {OUTCOME_VALUES.map((outcome) => (
                    <button
                      key={outcome}
                      type="button"
                      disabled={isPending}
                      onClick={() => complete(outcome)}
                      className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    >
                      {t(`recall.outcome.${outcome}`)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950 p-4 md:px-7">
            <p className="text-xs text-slate-400">{t('recall.noScore')}</p>
            <button
              type="button"
              disabled={isPending}
              onClick={() => cancel(session)}
              className="inline-flex min-h-11 items-center rounded-xl border border-rose-300/50 px-4 text-sm font-bold text-rose-200 hover:bg-rose-400/10 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:opacity-50"
            >
              {t('recall.stop')}
            </button>
          </footer>
        </section>
      ) : null}

      {!session && schedules.length > 0 ? (
        <section aria-labelledby="recall-active-title">
          <h2 id="recall-active-title" className="text-xl font-black text-slate-950">{t('recall.activeTitle')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('recall.activeBody')}</p>
          <ul className="mt-4 grid gap-3">
            {schedules.map((schedule) => (
              <li key={schedule.knowledgeItemId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-800">{t(`bundle.type.${schedule.exerciseType}`)}</span>
                      <span className={`rounded-full px-2.5 py-1 ${schedule.isDue ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        {schedule.isDue ? t('recall.ready') : formatInstant(schedule.dueAt)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-black text-slate-950"><KnowledgeText text={schedule.centralQuestion} /></h3>
                    <p className="mt-1 text-xs text-slate-500">{providerLabel(schedule.source.provider)} · {t('recall.approved')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPending || !schedule.isDue}
                      onClick={() => start(schedule)}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t(isPending ? 'recall.starting' : schedule.isDue ? 'recall.start' : 'recall.notDue')}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => cancel(schedule)}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
                    >
                      {t('recall.stop')}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!session ? (!enrollmentEnabled ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-100 p-5 text-slate-700">
          <h2 className="font-black">{t('recall.rolloutPausedTitle')}</h2>
          <p className="mt-2 text-sm leading-relaxed">{t('recall.rolloutPausedBody')}</p>
        </section>
      ) : (
        <section aria-labelledby="recall-candidate-title">
          <h2 id="recall-candidate-title" className="text-xl font-black text-slate-950">{t('recall.candidateTitle')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('recall.candidateBody')}</p>
          {candidates.length > 0 ? (
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {candidates.map((candidate) => (
                <li key={candidate.knowledgeItemId} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-800">{t(`bundle.type.${candidate.exerciseType}`)}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{providerLabel(candidate.source.provider)}</span>
                  </div>
                  <h3 className="mt-3 flex-1 text-base font-black text-slate-950"><KnowledgeText text={candidate.centralQuestion} /></h3>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => enroll(candidate)}
                    className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {t(isPending ? 'recall.enrolling' : 'recall.enroll')}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="font-black text-slate-900">{t('recall.emptyTitle')}</h3>
              <p className="mt-2 text-sm text-slate-500">{t('recall.emptyBody')}</p>
              <LocalizedLink href="/knowledge-inbox" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500">
                {t('recall.openInbox')}
              </LocalizedLink>
            </div>
          )}
        </section>
      )) : null}
    </div>
  );
}
