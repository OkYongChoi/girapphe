import type { KnowledgeBundleContent, KnowledgeBundleType, Locale } from '@stem-brain/shared';

const TYPE_LABELS: Record<Locale, Record<KnowledgeBundleType, string>> = {
  en: { concept: 'Concept', procedure: 'Procedure', comparison: 'Comparison', mechanism: 'Mechanism', structure: 'Structure', claim_evidence: 'Claim & evidence' },
  ja: { concept: '概念', procedure: '手順', comparison: '比較', mechanism: '仕組み', structure: '構造', claim_evidence: '主張と根拠' },
  'zh-CN': { concept: '概念', procedure: '步骤', comparison: '比较', mechanism: '机制', structure: '结构', claim_evidence: '主张与证据' },
  es: { concept: 'Concepto', procedure: 'Procedimiento', comparison: 'Comparación', mechanism: 'Mecanismo', structure: 'Estructura', claim_evidence: 'Afirmación y evidencia' },
  ar: { concept: 'مفهوم', procedure: 'إجراء', comparison: 'مقارنة', mechanism: 'آلية', structure: 'بنية', claim_evidence: 'ادعاء ودليل' },
  hi: { concept: 'अवधारणा', procedure: 'प्रक्रिया', comparison: 'तुलना', mechanism: 'तंत्र', structure: 'संरचना', claim_evidence: 'दावा और प्रमाण' },
};

const QUICK_NOTE_LABELS: Record<Locale, string> = {
  en: 'Quick note', ja: 'クイックメモ', 'zh-CN': '快速笔记', es: 'Nota rápida', ar: 'ملاحظة سريعة', hi: 'त्वरित नोट',
};

