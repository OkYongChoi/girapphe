import {
  EVENT_TIME_PRECISIONS,
  historicalTimePointKey,
  parseExpressionBundleExamples,
  serializeExpressionBundleExamples,
  type EventChronology,
  type HistoricalTimePoint,
  type KnowledgeBundleContent,
  type KnowledgeBundleType,
  type Locale,
} from '@stem-brain/shared';

const TYPE_LABELS: Record<Locale, Record<KnowledgeBundleType, string>> = {
  en: { concept: 'Concept', procedure: 'Procedure', comparison: 'Comparison', mechanism: 'Mechanism', structure: 'Structure', claim_evidence: 'Claim & evidence', question: 'Question', decision: 'Decision', event: 'Event', expression: 'Language expression' },
  ja: { concept: '概念', procedure: '手順', comparison: '比較', mechanism: '仕組み', structure: '構造', claim_evidence: '主張と根拠', question: '質問', decision: '決定', event: '出来事', expression: '言語表現' },
  'zh-CN': { concept: '概念', procedure: '步骤', comparison: '比较', mechanism: '机制', structure: '结构', claim_evidence: '主张与证据', question: '问题', decision: '决策', event: '事件', expression: '语言表达' },
  es: { concept: 'Concepto', procedure: 'Procedimiento', comparison: 'Comparación', mechanism: 'Mecanismo', structure: 'Estructura', claim_evidence: 'Afirmación y evidencia', question: 'Pregunta', decision: 'Decisión', event: 'Evento', expression: 'Expresión lingüística' },
  ar: { concept: 'مفهوم', procedure: 'إجراء', comparison: 'مقارنة', mechanism: 'آلية', structure: 'بنية', claim_evidence: 'ادعاء ودليل', question: 'سؤال', decision: 'قرار', event: 'حدث', expression: 'تعبير لغوي' },
  hi: { concept: 'अवधारणा', procedure: 'प्रक्रिया', comparison: 'तुलना', mechanism: 'तंत्र', structure: 'संरचना', claim_evidence: 'दावा और प्रमाण', question: 'प्रश्न', decision: 'निर्णय', event: 'घटना', expression: 'भाषाई अभिव्यक्ति' },
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

const QUESTION_STATUS_LABELS: Record<Locale, Record<'open' | 'answered', string>> = {
  en: { open: 'Open', answered: 'Answered' },
  ja: { open: '未回答', answered: '回答済み' },
  'zh-CN': { open: '待回答', answered: '已回答' },
  es: { open: 'Abierta', answered: 'Respondida' },
  ar: { open: 'مفتوح', answered: 'تمت الإجابة' },
  hi: { open: 'खुला', answered: 'उत्तर दिया गया' },
};

const RECALL_PROMPTS: Record<Locale, Record<KnowledgeBundleType, string>> = {
  en: { concept: 'Recall the definition, key points, examples, and misconceptions.', procedure: 'Recall the goal, steps, branches, failure responses, and completion criteria.', comparison: 'Recall the criteria, similarities, differences, and selection guide.', mechanism: 'Recall the causes, operating stages, results, conditions, and exceptions.', structure: 'Recall the purpose, components, relationships, and boundaries.', claim_evidence: 'Recall the claim, evidence, counterevidence, scope, limitations, and confidence.', question: 'Recall the question, known facts, hypotheses, next steps, and current answer.', decision: 'Recall the decision, options, criteria, rationale, reconsideration triggers, and outcome.', event: 'Recall what happened, when it happened, its causes, changes, and consequences.', expression: 'Recall the meaning, translation, nuance, context, pronunciation, and contrasts.' },
  ja: { concept: '定義・要点・例・誤解を思い出してください。', procedure: '目標・手順・分岐・失敗時の対応・完了条件を思い出してください。', comparison: '基準・共通点・相違点・選択ガイドを思い出してください。', mechanism: '原因・作動段階・結果・条件・例外を思い出してください。', structure: '目的・構成要素・関係・境界を思い出してください。', claim_evidence: '主張・根拠・反対根拠・範囲・限界・信頼度を思い出してください。', question: '問い・既知の事実・仮説・次の手順・現在の回答を思い出してください。', decision: '決定・選択肢・基準・理由・再検討条件・結果を思い出してください。', event: '何がいつ起きたか、その原因・変化・結果を思い出してください。', expression: '意味・翻訳・ニュアンス・使用場面・発音・対照表現を思い出してください。' },
  'zh-CN': { concept: '回忆定义、要点、示例和常见误解。', procedure: '回忆目标、步骤、分支、失败处理和完成标准。', comparison: '回忆标准、共同点、差异和选择指南。', mechanism: '回忆原因、运行阶段、结果、条件和例外。', structure: '回忆目的、组成部分、关系和边界。', claim_evidence: '回忆主张、证据、反证、范围、限制和可信度。', question: '回忆问题、已知事实、假设、下一步和当前答案。', decision: '回忆决策、选项、标准、理由、重新考虑的条件和结果。', event: '回忆发生了什么、何时发生、原因、变化和后果。', expression: '回忆含义、翻译、语气、场景、发音和对比表达。' },
  es: { concept: 'Recuerda la definición, los puntos clave, los ejemplos y los errores comunes.', procedure: 'Recuerda el objetivo, los pasos, las ramas, la respuesta a fallos y el criterio de finalización.', comparison: 'Recuerda los criterios, las similitudes, las diferencias y la guía de elección.', mechanism: 'Recuerda las causas, las etapas, los resultados, las condiciones y las excepciones.', structure: 'Recuerda el propósito, los componentes, las relaciones y los límites.', claim_evidence: 'Recuerda la afirmación, la evidencia, la evidencia contraria, el alcance, las limitaciones y la confianza.', question: 'Recuerda la pregunta, los hechos conocidos, las hipótesis, los próximos pasos y la respuesta actual.', decision: 'Recuerda la decisión, las opciones, los criterios, la justificación, las condiciones de revisión y el resultado.', event: 'Recuerda qué ocurrió, cuándo, sus causas, cambios y consecuencias.', expression: 'Recuerda el significado, la traducción, el matiz, el contexto, la pronunciación y los contrastes.' },
  ar: { concept: 'استرجع التعريف والنقاط الأساسية والأمثلة والمفاهيم الخاطئة.', procedure: 'استرجع الهدف والخطوات والفروع ومعالجة الفشل ومعيار الاكتمال.', comparison: 'استرجع المعايير وأوجه التشابه والاختلاف ودليل الاختيار.', mechanism: 'استرجع الأسباب والمراحل والنتائج والشروط والاستثناءات.', structure: 'استرجع الغرض والمكونات والعلاقات والحدود.', claim_evidence: 'استرجع الادعاء والدليل والدليل المضاد والنطاق والقيود والثقة.', question: 'استرجع السؤال والحقائق المعروفة والفرضيات والخطوات التالية والإجابة الحالية.', decision: 'استرجع القرار والخيارات والمعايير والمبررات وشروط إعادة النظر والنتيجة.', event: 'استرجع ما حدث ومتى وأسبابه وتغييراته وعواقبه.', expression: 'استرجع المعنى والترجمة والدلالة والسياق والنطق والتعبيرات المتقابلة.' },
  hi: { concept: 'परिभाषा, मुख्य बिंदु, उदाहरण और गलत धारणाएँ याद करें।', procedure: 'लक्ष्य, चरण, शाखाएँ, विफलता प्रतिक्रिया और पूर्णता मानदंड याद करें।', comparison: 'मानदंड, समानताएँ, अंतर और चयन मार्गदर्शिका याद करें।', mechanism: 'कारण, कार्य चरण, परिणाम, शर्तें और अपवाद याद करें।', structure: 'उद्देश्य, घटक, संबंध और सीमाएँ याद करें।', claim_evidence: 'दावा, प्रमाण, विरोधी प्रमाण, दायरा, सीमाएँ और भरोसा याद करें।', question: 'प्रश्न, ज्ञात तथ्य, परिकल्पनाएँ, अगले कदम और वर्तमान उत्तर याद करें।', decision: 'निर्णय, विकल्प, मानदंड, तर्क, पुनर्विचार की शर्तें और परिणाम याद करें।', event: 'क्या और कब हुआ, उसके कारण, बदलाव और परिणाम याद करें।', expression: 'अर्थ, अनुवाद, सूक्ष्मता, संदर्भ, उच्चारण और विपरीत अभिव्यक्तियाँ याद करें।' },
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

export function knowledgeBundleQuestionStatusLabel(locale: Locale, status: 'open' | 'answered') {
  return QUESTION_STATUS_LABELS[locale][status];
}

export function knowledgeBundleAnswerLines(content: KnowledgeBundleContent, locale: Locale = 'en'): string[] {
  if (content.type === 'concept') return [content.definition, ...content.key_points, ...content.examples, ...content.non_examples, ...content.misconceptions.map((item) => `${item.claim} → ${item.correction}`)].filter(Boolean);
  if (content.type === 'procedure') return [content.goal, ...content.prerequisites, ...content.steps.map((item, index) => `${index + 1}. ${item.title}${item.detail ? ` — ${item.detail}` : ''}`), ...content.branches.map((item) => `${item.condition} → ${item.action}`), ...content.failure_modes.map((item) => `${item.symptom} → ${item.response}`), ...content.done_when].filter(Boolean);
  if (content.type === 'comparison') return [content.targets.join(' ↔ '), ...content.criteria.map((item) => `${item.name}: ${item.values.join(' | ')}`), ...content.commonalities, ...content.differences, ...content.choice_guide.map((item) => `${item.condition} → ${item.recommendation}`)].filter(Boolean);
  if (content.type === 'mechanism') return [...content.causes, ...content.stages.map((item, index) => `${index + 1}. ${item.title}${item.detail ? ` — ${item.detail}` : ''}`), ...content.results, ...content.conditions, ...content.exceptions].filter(Boolean);
  if (content.type === 'structure') return [content.purpose, ...content.components.map((item) => `${item.parent_id ? '↳ ' : ''}${item.label}${item.role ? ` — ${item.role}` : ''}`), ...content.relations.map((item) => `${item.source_id} → ${item.target_id}: ${item.label}`), ...content.boundaries].filter(Boolean);
  if (content.type === 'question') return [content.question, content.context, ...content.known_facts, ...content.hypotheses, ...content.next_steps, content.answer_summary, QUESTION_STATUS_LABELS[locale][content.status]].filter(Boolean);
  if (content.type === 'decision') return [content.decision, content.context, ...content.options.map((item) => `${item.name} — ${item.tradeoffs}`), ...content.criteria, ...content.rationale, ...content.reconsider_when, content.outcome].filter(Boolean);
  if (content.type === 'event') return [content.event, content.occurred_at, content.context, ...content.changes, ...content.causes, ...content.consequences].filter(Boolean);
  if (content.type === 'expression') return [content.expression, content.language, content.pronunciation, ...content.meanings, ...content.translations.map((item) => `${item.language}: ${item.text}`), content.register, content.nuance, ...content.usage_contexts, ...content.examples.map((item) => [item.text, item.translation, item.note].filter(Boolean).join(' — ')), ...content.contrasts.map((item) => `${item.expression} → ${item.difference}`), ...content.common_mistakes.map((item) => `${item.incorrect} → ${item.correction}`)].filter(Boolean);
  return [content.claim, ...content.evidence.map((item) => `${item.statement}${item.source ? ` — ${item.source}` : ''}`), ...content.counterevidence, ...content.scope, ...content.limitations, ...(content.confidence ? [CONFIDENCE_LABELS[locale][content.confidence]] : [])].filter(Boolean);
}

function lines(value: string) { return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }
function segments(value: string) { return value.split('::').map((item) => item.trim()); }
function pairs(value: string) { return lines(value).map((item) => { const [first = '', ...rest] = segments(item); return [first, rest.join(' :: ')] as const; }).filter(([first]) => first); }
function slug(value: string, index: number) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `component_${index + 1}`; }

function historicalPoint(era: string, year: string, month: string, day: string): HistoricalTimePoint | null {
  if (era !== 'bce' && era !== 'ce') return null;
  const parsedYear = Number(year);
  const parsedMonth = month ? Number(month) : undefined;
  const parsedDay = day ? Number(day) : undefined;
  if (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > 999_999) return null;
  if (parsedMonth !== undefined && (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12)) return null;
  if (parsedDay !== undefined && (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedMonth === undefined)) return null;
  if (parsedDay !== undefined && parsedMonth !== undefined) {
    const astronomicalYear = era === 'bce' ? 1 - parsedYear : parsedYear;
    const leap = astronomicalYear % 4 === 0 && (astronomicalYear % 100 !== 0 || astronomicalYear % 400 === 0);
    const daysInMonth = parsedMonth === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(parsedMonth) ? 30 : 31;
    if (parsedDay > daysInMonth) return null;
  }
  return { year: parsedYear, era, ...(parsedMonth !== undefined ? { month: parsedMonth } : {}), ...(parsedDay !== undefined ? { day: parsedDay } : {}) };
}

export function parseMobileChronology(value: string): EventChronology | null | undefined {
  if (!value.trim()) return undefined;
  const chronologySegments = segments(value);
  if (chronologySegments.length > 9) return null;
  const [precision = '', startEra = '', startYear = '', startMonth = '', startDay = '', endEra = '', endYear = '', endMonth = '', endDay = ''] = chronologySegments;
  if (!EVENT_TIME_PRECISIONS.includes(precision as EventChronology['precision'])) return null;
  const start = historicalPoint(startEra.toLowerCase(), startYear, startMonth, startDay);
  if (!start) return null;
  if (precision !== 'range') {
    if (endEra || endYear || endMonth || endDay) return null;
    return { precision: precision as EventChronology['precision'], start };
  }
  const end = historicalPoint(endEra.toLowerCase(), endYear, endMonth, endDay);
  return end && historicalTimePointKey(end) >= historicalTimePointKey(start) ? { precision: 'range', start, end } : null;
}

export function serializeMobileChronology(value?: EventChronology) {
  if (!value) return '';
  const point = (item?: HistoricalTimePoint) => item ? [item.era, item.year, item.month ?? '', item.day ?? ''] : ['', '', '', ''];
  return [value.precision, ...point(value.start), ...point(value.end)].join(' :: ');
}

export function historicalTimePointLabel(value: HistoricalTimePoint) {
  const era = value.era.toUpperCase();
  return `${era} ${value.year}${value.month ? `-${String(value.month).padStart(2, '0')}` : ''}${value.day ? `-${String(value.day).padStart(2, '0')}` : ''}`;
}

export function eventChronologyLabel(value?: EventChronology) {
  if (!value) return '';
  return value.end
    ? `${historicalTimePointLabel(value.start)} – ${historicalTimePointLabel(value.end)}`
    : historicalTimePointLabel(value.start);
}

export type ExpressionRecallDirection = 'forward' | 'reverse';

const EXPRESSION_DIRECTION_LABELS: Record<Locale, Record<ExpressionRecallDirection, string>> = {
  en: { forward: 'Expression → meaning', reverse: 'Meaning → expression' },
  ja: { forward: '表現 → 意味', reverse: '意味 → 表現' },
  'zh-CN': { forward: '表达 → 含义', reverse: '含义 → 表达' },
  es: { forward: 'Expresión → significado', reverse: 'Significado → expresión' },
  ar: { forward: 'التعبير ← المعنى', reverse: 'المعنى ← التعبير' },
  hi: { forward: 'अभिव्यक्ति → अर्थ', reverse: 'अर्थ → अभिव्यक्ति' },
};

export function expressionRecallDirectionLabel(locale: Locale, direction: ExpressionRecallDirection) {
  return EXPRESSION_DIRECTION_LABELS[locale][direction];
}

export function expressionHasReverseRecallCue(content: Extract<KnowledgeBundleContent, { type: 'expression' }>) {
  return content.translations.some((item) => item.text.trim().length > 0)
    || content.meanings.some((meaning) => meaning.trim().length > 0);
}

export function expressionRecallCue(content: Extract<KnowledgeBundleContent, { type: 'expression' }>, locale: Locale, direction: ExpressionRecallDirection) {
  if (direction === 'forward') return content.expression;
  const preferredTranslation = content.translations.find((item) => item.language.toLowerCase() === locale.toLowerCase())
    ?? content.translations.find((item) => item.language.toLowerCase().split('-')[0] === locale.toLowerCase().split('-')[0])
    ?? content.translations[0];
  return preferredTranslation?.text ?? content.meanings[0] ?? content.expression;
}

export function buildMobileKnowledgeBundle(type: KnowledgeBundleType, fields: string[]): KnowledgeBundleContent {
  const [one = '', two = '', three = '', four = '', five = '', six = '', seven = '', eight = '', nine = '', ten = '', eleven = ''] = fields;
  if (type === 'concept') return { type, definition: one.trim(), key_points: lines(two), examples: lines(three), non_examples: lines(four), misconceptions: pairs(five).filter(([, correction]) => correction).map(([claim, correction]) => ({ claim, correction })) };
  if (type === 'procedure') return { type, goal: one.trim(), prerequisites: lines(two), steps: pairs(three).map(([title, detail]) => ({ title, detail })), branches: pairs(four).filter(([, action]) => action).map(([condition, action]) => ({ condition, action })), failure_modes: pairs(five).filter(([, response]) => response).map(([symptom, response]) => ({ symptom, response })), done_when: lines(six) };
  if (type === 'comparison') return { type, targets: lines(one), criteria: pairs(two).map(([name, values]) => ({ name, values: values.split('|').map((item) => item.trim()).filter(Boolean) })).filter((item) => item.values.length), commonalities: lines(three), differences: lines(four), choice_guide: pairs(five).filter(([, recommendation]) => recommendation).map(([condition, recommendation]) => ({ condition, recommendation })) };
  if (type === 'mechanism') return { type, causes: lines(one), stages: pairs(two).map(([title, detail]) => ({ title, detail })), results: lines(three), conditions: lines(four), exceptions: lines(five) };
  if (type === 'structure') return { type, purpose: one.trim(), components: lines(two).map((line, index) => { const [rawId = '', rawLabel = '', role = '', parentId = ''] = segments(line); const label = rawLabel || rawId; return { id: rawLabel ? rawId : slug(label, index), label, role, ...(parentId ? { parent_id: parentId } : {}) }; }).filter((item) => item.label), relations: lines(three).map((line) => { const [source_id = '', target_id = '', label = ''] = segments(line); return { source_id, target_id, label }; }).filter((item) => item.source_id && item.target_id && item.label), boundaries: lines(four) };
  if (type === 'question') return { type, question: one.trim(), context: two.trim(), known_facts: lines(three), hypotheses: lines(four), next_steps: lines(five), answer_summary: six.trim(), status: seven.trim().toLowerCase() === 'answered' ? 'answered' : 'open' };
  if (type === 'decision') return { type, decision: one.trim(), context: two.trim(), options: pairs(three).map(([name, tradeoffs]) => ({ name, tradeoffs })), criteria: lines(four), rationale: lines(five), reconsider_when: lines(six), outcome: seven.trim() };
  if (type === 'event') {
    const chronology = parseMobileChronology(seven);
    if (chronology === null) throw new Error('Enter a valid event chronology or leave it blank.');
    return { type, event: one.trim(), occurred_at: two.trim(), context: three.trim(), changes: lines(four), causes: lines(five), consequences: lines(six), ...(chronology ? { chronology } : {}) };
  }
  if (type === 'expression') return { type, expression: one.trim(), language: two.trim(), pronunciation: three.trim(), meanings: lines(four), translations: pairs(five).filter(([language, text]) => language && text).map(([language, text]) => ({ language, text })), register: six.trim(), nuance: seven.trim(), usage_contexts: lines(eight), examples: parseExpressionBundleExamples(nine), contrasts: pairs(ten).filter(([, difference]) => difference).map(([expression, difference]) => ({ expression, difference })), common_mistakes: pairs(eleven).filter(([, correction]) => correction).map(([incorrect, correction]) => ({ incorrect, correction })) };
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
  if (value.type === 'question') return [value.question, value.context, value.known_facts.join('\n'), value.hypotheses.join('\n'), value.next_steps.join('\n'), value.answer_summary, value.status];
  if (value.type === 'decision') return [value.decision, value.context, value.options.map((item) => `${item.name}${item.tradeoffs ? ` :: ${item.tradeoffs}` : ''}`).join('\n'), value.criteria.join('\n'), value.rationale.join('\n'), value.reconsider_when.join('\n'), value.outcome];
  if (value.type === 'event') return [value.event, value.occurred_at, value.context, value.changes.join('\n'), value.causes.join('\n'), value.consequences.join('\n'), serializeMobileChronology(value.chronology)];
  if (value.type === 'expression') return [value.expression, value.language, value.pronunciation, value.meanings.join('\n'), value.translations.map((item) => `${item.language} :: ${item.text}`).join('\n'), value.register, value.nuance, value.usage_contexts.join('\n'), serializeExpressionBundleExamples(value.examples), value.contrasts.map((item) => `${item.expression} :: ${item.difference}`).join('\n'), value.common_mistakes.map((item) => `${item.incorrect} :: ${item.correction}`).join('\n')];
  return [value.claim, value.evidence.map((item) => `${item.statement}${item.source ? ` :: ${item.source}` : ''}`).join('\n'), value.counterevidence.join('\n'), value.scope.join('\n'), value.limitations.join('\n'), value.confidence ?? ''];
}
