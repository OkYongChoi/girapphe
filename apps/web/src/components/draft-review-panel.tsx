'use client';

import { useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  approveKnowledgeDrafts,
  discardKnowledgeDraftBatch,
  updateKnowledgeDraft,
} from '@/actions/knowledge-ingestion-actions';
import ConfirmDeleteButton from '@/components/confirm-delete-button';
import SubmitButton from '@/components/submit-button';
import { draftDependencies, includeDraftDependencies } from '@/components/draft-review-selection';
import KnowledgeBundleEditor from '@/components/knowledge-bundle-editor';
import { isKnowledgeBundleType, type KnowledgeBundleContent, type KnowledgeBundleType } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';
import { LocalizedLink, localizeHref } from '@/i18n/navigation';

const RELATION_TYPES = [
  'related',
  'prerequisite',
  'generalizes',
  'derived_from',
  'equivalent_to',
  'supersedes',
  'answers',
  'supports',
  'contradicts',
  'causes',
  'contributes_to',
  'enables',
  'inhibits',
] as const;

type DraftLinkTarget = {
  id: string;
  label: string;
  scope: 'public' | 'private' | 'draft';
};

type EditableRelation = {
  targetId: string;
  targetKind: 'public' | 'private' | 'draft';
  type: (typeof RELATION_TYPES)[number];
  direction: 'outgoing' | 'incoming';
  weight: number;
  evidenceSelectorIndexes: number[];
};

type DraftReviewPanelProps = {
  batch: unknown;
  drafts: unknown[];
  linkTargets?: DraftLinkTarget[];
};

function SelectionSubmitButton({ count, blocked }: { count: number; blocked: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button
      type="submit"
      disabled={pending || count === 0 || blocked}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? t('topic.lifecycle.saving') : t('inbox.saveSelected', { count })}
    </button>
  );
}

function ConfirmApprovalButton({
  label,
  loadingLabel,
  confirmMessage,
  blocked,
  className,
}: {
  label: string;
  loadingLabel: string;
  confirmMessage: string;
  blocked: boolean;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blocked}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
      className={className}
    >
      {pending ? loadingLabel : label}
    </button>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function readTags(record: Record<string, unknown>) {
  const value = record.tags;
  if (Array.isArray(value)) return value.filter((tag): tag is string => typeof tag === 'string').join(', ');
  return typeof value === 'string' ? value : '';
}

function normalizeRelationType(value: unknown): EditableRelation['type'] {
  return RELATION_TYPES.includes(value as EditableRelation['type'])
    ? value as EditableRelation['type']
    : 'related';
}

function inferTargetKind(
  targetId: string,
  fallback: EditableRelation['targetKind'] = 'public'
): EditableRelation['targetKind'] {
  if (targetId.startsWith('draft:')) return 'draft';
  if (targetId.startsWith('personal:')) return 'private';
  if (targetId.startsWith('graph_')) return 'public';
  return fallback;
}

function readRelations(record: Record<string, unknown>): EditableRelation[] {
  let value = record.relations ?? record.relation_suggestions ?? record.suggested_relations ?? [];
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const relation = asRecord(item);
    const targetId = readString(relation, 'target_id', 'targetId', 'target');
    if (!targetId) return [];
    const rawTargetKind = relation.target_kind ?? relation.targetKind;
    const weight = Number(relation.weight);
    const evidenceSelectorIndexes = (relation.evidence_selector_indexes ?? relation.evidenceSelectorIndexes);
    return [{
      targetId,
      targetKind: rawTargetKind === 'draft' || rawTargetKind === 'private' || rawTargetKind === 'public'
        ? rawTargetKind
        : inferTargetKind(targetId),
      type: normalizeRelationType(relation.type ?? relation.relation_type),
      direction: relation.direction === 'incoming' ? 'incoming' : 'outgoing',
      weight: Number.isFinite(weight) && weight >= 0.05 && weight <= 1 ? weight : 1,
      evidenceSelectorIndexes: Array.isArray(evidenceSelectorIndexes)
        ? [...new Set(evidenceSelectorIndexes.filter((index): index is number => Number.isInteger(index) && index >= 0))]
        : [],
    }];
  });
}