const CONFIDENCE_LABELS: Record<Locale, Record<'low' | 'medium' | 'high', string>> = {
  en: { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' },
  ja: { low: '確信度：低', medium: '確信度：中', high: '確信度：高' },
  'zh-CN': { low: '低可信度', medium: '中等可信度', high: '高可信度' },
  es: { low: 'Confianza baja', medium: 'Confianza media', high: 'Confianza alta' },
  ar: { low: 'ثقة منخفضة', medium: 'ثقة متوسطة', high: 'ثقة مرتفعة' },
  hi: { low: 'कम विश्वास', medium: 'मध्यम विश्वास', high: 'उच्च विश्वास' },
};

const RECALL_PROMPTS: Record<Locale, Record<KnowledgeBundleType, string>> = {
  en: { concept: 'Recall the definition, key points, examples, and misconceptions.', procedure: 'Recall the goal, steps, branches, failure responses, and completion criteria.', comparison: 'Recall the criteria, similarities, differences, and selection guide.', mechanism: 'Recall the causes, operating stages, results, conditions, and exceptions.', structure: 'Recall the purpose, components, relationships, and boundaries.', claim_evidence: 'Recall the claim, evidence, counterevidence, scope, limitations, and confidence.' },
  ja: { concept: '定義・要点・例・誤解を思い出してください。', procedure: '目標・手順・分岐・失敗時の対応・完了条件を思い出してください。', comparison: '基準・共通点・相違点・選択ガイドを思い出してください。', mechanism: '原因・作動段階・結果・条件・例外を思い出してください。', structure: '目的・構成要素・関係・境界を思い出してください。', claim_evidence: '主張・根拠・反対根拠・範囲・限界・信頼度を思い出してください。' },
  'zh-CN': { concept: '回忆定义、要点、示例和常见误解。', procedure: '回忆目标、步骤、分支、失败处理和完成标准。', comparison: '回忆标准、共同点、差异和选择指南。', mechanism: '回忆原因、运行阶段、结果、条件和例外。', structure: '回忆目的、组成部分、关系和边界。', claim_evidence: '回忆主张、证据、反证、范围、限制和可信度。' },
  es: { concept: 'Recuerda la definición, los puntos clave, los ejemplos y los errores comunes.', procedure: 'Recuerda el objetivo, los pasos, las ramas, la respuesta a fallos y el criterio de finalización.', comparison: 'Recuerda los criterios, las similitudes, las diferencias y la guía de elección.', mechanism: 'Recuerda las causas, las etapas, los resultados, las condiciones y las excepciones.', structure: 'Recuerda el propósito, los componentes, las relaciones y los límites.', claim_evidence: 'Recuerda la afirmación, la evidencia, la evidencia contraria, el alcance, las limitaciones y la confianza.' },
  ar: { concept: 'استرجع التعريف والنقاط الأساسية والأمثلة والمفاهيم الخاطئة.', procedure: 'استرجع الهدف والخطوات والفروع ومعالجة الفشل ومعيار الاكتمال.', comparison: 'استرجع المعايير وأوجه التشابه والاختلاف ودليل الاختيار.', mechanism: 'استرجع الأسباب والمراحل والنتائج والشروط والاستثناءات.', structure: 'استرجع الغرض والمكونات والعلاقات والحدود.', claim_evidence: 'استرجع الادعاء والدليل والدليل المضاد والنطاق والقيود والثقة.' },
  hi: { concept: 'परिभाषा, मुख्य बिंदु, उदाहरण और गलत धारणाएँ याद करें।', procedure: 'लक्ष्य, चरण, शाखाएँ, विफलता प्रतिक्रिया और पूर्णता मानदंड याद करें।', comparison: 'मानदंड, समानताएँ, अंतर और चयन मार्गदर्शिका याद करें।', mechanism: 'कारण, कार्य चरण, परिणाम, शर्तें और अपवाद याद करें।', structure: 'उद्देश्य, घटक, संबंध और सीमाएँ याद करें।', claim_evidence: 'दावा, प्रमाण, विरोधी प्रमाण, दायरा, सीमाएँ और भरोसा याद करें।' },
};

export function knowledgeBundleTypeLabel(locale: Locale, type: KnowledgeBundleType) {
  return TYPE_LABELS[locale][type];
}

export function knowledgeBundleRecallPrompt(locale: Locale, type: KnowledgeBundleType) {
  return RECALL_PROMPTS[locale][type];
}

export function quickNoteLabel(locale: Locale) {
  return QUICK_NOTE_LABELS[locale];
}

export function knowledgeBundleConfidenceLabel(locale: Locale, confidence: 'low' | 'medium' | 'high') {
  return CONFIDENCE_LABELS[locale][confidence];
}

export function knowledgeBundleAnswerLines(content: KnowledgeBundleContent, locale: Locale = 'en'): string[] {
  if (content.type === 'concept') return [content.definition, ...content.key_points, ...content.examples, ...content.non_examples, ...content.misconceptions.map((item) => `${item.claim} → ${item.correction}`)].filter(Boolean);
  if (content.type === 'procedure') return [content.goal, ...content.prerequisites, ...content.steps.map((item, index) => `${index + 1}. ${item.title}${item.detail ? ` — ${item.detail}` : ''}`), ...content.branches.map((item) => `${item.condition} → ${item.action}`), ...content.failure_modes.map((item) => `${item.symptom} → ${item.response}`), ...content.done_when].filter(Boolean);
  if (content.type === 'comparison') return [content.targets.join(' ↔ '), ...content.criteria.map((item) => `${item.name}: ${item.values.join(' | ')}`), ...content.commonalities, ...content.differences, ...content.choice_guide.map((item) => `${item.condition} → ${item.recommendation}`)].filter(Boolean);
  if (content.type === 'mechanism') return [...content.causes, ...content.stages.map((item, index) => `${index + 1}. ${item.title}${item.detail ? ` — ${item.detail}` : ''}`), ...content.results, ...content.conditions, ...content.exceptions].filter(Boolean);
  if (content.type === 'structure') return [content.purpose, ...content.components.map((item) => `${item.parent_id ? '↳ ' : ''}${item.label}${item.role ? ` — ${item.role}` : ''}`), ...content.relations.map((item) => `${item.source_id} → ${item.target_id}: ${item.label}`), ...content.boundaries].filter(Boolean);
  return [content.claim, ...content.evidence.map((item) => `${item.statement}${item.source ? ` — ${item.source}` : ''}`), ...content.counterevidence, ...content.scope, ...content.limitations, ...(content.confidence ? [CONFIDENCE_LABELS[locale][content.confidence]] : [])].filter(Boolean);
}

function lines(value: string) { return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }
function segments(value: string) { return value.split('::').map((item) => item.trim()); }
function pairs(value: string) { return lines(value).map((item) => { const [first = '', ...rest] = segments(item); return [first, rest.join(' :: ')] as const; }).filter(([first]) => first); }
function slug(value: string, index: number) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `component_${index + 1}`; }

