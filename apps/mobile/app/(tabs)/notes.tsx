import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthRequired } from '@/components/auth-required';
import { mobileApi, type PersonalNote } from '@/api';
import { useI18n } from '@/i18n';
import { buildMobileKnowledgeBundle, knowledgeBundleQuestionStatusLabel, knowledgeBundleRecallPrompt, knowledgeBundleTypeLabel, mobileKnowledgeBundleEditValues } from '@/knowledge-bundle-ui';
import { MobileKnowledgeBundleView } from '@/components/knowledge-bundle-view';
import { KnowledgeNotationGroup } from '@/components/knowledge-notation-group';
import { KnowledgeText } from '@/components/knowledge-text';
import { buildKnowledgeNotationGroupBlocks } from '@/knowledge-bundle-notation';
import {
  KNOWLEDGE_BUNDLE_TYPES,
  type KnowledgeBundleType,
  type Locale,
} from '@stem-brain/shared';

const BUNDLE_COPY: Record<Locale, {
  format: string; preview: string; quick: string; question: string; questionPlaceholder: string; summary: string; tags: string;
  primary: Partial<Record<KnowledgeBundleType, string>>; secondary: Partial<Record<KnowledgeBundleType, string>>; tertiary: Partial<Record<KnowledgeBundleType, string>>;
  types: Partial<Record<KnowledgeBundleType, string>>; lines: string;
}> = {
  en: { format: 'Knowledge format', preview: 'Live preview', quick: 'Quick note', question: 'Central question', questionPlaceholder: 'What should you be able to explain?', summary: 'Summary', tags: 'Tags, separated by commas', lines: 'One item per line', types: { concept: 'Concept', procedure: 'Procedure', comparison: 'Comparison', mechanism: 'Mechanism', structure: 'Structure', claim_evidence: 'Claim & evidence' }, primary: { concept: 'Definition', procedure: 'Goal', comparison: 'Targets', mechanism: 'Causes', structure: 'Purpose', claim_evidence: 'Claim' }, secondary: { concept: 'Key points', procedure: 'Steps', comparison: 'Differences', mechanism: 'Process stages', structure: 'Components', claim_evidence: 'Evidence' }, tertiary: { concept: 'Examples', procedure: 'Done when', comparison: 'Commonalities', mechanism: 'Results', structure: 'Boundaries', claim_evidence: 'Limitations' } },
  ja: { format: '知識形式', preview: 'ライブプレビュー', quick: 'クイックメモ', question: '中心となる問い', questionPlaceholder: '何を説明できるようにしますか？', summary: '要約', tags: 'タグ（カンマ区切り）', lines: '1行に1項目', types: { concept: '概念', procedure: '手順', comparison: '比較', mechanism: '仕組み', structure: '構造', claim_evidence: '主張と根拠' }, primary: { concept: '定義', procedure: '目標', comparison: '比較対象', mechanism: '原因', structure: '目的', claim_evidence: '主張' }, secondary: { concept: '要点', procedure: '手順', comparison: '相違点', mechanism: '進行段階', structure: '構成要素', claim_evidence: '根拠' }, tertiary: { concept: '例', procedure: '完了条件', comparison: '共通点', mechanism: '結果', structure: '境界', claim_evidence: '限界' } },
  'zh-CN': { format: '知识形式', preview: '实时预览', quick: '快速笔记', question: '核心问题', questionPlaceholder: '你应该能够解释什么？', summary: '摘要', tags: '标签（用逗号分隔）', lines: '每行一项', types: { concept: '概念', procedure: '步骤', comparison: '比较', mechanism: '机制', structure: '结构', claim_evidence: '主张与证据' }, primary: { concept: '定义', procedure: '目标', comparison: '比较对象', mechanism: '原因', structure: '目的', claim_evidence: '主张' }, secondary: { concept: '要点', procedure: '步骤', comparison: '差异', mechanism: '过程阶段', structure: '组成部分', claim_evidence: '证据' }, tertiary: { concept: '示例', procedure: '完成标准', comparison: '共同点', mechanism: '结果', structure: '边界', claim_evidence: '限制' } },
  es: { format: 'Formato de conocimiento', preview: 'Vista previa', quick: 'Nota rápida', question: 'Pregunta central', questionPlaceholder: '¿Qué deberías poder explicar?', summary: 'Resumen', tags: 'Etiquetas, separadas por comas', lines: 'Un elemento por línea', types: { concept: 'Concepto', procedure: 'Procedimiento', comparison: 'Comparación', mechanism: 'Mecanismo', structure: 'Estructura', claim_evidence: 'Afirmación y evidencia' }, primary: { concept: 'Definición', procedure: 'Objetivo', comparison: 'Objetivos', mechanism: 'Causas', structure: 'Propósito', claim_evidence: 'Afirmación' }, secondary: { concept: 'Puntos clave', procedure: 'Pasos', comparison: 'Diferencias', mechanism: 'Etapas', structure: 'Componentes', claim_evidence: 'Evidencia' }, tertiary: { concept: 'Ejemplos', procedure: 'Criterio de finalización', comparison: 'Similitudes', mechanism: 'Resultados', structure: 'Límites', claim_evidence: 'Limitaciones' } },
  ar: { format: 'صيغة المعرفة', preview: 'معاينة مباشرة', quick: 'ملاحظة سريعة', question: 'السؤال المركزي', questionPlaceholder: 'ما الذي ينبغي أن تستطيع شرحه؟', summary: 'الملخص', tags: 'وسوم مفصولة بفواصل', lines: 'عنصر واحد في كل سطر', types: { concept: 'مفهوم', procedure: 'إجراء', comparison: 'مقارنة', mechanism: 'آلية', structure: 'بنية', claim_evidence: 'ادعاء ودليل' }, primary: { concept: 'التعريف', procedure: 'الهدف', comparison: 'عناصر المقارنة', mechanism: 'الأسباب', structure: 'الغرض', claim_evidence: 'الادعاء' }, secondary: { concept: 'النقاط الأساسية', procedure: 'الخطوات', comparison: 'الاختلافات', mechanism: 'المراحل', structure: 'المكونات', claim_evidence: 'الدليل' }, tertiary: { concept: 'أمثلة', procedure: 'معيار الاكتمال', comparison: 'أوجه التشابه', mechanism: 'النتائج', structure: 'الحدود', claim_evidence: 'القيود' } },
  hi: { format: 'ज्ञान प्रारूप', preview: 'लाइव पूर्वावलोकन', quick: 'त्वरित नोट', question: 'केंद्रीय प्रश्न', questionPlaceholder: 'आपको क्या समझा पाना चाहिए?', summary: 'सार', tags: 'कॉमा से अलग टैग', lines: 'हर पंक्ति में एक बिंदु', types: { concept: 'अवधारणा', procedure: 'प्रक्रिया', comparison: 'तुलना', mechanism: 'तंत्र', structure: 'संरचना', claim_evidence: 'दावा और प्रमाण' }, primary: { concept: 'परिभाषा', procedure: 'लक्ष्य', comparison: 'तुलना लक्ष्य', mechanism: 'कारण', structure: 'उद्देश्य', claim_evidence: 'दावा' }, secondary: { concept: 'मुख्य बिंदु', procedure: 'चरण', comparison: 'अंतर', mechanism: 'प्रक्रिया चरण', structure: 'घटक', claim_evidence: 'प्रमाण' }, tertiary: { concept: 'उदाहरण', procedure: 'पूर्ण होने की शर्त', comparison: 'समानताएँ', mechanism: 'परिणाम', structure: 'सीमाएँ', claim_evidence: 'सीमाएँ' } },
};

