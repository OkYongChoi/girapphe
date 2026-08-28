'use client';

import type { KnowledgeBundleContent, KnowledgeBundleType } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';

type KnowledgeBundleViewProps = {
  type: KnowledgeBundleType;
  centralQuestion: string;
  content: KnowledgeBundleContent;
  compact?: boolean;
};

const panel = 'rounded-lg border border-slate-200 bg-slate-50 p-3';

function List({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;
  return <section className={panel}><h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">{title}</h4><ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-700">{values.map((value, index) => <li key={`${index}-${value}`}>{value}</li>)}</ul></section>;
}

function PairList({ title, values }: { title: string; values: Array<{ label: string; detail: string }> }) {
  if (values.length === 0) return null;
  return <section className={panel}><h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">{title}</h4><dl className="mt-2 space-y-2 text-sm">{values.map((value, index) => <div key={`${index}-${value.label}`}><dt className="font-semibold text-slate-900">{value.label}</dt><dd className="text-slate-600">{value.detail}</dd></div>)}</dl></section>;
}

function structureDepth(content: Extract<KnowledgeBundleContent, { type: 'structure' }>, componentId: string) {
  let depth = 0;
  let parentId = content.components.find((item) => item.id === componentId)?.parent_id;
  const seen = new Set([componentId]);
  while (parentId && !seen.has(parentId) && depth < content.components.length) {
    seen.add(parentId); depth += 1;
    parentId = content.components.find((item) => item.id === parentId)?.parent_id;
  }
  return depth;
}

export default function KnowledgeBundleView({ type, centralQuestion, content, compact = false }: KnowledgeBundleViewProps) {
  const { t } = useI18n();
  return (
    <section className="space-y-3" aria-label={t('bundle.structuredView')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">{t(`bundle.type.${type}`)}</span>
        <p className="font-semibold text-slate-900">{centralQuestion}</p>
      </div>
      {!compact ? <BundleBody content={content} t={t} /> : <BundleCompact content={content} />}
    </section>
  );
}

function BundleCompact({ content }: { content: KnowledgeBundleContent }) {
  const values = content.type === 'concept' ? [content.definition, ...content.key_points]
    : content.type === 'procedure' ? [content.goal, ...content.steps.map((step) => step.title)]
    : content.type === 'comparison' ? [...content.targets, ...content.differences]
    : content.type === 'mechanism' ? [...content.causes, ...content.stages.map((stage) => stage.title), ...content.results]
    : content.type === 'structure' ? [content.purpose, ...content.components.map((item) => `${item.label}: ${item.role}`)]
    : [content.claim, ...content.evidence.map((item) => item.statement), ...content.limitations];
  return <ul className="list-disc space-y-1 ps-5 text-sm text-slate-700">{values.filter(Boolean).slice(0, 8).map((value, index) => <li key={`${index}-${value}`}>{value}</li>)}</ul>;
}

function BundleBody({ content, t }: { content: KnowledgeBundleContent; t: ReturnType<typeof useI18n>['t'] }) {
  switch (content.type) {
    case 'concept': return <div className="grid gap-3 md:grid-cols-2">
      {content.definition ? <section className={`${panel} md:col-span-2`}><h4 className="text-xs font-bold uppercase text-slate-600">{t('bundle.field.definition')}</h4><p className="mt-2 text-sm text-slate-800">{content.definition}</p></section> : null}
      <List title={t('bundle.field.keyPoints')} values={content.key_points} /><List title={t('bundle.field.examples')} values={content.examples} /><List title={t('bundle.field.nonExamples')} values={content.non_examples} />
      {content.misconceptions.length ? <section className={panel}><h4 className="text-xs font-bold uppercase text-slate-600">{t('bundle.field.misconceptions')}</h4><dl className="mt-2 space-y-2 text-sm">{content.misconceptions.map((item, index) => <div key={index}><dt className="font-semibold text-rose-700">{item.claim}</dt><dd className="text-slate-700">{item.correction}</dd></div>)}</dl></section> : null}
    </div>;
    case 'procedure': return <div className="space-y-3">
      {content.goal ? <p className={`${panel} text-sm text-slate-800`}>{content.goal}</p> : null}<List title={t('bundle.field.prerequisites')} values={content.prerequisites} />
      {content.steps.length ? <ol className="space-y-2">{content.steps.map((step, index) => <li key={index} className="flex gap-3 rounded-lg border bg-white p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{index + 1}</span><div><strong className="text-sm text-slate-900">{step.title}</strong>{step.detail ? <p className="mt-1 text-sm text-slate-600">{step.detail}</p> : null}</div></li>)}</ol> : null}
      <div className="grid gap-3 md:grid-cols-2"><PairList title={t('bundle.field.branches')} values={content.branches.map((item) => ({ label: item.condition, detail: item.action }))} /><PairList title={t('bundle.field.failureModes')} values={content.failure_modes.map((item) => ({ label: item.symptom, detail: item.response }))} /></div>
      <List title={t('bundle.field.doneWhen')} values={content.done_when} />
    </div>;
    case 'comparison': return <div className="space-y-3">
      {content.criteria.length ? <div className="overflow-x-auto rounded-lg border"><table className="min-w-full text-sm"><thead className="bg-slate-100"><tr><th className="p-2 text-start">{t('bundle.field.criteria')}</th>{content.targets.map((target) => <th key={target} className="p-2 text-start">{target}</th>)}</tr></thead><tbody>{content.criteria.map((item) => <tr key={item.name} className="border-t"><th className="p-2 text-start font-semibold">{item.name}</th>{content.targets.map((_, index) => <td key={index} className="p-2">{item.values[index] ?? '—'}</td>)}</tr>)}</tbody></table></div> : <List title={t('bundle.field.targets')} values={content.targets} />}
      <div className="grid gap-3 md:grid-cols-2"><List title={t('bundle.field.commonalities')} values={content.commonalities} /><List title={t('bundle.field.differences')} values={content.differences} /></div>
      <PairList title={t('bundle.field.choiceGuide')} values={content.choice_guide.map((item) => ({ label: item.condition, detail: item.recommendation }))} />
    </div>;
    case 'mechanism': return <div className="space-y-3"><List title={t('bundle.field.causes')} values={content.causes} />{content.stages.length ? <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">{content.stages.map((stage, index) => <li key={index} className="flex min-w-0 flex-1 items-center gap-2"><div className={`${panel} h-full flex-1`}><strong className="text-sm">{stage.title}</strong>{stage.detail ? <p className="mt-1 text-sm text-slate-600">{stage.detail}</p> : null}</div>{index < content.stages.length - 1 ? <span aria-hidden="true" className="text-blue-500">→</span> : null}</li>)}</ol> : null}<List title={t('bundle.field.results')} values={content.results} /><div className="grid gap-3 md:grid-cols-2"><List title={t('bundle.field.conditions')} values={content.conditions} /><List title={t('bundle.field.exceptions')} values={content.exceptions} /></div></div>;
    case 'structure': return <div className="space-y-3">{content.purpose ? <p className={`${panel} text-sm text-slate-800`}>{content.purpose}</p> : null}{content.components.length ? <section className={panel}><h4 className="text-xs font-bold uppercase text-slate-600">{t('bundle.field.components')}</h4><ul className="mt-2 space-y-2">{content.components.map((item) => <li key={item.id} className="border-s-2 border-blue-200 ps-3" style={{ marginInlineStart: `${structureDepth(content, item.id) * 1.25}rem` }}><strong className="text-sm text-slate-900">{item.label}</strong>{item.role ? <p className="text-sm text-slate-600">{item.role}</p> : null}</li>)}</ul></section> : null}<PairList title={t('bundle.field.internalRelations')} values={content.relations.map((item) => ({ label: `${item.source_id} → ${item.target_id}`, detail: item.label }))} /><List title={t('bundle.field.boundaries')} values={content.boundaries} /></div>;
    case 'claim_evidence': return <div className="space-y-3">{content.claim ? <blockquote className="rounded-lg border-s-4 border-blue-500 bg-blue-50 p-4 font-semibold text-slate-900">{content.claim}</blockquote> : null}{content.evidence.length ? <section className={panel}><h4 className="text-xs font-bold uppercase text-slate-600">{t('bundle.field.evidence')}</h4><ul className="mt-2 space-y-2">{content.evidence.map((item, index) => <li key={index} className="text-sm text-slate-700">{item.statement}{item.source ? <span className="ms-2 text-xs text-blue-700">{item.source}</span> : null}</li>)}</ul></section> : null}<div className="grid gap-3 md:grid-cols-2"><List title={t('bundle.field.counterevidence')} values={content.counterevidence} /><List title={t('bundle.field.scope')} values={content.scope} /><List title={t('bundle.field.limitations')} values={content.limitations} />{content.confidence ? <section className={panel}><h4 className="text-xs font-bold uppercase text-slate-600">{t('bundle.field.confidence')}</h4><p className="mt-2 text-sm font-semibold text-slate-800">{t(`bundle.confidence.${content.confidence}`)}</p></section> : null}</div></div>;
  }
}