export function buildMobileKnowledgeBundle(type: KnowledgeBundleType, fields: string[]): KnowledgeBundleContent {
  const [one = '', two = '', three = '', four = '', five = '', six = ''] = fields;
  if (type === 'concept') return { type, definition: one.trim(), key_points: lines(two), examples: lines(three), non_examples: lines(four), misconceptions: pairs(five).filter(([, correction]) => correction).map(([claim, correction]) => ({ claim, correction })) };
  if (type === 'procedure') return { type, goal: one.trim(), prerequisites: lines(two), steps: pairs(three).map(([title, detail]) => ({ title, detail })), branches: pairs(four).filter(([, action]) => action).map(([condition, action]) => ({ condition, action })), failure_modes: pairs(five).filter(([, response]) => response).map(([symptom, response]) => ({ symptom, response })), done_when: lines(six) };
  if (type === 'comparison') return { type, targets: lines(one), criteria: pairs(two).map(([name, values]) => ({ name, values: values.split('|').map((item) => item.trim()).filter(Boolean) })).filter((item) => item.values.length), commonalities: lines(three), differences: lines(four), choice_guide: pairs(five).filter(([, recommendation]) => recommendation).map(([condition, recommendation]) => ({ condition, recommendation })) };
  if (type === 'mechanism') return { type, causes: lines(one), stages: pairs(two).map(([title, detail]) => ({ title, detail })), results: lines(three), conditions: lines(four), exceptions: lines(five) };
  if (type === 'structure') return { type, purpose: one.trim(), components: lines(two).map((line, index) => { const [rawId = '', rawLabel = '', role = '', parentId = ''] = segments(line); const label = rawLabel || rawId; return { id: rawLabel ? rawId : slug(label, index), label, role, ...(parentId ? { parent_id: parentId } : {}) }; }).filter((item) => item.label), relations: lines(three).map((line) => { const [source_id = '', target_id = '', label = ''] = segments(line); return { source_id, target_id, label }; }).filter((item) => item.source_id && item.target_id && item.label), boundaries: lines(four) };
  const confidence = six.trim().toLowerCase();
  return { type, claim: one.trim(), evidence: pairs(two).map(([statement, source]) => ({ statement, ...(source ? { source } : {}) })), counterevidence: lines(three), scope: lines(four), limitations: lines(five), ...(['low', 'medium', 'high'].includes(confidence) ? { confidence: confidence as 'low' | 'medium' | 'high' } : {}) };
}

export function mobileKnowledgeBundleEditValues(value: KnowledgeBundleContent | null, legacyContent = ''): string[] {
  if (!value) return [legacyContent, '', '', '', '', ''];
  if (value.type === 'concept') return [value.definition, value.key_points.join('\n'), value.examples.join('\n'), value.non_examples.join('\n'), value.misconceptions.map((item) => `${item.claim} :: ${item.correction}`).join('\n'), ''];
  if (value.type === 'procedure') return [value.goal, value.prerequisites.join('\n'), value.steps.map((item) => `${item.title}${item.detail ? ` :: ${item.detail}` : ''}`).join('\n'), value.branches.map((item) => `${item.condition} :: ${item.action}`).join('\n'), value.failure_modes.map((item) => `${item.symptom} :: ${item.response}`).join('\n'), value.done_when.join('\n')];
  if (value.type === 'comparison') return [value.targets.join('\n'), value.criteria.map((item) => `${item.name} :: ${item.values.join(' | ')}`).join('\n'), value.commonalities.join('\n'), value.differences.join('\n'), value.choice_guide.map((item) => `${item.condition} :: ${item.recommendation}`).join('\n'), ''];
  if (value.type === 'mechanism') return [value.causes.join('\n'), value.stages.map((item) => `${item.title}${item.detail ? ` :: ${item.detail}` : ''}`).join('\n'), value.results.join('\n'), value.conditions.join('\n'), value.exceptions.join('\n'), ''];
  if (value.type === 'structure') return [value.purpose, value.components.map((item) => [item.id, item.label, item.role, item.parent_id ?? ''].join(' :: ')).join('\n'), value.relations.map((item) => `${item.source_id} :: ${item.target_id} :: ${item.label}`).join('\n'), value.boundaries.join('\n'), '', ''];
  return [value.claim, value.evidence.map((item) => `${item.statement}${item.source ? ` :: ${item.source}` : ''}`).join('\n'), value.counterevidence.join('\n'), value.scope.join('\n'), value.limitations.join('\n'), value.confidence ?? ''];
}
