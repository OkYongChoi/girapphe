import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '@stem-brain/shared';
import { AuthRequired } from '@/components/auth-required';
import { MobileKnowledgeBundleView } from '@/components/knowledge-bundle-view';
import { mobileApi, type MobileTopicHub } from '@/api';
import { useI18n } from '@/i18n';
import { eventChronologyLabel, knowledgeBundleTypeLabel } from '@/knowledge-bundle-ui';
import { eventTimelineSortKey } from '@/knowledge-topic';

type TopicCopy = {
  back: string;
  workspace: string;
  confirmed: string;
  open: string;
  decisions: string;
  events: string;
  openQuestions: string;
  knowledge: string;
  relationships: string;
  timeline: string;
  recentActivity: string;
  sources: string;
  noOpen: string;
  noRelations: string;
  noSources: string;
  confirmedByYou: string;
  openSource: string;
  retry: string;
  heroBody: string;
  confirmedNotice: string;
  next: string;
  updated: string;
  verified: string;
  observedEvent: string;
  undated: string;
  evidence: string;
};

const COPY: Record<Locale, TopicCopy> = {
  en: { back: 'Back', workspace: 'Topic workspace', confirmed: 'Confirmed', open: 'Open', decisions: 'Decisions', events: 'Events', openQuestions: 'Open questions', knowledge: 'Confirmed knowledge', relationships: 'Relationships', timeline: 'Timeline', recentActivity: 'Recent activity', sources: 'Source locations', noOpen: 'No unresolved questions.', noRelations: 'No confirmed relationships yet.', noSources: 'No imported source locations.', confirmedByYou: 'Confirmed by you', openSource: 'Open source location', retry: 'Try again', heroBody: 'Approved knowledge, unresolved questions, time, relationships, and provenance in one compact view.', confirmedNotice: 'These items were approved by you. Extracted and model-inferred relationships remain labeled.', next: 'Next', updated: 'Updated', verified: 'Verified', observedEvent: 'Observed event', undated: 'Date unknown', evidence: 'Evidence' },
  ja: { back: '戻る', workspace: 'トピックワークスペース', confirmed: '確認済み', open: '未解決', decisions: '決定', events: '出来事', openQuestions: '未解決の質問', knowledge: '確認済みナレッジ', relationships: '関係', timeline: 'タイムライン', recentActivity: '最近のアクティビティ', sources: '参照元', noOpen: '未解決の質問はありません。', noRelations: '確認済みの関係はありません。', noSources: 'インポート元はありません。', confirmedByYou: 'あなたが確認', openSource: '参照元を開く', retry: '再試行', heroBody: '承認済みナレッジ、未解決の質問、時系列、関係、出典をコンパクトに確認できます。', confirmedNotice: 'これらはあなたが承認した項目です。出典から抽出・モデル推論された関係にはラベルが表示されます。', next: '次', updated: '更新', verified: '検証', observedEvent: '観測イベント', undated: '年代不明', evidence: '根拠' },
  'zh-CN': { back: '返回', workspace: '主题工作区', confirmed: '已确认', open: '未解决', decisions: '决策', events: '事件', openQuestions: '待解决问题', knowledge: '已确认知识', relationships: '关系', timeline: '时间线', recentActivity: '近期活动', sources: '来源位置', noOpen: '没有待解决问题。', noRelations: '尚无已确认关系。', noSources: '没有导入来源。', confirmedByYou: '由你确认', openSource: '打开来源', retry: '重试', heroBody: '在一个紧凑视图中查看已批准知识、未解决问题、时间、关系和来源。', confirmedNotice: '这些项目由你批准。来源提取和模型推断的关系会保留清晰标签。', next: '下一步', updated: '更新于', verified: '已核验', observedEvent: '观测事件', undated: '日期未知', evidence: '证据' },
  es: { back: 'Volver', workspace: 'Espacio del tema', confirmed: 'Confirmado', open: 'Abiertas', decisions: 'Decisiones', events: 'Eventos', openQuestions: 'Preguntas abiertas', knowledge: 'Conocimiento confirmado', relationships: 'Relaciones', timeline: 'Cronología', recentActivity: 'Actividad reciente', sources: 'Ubicaciones de origen', noOpen: 'No hay preguntas sin resolver.', noRelations: 'Aún no hay relaciones confirmadas.', noSources: 'No hay fuentes importadas.', confirmedByYou: 'Confirmado por ti', openSource: 'Abrir fuente', retry: 'Reintentar', heroBody: 'Conocimiento aprobado, preguntas abiertas, tiempo, relaciones y procedencia en una vista compacta.', confirmedNotice: 'Estos elementos fueron aprobados por ti. Las relaciones extraídas o inferidas por el modelo conservan su etiqueta.', next: 'Siguiente', updated: 'Actualizado', verified: 'Verificado', observedEvent: 'Evento observado', undated: 'Fecha desconocida', evidence: 'Evidencia' },
  ar: { back: 'رجوع', workspace: 'مساحة الموضوع', confirmed: 'مؤكد', open: 'مفتوحة', decisions: 'قرارات', events: 'أحداث', openQuestions: 'أسئلة مفتوحة', knowledge: 'المعرفة المؤكدة', relationships: 'العلاقات', timeline: 'الخط الزمني', recentActivity: 'النشاط الأخير', sources: 'مواقع المصادر', noOpen: 'لا توجد أسئلة معلقة.', noRelations: 'لا توجد علاقات مؤكدة بعد.', noSources: 'لا توجد مصادر مستوردة.', confirmedByYou: 'أكدتها أنت', openSource: 'فتح المصدر', retry: 'إعادة المحاولة', heroBody: 'المعرفة المعتمدة والأسئلة المفتوحة والزمن والعلاقات والمصدر في عرض موجز واحد.', confirmedNotice: 'اعتمدت هذه العناصر بنفسك. وتظل العلاقات المستخرجة أو المستنتجة من النموذج موسومة بوضوح.', next: 'التالي', updated: 'حُدّث', verified: 'تم التحقق', observedEvent: 'حدث مرصود', undated: 'التاريخ غير معروف', evidence: 'الدليل' },
  hi: { back: 'वापस', workspace: 'विषय कार्यक्षेत्र', confirmed: 'पुष्ट', open: 'खुले', decisions: 'निर्णय', events: 'घटनाएँ', openQuestions: 'खुले प्रश्न', knowledge: 'पुष्ट ज्ञान', relationships: 'संबंध', timeline: 'समयरेखा', recentActivity: 'हाल की गतिविधि', sources: 'स्रोत स्थान', noOpen: 'कोई अनसुलझा प्रश्न नहीं।', noRelations: 'अभी कोई पुष्ट संबंध नहीं।', noSources: 'कोई आयातित स्रोत नहीं।', confirmedByYou: 'आपने पुष्टि की', openSource: 'स्रोत खोलें', retry: 'फिर प्रयास करें', heroBody: 'स्वीकृत ज्ञान, अनसुलझे प्रश्न, समय, संबंध और स्रोत एक संक्षिप्त दृश्य में।', confirmedNotice: 'इन आइटम को आपने स्वीकृत किया है। स्रोत से निकाले और मॉडल द्वारा अनुमानित संबंध स्पष्ट लेबल के साथ रहते हैं।', next: 'अगला', updated: 'अपडेट', verified: 'सत्यापित', observedEvent: 'देखी गई घटना', undated: 'तिथि अज्ञात', evidence: 'प्रमाण' },
};

