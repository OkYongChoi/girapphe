'use client';

import { useMemo, useState } from 'react';
import {
  createEmptyKnowledgeBundleContent,
  KNOWLEDGE_BUNDLE_SCHEMA_VERSION,
  KNOWLEDGE_BUNDLE_TYPES,
  type KnowledgeBundleContent,
  type KnowledgeBundleType,
} from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';
import type { Translate } from '@/i18n/core';

type KnowledgeBundleEditorProps = {
  defaultType?: KnowledgeBundleType | null;
  defaultQuestion?: string | null;
  defaultContent?: KnowledgeBundleContent | null;
  allowQuickNote?: boolean;
};

const fieldClass = 'min-h-11 rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
const areaClass = `${fieldClass} min-h-24`;

function textLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function pairLines(value: string, left: string, right: string) {
  return textLines(value).map((line) => {
    const [first, ...rest] = line.split('::');
    return { [left]: first.trim(), [right]: rest.join('::').trim() };
  }).filter((item) => String(item[left]).length > 0 && String(item[right]).length > 0);
}

function listValue(values: string[]) { return values.join('\n'); }
function pairValue(values: Array<Record<string, unknown>>, left: string, right: string) {
  return values.map((item) => `${String(item[left] ?? '')} :: ${String(item[right] ?? '')}`).join('\n');
}

export default function KnowledgeBundleEditor({
  defaultType = null,
  defaultQuestion = '',
  defaultContent = null,
  allowQuickNote = true,
}: KnowledgeBundleEditorProps) {
  const { t } = useI18n();
  const [type, setType] = useState<KnowledgeBundleType | null>(defaultType);
  const [content, setContent] = useState<KnowledgeBundleContent | null>(
    defaultType ? defaultContent ?? createEmptyKnowledgeBundleContent(defaultType) : null,
  );
  const serialized = useMemo(() => content ? JSON.stringify(content) : '', [content]);

  function chooseType(next: string) {
    if (!next) { setType(null); setContent(null); return; }
    const selected = next as KnowledgeBundleType;
    setType(selected);
    setContent((current) => current?.type === selected ? current : createEmptyKnowledgeBundleContent(selected));
  }

  function updateContent(next: KnowledgeBundleContent) { setContent(next); }

  return (
    <fieldset className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3 md:col-span-2">
      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-blue-800">{t('bundle.editorTitle')}</legend>
      <input type="hidden" name="bundle_mode_present" value="1" />
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        {t('bundle.format')}
        <select name="knowledge_type" value={type ?? ''} onChange={(event) => chooseType(event.target.value)} className={fieldClass}>
          {allowQuickNote ? <option value="">{t('bundle.quickNote')}</option> : null}
          {KNOWLEDGE_BUNDLE_TYPES.map((value) => <option key={value} value={value}>{t(`bundle.type.${value}`)}</option>)}
        </select>
      </label>

      {type && content ? (
        <>
          <input type="hidden" name="bundle_schema_version" value={KNOWLEDGE_BUNDLE_SCHEMA_VERSION} />
          <input type="hidden" name="structured_content" value={serialized} />
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            {t('bundle.centralQuestion')}
            <input name="central_question" required defaultValue={defaultQuestion ?? ''} maxLength={500} className={fieldClass} placeholder={t('bundle.centralQuestionPlaceholder')} />
          </label>
          <p className="text-xs text-slate-500">{t('bundle.linesHelp')}</p>
          <BundleFields content={content} update={updateContent} t={t} />
        </>
      ) : (
        <p className="text-xs text-slate-500">{t('bundle.quickNoteHelp')}</p>
      )}
    </fieldset>
  );
}