type BundleRowFormat = 'pair' | 'criteria' | 'component' | 'relation' | 'example';

const BUNDLE_EDITOR_HELP: Record<Locale, {
  notation: string; visual: string; jsonRows: string; pair: string; criteria: string; component: string; relation: string; example: string;
}> = {
  en: { notation: 'Every text field supports inline and display math, chemistry, units, and inline code. Multiline prose fields also support fenced code blocks.', visual: 'Flow and timeline blocks work in multiline prose fields such as Definition, Goal, Context, or Purpose. Each row is JSON; write every formula backslash twice inside the JSON string.', jsonRows: 'For multi-column fields, enter one JSON row per line.', pair: 'JSON per line: ["item", "detail"]', criteria: 'JSON per line: ["criterion", ["value 1", "value 2"]]', component: 'JSON per line: ["id", "label", "role", "parent id"]', relation: 'JSON per line: ["source id", "target id", "relationship"]', example: 'JSON per line: ["text", "translation", "note"]' },
  ja: { notation: 'すべてのテキスト欄で行内・別行数式、化学式、単位、行内コードを使えます。複数行の文章欄ではフェンス付きコードブロックも使えます。', visual: 'フローとタイムラインのブロックは、定義・目標・背景・目的などの複数行の文章欄で使えます。各行はJSONです。数式のバックスラッシュはJSON文字列内で2回入力してください。', jsonRows: '複数列の欄は1行に1つのJSON行で入力します。', pair: '1行ごとのJSON：["項目", "詳細"]', criteria: '1行ごとのJSON：["基準", ["値1", "値2"]]', component: '1行ごとのJSON：["ID", "名前", "役割", "親ID"]', relation: '1行ごとのJSON：["元ID", "先ID", "関係"]', example: '1行ごとのJSON：["本文", "翻訳", "注記"]' },
  'zh-CN': { notation: '所有文本字段都支持行内及独立公式、化学式、单位和行内代码；多行正文还支持围栏代码块。', visual: '流程和时间线块可用于定义、目标、上下文或目的等多行正文栏。每一行都是 JSON；公式中的每个反斜杠在 JSON 字符串内要写两次。', jsonRows: '多列字段每行输入一条 JSON 记录。', pair: '每行 JSON：["项目", "详情"]', criteria: '每行 JSON：["标准", ["值一", "值二"]]', component: '每行 JSON：["ID", "名称", "角色", "父ID"]', relation: '每行 JSON：["源ID", "目标ID", "关系"]', example: '每行 JSON：["原文", "翻译", "注释"]' },
  es: { notation: 'Todos los campos admiten fórmulas en línea y separadas, química, unidades y código en línea. Los campos de prosa multilínea también admiten bloques de código cercados.', visual: 'Los bloques de flujo y cronología funcionan en campos de prosa multilínea como Definición, Objetivo, Contexto o Propósito. Cada fila es JSON; escribe dos veces cada barra inversa de una fórmula dentro de la cadena JSON.', jsonRows: 'En campos con varias columnas, introduce una fila JSON por línea.', pair: 'JSON por línea: ["elemento", "detalle"]', criteria: 'JSON por línea: ["criterio", ["valor 1", "valor 2"]]', component: 'JSON por línea: ["id", "nombre", "función", "id superior"]', relation: 'JSON por línea: ["id origen", "id destino", "relación"]', example: 'JSON por línea: ["texto", "traducción", "nota"]' },
  ar: { notation: 'تدعم جميع الحقول النصية الرياضيات المضمنة والمنفصلة والكيمياء والوحدات والشفرة المضمنة. وتدعم حقول النص متعددة الأسطر كتل الشفرة المسيجة أيضاً.', visual: 'تعمل كتل التدفق والخط الزمني في حقول النص متعددة الأسطر مثل التعريف أو الهدف أو السياق أو الغرض. كل صف بصيغة JSON؛ اكتب كل شرطة مائلة عكسية في الصيغة مرتين داخل سلسلة JSON.', jsonRows: 'في الحقول متعددة الأعمدة، أدخل صف JSON واحداً في كل سطر.', pair: 'JSON في كل سطر: ["العنصر", "التفاصيل"]', criteria: 'JSON في كل سطر: ["المعيار", ["القيمة 1", "القيمة 2"]]', component: 'JSON في كل سطر: ["المعرف", "الاسم", "الدور", "معرف الأصل"]', relation: 'JSON في كل سطر: ["المصدر", "الهدف", "العلاقة"]', example: 'JSON في كل سطر: ["النص", "الترجمة", "الملاحظة"]' },
  hi: { notation: 'हर टेक्स्ट फ़ील्ड में इनलाइन और अलग गणित, रसायन, इकाइयाँ और इनलाइन कोड काम करते हैं। बहु-पंक्ति विवरण फ़ील्ड में फ़ेन्स्ड कोड ब्लॉक भी काम करते हैं।', visual: 'फ़्लो और टाइमलाइन ब्लॉक परिभाषा, लक्ष्य, संदर्भ या उद्देश्य जैसे बहु-पंक्ति गद्य फ़ील्ड में काम करते हैं। हर पंक्ति JSON है; JSON स्ट्रिंग में सूत्र का हर बैकस्लैश दो बार लिखें।', jsonRows: 'कई कॉलम वाले फ़ील्ड में हर पंक्ति पर एक JSON रो लिखें।', pair: 'हर पंक्ति JSON: ["बिंदु", "विवरण"]', criteria: 'हर पंक्ति JSON: ["मानदंड", ["मान 1", "मान 2"]]', component: 'हर पंक्ति JSON: ["id", "नाम", "भूमिका", "parent id"]', relation: 'हर पंक्ति JSON: ["स्रोत id", "लक्ष्य id", "संबंध"]', example: 'हर पंक्ति JSON: ["पाठ", "अनुवाद", "टिप्पणी"]' },
};