const TOKEN_LABELS: Record<Locale, Record<string, string>> = {
  en: { confirmed: 'Confirmed', connected: 'Connected', verified: 'Verified', reused: 'Reused', revised: 'Revised', superseded: 'Superseded', archived: 'Archived', restored: 'Restored', related: 'related', prerequisite: 'prerequisite', generalizes: 'generalizes', derived_from: 'derived from', equivalent_to: 'equivalent to', supersedes: 'supersedes', answers: 'answers', supports: 'supports', contradicts: 'contradicts', causes: 'causes', contributes_to: 'contributes to', enables: 'enables', inhibits: 'inhibits', explicit_user: 'explicitly confirmed', extracted_from_source: 'extracted from source', model_inferred: 'model inferred' },
  ja: { confirmed: '確認済み', connected: '接続済み', verified: '検証済み', reused: '再利用', revised: '改訂', superseded: '置換済み', archived: 'アーカイブ済み', restored: '復元済み', related: '関連', prerequisite: '前提', generalizes: '一般化', derived_from: '派生元', equivalent_to: '同等', supersedes: '置換', answers: '回答', supports: '支持', contradicts: '反証', causes: '原因となる', contributes_to: '寄与する', enables: '可能にする', inhibits: '抑制する', explicit_user: 'ユーザーが明示確認', extracted_from_source: '出典から抽出', model_inferred: 'モデル推論' },
  'zh-CN': { confirmed: '已确认', connected: '已连接', verified: '已核验', reused: '已复用', revised: '已修订', superseded: '已取代', archived: '已归档', restored: '已恢复', related: '相关', prerequisite: '前置条件', generalizes: '概括', derived_from: '派生自', equivalent_to: '等同于', supersedes: '取代', answers: '回答', supports: '支持', contradicts: '反驳', causes: '导致', contributes_to: '促成', enables: '使能够', inhibits: '抑制', explicit_user: '用户明确确认', extracted_from_source: '从来源提取', model_inferred: '模型推断' },
  es: { confirmed: 'Confirmado', connected: 'Conectado', verified: 'Verificado', reused: 'Reutilizado', revised: 'Revisado', superseded: 'Sustituido', archived: 'Archivado', restored: 'Restaurado', related: 'relacionado', prerequisite: 'requisito', generalizes: 'generaliza', derived_from: 'derivado de', equivalent_to: 'equivalente a', supersedes: 'sustituye', answers: 'responde', supports: 'respalda', contradicts: 'contradice', causes: 'causa', contributes_to: 'contribuye a', enables: 'permite', inhibits: 'inhibe', explicit_user: 'confirmado explícitamente', extracted_from_source: 'extraído de la fuente', model_inferred: 'inferido por el modelo' },
  ar: { confirmed: 'مؤكد', connected: 'مرتبط', verified: 'تم التحقق', reused: 'أعيد استخدامه', revised: 'منقح', superseded: 'مستبدل', archived: 'مؤرشف', restored: 'مستعاد', related: 'مرتبط', prerequisite: 'متطلب سابق', generalizes: 'يعمم', derived_from: 'مشتق من', equivalent_to: 'مكافئ لـ', supersedes: 'يستبدل', answers: 'يجيب عن', supports: 'يدعم', contradicts: 'يناقض', causes: 'يسبب', contributes_to: 'يسهم في', enables: 'يمكّن', inhibits: 'يثبط', explicit_user: 'تأكيد صريح من المستخدم', extracted_from_source: 'مستخرج من المصدر', model_inferred: 'استدلال النموذج' },
  hi: { confirmed: 'पुष्ट', connected: 'जुड़ा', verified: 'सत्यापित', reused: 'दोबारा उपयोग', revised: 'संशोधित', superseded: 'प्रतिस्थापित', archived: 'संग्रहीत', restored: 'बहाल', related: 'संबंधित', prerequisite: 'पूर्वापेक्षा', generalizes: 'सामान्यीकृत करता है', derived_from: 'से व्युत्पन्न', equivalent_to: 'के बराबर', supersedes: 'प्रतिस्थापित करता है', answers: 'उत्तर देता है', supports: 'समर्थन करता है', contradicts: 'खंडन करता है', causes: 'कारण बनता है', contributes_to: 'योगदान देता है', enables: 'सक्षम करता है', inhibits: 'रोकता है', explicit_user: 'उपयोगकर्ता द्वारा स्पष्ट पुष्टि', extracted_from_source: 'स्रोत से निकाला गया', model_inferred: 'मॉडल द्वारा अनुमानित' },
};

