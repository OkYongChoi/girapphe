'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import KnowledgeBundleEditor from '@/components/knowledge-bundle-editor';
import KnowledgeBundleView from '@/components/knowledge-bundle-view';
import KnowledgeText from '@/components/knowledge-text';
import { LocalizedLink, localizeHref } from '@/i18n/navigation';
import { useI18n } from '@/i18n/client';
import type { TranslationValues } from '@/i18n';
import type { MessageKey } from '@/i18n/messages';
import {
  prepareKnowledgeLifecycleFormData,
  type KnowledgeLifecycleExactDefaults,
  type KnowledgeLifecycleLocalDefaults,
} from '@/lib/local-datetime';
import {
  ignoreKnowledgeDraft,
  resolveKnowledgeDraft,
} from '@/actions/user-knowledge-actions';
import type {
  KnowledgeCardDraft,
  KnowledgeDuplicateSuggestion,
  KnowledgeResolutionTarget,
} from '@/lib/knowledge-ingestion';

type Seed = {
  title: string;
  summary: string;
  content: string;
  topic: string;
  tags: string[];
  knowledge_type: KnowledgeCardDraft['knowledge_type'];
  central_question: string | null;
  structured_content: KnowledgeCardDraft['structured_content'];
  bundle_schema_version: number | null;
};

function draftSeed(draft: KnowledgeCardDraft): Seed {
  return {
    title: draft.title,
    summary: draft.summary,
    content: draft.explanation,
    topic: draft.topic,
    tags: draft.tags,
    knowledge_type: draft.knowledge_type,
    central_question: draft.central_question,
    structured_content: draft.structured_content,
    bundle_schema_version: draft.bundle_schema_version,
  };
}

function targetSeed(target: KnowledgeResolutionTarget): Seed {
  return {
    title: target.title,
    summary: target.summary,
    content: target.content,
    topic: target.topic,
    tags: target.tags,
    knowledge_type: target.knowledge_type,
    central_question: target.central_question,
    structured_content: target.structured_content,
    bundle_schema_version: target.bundle_schema_version,
  };
}

function asLocalDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function asExactIso(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function evidenceLocation(
  evidence: KnowledgeCardDraft['proposed_evidence'][number],
): { key: MessageKey; values: TranslationValues } {
  if (evidence.selectorType === 'message') return { key: 'resolution.location.message' as MessageKey, values: { value: evidence.messageRef ?? '' } };
  if (evidence.selectorType === 'external_ref') return { key: 'resolution.location.external' as MessageKey, values: { value: evidence.sourceRef ?? '' } };
  if (evidence.selectorType === 'text_position') return { key: 'resolution.location.text' as MessageKey, values: { start: evidence.start ?? '', end: evidence.end ?? '' } };
  return { key: 'resolution.location.lines' as MessageKey, values: { start: evidence.lineStart ?? '', end: evidence.lineEnd ?? '' } };
}

function ResolutionButtons({ hasTarget, blocked }: { hasTarget: boolean; blocked: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-2">
      {hasTarget ? (
        <>
          <button name="resolution_action" value="merge" disabled={pending || blocked} onClick={(event) => { if (!window.confirm(t('resolution.mergeConfirm'))) event.preventDefault(); }} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
            {t('resolution.merge')}
          </button>
          <button name="resolution_action" value="update" disabled={pending || blocked} onClick={(event) => { if (!window.confirm(t('resolution.updateConfirm'))) event.preventDefault(); }} className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50">
            {t('resolution.update')}
          </button>
        </>
      ) : (
        <button name="resolution_action" value="create" disabled={pending || blocked} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
          {pending ? t('topic.lifecycle.saving') : t('resolution.saveNew')}
        </button>
      )}
    </div>
  );
}

function IgnoreButton() {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return <button type="submit" disabled={pending} onClick={(event) => { if (!window.confirm(t('resolution.ignoreConfirm'))) event.preventDefault(); }} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{pending ? t('resolution.ignoring') : t('resolution.ignore')}</button>;
}

function BundlePreview({ value, legacyExplanation = false }: { value: Seed; legacyExplanation?: boolean }) {
  return value.knowledge_type && value.central_question && value.structured_content ? (
    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
      <KnowledgeBundleView type={value.knowledge_type} centralQuestion={value.central_question} content={value.structured_content} compact />
    </div>
  ) : value.content ? <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600"><KnowledgeText text={value.content} legacyDollarMath={legacyExplanation} /></p> : null;
}

export default function DraftResolutionPanel({
  batchId,
  draft,
  target,
  duplicateSuggestions,
}: {
  batchId: string;
  draft: KnowledgeCardDraft;
  target: KnowledgeResolutionTarget | null;
  duplicateSuggestions: KnowledgeDuplicateSuggestion[];
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [seedChoice, setSeedChoice] = useState<'candidate' | 'existing'>('candidate');
  const [error, setError] = useState<string | null>(null);
  const [selectedEvidenceIndexes, setSelectedEvidenceIndexes] = useState<Set<number>>(
    () => new Set(draft.proposed_evidence.map((_, index) => index)),
  );
  const [selectedRelationIndexes, setSelectedRelationIndexes] = useState<Set<number>>(
    () => new Set(draft.relations.flatMap((relation, index) => (
      relation.type === 'causes' || relation.type === 'contributes_to'
      || relation.type === 'enables' || relation.type === 'inhibits' ? [] : [index]
    ))),
  );
  const candidate = draftSeed(draft);
  const existing = target ? targetSeed(target) : null;
  const seed = seedChoice === 'existing' && existing ? existing : candidate;
  const eventObservedAt = draft.structured_content?.type === 'event' ? draft.structured_content.occurred_at : null;
  const createLifecycleDefaults: KnowledgeLifecycleLocalDefaults = {
    observed_at: asLocalDateTime(eventObservedAt),
    review_at: '',
    valid_from: '',
    valid_to: '',
  };
  const createLifecycleExactDefaults: KnowledgeLifecycleExactDefaults = {
    observed_at: asExactIso(eventObservedAt),
    review_at: null,
    valid_from: null,
    valid_to: null,
  };
  const targetLifecycleDefaults: KnowledgeLifecycleLocalDefaults | null = target ? {
    observed_at: asLocalDateTime(target.observed_at),
    review_at: asLocalDateTime(target.review_at),
    valid_from: asLocalDateTime(target.valid_from),
    valid_to: asLocalDateTime(target.valid_to),
  } : null;
  const lifecycleDefaults = targetLifecycleDefaults ?? createLifecycleDefaults;
  const reviewedEvidence = draft.proposed_evidence.filter((_, index) => selectedEvidenceIndexes.has(index));
  const reviewedRelations = draft.relations.filter((_, index) => selectedRelationIndexes.has(index));
  const selectedCausalRelationMissingEvidence = reviewedRelations.some((relation) => (
    (relation.type === 'causes' || relation.type === 'contributes_to'
      || relation.type === 'enables' || relation.type === 'inhibits')
    && !(relation.evidenceSelectorIndexes ?? []).some((index) => selectedEvidenceIndexes.has(index))
  ));

  const resolve = async (formData: FormData) => {
    setError(null);
    try {
      prepareKnowledgeLifecycleFormData(
        formData,
        String(formData.get('resolution_action') ?? ''),
        targetLifecycleDefaults,
        createLifecycleDefaults,
        createLifecycleExactDefaults,
      );
      const result = await resolveKnowledgeDraft(formData);
      if (!result.resolved) {
        setError(result.pendingDependency
          ? t('resolution.pendingDependency')
          : result.stale ? t('resolution.changed') : t('resolution.resolveError'));
        router.refresh();
        return;
      }
      if ((result.skippedEdges ?? 0) > 0) {
        window.location.assign(String(localizeHref(
          `/knowledge-inbox?approved=1&skippedEdges=${result.skippedEdges}`,
          locale,
        )));
        return;
      }
      const topic = String(formData.get('topic') ?? draft.topic);
      router.push(String(localizeHref(`/topics/${encodeURIComponent(topic)}`, locale)));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('resolution.resolveError'));
    }
  };

  const ignore = async (formData: FormData) => {
    setError(null);
    try {
      const result = await ignoreKnowledgeDraft(formData);
      if (!result.resolved) {
        setError(result.stale ? t('resolution.ignoreChanged') : t('resolution.ignoreError'));
        router.refresh();
        return;
      }
      router.push(String(localizeHref(`/knowledge-inbox/${encodeURIComponent(batchId)}`, locale)));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('resolution.ignoreError'));
    }
  };

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">{t('inbox.currentImport')}</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">{t('inbox.reviewTitle')}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-950">{t('inbox.reviewSubtitle')}</p>
      </section>

      <section aria-labelledby="duplicate-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">{t('resolution.duplicateCheck')}</p>
            <h2 id="duplicate-heading" className="mt-1 text-xl font-black text-slate-950">{t('resolution.duplicateTitle')}</h2>
          </div>
          {target ? <LocalizedLink href={`/knowledge-inbox/${encodeURIComponent(batchId)}/${encodeURIComponent(draft.id)}/resolve`} className="text-sm font-bold text-slate-600 hover:underline">{t('resolution.clearTarget')}</LocalizedLink> : null}
        </div>
        {duplicateSuggestions.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{t('resolution.noDuplicate')}</p>
        ) : (
          <ol className="mt-3 grid gap-3 md:grid-cols-2">
            {duplicateSuggestions.map((suggestion) => (
              <li key={suggestion.id} className={`rounded-2xl border bg-white p-4 ${target?.id === suggestion.id ? 'border-violet-400 ring-2 ring-violet-100' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
                  <span className={suggestion.match === 'exact' ? 'text-red-700' : 'text-amber-700'}>{t(`resolution.match.${suggestion.match}` as MessageKey)}</span>
                  <span className="text-slate-500">{Math.round(suggestion.score * 100)}%</span>
                  <span className="text-slate-500">v{suggestion.version}</span>
                </div>
                <h3 className="mt-2 font-bold text-slate-950"><KnowledgeText text={suggestion.title} /></h3>
                {suggestion.central_question ? <p className="mt-1 text-sm font-semibold text-blue-950"><KnowledgeText text={suggestion.central_question} /></p> : null}
                {suggestion.summary ? <p className="mt-2 line-clamp-3 text-sm text-slate-600"><KnowledgeText text={suggestion.summary} /></p> : null}
                <LocalizedLink href={`/knowledge-inbox/${encodeURIComponent(batchId)}/${encodeURIComponent(draft.id)}/resolve?target=${encodeURIComponent(suggestion.id)}`} className="mt-3 inline-flex rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700">{t('resolution.compare')}</LocalizedLink>
              </li>
            ))}
          </ol>
        )}
      </section>

      {target && existing ? (
        <section aria-labelledby="comparison-heading">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{t('resolution.sideReview')}</p>
          <h2 id="comparison-heading" className="mt-1 text-xl font-black text-slate-950">{t('resolution.comparisonTitle')}</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-amber-200 bg-white p-5">
              <p className="text-xs font-bold uppercase text-amber-700">{t('resolution.candidateVersion', { version: draft.version })}</p>
              <h3 className="mt-2 text-lg font-black text-slate-950"><KnowledgeText text={candidate.title} /></h3>
              {candidate.central_question ? <p className="mt-1 font-semibold text-blue-950"><KnowledgeText text={candidate.central_question} /></p> : null}
              {candidate.summary ? <p className="mt-2 text-sm text-slate-600"><KnowledgeText text={candidate.summary} /></p> : null}
              <BundlePreview value={candidate} legacyExplanation />
            </article>
            <article className="rounded-2xl border border-violet-200 bg-white p-5">
              <p className="text-xs font-bold uppercase text-violet-700">{t('resolution.existingVersion', { version: target.version })}</p>
              <h3 className="mt-2 text-lg font-black text-slate-950"><KnowledgeText text={existing.title} /></h3>
              {existing.central_question ? <p className="mt-1 font-semibold text-blue-950"><KnowledgeText text={existing.central_question} /></p> : null}
              {existing.summary ? <p className="mt-2 text-sm text-slate-600"><KnowledgeText text={existing.summary} /></p> : null}
              <BundlePreview value={existing} />
            </article>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="final-heading" className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{t('resolution.outputEyebrow')}</p>
            <h2 id="final-heading" className="mt-1 text-xl font-black text-slate-950">{t('resolution.outputTitle')}</h2>
          </div>
          {existing ? (
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
              <button type="button" aria-pressed={seedChoice === 'candidate'} onClick={() => setSeedChoice('candidate')} className={`rounded-lg px-3 py-2 ${seedChoice === 'candidate' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>{t('resolution.startCandidate')}</button>
              <button type="button" aria-pressed={seedChoice === 'existing'} onClick={() => setSeedChoice('existing')} className={`rounded-lg px-3 py-2 ${seedChoice === 'existing' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600'}`}>{t('resolution.startExisting')}</button>
            </div>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('resolution.outputBody')}</p>

        <form key={`${target?.id ?? 'new'}:${seedChoice}`} action={resolve} className="mt-5 grid gap-4">
          <input type="hidden" name="batch_id" value={batchId} />
          <input type="hidden" name="draft_id" value={draft.id} />
          <input type="hidden" name="draft_version" value={draft.version} />
          <input type="hidden" name="lifecycle_patch_semantics" value="tri_state_v1" />
          <input type="hidden" name="evidence_selectors_json" value={JSON.stringify(reviewedEvidence)} />
          <input type="hidden" name="relations_json" value={JSON.stringify(reviewedRelations)} />
          {target ? <><input type="hidden" name="target_item_id" value={target.id} /><input type="hidden" name="target_version" value={target.version} /></> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-slate-700">{t('notes.titleLabel')}<input name="title" required maxLength={120} defaultValue={seed.title} className="min-h-11 rounded-lg border px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-400" /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">{t('notes.newTopic')}<input name="topic" required maxLength={120} defaultValue={seed.topic} className="min-h-11 rounded-lg border px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-400" /></label>
          </div>
          <KnowledgeBundleEditor defaultType={seed.knowledge_type} defaultQuestion={seed.central_question} defaultContent={seed.structured_content} legacyContent={seed.knowledge_type ? '' : seed.content} />
          <label className="grid gap-1 text-xs font-bold text-slate-700">{t('knowledge.summaryLabel')}<textarea name="summary" maxLength={500} defaultValue={seed.summary} className="min-h-20 rounded-lg border p-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-400" /></label>
          <label className="grid gap-1 text-xs font-bold text-slate-700">{t('notes.contentLabel')}<textarea name="content" maxLength={6000} defaultValue={seed.content} className="min-h-32 rounded-lg border p-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-400" /></label>
          <label className="grid gap-1 text-xs font-bold text-slate-700">{t('knowledge.tagsLabel')}<input name="tags" maxLength={599} defaultValue={seed.tags.join(', ')} className="min-h-11 rounded-lg border px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-400" /></label>

          <details open={draft.relations.some((relation) => (
            relation.type === 'causes' || relation.type === 'contributes_to'
            || relation.type === 'enables' || relation.type === 'inhibits'
          ))} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-bold text-slate-800">{t('resolution.metadata')}</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-bold text-slate-700">{t('bundle.field.occurredAt')}<input type="datetime-local" name="observed_at" defaultValue={lifecycleDefaults.observed_at} className="min-h-11 rounded-lg border bg-white px-3 text-sm font-normal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-700">{t('topic.lifecycle.reviewAt')}<input type="datetime-local" name="review_at" defaultValue={lifecycleDefaults.review_at} className="min-h-11 rounded-lg border bg-white px-3 text-sm font-normal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-700">{t('notes.from')}<input type="datetime-local" name="valid_from" defaultValue={lifecycleDefaults.valid_from} className="min-h-11 rounded-lg border bg-white px-3 text-sm font-normal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-700">{t('notes.to')}<input type="datetime-local" name="valid_to" defaultValue={lifecycleDefaults.valid_to} className="min-h-11 rounded-lg border bg-white px-3 text-sm font-normal" /></label>
            </div>
            {draft.relations.length > 0 ? (
              <fieldset className="mt-4">
                <legend className="text-xs font-bold text-slate-700">{t('resolution.relationships')}</legend>
                <p className="mt-1 text-xs text-slate-500">{t('resolution.relationshipsBody')}</p>
                <div className="mt-2 grid gap-2">
                  {draft.relations.map((relation, index) => {
                    const causal = relation.type === 'causes' || relation.type === 'contributes_to'
                      || relation.type === 'enables' || relation.type === 'inhibits';
                    const evidenceLabels = (relation.evidenceSelectorIndexes ?? []).map((evidenceIndex) => `#${evidenceIndex + 1}`);
                    const directionLabel = t(
                      relation.direction === 'incoming' ? 'resolution.direction.incoming' : 'resolution.direction.outgoing',
                      { target: relation.targetId },
                    );
                    const relationTypeLabel = causal
                      ? t(`topic.graph.relation.${relation.type}` as MessageKey)
                      : relation.type.replaceAll('_', ' ');
                    return (
                      <label key={`${relation.targetKind}:${relation.targetId}:${relation.type}:${index}`} className={`flex items-start gap-2 rounded-lg border bg-white p-3 text-xs ${causal ? 'border-amber-300 text-amber-950' : 'border-slate-200 text-slate-700'}`}>
                        <input
                          type="checkbox"
                          checked={selectedRelationIndexes.has(index)}
                          onChange={(event) => setSelectedRelationIndexes((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(index);
                            else next.delete(index);
                            return next;
                          })}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          <strong>{directionLabel}</strong>
                          {' · '}{relationTypeLabel} · {t(`resolution.target.${relation.targetKind}` as MessageKey)} · {t(`topic.graph.origin.${relation.relationOrigin ?? 'model_inferred'}` as MessageKey)}
                          {' · '}{evidenceLabels.length > 0
                            ? t('resolution.relationshipEvidence', { refs: evidenceLabels.join(', ') })
                            : t('resolution.relationshipEvidenceNone')}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
            {draft.proposed_evidence.length > 0 ? (
              <fieldset className="mt-4">
                <legend className="text-xs font-bold text-slate-700">{t('resolution.evidence')}</legend>
                <p className="mt-1 text-xs text-slate-500">{t('resolution.evidenceBody')}</p>
                <div className="mt-2 grid gap-2">
                  {draft.proposed_evidence.map((evidence, index) => {
                    const location = evidenceLocation(evidence);
                    return (
                    <label key={`${evidence.selectorType}:${index}`} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedEvidenceIndexes.has(index)}
                        onChange={(event) => setSelectedEvidenceIndexes((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(index);
                          else next.delete(index);
                          return next;
                        })}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span><strong>#{index + 1} · {t(location.key, location.values)}</strong> · {evidence.polarity} · {evidence.quality} · {t(`topic.graph.origin.${evidence.relationOrigin}` as MessageKey)}</span>
                    </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : <p className="mt-3 text-xs text-slate-500">{t('resolution.noEvidence')}</p>}
          </details>

          {selectedCausalRelationMissingEvidence ? (
            <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              {t('resolution.causalEvidenceRequired')}
            </p>
          ) : null}

          {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : null}
          <ResolutionButtons hasTarget={Boolean(target)} blocked={selectedCausalRelationMissingEvidence} />
        </form>

        <form action={ignore} className="mt-4 border-t border-slate-100 pt-4">
          <input type="hidden" name="batch_id" value={batchId} />
          <input type="hidden" name="draft_id" value={draft.id} />
          <input type="hidden" name="draft_version" value={draft.version} />
          <IgnoreButton />
        </form>
      </section>
    </div>
  );
}
