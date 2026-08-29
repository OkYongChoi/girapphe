import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthRequired } from '@/components/auth-required';
import { mobileApi, type PersonalNote } from '@/api';
import { useI18n } from '@/i18n';
import { buildMobileKnowledgeBundle, knowledgeBundleQuestionStatusLabel, knowledgeBundleTypeLabel, mobileKnowledgeBundleEditValues } from '@/knowledge-bundle-ui';
import { MobileKnowledgeBundleView } from '@/components/knowledge-bundle-view';
import {
  KNOWLEDGE_BUNDLE_TYPES,
  type KnowledgeBundleType,
  type Locale,
} from '@stem-brain/shared';

const BUNDLE_COPY: Record<Locale, {
  format: string; quick: string; question: string; questionPlaceholder: string; summary: string; tags: string;
  primary: Partial<Record<KnowledgeBundleType, string>>; secondary: Partial<Record<KnowledgeBundleType, string>>; tertiary: Partial<Record<KnowledgeBundleType, string>>;
  types: Partial<Record<KnowledgeBundleType, string>>; lines: string;
}> = {
  en: { format: 'Knowledge format', quick: 'Quick note', question: 'Central question', questionPlaceholder: 'What should you be able to explain?', summary: 'Summary', tags: 'Tags, separated by commas', lines: 'One item per line', types: { concept: 'Concept', procedure: 'Procedure', comparison: 'Comparison', mechanism: 'Mechanism', structure: 'Structure', claim_evidence: 'Claim & evidence' }, primary: { concept: 'Definition', procedure: 'Goal', comparison: 'Targets', mechanism: 'Causes', structure: 'Purpose', claim_evidence: 'Claim' }, secondary: { concept: 'Key points', procedure: 'Steps', comparison: 'Differences', mechanism: 'Process stages', structure: 'Components', claim_evidence: 'Evidence' }, tertiary: { concept: 'Examples', procedure: 'Done when', comparison: 'Commonalities', mechanism: 'Results', structure: 'Boundaries', claim_evidence: 'Limitations' } },
  ja: { format: '知識形式', quick: 'クイックメモ', question: '中心となる問い', questionPlaceholder: '何を説明できるようにしますか？', summary: '要約', tags: 'タグ（カンマ区切り）', lines: '1行に1項目', types: { concept: '概念', procedure: '手順', comparison: '比較', mechanism: '仕組み', structure: '構造', claim_evidence: '主張と根拠' }, primary: { concept: '定義', procedure: '目標', comparison: '比較対象', mechanism: '原因', structure: '目的', claim_evidence: '主張' }, secondary: { concept: '要点', procedure: '手順', comparison: '相違点', mechanism: '進行段階', structure: '構成要素', claim_evidence: '根拠' }, tertiary: { concept: '例', procedure: '完了条件', comparison: '共通点', mechanism: '結果', structure: '境界', claim_evidence: '限界' } },
  'zh-CN': { format: '知识形式', quick: '快速笔记', question: '核心问题', questionPlaceholder: '你应该能够解释什么？', summary: '摘要', tags: '标签（用逗号分隔）', lines: '每行一项', types: { concept: '概念', procedure: '步骤', comparison: '比较', mechanism: '机制', structure: '结构', claim_evidence: '主张与证据' }, primary: { concept: '定义', procedure: '目标', comparison: '比较对象', mechanism: '原因', structure: '目的', claim_evidence: '主张' }, secondary: { concept: '要点', procedure: '步骤', comparison: '差异', mechanism: '过程阶段', structure: '组成部分', claim_evidence: '证据' }, tertiary: { concept: '示例', procedure: '完成标准', comparison: '共同点', mechanism: '结果', structure: '边界', claim_evidence: '限制' } },
  es: { format: 'Formato de conocimiento', quick: 'Nota rápida', question: 'Pregunta central', questionPlaceholder: '¿Qué deberías poder explicar?', summary: 'Resumen', tags: 'Etiquetas, separadas por comas', lines: 'Un elemento por línea', types: { concept: 'Concepto', procedure: 'Procedimiento', comparison: 'Comparación', mechanism: 'Mecanismo', structure: 'Estructura', claim_evidence: 'Afirmación y evidencia' }, primary: { concept: 'Definición', procedure: 'Objetivo', comparison: 'Objetivos', mechanism: 'Causas', structure: 'Propósito', claim_evidence: 'Afirmación' }, secondary: { concept: 'Puntos clave', procedure: 'Pasos', comparison: 'Diferencias', mechanism: 'Etapas', structure: 'Componentes', claim_evidence: 'Evidencia' }, tertiary: { concept: 'Ejemplos', procedure: 'Criterio de finalización', comparison: 'Similitudes', mechanism: 'Resultados', structure: 'Límites', claim_evidence: 'Limitaciones' } },
  ar: { format: 'صيغة المعرفة', quick: 'ملاحظة سريعة', question: 'السؤال المركزي', questionPlaceholder: 'ما الذي ينبغي أن تستطيع شرحه؟', summary: 'الملخص', tags: 'وسوم مفصولة بفواصل', lines: 'عنصر واحد في كل سطر', types: { concept: 'مفهوم', procedure: 'إجراء', comparison: 'مقارنة', mechanism: 'آلية', structure: 'بنية', claim_evidence: 'ادعاء ودليل' }, primary: { concept: 'التعريف', procedure: 'الهدف', comparison: 'عناصر المقارنة', mechanism: 'الأسباب', structure: 'الغرض', claim_evidence: 'الادعاء' }, secondary: { concept: 'النقاط الأساسية', procedure: 'الخطوات', comparison: 'الاختلافات', mechanism: 'المراحل', structure: 'المكونات', claim_evidence: 'الدليل' }, tertiary: { concept: 'أمثلة', procedure: 'معيار الاكتمال', comparison: 'أوجه التشابه', mechanism: 'النتائج', structure: 'الحدود', claim_evidence: 'القيود' } },
  hi: { format: 'ज्ञान प्रारूप', quick: 'त्वरित नोट', question: 'केंद्रीय प्रश्न', questionPlaceholder: 'आपको क्या समझा पाना चाहिए?', summary: 'सार', tags: 'कॉमा से अलग टैग', lines: 'हर पंक्ति में एक बिंदु', types: { concept: 'अवधारणा', procedure: 'प्रक्रिया', comparison: 'तुलना', mechanism: 'तंत्र', structure: 'संरचना', claim_evidence: 'दावा और प्रमाण' }, primary: { concept: 'परिभाषा', procedure: 'लक्ष्य', comparison: 'तुलना लक्ष्य', mechanism: 'कारण', structure: 'उद्देश्य', claim_evidence: 'दावा' }, secondary: { concept: 'मुख्य बिंदु', procedure: 'चरण', comparison: 'अंतर', mechanism: 'प्रक्रिया चरण', structure: 'घटक', claim_evidence: 'प्रमाण' }, tertiary: { concept: 'उदाहरण', procedure: 'पूर्ण होने की शर्त', comparison: 'समानताएँ', mechanism: 'परिणाम', structure: 'सीमाएँ', claim_evidence: 'सीमाएँ' } },
};