function tokenLabel(locale: Locale, value: string) {
  return TOKEN_LABELS[locale][value] ?? value.replaceAll('_', ' ');
}

function parameterValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function privateId(value: string) {
  return value.startsWith('personal:') ? value.slice('personal:'.length) : value.replace(/^public:/, '');
}

function relationArrow(type: string) {
  return type === 'related' || type === 'equivalent_to' ? '↔' : '→';
}

function isHttpsUrl(value: string | null) {
  if (!value) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function TopicScreenContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ topic?: string | string[] }>();
  const { direction, formatDate, locale, t } = useI18n();
  const copy = COPY[locale];
  const topic = parameterValue(params.topic);
  const [hub, setHub] = useState<MobileTopicHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    if (!topic) {
      setHub(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextHub = (await mobileApi.topicHub(topic)).hub;
      if (request === loadRequest.current) setHub(nextHub);
    } catch (reason) {
      if (request === loadRequest.current) {
        setError(reason instanceof Error ? reason.message : t('api.networkFailed'));
      }
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [t, topic]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const itemLabels = useMemo(() => new Map(hub?.items.map((item) => [item.id, item.title]) ?? []), [hub]);
  const openQuestions = hub?.items.filter((item) => item.structured_content?.type === 'question' && item.structured_content.status === 'open') ?? [];
  const decisions = hub?.items.filter((item) => item.structured_content?.type === 'decision') ?? [];
  const events = [...(hub?.items.filter((item) => item.structured_content?.type === 'event') ?? [])].sort((left, right) => {
    const leftKey = eventTimelineSortKey(left);
    const rightKey = eventTimelineSortKey(right);
    if (leftKey === null) return rightKey === null ? left.created_at.localeCompare(right.created_at) : 1;
    if (rightKey === null) return -1;
    return leftKey - rightKey;
  });
  const activity = [...(hub?.activity ?? [])].sort((left, right) => +new Date(right.created_at) - +new Date(left.created_at));

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>← {copy.back}</Text></Pressable>

        <View style={styles.hero}>
          <Text style={styles.kicker}>{copy.workspace}</Text>
          <Text style={styles.title}>{hub?.topic ?? topic}</Text>
          <Text style={styles.heroBody}>{copy.heroBody}</Text>
          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statValue}>{hub?.items.length ?? 0}</Text><Text style={styles.statLabel}>{copy.confirmed}</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{openQuestions.length}</Text><Text style={styles.statLabel}>{copy.open}</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{decisions.length}</Text><Text style={styles.statLabel}>{copy.decisions}</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{events.length}</Text><Text style={styles.statLabel}>{copy.events}</Text></View>
          </View>
        </View>

        {loading ? <ActivityIndicator accessibilityLabel={t('common.loading')} color="#2563eb" size="large" /> : null}
        {error ? <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retryButton}><Text style={styles.retryText}>{copy.retry}</Text></Pressable></View> : null}

        {!loading && hub ? (
          <>
            <View style={styles.confirmedNotice}><Text style={styles.confirmedNoticeText}>{copy.confirmedNotice}</Text></View>

            <SectionTitle label={copy.openQuestions} />
            {openQuestions.length === 0 ? <Text style={styles.empty}>{copy.noOpen}</Text> : openQuestions.map((item) => {
              const question = item.structured_content?.type === 'question' ? item.structured_content : null;
              return <View key={item.id} style={[styles.card, styles.questionCard]}><Text style={styles.badge}>{copy.open} · v{item.version}</Text><Text style={styles.cardTitle}>{question?.question ?? item.central_question ?? item.title}</Text>{question?.context ? <Text style={styles.body}>{question.context}</Text> : null}{question && question.next_steps.length > 0 ? <Text style={styles.meta}>{copy.next}: {question.next_steps.join(' · ')}</Text> : null}</View>;
            })}

            <SectionTitle label={copy.knowledge} />
            {hub.items.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.badgeRow}>
                  <Text style={styles.confirmedBadge}>{copy.confirmedByYou}</Text>
                  <Text style={styles.versionBadge}>v{item.version}</Text>
                  {item.knowledge_type ? <Text style={styles.typeBadge}>{knowledgeBundleTypeLabel(locale, item.knowledge_type)}</Text> : null}
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.central_question ? <Text style={styles.centralQuestion}>{item.central_question}</Text> : null}
                {item.summary ? <Text style={styles.body}>{item.summary}</Text> : null}
                {item.structured_content ? <View style={styles.bundle}><MobileKnowledgeBundleView content={item.structured_content} locale={locale} /></View> : item.content ? <Text style={styles.body}>{item.content}</Text> : null}
                <Text style={styles.meta}>{copy.updated} {formatDate(item.updated_at)}{item.last_verified_at ? ` · ${copy.verified} ${formatDate(item.last_verified_at)}` : ''}</Text>
              </View>
            ))}

            <SectionTitle label={copy.relationships} />
            {hub.relations.length === 0 ? <Text style={styles.empty}>{copy.noRelations}</Text> : hub.relations.map((relation) => (
              <View key={relation.id} style={styles.relationship}>
                <Text style={styles.relationshipText}>{itemLabels.get(privateId(relation.source)) ?? privateId(relation.source)} {relationArrow(relation.type)} {tokenLabel(locale, relation.type)} {relationArrow(relation.type)} {itemLabels.get(privateId(relation.target)) ?? privateId(relation.target)}</Text>
                <Text style={styles.origin}>{tokenLabel(locale, relation.relation_origin)}</Text>
                {relation.evidence_span_ids.length > 0 ? <Text style={styles.meta}>{copy.evidence}: {relation.evidence_span_ids.length}</Text> : null}
              </View>
            ))}

            <SectionTitle label={copy.timeline} />
            {events.map((item) => {
              const event = item.structured_content?.type === 'event' ? item.structured_content : null;
              const parseableOccurredAt = event?.occurred_at ? new Date(event.occurred_at) : null;
              const dateLabel = event?.chronology
                ? eventChronologyLabel(event.chronology)
                : parseableOccurredAt && !Number.isNaN(parseableOccurredAt.getTime())
                  ? formatDate(parseableOccurredAt.toISOString())
                  : event?.occurred_at || copy.undated;
              return <View key={`event:${item.id}`} style={[styles.timelineItem, styles.eventItem]}><Text style={styles.badge}>{copy.observedEvent} · {dateLabel}</Text><Text style={styles.cardTitle}>{event?.event ?? item.title}</Text>{event?.context ? <Text style={styles.body}>{event.context}</Text> : null}</View>;
            })}

            <SectionTitle label={copy.recentActivity} />
            {activity.map((entry) => <View key={entry.id} style={styles.timelineItem}><Text style={styles.body}>{tokenLabel(locale, entry.activity_type)} · {itemLabels.get(entry.knowledge_item_id) ?? entry.knowledge_item_id}</Text><Text style={styles.meta}>{formatDate(entry.created_at)}</Text></View>)}

            <SectionTitle label={copy.sources} />
            {hub.sources.length === 0 ? <Text style={styles.empty}>{copy.noSources}</Text> : hub.sources.map((source) => (
              <View key={source.id} style={styles.sourceCard}>
                <Text style={styles.badge}>{source.provider.toUpperCase()} · {tokenLabel(locale, source.relation_origin)}</Text>
                <Text style={styles.cardTitle}>{itemLabels.get(source.knowledge_item_id) ?? source.source_type}</Text>
                {isHttpsUrl(source.source_url) ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(source.source_url!)}><Text style={styles.link}>{copy.openSource} ↗</Text></Pressable> : source.conversation_ref ? <Text style={styles.meta}>{source.conversation_ref}</Text> : null}
                <Text style={styles.meta}>{source.discussed_at ? formatDate(source.discussed_at) : formatDate(source.created_at)}</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <Text accessibilityRole="header" style={styles.sectionTitle}>{label}</Text>;
}

export default function MobileKnowledgeTopicScreen() {
  return <AuthRequired><TopicScreenContent /></AuthRequired>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 18, paddingBottom: 48, gap: 12 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  backText: { color: '#1d4ed8', fontSize: 15, fontWeight: '800' },
  hero: { borderRadius: 22, backgroundColor: '#0f172a', padding: 22, gap: 10 },
  kicker: { color: '#67e8f9', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  title: { color: '#fff', fontSize: 30, lineHeight: 36, fontWeight: '900' },
  heroBody: { color: '#cbd5e1', fontSize: 14, lineHeight: 21 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  stat: { minWidth: 70, flexGrow: 1, borderRadius: 12, backgroundColor: '#1e293b', padding: 10 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  confirmedNotice: { borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 12, backgroundColor: '#ecfdf5', padding: 12 },
  confirmedNoticeText: { color: '#065f46', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  sectionTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', marginTop: 16 },
  card: { borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 16, backgroundColor: '#fff', padding: 16, gap: 8 },
  questionCard: { borderColor: '#c4b5fd', backgroundColor: '#faf5ff' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { color: '#6d28d9', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  confirmedBadge: { color: '#047857', backgroundColor: '#d1fae5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontSize: 10, fontWeight: '900' },
  versionBadge: { color: '#475569', backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontSize: 10, fontWeight: '900' },
  typeBadge: { color: '#6b21a8', backgroundColor: '#f3e8ff', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontSize: 10, fontWeight: '900' },
  cardTitle: { color: '#0f172a', fontSize: 17, lineHeight: 23, fontWeight: '900' },
  centralQuestion: { color: '#1e3a8a', fontSize: 15, lineHeight: 22, fontWeight: '800' },
  body: { color: '#475569', fontSize: 14, lineHeight: 21 },
  meta: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  bundle: { borderColor: '#dbeafe', borderWidth: 1, borderRadius: 12, backgroundColor: '#eff6ff', padding: 12 },
  empty: { color: '#64748b', borderColor: '#cbd5e1', borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, backgroundColor: '#fff', padding: 14, fontSize: 14 },
  relationship: { borderColor: '#dbeafe', borderWidth: 1, borderRadius: 12, backgroundColor: '#fff', padding: 13, gap: 5 },
  relationshipText: { color: '#1e293b', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  origin: { color: '#2563eb', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  timelineItem: { borderLeftColor: '#94a3b8', borderLeftWidth: 3, backgroundColor: '#fff', padding: 13, gap: 4 },
  eventItem: { borderLeftColor: '#06b6d4', borderRadius: 8 },
  sourceCard: { borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 14, backgroundColor: '#fff', padding: 14, gap: 7 },
  link: { color: '#1d4ed8', fontSize: 14, fontWeight: '900' },
  errorCard: { borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, backgroundColor: '#fef2f2', padding: 14, gap: 10 },
  error: { color: '#b91c1c', fontSize: 14 },
  retryButton: { alignSelf: 'flex-start', borderRadius: 8, backgroundColor: '#b91c1c', paddingHorizontal: 12, paddingVertical: 8 },
  retryText: { color: '#fff', fontWeight: '800' },
});