function BundleFields({ content, update, t }: {
  content: KnowledgeBundleContent;
  update: (value: KnowledgeBundleContent) => void;
  t: Translate;
}) {
  const area = (label: string, value: string, onChange: (value: string) => void, help?: string) => (
    <label className="grid gap-1 text-xs font-medium text-slate-700">
      {label}
      <textarea className={areaClass} value={value} onChange={(event) => onChange(event.target.value)} />
      {help ? <span className="font-normal text-slate-500">{help}</span> : null}
    </label>
  );

  switch (content.type) {
    case 'concept': return <>
      {area(t('bundle.field.definition'), content.definition, (value) => update({ ...content, definition: value }))}
      {area(t('bundle.field.keyPoints'), listValue(content.key_points), (value) => update({ ...content, key_points: textLines(value) }))}
      {area(t('bundle.field.examples'), listValue(content.examples), (value) => update({ ...content, examples: textLines(value) }))}
      {area(t('bundle.field.nonExamples'), listValue(content.non_examples), (value) => update({ ...content, non_examples: textLines(value) }))}
      {area(t('bundle.field.misconceptions'), pairValue(content.misconceptions, 'claim', 'correction'), (value) => update({ ...content, misconceptions: pairLines(value, 'claim', 'correction') as typeof content.misconceptions }), t('bundle.pairHelp'))}
    </>;
    case 'procedure': return <>
      {area(t('bundle.field.goal'), content.goal, (value) => update({ ...content, goal: value }))}
      {area(t('bundle.field.prerequisites'), listValue(content.prerequisites), (value) => update({ ...content, prerequisites: textLines(value) }))}
      {area(t('bundle.field.steps'), pairValue(content.steps, 'title', 'detail'), (value) => update({ ...content, steps: pairLines(value, 'title', 'detail') as typeof content.steps }), t('bundle.pairHelp'))}
      {area(t('bundle.field.branches'), pairValue(content.branches, 'condition', 'action'), (value) => update({ ...content, branches: pairLines(value, 'condition', 'action') as typeof content.branches }), t('bundle.pairHelp'))}
      {area(t('bundle.field.failureModes'), pairValue(content.failure_modes, 'symptom', 'response'), (value) => update({ ...content, failure_modes: pairLines(value, 'symptom', 'response') as typeof content.failure_modes }), t('bundle.pairHelp'))}
      {area(t('bundle.field.doneWhen'), listValue(content.done_when), (value) => update({ ...content, done_when: textLines(value) }))}
    </>;
    case 'comparison': return <>
      {area(t('bundle.field.targets'), listValue(content.targets), (value) => update({ ...content, targets: textLines(value) }))}
      {area(t('bundle.field.criteria'), content.criteria.map((item) => `${item.name} :: ${item.values.join(' | ')}`).join('\n'), (value) => update({ ...content, criteria: textLines(value).map((line) => { const [name, ...rest] = line.split('::'); return { name: name.trim(), values: rest.join('::').split('|').map((item) => item.trim()).filter(Boolean) }; }).filter((item) => item.name && item.values.length > 0) }), t('bundle.criteriaHelp'))}
      {area(t('bundle.field.commonalities'), listValue(content.commonalities), (value) => update({ ...content, commonalities: textLines(value) }))}
      {area(t('bundle.field.differences'), listValue(content.differences), (value) => update({ ...content, differences: textLines(value) }))}
      {area(t('bundle.field.choiceGuide'), pairValue(content.choice_guide, 'condition', 'recommendation'), (value) => update({ ...content, choice_guide: pairLines(value, 'condition', 'recommendation') as typeof content.choice_guide }), t('bundle.pairHelp'))}
    </>;
    case 'mechanism': return <>
      {area(t('bundle.field.causes'), listValue(content.causes), (value) => update({ ...content, causes: textLines(value) }))}
      {area(t('bundle.field.stages'), pairValue(content.stages, 'title', 'detail'), (value) => update({ ...content, stages: pairLines(value, 'title', 'detail') as typeof content.stages }), t('bundle.pairHelp'))}
      {area(t('bundle.field.results'), listValue(content.results), (value) => update({ ...content, results: textLines(value) }))}
      {area(t('bundle.field.conditions'), listValue(content.conditions), (value) => update({ ...content, conditions: textLines(value) }))}
      {area(t('bundle.field.exceptions'), listValue(content.exceptions), (value) => update({ ...content, exceptions: textLines(value) }))}
    </>;
    case 'structure': return <>
      {area(t('bundle.field.purpose'), content.purpose, (value) => update({ ...content, purpose: value }))}
      {area(t('bundle.field.components'), content.components.map((item) => [item.id, item.label, item.role, item.parent_id ?? ''].join(' :: ')).join('\n'), (value) => update({ ...content, components: textLines(value).map((line) => { const [id = '', label = '', role = '', parent = ''] = line.split('::').map((item) => item.trim()); return { id, label, role, ...(parent ? { parent_id: parent } : {}) }; }).filter((item) => item.id && item.label) }), t('bundle.componentsHelp'))}
      {area(t('bundle.field.internalRelations'), content.relations.map((item) => [item.source_id, item.target_id, item.label].join(' :: ')).join('\n'), (value) => update({ ...content, relations: textLines(value).map((line) => { const [source_id = '', target_id = '', label = ''] = line.split('::').map((item) => item.trim()); return { source_id, target_id, label }; }).filter((item) => item.source_id && item.target_id && item.label) }), t('bundle.relationsHelp'))}
      {area(t('bundle.field.boundaries'), listValue(content.boundaries), (value) => update({ ...content, boundaries: textLines(value) }))}
    </>;
    case 'claim_evidence': return <>
      {area(t('bundle.field.claim'), content.claim, (value) => update({ ...content, claim: value }))}
      {area(t('bundle.field.evidence'), content.evidence.map((item) => `${item.statement}${item.source ? ` :: ${item.source}` : ''}`).join('\n'), (value) => update({ ...content, evidence: textLines(value).map((line) => { const [statement, ...rest] = line.split('::'); const source = rest.join('::').trim(); return { statement: statement.trim(), ...(source ? { source } : {}) }; }).filter((item) => item.statement) }), t('bundle.pairHelp'))}
      {area(t('bundle.field.counterevidence'), listValue(content.counterevidence), (value) => update({ ...content, counterevidence: textLines(value) }))}
      {area(t('bundle.field.scope'), listValue(content.scope), (value) => update({ ...content, scope: textLines(value) }))}
      {area(t('bundle.field.limitations'), listValue(content.limitations), (value) => update({ ...content, limitations: textLines(value) }))}
      <label className="grid gap-1 text-xs font-medium text-slate-700">{t('bundle.field.confidence')}<select className={fieldClass} value={content.confidence ?? ''} onChange={(event) => update({ ...content, confidence: event.target.value ? event.target.value as 'low' | 'medium' | 'high' : undefined })}><option value="">—</option><option value="low">{t('bundle.confidence.low')}</option><option value="medium">{t('bundle.confidence.medium')}</option><option value="high">{t('bundle.confidence.high')}</option></select></label>
    </>;
  }
}