const BUNDLE_FIELD_COPY: Record<Locale, Record<KnowledgeBundleType, string[]>> = {
  en: { concept: ['Definition', 'Key points', 'Examples', 'Non-examples', 'Misconceptions :: corrections'], procedure: ['Goal', 'Prerequisites', 'Steps :: details', 'Branch condition :: action', 'Failure symptom :: response', 'Done when'], comparison: ['Targets', 'Criterion :: values separated by |', 'Commonalities', 'Differences', 'Choice condition :: recommendation'], mechanism: ['Causes', 'Process stage :: detail', 'Results', 'Conditions', 'Exceptions'], structure: ['Purpose', 'Components: id :: label :: role :: parent id', 'Relations: source id :: target id :: relationship', 'Boundaries'], claim_evidence: ['Claim', 'Evidence :: source', 'Counterevidence', 'Scope', 'Limitations', 'Confidence: low, medium, or high'], question: ['Question', 'Context', 'Known facts', 'Hypotheses', 'Next steps', 'Answer summary', 'Status: open or answered'], decision: ['Decision', 'Context', 'Option :: tradeoffs', 'Criteria', 'Rationale', 'Reconsider when', 'Outcome'], event: ['Event', 'Occurred at', 'Context', 'Changes', 'Causes', 'Consequences', 'Chronology: precision :: era :: year :: month :: day :: end era :: end year :: end month :: end day'], expression: ['Expression', 'Language tag', 'Pronunciation', 'Meanings', 'Translation language :: text', 'Register', 'Nuance', 'Usage contexts', 'Example JSON: ["text", "translation", "note"]', 'Contrasting expression :: difference', 'Common mistake :: correction'] },
  ja: { concept: ['定義', '要点', '例', '反例', '誤解 :: 訂正'], procedure: ['目標', '前提条件', '手順 :: 詳細', '分岐条件 :: 対応', '失敗症状 :: 対応', '完了条件'], comparison: ['比較対象', '基準 :: | で区切った値', '共通点', '相違点', '選択条件 :: 推奨'], mechanism: ['原因', '進行段階 :: 詳細', '結果', '条件', '例外'], structure: ['目的', '構成要素：ID :: 名前 :: 役割 :: 親ID', '関係：元ID :: 先ID :: 関係', '境界'], claim_evidence: ['主張', '根拠 :: 出典', '反証', '適用範囲', '限界', '確信度：low、medium、high'], question: ['質問', '背景', '既知の事実', '仮説', '次の手順', '回答の要約', '状態：open または answered'], decision: ['決定', '背景', '選択肢 :: トレードオフ', '基準', '理由', '再検討条件', '結果'], event: ['出来事', '発生日時', '背景', '変化', '原因', '結果', '年代：精度 :: 紀元 :: 年 :: 月 :: 日 :: 終了紀元 :: 終了年 :: 終了月 :: 終了日'], expression: ['表現', '言語タグ', '発音', '意味', '翻訳言語 :: 文', '使用域', 'ニュアンス', '使用場面', '例文JSON：["本文", "翻訳", "注記"]', '対照表現 :: 違い', 'よくある誤り :: 訂正'] },
  'zh-CN': { concept: ['定义', '要点', '示例', '反例', '误解 :: 纠正'], procedure: ['目标', '前置条件', '步骤 :: 详情', '分支条件 :: 操作', '失败症状 :: 处理', '完成标准'], comparison: ['比较对象', '标准 :: 用 | 分隔的值', '共同点', '差异', '选择条件 :: 建议'], mechanism: ['原因', '过程阶段 :: 详情', '结果', '条件', '例外'], structure: ['目的', '组成部分：ID :: 名称 :: 角色 :: 父ID', '关系：源ID :: 目标ID :: 关系', '边界'], claim_evidence: ['主张', '证据 :: 来源', '反证', '范围', '限制', '可信度：low、medium、high'], question: ['问题', '背景', '已知事实', '假设', '下一步', '答案摘要', '状态：open 或 answered'], decision: ['决策', '背景', '选项 :: 权衡', '标准', '理由', '重新考虑的条件', '结果'], event: ['事件', '发生时间', '背景', '变化', '原因', '后果', '年代：精度 :: 纪元 :: 年 :: 月 :: 日 :: 结束纪元 :: 结束年 :: 结束月 :: 结束日'], expression: ['表达', '语言标签', '发音', '含义', '翻译语言 :: 文本', '语域', '语气', '使用场景', '例句 JSON：["原文", "翻译", "注释"]', '对比表达 :: 差异', '常见错误 :: 纠正'] },
  es: { concept: ['Definición', 'Puntos clave', 'Ejemplos', 'Contraejemplos', 'Error :: corrección'], procedure: ['Objetivo', 'Requisitos', 'Paso :: detalle', 'Condición de rama :: acción', 'Síntoma de fallo :: respuesta', 'Criterio de finalización'], comparison: ['Objetivos', 'Criterio :: valores separados por |', 'Similitudes', 'Diferencias', 'Condición :: recomendación'], mechanism: ['Causas', 'Etapa :: detalle', 'Resultados', 'Condiciones', 'Excepciones'], structure: ['Propósito', 'Componentes: id :: nombre :: función :: id superior', 'Relaciones: id origen :: id destino :: relación', 'Límites'], claim_evidence: ['Afirmación', 'Evidencia :: fuente', 'Contraevidencia', 'Alcance', 'Limitaciones', 'Confianza: low, medium o high'], question: ['Pregunta', 'Contexto', 'Hechos conocidos', 'Hipótesis', 'Próximos pasos', 'Resumen de la respuesta', 'Estado: open o answered'], decision: ['Decisión', 'Contexto', 'Opción :: contraprestaciones', 'Criterios', 'Justificación', 'Reconsiderar cuando', 'Resultado'], event: ['Evento', 'Ocurrió en', 'Contexto', 'Cambios', 'Causas', 'Consecuencias', 'Cronología: precisión :: era :: año :: mes :: día :: era final :: año final :: mes final :: día final'], expression: ['Expresión', 'Etiqueta de idioma', 'Pronunciación', 'Significados', 'Idioma de traducción :: texto', 'Registro', 'Matiz', 'Contextos de uso', 'Ejemplo JSON: ["texto", "traducción", "nota"]', 'Expresión contrastante :: diferencia', 'Error común :: corrección'] },
  ar: { concept: ['التعريف', 'النقاط الأساسية', 'أمثلة', 'أمثلة مضادة', 'مفهوم خاطئ :: تصحيح'], procedure: ['الهدف', 'المتطلبات', 'الخطوة :: التفاصيل', 'شرط التفرع :: الإجراء', 'عرض الفشل :: الاستجابة', 'معيار الاكتمال'], comparison: ['عناصر المقارنة', 'المعيار :: قيم مفصولة بـ |', 'أوجه التشابه', 'الاختلافات', 'الشرط :: التوصية'], mechanism: ['الأسباب', 'المرحلة :: التفاصيل', 'النتائج', 'الشروط', 'الاستثناءات'], structure: ['الغرض', 'المكونات: المعرف :: الاسم :: الدور :: معرف الأصل', 'العلاقات: المصدر :: الهدف :: العلاقة', 'الحدود'], claim_evidence: ['الادعاء', 'الدليل :: المصدر', 'الدليل المضاد', 'النطاق', 'القيود', 'الثقة: low أو medium أو high'], question: ['السؤال', 'السياق', 'الحقائق المعروفة', 'الفرضيات', 'الخطوات التالية', 'ملخص الإجابة', 'الحالة: open أو answered'], decision: ['القرار', 'السياق', 'الخيار :: المفاضلات', 'المعايير', 'المبررات', 'إعادة النظر عند', 'النتيجة'], event: ['الحدث', 'وقت الحدوث', 'السياق', 'التغييرات', 'الأسباب', 'العواقب', 'التسلسل الزمني: الدقة :: العصر :: السنة :: الشهر :: اليوم :: عصر النهاية :: سنة النهاية :: شهر النهاية :: يوم النهاية'], expression: ['التعبير', 'وسم اللغة', 'النطق', 'المعاني', 'لغة الترجمة :: النص', 'السجل', 'الدلالة', 'سياقات الاستخدام', 'مثال JSON: ["النص", "الترجمة", "الملاحظة"]', 'تعبير مقابل :: الفرق', 'خطأ شائع :: تصحيح'] },
  hi: { concept: ['परिभाषा', 'मुख्य बिंदु', 'उदाहरण', 'प्रतिउदाहरण', 'गलत धारणा :: सुधार'], procedure: ['लक्ष्य', 'पूर्वापेक्षाएँ', 'चरण :: विवरण', 'शाखा शर्त :: कार्रवाई', 'विफलता लक्षण :: प्रतिक्रिया', 'पूर्ण होने की शर्त'], comparison: ['तुलना लक्ष्य', 'मानदंड :: | से अलग मान', 'समानताएँ', 'अंतर', 'शर्त :: अनुशंसा'], mechanism: ['कारण', 'प्रक्रिया चरण :: विवरण', 'परिणाम', 'शर्तें', 'अपवाद'], structure: ['उद्देश्य', 'घटक: id :: नाम :: भूमिका :: parent id', 'संबंध: स्रोत id :: लक्ष्य id :: संबंध', 'सीमाएँ'], claim_evidence: ['दावा', 'प्रमाण :: स्रोत', 'विपरीत प्रमाण', 'दायरा', 'सीमाएँ', 'विश्वास: low, medium या high'], question: ['प्रश्न', 'संदर्भ', 'ज्ञात तथ्य', 'परिकल्पनाएँ', 'अगले कदम', 'उत्तर सारांश', 'स्थिति: open या answered'], decision: ['निर्णय', 'संदर्भ', 'विकल्प :: समझौते', 'मानदंड', 'तर्क', 'पुनर्विचार कब', 'परिणाम'], event: ['घटना', 'घटित होने का समय', 'संदर्भ', 'बदलाव', 'कारण', 'परिणाम', 'कालक्रम: शुद्धता :: युग :: वर्ष :: माह :: दिन :: अंतिम युग :: अंतिम वर्ष :: अंतिम माह :: अंतिम दिन'], expression: ['अभिव्यक्ति', 'भाषा टैग', 'उच्चारण', 'अर्थ', 'अनुवाद भाषा :: पाठ', 'रजिस्टर', 'सूक्ष्मता', 'प्रयोग संदर्भ', 'उदाहरण JSON: ["पाठ", "अनुवाद", "टिप्पणी"]', 'विपरीत अभिव्यक्ति :: अंतर', 'सामान्य गलती :: सुधार'] },
};