const BUNDLE_ROW_FORMATS: Partial<Record<KnowledgeBundleType, Partial<Record<number, BundleRowFormat>>>> = {
  concept: { 4: 'pair' },
  procedure: { 2: 'pair', 3: 'pair', 4: 'pair' },
  comparison: { 1: 'criteria', 4: 'pair' },
  mechanism: { 1: 'pair' },
  structure: { 1: 'component', 2: 'relation' },
  claim_evidence: { 1: 'pair' },
  decision: { 2: 'pair' },
  expression: { 4: 'pair', 8: 'example', 9: 'pair', 10: 'pair' },
};

function bundleFieldHelp(locale: Locale, type: KnowledgeBundleType, index: number) {
  const format = BUNDLE_ROW_FORMATS[type]?.[index];
  return format ? BUNDLE_EDITOR_HELP[locale][format] : BUNDLE_COPY[locale].lines;
}

const BUNDLE_FIELD_COPY: Record<Locale, Record<KnowledgeBundleType, string[]>> = {
  en: { concept: ['Definition', 'Key points', 'Examples', 'Non-examples', 'Misconceptions and corrections'], procedure: ['Goal', 'Prerequisites', 'Steps and details', 'Branch conditions and actions', 'Failure symptoms and responses', 'Done when'], comparison: ['Targets', 'Criteria and values', 'Commonalities', 'Differences', 'Choice conditions and recommendations'], mechanism: ['Causes', 'Process stages and details', 'Results', 'Conditions', 'Exceptions'], structure: ['Purpose', 'Components', 'Internal relations', 'Boundaries'], claim_evidence: ['Claim', 'Evidence and sources', 'Counterevidence', 'Scope', 'Limitations', 'Confidence: low, medium, or high'], question: ['Question', 'Context', 'Known facts', 'Hypotheses', 'Next steps', 'Answer summary', 'Status: open or answered'], decision: ['Decision', 'Context', 'Options and tradeoffs', 'Criteria', 'Rationale', 'Reconsider when', 'Outcome'], event: ['Event', 'Occurred at', 'Context', 'Changes', 'Causes', 'Consequences', 'Chronology: precision :: era :: year :: month :: day :: end era :: end year :: end month :: end day'], expression: ['Expression', 'Language tag', 'Pronunciation', 'Meanings', 'Translations', 'Register', 'Nuance', 'Usage contexts', 'Examples', 'Contrasting expressions and differences', 'Common mistakes and corrections'] },
  ja: { concept: ['定義', '要点', '例', '反例', '誤解と訂正'], procedure: ['目標', '前提条件', '手順と詳細', '分岐条件と対応', '失敗症状と対応', '完了条件'], comparison: ['比較対象', '基準と値', '共通点', '相違点', '選択条件と推奨'], mechanism: ['原因', '進行段階と詳細', '結果', '条件', '例外'], structure: ['目的', '構成要素', '内部関係', '境界'], claim_evidence: ['主張', '根拠と出典', '反証', '適用範囲', '限界', '確信度：low、medium、high'], question: ['質問', '背景', '既知の事実', '仮説', '次の手順', '回答の要約', '状態：open または answered'], decision: ['決定', '背景', '選択肢とトレードオフ', '基準', '理由', '再検討条件', '結果'], event: ['出来事', '発生日時', '背景', '変化', '原因', '結果', '年代：精度 :: 紀元 :: 年 :: 月 :: 日 :: 終了紀元 :: 終了年 :: 終了月 :: 終了日'], expression: ['表現', '言語タグ', '発音', '意味', '翻訳', '使用域', 'ニュアンス', '使用場面', '例文', '対照表現と違い', 'よくある誤りと訂正'] },
  'zh-CN': { concept: ['定义', '要点', '示例', '反例', '误解与纠正'], procedure: ['目标', '前置条件', '步骤与详情', '分支条件与操作', '失败症状与处理', '完成标准'], comparison: ['比较对象', '标准与取值', '共同点', '差异', '选择条件与建议'], mechanism: ['原因', '过程阶段与详情', '结果', '条件', '例外'], structure: ['目的', '组成部分', '内部关系', '边界'], claim_evidence: ['主张', '证据与来源', '反证', '范围', '限制', '可信度：low、medium、high'], question: ['问题', '背景', '已知事实', '假设', '下一步', '答案摘要', '状态：open 或 answered'], decision: ['决策', '背景', '选项与权衡', '标准', '理由', '重新考虑的条件', '结果'], event: ['事件', '发生时间', '背景', '变化', '原因', '后果', '年代：精度 :: 纪元 :: 年 :: 月 :: 日 :: 结束纪元 :: 结束年 :: 结束月 :: 结束日'], expression: ['表达', '语言标签', '发音', '含义', '翻译', '语域', '语气', '使用场景', '例句', '对比表达与差异', '常见错误与纠正'] },
  es: { concept: ['Definición', 'Puntos clave', 'Ejemplos', 'Contraejemplos', 'Errores y correcciones'], procedure: ['Objetivo', 'Requisitos', 'Pasos y detalles', 'Condiciones de rama y acciones', 'Síntomas de fallo y respuestas', 'Criterio de finalización'], comparison: ['Objetivos', 'Criterios y valores', 'Similitudes', 'Diferencias', 'Condiciones y recomendaciones'], mechanism: ['Causas', 'Etapas y detalles', 'Resultados', 'Condiciones', 'Excepciones'], structure: ['Propósito', 'Componentes', 'Relaciones internas', 'Límites'], claim_evidence: ['Afirmación', 'Evidencias y fuentes', 'Contraevidencia', 'Alcance', 'Limitaciones', 'Confianza: low, medium o high'], question: ['Pregunta', 'Contexto', 'Hechos conocidos', 'Hipótesis', 'Próximos pasos', 'Resumen de la respuesta', 'Estado: open o answered'], decision: ['Decisión', 'Contexto', 'Opciones y contraprestaciones', 'Criterios', 'Justificación', 'Reconsiderar cuando', 'Resultado'], event: ['Evento', 'Ocurrió en', 'Contexto', 'Cambios', 'Causas', 'Consecuencias', 'Cronología: precisión :: era :: año :: mes :: día :: era final :: año final :: mes final :: día final'], expression: ['Expresión', 'Etiqueta de idioma', 'Pronunciación', 'Significados', 'Traducciones', 'Registro', 'Matiz', 'Contextos de uso', 'Ejemplos', 'Expresiones contrastantes y diferencias', 'Errores comunes y correcciones'] },
  ar: { concept: ['التعريف', 'النقاط الأساسية', 'أمثلة', 'أمثلة مضادة', 'المفاهيم الخاطئة وتصحيحها'], procedure: ['الهدف', 'المتطلبات', 'الخطوات والتفاصيل', 'شروط التفرع والإجراءات', 'أعراض الفشل والاستجابات', 'معيار الاكتمال'], comparison: ['عناصر المقارنة', 'المعايير والقيم', 'أوجه التشابه', 'الاختلافات', 'الشروط والتوصيات'], mechanism: ['الأسباب', 'المراحل والتفاصيل', 'النتائج', 'الشروط', 'الاستثناءات'], structure: ['الغرض', 'المكونات', 'العلاقات الداخلية', 'الحدود'], claim_evidence: ['الادعاء', 'الأدلة والمصادر', 'الدليل المضاد', 'النطاق', 'القيود', 'الثقة: low أو medium أو high'], question: ['السؤال', 'السياق', 'الحقائق المعروفة', 'الفرضيات', 'الخطوات التالية', 'ملخص الإجابة', 'الحالة: open أو answered'], decision: ['القرار', 'السياق', 'الخيارات والمفاضلات', 'المعايير', 'المبررات', 'إعادة النظر عند', 'النتيجة'], event: ['الحدث', 'وقت الحدوث', 'السياق', 'التغييرات', 'الأسباب', 'العواقب', 'التسلسل الزمني: الدقة :: العصر :: السنة :: الشهر :: اليوم :: عصر النهاية :: سنة النهاية :: شهر النهاية :: يوم النهاية'], expression: ['التعبير', 'وسم اللغة', 'النطق', 'المعاني', 'الترجمات', 'السجل', 'الدلالة', 'سياقات الاستخدام', 'الأمثلة', 'التعبيرات المقابلة والفروق', 'الأخطاء الشائعة وتصحيحها'] },
  hi: { concept: ['परिभाषा', 'मुख्य बिंदु', 'उदाहरण', 'प्रतिउदाहरण', 'गलत धारणाएँ और सुधार'], procedure: ['लक्ष्य', 'पूर्वापेक्षाएँ', 'चरण और विवरण', 'शाखा शर्तें और कार्रवाइयाँ', 'विफलता लक्षण और प्रतिक्रियाएँ', 'पूर्ण होने की शर्त'], comparison: ['तुलना लक्ष्य', 'मानदंड और मान', 'समानताएँ', 'अंतर', 'शर्तें और अनुशंसाएँ'], mechanism: ['कारण', 'प्रक्रिया चरण और विवरण', 'परिणाम', 'शर्तें', 'अपवाद'], structure: ['उद्देश्य', 'घटक', 'आंतरिक संबंध', 'सीमाएँ'], claim_evidence: ['दावा', 'प्रमाण और स्रोत', 'विपरीत प्रमाण', 'दायरा', 'सीमाएँ', 'विश्वास: low, medium या high'], question: ['प्रश्न', 'संदर्भ', 'ज्ञात तथ्य', 'परिकल्पनाएँ', 'अगले कदम', 'उत्तर सारांश', 'स्थिति: open या answered'], decision: ['निर्णय', 'संदर्भ', 'विकल्प और समझौते', 'मानदंड', 'तर्क', 'पुनर्विचार कब', 'परिणाम'], event: ['घटना', 'घटित होने का समय', 'संदर्भ', 'बदलाव', 'कारण', 'परिणाम', 'कालक्रम: शुद्धता :: युग :: वर्ष :: माह :: दिन :: अंतिम युग :: अंतिम वर्ष :: अंतिम माह :: अंतिम दिन'], expression: ['अभिव्यक्ति', 'भाषा टैग', 'उच्चारण', 'अर्थ', 'अनुवाद', 'रजिस्टर', 'सूक्ष्मता', 'प्रयोग संदर्भ', 'उदाहरण', 'विपरीत अभिव्यक्तियाँ और अंतर', 'सामान्य गलतियाँ और सुधार'] },
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
  const deferredBundleFields = useDeferredValue(bundleFields);
  const deferredCentralQuestion = useDeferredValue(centralQuestion);
  const deferredSummary = useDeferredValue(summary);

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
  const bundlePreview = useMemo(() => {
    if (!knowledgeType) return null;
    try {
      return buildMobileKnowledgeBundle(knowledgeType, deferredBundleFields);
    } catch {
      return null;
    }
  }, [deferredBundleFields, knowledgeType]);
  const topics = Array.from(new Set(items.map((item) => item.topic))).sort();
  const visibleItems = items.filter((item) => {
    const matchesQuery = !query.trim() || `${item.title} ${item.topic} ${item.summary} ${item.content} ${item.central_question ?? ''} ${item.knowledge_type ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (selectedTopic === 'all' || item.topic === selectedTopic);
  }).sort((a, b) => sortBy === 'title' ? a.title.localeCompare(b.title, locale) : +new Date(b[sortBy === 'updated' ? 'updated_at' : 'created_at']) - +new Date(a[sortBy === 'updated' ? 'updated_at' : 'created_at']));

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList data={visibleItems} keyExtractor={(item) => item.id} contentContainerStyle={styles.content}
        initialNumToRender={4} maxToRenderPerBatch={4} windowSize={5}
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
                  <View accessibilityLabel={`${BUNDLE_EDITOR_HELP[locale].notation}\n${BUNDLE_EDITOR_HELP[locale].visual}`} style={styles.editorHelp}>
                    <Text style={styles.editorHelpText}>{BUNDLE_EDITOR_HELP[locale].notation}</Text>
                    <Text selectable style={styles.editorSyntax}>{'\\(E = mc^2\\) · \\(\\ce{2H2 + O2 -> 2H2O}\\) · \\(\\pu{9.81 m/s^2}\\) · `inline code`'}</Text>
                    <Text selectable style={styles.editorSyntax}>{'\\[E = mc^2\\]\n```ts\nconst value = 1;\n```'}</Text>
                    <Text style={styles.editorHelpText}>{BUNDLE_EDITOR_HELP[locale].visual}</Text>
                    <Text selectable style={styles.editorSyntax}>{':::flow\n["Input", "Output", "produces"]\n["\\\\(m\\\\)", "\\\\(E = mc^2\\\\)", "maps to"]\n:::\n\n:::timeline\n["1905", "Special relativity", "Connects \\\\(m\\\\) and \\\\(E\\\\)"]\n:::'}</Text>
                    <Text style={styles.editorHelpText}>{BUNDLE_EDITOR_HELP[locale].jsonRows}</Text>
                    <Text selectable style={styles.editorSyntax}>{'["item", "detail"]'}</Text>
                  </View>
                  {BUNDLE_FIELD_COPY[locale][knowledgeType].map((label, index) => {
                    const fieldLabel = label;
                    return knowledgeType === 'question' && index === 6 ? (
                      <View key="question-status" style={styles.statusEditor}>
                        <Text style={styles.fieldLabel}>{fieldLabel}</Text>
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
                        accessibilityLabel={fieldLabel}
                        value={bundleFields[index] ?? ''}
                        onChangeText={(value) => updateBundleField(index, value)}
                        placeholder={`${fieldLabel} · ${bundleFieldHelp(locale, knowledgeType, index)}`}
                        multiline
                        style={[styles.input, styles.contentInput]}
                      />
                    );
                  })}
                  <View accessibilityLabel={BUNDLE_COPY[locale].preview} style={styles.preview}>
                    <Text style={styles.previewLabel}>{BUNDLE_COPY[locale].preview}</Text>
                    <KnowledgeNotationGroup
                      accessibilityLabel={bundlePreview ? `${BUNDLE_COPY[locale].preview}\n${knowledgeBundleRecallPrompt(locale, bundlePreview.type)}` : BUNDLE_COPY[locale].preview}
                      blocks={buildKnowledgeNotationGroupBlocks([
                        { source: deferredCentralQuestion.trim(), tone: 'question' },
                        { source: deferredSummary.trim(), tone: 'summary' },
                      ], bundlePreview, locale)}
                      direction={direction}
                    >
                      {deferredCentralQuestion.trim() ? <KnowledgeText value={deferredCentralQuestion} direction={direction} style={styles.previewQuestion} /> : null}
                      {deferredSummary.trim() ? <KnowledgeText value={deferredSummary} direction={direction} style={styles.previewSummary} /> : null}
                      {bundlePreview ? <MobileKnowledgeBundleView content={bundlePreview} locale={locale} /> : null}
                    </KnowledgeNotationGroup>
                  </View>
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
        renderItem={({ item }) => {
          const notationBlocks = buildKnowledgeNotationGroupBlocks([
            { source: item.title, tone: 'title' },
            { source: item.central_question, tone: 'question' },
            { source: item.summary || item.content, tone: 'summary' },
          ], item.structured_content, locale);
          return (
            <View style={styles.note}>
              {item.knowledge_type ? <View style={styles.noteHeader}><Text style={styles.typeBadge}>{knowledgeBundleTypeLabel(locale, item.knowledge_type)}</Text></View> : null}
              <KnowledgeNotationGroup accessibilityLabel={item.structured_content ? knowledgeBundleRecallPrompt(locale, item.structured_content.type) : undefined} blocks={notationBlocks} direction={direction}>
                <KnowledgeText value={item.title} direction={direction} style={styles.noteTitle} />
                {item.central_question ? <KnowledgeText value={item.central_question} direction={direction} style={styles.centralQuestion} /> : null}
                {item.summary || item.content ? <KnowledgeText value={item.summary || item.content} direction={direction} style={styles.noteContent} /> : null}
                {item.structured_content ? <View style={styles.bundleAnswer}><MobileKnowledgeBundleView content={item.structured_content} locale={locale} /></View> : null}
              </KnowledgeNotationGroup>
              <View style={styles.noteMetaRow}>
                {item.topic && !isTrash ? (
                  <Pressable accessibilityRole="link" accessibilityLabel={`${OPEN_TOPIC_COPY[locale]}: ${item.topic}`} onPress={() => router.push(`/knowledge-topic/${encodeURIComponent(item.topic)}`)}>
                    <Text style={styles.topicLink}>{item.topic} ↗</Text>
                  </Pressable>
                ) : item.topic ? <Text style={styles.meta}>{item.topic}</Text> : null}
                <Text style={styles.meta}>{formatDate(item.updated_at)}</Text>
              </View>
              {!isTrash ? <Pressable accessibilityRole="button" accessibilityLabel={`${t('notes.edit')} ${item.title}`} onPress={() => startEdit(item)}><Text style={styles.action}>{t('notes.edit')}</Text></Pressable> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`${isTrash ? t('notes.restore') : t('notes.moveToTrash')} ${item.title}`} onPress={() => isTrash ? void restoreNote(item) : deleteNote(item)}><Text style={styles.action}>{isTrash ? t('notes.restore') : t('notes.moveToTrash')}</Text></Pressable>
            </View>
          );
        }}
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
  editorHelp: { borderColor: '#bae6fd', borderWidth: 1, borderRadius: 10, backgroundColor: '#f0f9ff', padding: 12, gap: 7 },
  editorHelpText: { color: '#334155', fontSize: 13, lineHeight: 19 },
  editorSyntax: { color: '#0f172a', backgroundColor: '#fff', borderRadius: 6, padding: 8, fontFamily: 'monospace', fontSize: 12, textAlign: 'left' },
  preview: { borderColor: '#c4b5fd', borderWidth: 1, borderRadius: 10, backgroundColor: '#faf5ff', padding: 12, gap: 8 },
  previewLabel: { color: '#6d28d9', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  previewQuestion: { color: '#111827', fontSize: 15, lineHeight: 22, fontWeight: '800' },
  previewSummary: { color: '#4b5563', fontSize: 13, lineHeight: 19 },
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