function providerLabel(batch: Record<string, unknown>) {
  const provider = readString(batch, 'provider', 'source_provider', 'source_type') || 'Girapphe';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function DraftRelationsEditor({
  draftId,
  initialRelations,
  targetListId,
  onDirty,
}: {
  draftId: string;
  initialRelations: EditableRelation[];
  targetListId: string;
  onDirty: () => void;
}) {
  const [relations, setRelations] = useState(initialRelations);

  return (
    <fieldset className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <legend className="px-1 text-xs font-semibold text-slate-700">Relationships</legend>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        Only relationships saved here become graph edges. Use stable concept IDs; no semantic matching is performed.
      </p>
      <input
        type="hidden"
        name="relations_json"
        value={JSON.stringify(relations.filter((relation) => relation.targetId.trim()).map((relation) => ({
          target_kind: relation.targetKind,
          target_id: relation.targetId.trim(),
          type: relation.type,
          direction: relation.direction,
          weight: relation.weight,
          evidence_selector_indexes: relation.evidenceSelectorIndexes,
        })))}
      />
      {relations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
          No relationship selected. The card can still be added and linked later from My Knowledge.
        </p>
      ) : (
        <div className="space-y-2">
          {relations.map((relation, index) => (
            <div key={`${draftId}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_7rem_9rem_auto]">
              <label className="sr-only" htmlFor={`${draftId}-relation-target-${index}`}>Relationship target</label>
              <input
                id={`${draftId}-relation-target-${index}`}
                list={targetListId}
                value={relation.targetId}
                onChange={(event) => {
                  onDirty();
                  setRelations((current) => current.map((item, itemIndex) => itemIndex === index
                    ? { ...item, targetId: event.target.value, targetKind: inferTargetKind(event.target.value, item.targetKind) }
                    : item));
                }}
                placeholder="graph_concept_id or personal:item-id"
                className="min-h-10 rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
              <label className="sr-only" htmlFor={`${draftId}-relation-evidence-${index}`}>Evidence selector indexes</label>
              <input
                id={`${draftId}-relation-evidence-${index}`}
                value={relation.evidenceSelectorIndexes.join(', ')}
                onChange={(event) => {
                  onDirty();
                  const indexes = [...new Set(event.target.value.split(',')
                    .map((value) => value.trim())
                    .filter(Boolean)
                    .map(Number)
                    .filter((value) => Number.isInteger(value) && value >= 0))];
                  setRelations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, evidenceSelectorIndexes: indexes } : item));
                }}
                placeholder="Evidence: 0, 1"
                title="Zero-based evidence selector indexes. Causal relationships require at least one."
                className="min-h-10 rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
              <label className="sr-only" htmlFor={`${draftId}-relation-type-${index}`}>Relationship type</label>
              <select
                id={`${draftId}-relation-type-${index}`}
                value={relation.type}
                onChange={(event) => {
                  onDirty();
                  setRelations((current) => current.map((item, itemIndex) => itemIndex === index
                    ? { ...item, type: normalizeRelationType(event.target.value) }
                    : item));
                }}
                className="min-h-10 rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              >
                {RELATION_TYPES.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
              </select>
              <label className="sr-only" htmlFor={`${draftId}-relation-direction-${index}`}>Relationship direction</label>
              <select
                id={`${draftId}-relation-direction-${index}`}
                value={relation.direction}
                disabled={relation.type === 'related' || relation.type === 'equivalent_to'}
                onChange={(event) => {
                  onDirty();
                  setRelations((current) => current.map((item, itemIndex) => itemIndex === index
                    ? { ...item, direction: event.target.value === 'incoming' ? 'incoming' : 'outgoing' }
                    : item));
                }}
                className="min-h-10 rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="outgoing">{relation.type === 'related' || relation.type === 'equivalent_to' ? 'Two-way' : 'This → target'}</option>
                <option value="incoming">Target → this</option>
              </select>
              <label className="sr-only" htmlFor={`${draftId}-relation-weight-${index}`}>Relationship weight</label>
              <input
                id={`${draftId}-relation-weight-${index}`}
                type="number"
                min="0.05"
                max="1"
                step="0.05"
                value={relation.weight}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isFinite(value)) return;
                  onDirty();
                  setRelations((current) => current.map((item, itemIndex) => itemIndex === index
                    ? { ...item, weight: Math.min(1, Math.max(0.05, value)) }
                    : item));
                }}
                title="Relationship strength from 0.05 to 1"
                className="min-h-10 rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={() => {
                  onDirty();
                  setRelations((current) => current.filter((_, itemIndex) => itemIndex !== index));
                }}
                className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          onDirty();
          setRelations((current) => [...current, {
            targetId: '',
            targetKind: 'public',
            type: 'related',
            direction: 'outgoing',
            weight: 1,
            evidenceSelectorIndexes: [],
          }]);
        }}
        className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
      >
        Add relationship
      </button>
    </fieldset>
  );
}

function DraftCardEditor({
  draft,
  selected,
  onSelectedChange,
  onDirtyChange,
  targetListId,
  dependencyRequired,
}: {
  draft: unknown;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
  targetListId: string;
  dependencyRequired: boolean;
}) {
  const { t } = useI18n();
  const [saveError, setSaveError] = useState<string | null>(null);
  const record = asRecord(draft);
  const id = readString(record, 'id', 'draft_id');
  const batchId = readString(record, 'batch_id');
  const title = readString(record, 'title');
  const summary = readString(record, 'summary');
  const explanation = readString(record, 'explanation', 'content');
  const topic = readString(record, 'topic', 'domain') || 'general';
  const version = typeof record.version === 'number' ? record.version : Number(record.version ?? 1);
  const relations = readRelations(record);
  const knowledgeType: KnowledgeBundleType | null = isKnowledgeBundleType(record.knowledge_type) ? record.knowledge_type : null;
  const centralQuestion = readString(record, 'central_question');
  const structuredContent = record.structured_content && typeof record.structured_content === 'object'
    ? record.structured_content as KnowledgeBundleContent
    : null;

  return (
    <article className={`rounded-2xl border bg-white shadow-sm transition ${selected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3 border-b border-slate-100 p-4 md:p-5">
        <input
          id={`select-${id}`}
          type="checkbox"
          checked={selected}
          disabled={dependencyRequired}
          onChange={(event) => onSelectedChange(event.target.checked)}
          title={dependencyRequired ? 'Required by a relationship from another selected draft' : undefined}
          className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor={`select-${id}`} className="min-w-0 flex-1 cursor-pointer">
          <span className="block text-xs font-semibold uppercase tracking-wide text-amber-700">{t('inbox.candidateUnconfirmed')}</span>
          <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{knowledgeType ? `${t('bundle.structuredView')} · ${t(`bundle.type.${knowledgeType}`)}` : t('bundle.quickNote')}</span>
          <span className="mt-1 block truncate text-base font-semibold text-slate-950">{title || 'Untitled draft'}</span>
          <span className="mt-1 block font-mono text-[10px] text-slate-400">{id}</span>
        </label>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
          {dependencyRequired ? 'Required by relation' : selected ? 'Selected' : 'Not selected'}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-amber-50/60 px-4 py-3 md:px-5">
        <p className="max-w-2xl text-xs leading-relaxed text-amber-950">{t('inbox.resolutionBody')}</p>
        <LocalizedLink href={`/knowledge-inbox/${encodeURIComponent(batchId)}/${encodeURIComponent(id)}/resolve`} className="inline-flex min-h-10 items-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">
          {t('inbox.reviewResolution')} →
        </LocalizedLink>
      </div>

      <details className="group">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:px-5">
          {t('inbox.editCandidate')} <span aria-hidden="true" className="ml-1 text-slate-400 group-open:hidden">+</span><span aria-hidden="true" className="ml-1 hidden text-slate-400 group-open:inline">−</span>
        </summary>
        <form
          className="grid gap-4 border-t border-slate-100 p-4 md:p-5"
          onChange={() => onDirtyChange(true)}
          action={async (formData) => {
            try {
              await updateKnowledgeDraft(formData);
              setSaveError(null);
              onDirtyChange(false);
            } catch {
              setSaveError('This draft changed before your edit was saved. Reload the batch and try again.');
              onDirtyChange(true);
            }
          }}
        >
          <input type="hidden" name="draft_id" value={id} />
          <input type="hidden" name="batch_id" value={batchId} />
          <input type="hidden" name="version" value={Number.isFinite(version) ? version : 1} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Title
              <input name="title" required defaultValue={title} maxLength={120} className="min-h-10 rounded-lg border px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-400" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Topic
              <input name="topic" defaultValue={topic} maxLength={48} className="min-h-10 rounded-lg border px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-400" />
            </label>
          </div>
          <KnowledgeBundleEditor
            defaultType={knowledgeType}
            defaultQuestion={centralQuestion}
            defaultContent={structuredContent}
          />
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Summary
            <textarea name="summary" defaultValue={summary} maxLength={500} className="min-h-20 rounded-lg border p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Explanation
            <textarea name="explanation" defaultValue={explanation} maxLength={6000} className="min-h-36 rounded-lg border p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Tags
            <input name="tags" defaultValue={readTags(record)} maxLength={599} placeholder="ml, optimization, #gradient-descent" className="min-h-10 rounded-lg border px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-400" />
            <span className="font-normal text-slate-500">Up to 12 comma-separated tags, 48 characters each. Semantic search is not used.</span>
          </label>

          <DraftRelationsEditor draftId={id} initialRelations={relations} targetListId={targetListId} onDirty={() => onDirtyChange(true)} />

          {saveError ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              {saveError}
            </p>
          ) : null}

          <div>
            <SubmitButton
              label="Save draft changes"
              loadingLabel="Saving draft…"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            />
          </div>
        </form>
      </details>
    </article>
  );
}

export default function DraftReviewPanel({ batch, drafts, linkTargets = [] }: DraftReviewPanelProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const batchRecord = asRecord(batch);
  const batchId = readString(batchRecord, 'id', 'batch_id');
  const provider = providerLabel(batchRecord);
  const sourceReference = readString(batchRecord, 'source_reference', 'source_ref', 'conversation_ref', 'external_source_id');
  const sourceUrl = readString(batchRecord, 'source_url');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const draftTargets = useMemo<DraftLinkTarget[]>(() => drafts.map((draft) => {
    const record = asRecord(draft);
    return {
      id: `draft:${readString(record, 'id', 'draft_id')}`,
      label: readString(record, 'title') || 'Untitled draft',
      scope: 'draft',
    };
  }), [drafts]);
  const targets = useMemo(() => [...draftTargets, ...linkTargets], [draftTargets, linkTargets]);
  const dependencyMap = useMemo(() => draftDependencies(drafts.flatMap((draft) => {
    const record = asRecord(draft);
    const id = readString(record, 'id', 'draft_id');
    if (!id) return [];
    return [{
      id,
      clientCardId: readString(record, 'client_card_id', 'clientCardId') || undefined,
      relations: readRelations(record),
    }];
  })), [drafts]);
  const selectableDraftIds = useMemo(() => drafts
    .map((draft) => readString(asRecord(draft), 'id', 'draft_id'))
    .filter(Boolean), [drafts]);
  const draftVersions = useMemo(() => Object.fromEntries(drafts.flatMap((draft) => {
    const record = asRecord(draft);
    const id = readString(record, 'id', 'draft_id');
    const version = typeof record.version === 'number' ? record.version : Number(record.version ?? 1);
    return id ? [[id, Number.isFinite(version) ? version : 1] as const] : [];
  })), [drafts]);
  const effectiveSelectedIds = useMemo(
    () => includeDraftDependencies(selectedIds, dependencyMap),
    [dependencyMap, selectedIds]
  );
  const requiredDependencyIds = useMemo(() => {
    const required = new Set<string>();
    for (const sourceId of effectiveSelectedIds) {
      for (const dependencyId of dependencyMap.get(sourceId) ?? []) required.add(dependencyId);
    }
    return required;
  }, [dependencyMap, effectiveSelectedIds]);
  const selectedDirtyCount = [...dirtyIds].filter((id) => effectiveSelectedIds.has(id)).length;
  const causalReviewRequiredIds = useMemo(() => new Set(drafts.flatMap((draft) => {
    const record = asRecord(draft);
    const id = readString(record, 'id', 'draft_id');
    return id && readRelations(record).some((relation) => (
      relation.type === 'causes' || relation.type === 'contributes_to'
      || relation.type === 'enables' || relation.type === 'inhibits'
    )) ? [id] : [];
  })), [drafts]);
  const selectedCausalReviewCount = [...causalReviewRequiredIds]
    .filter((id) => effectiveSelectedIds.has(id)).length;

  const finishApproval = async (formData: FormData) => {
    setApprovalError(null);
    const result = await approveKnowledgeDrafts(formData);
    if (result.approved === 0) {
      setApprovalError(result.requiresEvidenceReview
        ? 'Causal relationships require a detailed review of their evidence. Open each highlighted candidate with Review resolution, choose its evidence, and save it there.'
        : 'No cards were added. This batch may have changed in another session; reload it before approving again.');
      router.refresh();
      return;
    }
    window.location.assign(String(localizeHref(`/knowledge-inbox?approved=${result.approved}&skippedEdges=${result.skippedEdges}`, locale)));
  };

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 md:p-5" aria-label="Current import scope">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Current batch only</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{provider} · {drafts.length} draft cards</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Approval below applies only to this explicitly sent batch. Girapphe does not fetch other or historical conversations.
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white/80 px-3 py-2 text-right">
            <p className="font-mono text-[10px] text-slate-500">Batch {batchId}</p>
            {sourceReference ? <p className="mt-1 max-w-xs truncate text-xs text-slate-600">Source {sourceReference}</p> : null}
            {sourceUrl.startsWith('https://') ? <a href={sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-1 block text-xs font-semibold text-blue-700 hover:underline">{t('inbox.openSelectedSource')} ↗</a> : null}
          </div>
        </div>
      </section>

      <datalist id="knowledge-draft-relation-targets">
        {targets.map((target) => (
          <option key={`${target.scope}:${target.id}`} value={target.id}>
            {target.label} ({target.scope})
          </option>
        ))}
      </datalist>

      <div className="sticky top-[7.5rem] z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{effectiveSelectedIds.size} of {drafts.length} selected</p>
            <div className="mt-1 flex gap-3 text-xs">
              <button type="button" onClick={() => setSelectedIds(new Set(selectableDraftIds))} className="font-semibold text-blue-700 hover:underline">Select all</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="font-semibold text-slate-600 hover:underline">Clear</button>
            </div>
            {dirtyIds.size > 0 ? (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                {dirtyIds.size} draft{dirtyIds.size === 1 ? ' has' : 's have'} unsaved edits. Save selected drafts before approval; adding the whole batch is disabled.
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              {t('inbox.fastSaveBody')}
            </p>
            {causalReviewRequiredIds.size > 0 ? (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                {causalReviewRequiredIds.size} causal candidate{causalReviewRequiredIds.size === 1 ? '' : 's'} must be opened with Review resolution so you can inspect and choose the supporting evidence before approval.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form action={finishApproval}>
              <input type="hidden" name="batch_id" value={batchId} />
              <input type="hidden" name="draft_versions" value={JSON.stringify(draftVersions)} />
              {[...effectiveSelectedIds].map((id) => <input key={id} type="hidden" name="draft_id" value={id} />)}
              <SelectionSubmitButton count={effectiveSelectedIds.size} blocked={selectedDirtyCount > 0 || selectedCausalReviewCount > 0} />
            </form>

            <form action={finishApproval}>
              <input type="hidden" name="batch_id" value={batchId} />
              <input type="hidden" name="approve_all" value="true" />
              <input type="hidden" name="draft_versions" value={JSON.stringify(draftVersions)} />
              <ConfirmApprovalButton
                label={t('inbox.saveBatch')}
                loadingLabel={t('inbox.savingBatch')}
                confirmMessage={t('inbox.saveBatchConfirm', { count: drafts.length, provider })}
                blocked={dirtyIds.size > 0 || causalReviewRequiredIds.size > 0}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </form>

            <form
              action={async (formData) => {
                await discardKnowledgeDraftBatch(formData);
                router.push(String(localizeHref('/knowledge-inbox', locale)));
                router.refresh();
              }}
            >
              <input type="hidden" name="batch_id" value={batchId} />
              <ConfirmDeleteButton
                label={t('inbox.ignoreBatch')}
                confirmMessage={t('inbox.ignoreBatchConfirm', { count: drafts.length, provider })}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
              />
            </form>
          </div>
        </div>
        {approvalError ? (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {approvalError}
          </p>
        ) : null}
      </div>

      {drafts.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-900">No pending cards in this batch</h2>
          <p className="mt-1 text-sm text-slate-500">They may already have been approved or discarded.</p>
          <LocalizedLink href="/knowledge-inbox" className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{t('inbox.back')}</LocalizedLink>
        </section>
      ) : (
        <div className="grid gap-4">
          {drafts.map((draft) => {
            const id = readString(asRecord(draft), 'id', 'draft_id');
            return (
              <DraftCardEditor
                key={id}
                draft={draft}
                selected={effectiveSelectedIds.has(id)}
                onSelectedChange={(selected) => setSelectedIds((current) => {
                  const next = new Set(current);
                  if (selected) next.add(id);
                  else next.delete(id);
                  return includeDraftDependencies(next, dependencyMap);
                })}
                onDirtyChange={(dirty) => setDirtyIds((current) => {
                  const next = new Set(current);
                  if (dirty) next.add(id);
                  else next.delete(id);
                  return next;
                })}
                targetListId="knowledge-draft-relation-targets"
                dependencyRequired={requiredDependencyIds.has(id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