const CANDIDATE_INBOX_COPY: Record<Locale, string> = {
  en: 'Review conversation candidates',
  ja: '会話からの候補を確認',
  'zh-CN': '审核对话候选知识',
  es: 'Revisar candidatos de conversaciones',
  ar: 'مراجعة مرشحي المحادثات',
  hi: 'बातचीत के उम्मीदवारों की समीक्षा करें',
};

const OPEN_TOPIC_COPY: Record<Locale, string> = {
  en: 'Open topic',
  ja: 'トピックを開く',
  'zh-CN': '打开主题',
  es: 'Abrir tema',
  ar: 'فتح الموضوع',
  hi: 'विषय खोलें',
};

export default function NotesScreen() {
  return <AuthRequired><NotesContent /></AuthRequired>;
}

function NotesContent() {
  const router = useRouter();
  const { direction, formatDate, formatNumber, locale, t } = useI18n();
  const [items, setItems] = useState<PersonalNote[]>([]);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [summary, setSummary] = useState('');
  const [knowledgeType, setKnowledgeType] = useState<KnowledgeBundleType | null>(null);
  const [centralQuestion, setCentralQuestion] = useState('');
  const [bundleFields, setBundleFields] = useState<string[]>(Array(11).fill(''));
  const [query, setQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'title'>('created');
  const [editing, setEditing] = useState<PersonalNote | null>(null);
  const [isTrash, setIsTrash] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (view = isTrash) => {
    setLoading(true); setError(null);
    try { setItems((await mobileApi.notes(view ? 'trash' : 'active')).items); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('notes.loadError')); }
    finally { setLoading(false); }
  }, [isTrash, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function resetEditor() {
    setTitle(''); setTopic(''); setContent(''); setTags(''); setSummary(''); setKnowledgeType(null);
    setCentralQuestion(''); setBundleFields(Array(11).fill(''));
    setEditing(null);
  }

  async function addNote() {
    if (!title.trim() || submitting || (knowledgeType && !centralQuestion.trim())) return;
    setSubmitting(true); setError(null);
    try {
      const typedFields = knowledgeType ? {
        summary,
        knowledge_type: knowledgeType,
        central_question: centralQuestion,
        structured_content: buildMobileKnowledgeBundle(knowledgeType, bundleFields),
        bundle_schema_version: 1,
      } : {
        summary, knowledge_type: '', central_question: '', structured_content: null, bundle_schema_version: null,
      };
      if (editing) {
        await mobileApi.mutate({ action: 'update-note', id: editing.id, version: editing.version, title, topic, content, tags: tags.split(',').map((value) => value.trim()).filter(Boolean), ...typedFields });
      } else {
        await mobileApi.mutate({ action: 'create-note', title, topic, content, tags: tags.split(',').map((value) => value.trim()).filter(Boolean), requestId: `${Date.now()}-${Math.random()}`, ...typedFields });
      }
      resetEditor(); await load(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('notes.saveError')); }
    finally { setSubmitting(false); }
  }

  async function changeView(nextTrash: boolean) { setIsTrash(nextTrash); await load(nextTrash); }
  function deleteNote(note: PersonalNote) {
    Alert.alert(t('notes.trashConfirmTitle'), t('notes.trashConfirmBody', { title: note.title, days: formatNumber(14) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('notes.moveToTrash'), style: 'destructive', onPress: () => void mobileApi.mutate({ action: 'delete-note', id: note.id }).then(() => load(false)).catch((reason) => setError(reason.message)) },
    ]);
  }
  async function restoreNote(note: PersonalNote) {
    try { await mobileApi.mutate({ action: 'restore-note', id: note.id }); await load(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('notes.restoreError')); }
  }
  function startEdit(note: PersonalNote) {
    setEditing(note); setTitle(note.title); setTopic(note.topic); setContent(note.content); setTags(note.tags.join(', ')); setSummary(note.summary);
    setKnowledgeType(note.knowledge_type); setCentralQuestion(note.central_question ?? '');
    setBundleFields(mobileKnowledgeBundleEditValues(note.structured_content, note.content));
  }
  function chooseType(nextType: KnowledgeBundleType | null) {
    if (nextType !== knowledgeType) setBundleFields([!knowledgeType && content.trim() ? content : bundleFields[0] ?? '', ...Array(10).fill('')]);
    setKnowledgeType(nextType);
  }
  function updateBundleField(index: number, value: string) {
    setBundleFields((current) => Array.from({ length: 11 }, (_, fieldIndex) => fieldIndex === index ? value : current[fieldIndex] ?? ''));
  }
  const topics = Array.from(new Set(items.map((item) => item.topic))).sort();
  const visibleItems = items.filter((item) => {
    const matchesQuery = !query.trim() || `${item.title} ${item.topic} ${item.summary} ${item.content} ${item.central_question ?? ''} ${item.knowledge_type ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (selectedTopic === 'all' || item.topic === selectedTopic);
  }).sort((a, b) => sortBy === 'title' ? a.title.localeCompare(b.title, locale) : +new Date(b[sortBy === 'updated' ? 'updated_at' : 'created_at']) - +new Date(a[sortBy === 'updated' ? 'updated_at' : 'created_at']));

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList data={visibleItems} keyExtractor={(item) => item.id} contentContainerStyle={styles.content}
        ListHeaderComponent={<View>
          <Text style={styles.kicker}>{t('notes.private')}</Text><Text style={styles.title}>{t('notes.title')}</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/candidate-inbox')} style={styles.candidateInboxLink}>
            <Text style={styles.candidateInboxLinkText}>{CANDIDATE_INBOX_COPY[locale]} →</Text>
          </Pressable>
          <View style={styles.tabs}><Pressable accessibilityRole="tab" accessibilityState={{ selected: !isTrash }} onPress={() => void changeView(false)} style={[styles.tab, !isTrash && styles.activeTab]}><Text>{t('notes.myNotes')}</Text></Pressable><Pressable accessibilityRole="tab" accessibilityState={{ selected: isTrash }} onPress={() => void changeView(true)} style={[styles.tab, isTrash && styles.activeTab]}><Text>{t('notes.trash')}</Text></Pressable></View>
          {!isTrash ? (
            <View style={styles.form}>
              <TextInput accessibilityLabel={t('notes.titlePlaceholder')} value={title} onChangeText={setTitle} placeholder={t('notes.titlePlaceholder')} style={styles.input} />
              <TextInput accessibilityLabel={t('notes.topicPlaceholder')} value={topic} onChangeText={setTopic} placeholder={t('notes.topicPlaceholder')} style={styles.input} />
              <TextInput accessibilityLabel={BUNDLE_COPY[locale].tags} value={tags} onChangeText={setTags} placeholder={BUNDLE_COPY[locale].tags} style={styles.input} />
              <TextInput accessibilityLabel={BUNDLE_COPY[locale].summary} value={summary} onChangeText={setSummary} placeholder={BUNDLE_COPY[locale].summary} multiline style={[styles.input, styles.shortMultiline]} />
              <Text style={styles.fieldLabel}>{BUNDLE_COPY[locale].format}</Text>
              <View style={styles.typeGrid}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: knowledgeType === null }} onPress={() => chooseType(null)} style={[styles.typeButton, knowledgeType === null && styles.typeButtonActive]}>
                  <Text style={[styles.typeButtonText, knowledgeType === null && styles.typeButtonTextActive]}>{BUNDLE_COPY[locale].quick}</Text>
                </Pressable>
                {KNOWLEDGE_BUNDLE_TYPES.map((value) => (
                  <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: knowledgeType === value }} onPress={() => chooseType(value)} style={[styles.typeButton, knowledgeType === value && styles.typeButtonActive]}>
                    <Text style={[styles.typeButtonText, knowledgeType === value && styles.typeButtonTextActive]}>{knowledgeBundleTypeLabel(locale, value)}</Text>
                  </Pressable>
                ))}
              </View>
              {knowledgeType ? (
                <>
                  <TextInput accessibilityLabel={BUNDLE_COPY[locale].question} value={centralQuestion} onChangeText={setCentralQuestion} placeholder={BUNDLE_COPY[locale].questionPlaceholder} style={styles.input} />
                  {BUNDLE_FIELD_COPY[locale][knowledgeType].map((label, index) => knowledgeType === 'question' && index === 6 ? (
                    <View key="question-status" style={styles.statusEditor}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <View style={styles.typeGrid}>
                        {(['open', 'answered'] as const).map((status) => {
                          const selected = (bundleFields[6] || 'open') === status;
                          return <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => updateBundleField(6, status)} style={[styles.typeButton, selected && styles.typeButtonActive]}><Text style={[styles.typeButtonText, selected && styles.typeButtonTextActive]}>{knowledgeBundleQuestionStatusLabel(locale, status)}</Text></Pressable>;
                        })}
                      </View>
                    </View>
                  ) : (
                    <TextInput
                      key={`${knowledgeType}-${index}`}
                      accessibilityLabel={label}
                      value={bundleFields[index] ?? ''}
                      onChangeText={(value) => updateBundleField(index, value)}
                      placeholder={`${label} · ${BUNDLE_COPY[locale].lines}`}
                      multiline
                      style={[styles.input, styles.contentInput]}
                    />
                  ))}
                </>
              ) : (
                <TextInput accessibilityLabel={t('notes.contentPlaceholder')} value={content} onChangeText={setContent} placeholder={t('notes.contentPlaceholder')} multiline style={[styles.input, styles.contentInput]} />
              )}
              <Pressable accessibilityRole="button" disabled={!title.trim() || submitting || Boolean(knowledgeType && !centralQuestion.trim())} onPress={() => void addNote()} style={[styles.addButton, (!title.trim() || submitting || Boolean(knowledgeType && !centralQuestion.trim())) && styles.disabled]}>
                <Text style={styles.addButtonText}>{submitting ? t('notes.saving') : editing ? t('notes.saveChanges') : t('notes.add')}</Text>
              </Pressable>
              {editing ? <Pressable accessibilityRole="button" onPress={resetEditor}><Text style={styles.action}>{t('notes.cancelEdit')}</Text></Pressable> : null}
            </View>
          ) : null}
          <TextInput accessibilityLabel={t('notes.search')} value={query} onChangeText={setQuery} placeholder={t('notes.search')} style={styles.input}/>
          <View style={styles.filterRow}><Pressable accessibilityRole="button" accessibilityState={{ selected: selectedTopic === 'all' }} onPress={() => setSelectedTopic('all')} style={[styles.filter, selectedTopic === 'all' && styles.activeTab]}><Text>{t('notes.allTopics')}</Text></Pressable>{topics.map((value) => <Pressable accessibilityRole="button" accessibilityState={{ selected: selectedTopic === value }} key={value} onPress={() => setSelectedTopic(value)} style={[styles.filter, selectedTopic === value && styles.activeTab]}><Text>{value}</Text></Pressable>)}</View>
          <View style={styles.filterRow}>{(['created', 'updated', 'title'] as const).map((value) => <Pressable accessibilityRole="button" accessibilityState={{ selected: sortBy === value }} key={value} onPress={() => setSortBy(value)} style={[styles.filter, sortBy === value && styles.activeTab]}><Text>{value === 'created' ? t('notes.recentlyAdded') : value === 'updated' ? t('notes.recentlyUpdated') : t('notes.alphabetical')}</Text></Pressable>)}</View>
          {error && <Text style={styles.error}>{error}</Text>}
          {loading && <Text style={styles.meta}>{t('common.loading')}</Text>}
        </View>}
        ListEmptyComponent={!loading ? <Text style={styles.meta}>{isTrash ? t('notes.emptyTrash') : t('notes.empty')}</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.note}>
            <View style={styles.noteHeader}>
              <Text style={styles.noteTitle}>{item.title}</Text>
              {item.knowledge_type ? <Text style={styles.typeBadge}>{knowledgeBundleTypeLabel(locale, item.knowledge_type)}</Text> : null}
            </View>
            <View style={styles.noteMetaRow}>
              {item.topic && !isTrash ? (
                <Pressable accessibilityRole="link" accessibilityLabel={`${OPEN_TOPIC_COPY[locale]}: ${item.topic}`} onPress={() => router.push(`/knowledge-topic/${encodeURIComponent(item.topic)}`)}>
                  <Text style={styles.topicLink}>{item.topic} ↗</Text>
                </Pressable>
              ) : item.topic ? <Text style={styles.meta}>{item.topic}</Text> : null}
              <Text style={styles.meta}>{formatDate(item.updated_at)}</Text>
            </View>
            {item.central_question ? <Text style={styles.centralQuestion}>{item.central_question}</Text> : null}
            {item.summary || item.content ? <Text style={styles.noteContent}>{item.summary || item.content}</Text> : null}
            {item.structured_content ? <View style={styles.bundleAnswer}><MobileKnowledgeBundleView content={item.structured_content} locale={locale} /></View> : null}
            {!isTrash ? <Pressable accessibilityRole="button" accessibilityLabel={`${t('notes.edit')} ${item.title}`} onPress={() => startEdit(item)}><Text style={styles.action}>{t('notes.edit')}</Text></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`${isTrash ? t('notes.restore') : t('notes.moveToTrash')} ${item.title}`} onPress={() => isTrash ? void restoreNote(item) : deleteNote(item)}><Text style={styles.action}>{isTrash ? t('notes.restore') : t('notes.moveToTrash')}</Text></Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8fb' },
  content: { padding: 20, paddingBottom: 32, gap: 12 },
  kicker: { color: '#47606f', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#111827', fontSize: 32, fontWeight: '800', marginBottom: 14 },
  candidateInboxLink: { alignSelf: 'flex-start', backgroundColor: '#eef2ff', borderColor: '#a5b4fc', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  candidateInboxLinkText: { color: '#3730a3', fontSize: 13, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { backgroundColor: '#fff', borderColor: '#d8dee8', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  activeTab: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  filterRow: { flexDirection: 'row', gap: 8, overflow: 'hidden' },
  filter: { backgroundColor: '#fff', borderColor: '#d8dee8', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 10, marginBottom: 14 },
  fieldLabel: { color: '#374151', fontSize: 13, fontWeight: '800' },
  statusEditor: { gap: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeButton: { backgroundColor: '#fff', borderColor: '#d8dee8', borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  typeButtonActive: { backgroundColor: '#111827', borderColor: '#111827' },
  typeButtonText: { color: '#445463', fontSize: 13, fontWeight: '700' },
  typeButtonTextActive: { color: '#fff' },
  input: { borderColor: '#d8dee8', borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  shortMultiline: { minHeight: 70, textAlignVertical: 'top' },
  contentInput: { minHeight: 96, textAlignVertical: 'top' },
  addButton: { backgroundColor: '#111827', borderRadius: 8, padding: 13 },
  disabled: { opacity: .45 },
  addButtonText: { color: '#fff', fontWeight: '800', textAlign: 'center' },
  note: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 6 },
  noteHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  topicLink: { color: '#1d4ed8', fontSize: 13, fontWeight: '800' },
  noteTitle: { color: '#111827', fontSize: 17, fontWeight: '800', flex: 1 },
  typeBadge: { color: '#6b21a8', backgroundColor: '#f3e8ff', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  centralQuestion: { color: '#111827', fontSize: 15, lineHeight: 22, fontWeight: '800' },
  noteContent: { color: '#374151', fontSize: 15, lineHeight: 22 },
  bundleAnswer: { borderColor: '#e9d5ff', borderWidth: 1, backgroundColor: '#faf5ff', borderRadius: 8, padding: 10, gap: 5 },
  meta: { color: '#607080', fontSize: 13 },
  action: { color: '#2563eb', fontWeight: '800', marginTop: 4 },
  error: { color: '#b91c1c', marginBottom: 12 },
});
