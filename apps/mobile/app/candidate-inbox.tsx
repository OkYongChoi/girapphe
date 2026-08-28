import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '@stem-brain/shared';
import { AuthRequired } from '@/components/auth-required';
import { MobileKnowledgeBundleView } from '@/components/knowledge-bundle-view';
import { mobileApi, type MobileCandidateBatch, type MobileCandidateDraft } from '@/api';
import { useI18n } from '@/i18n';
import { knowledgeBundleTypeLabel } from '@/knowledge-bundle-ui';

type InboxCopy = {
  back: string; eyebrow: string; title: string; subtitle: string; boundary: string; batches: string; candidates: string;
  empty: string; openSource: string; save: string; ignore: string; saving: string; duplicate: string; webMerge: string; retry: string;
  candidate: string; batchCount: string; ignoreConfirm: string; saveConfirm: string;
};

const COPY: Record<Locale, InboxCopy> = {
  en: { back: 'Back', eyebrow: 'Private review queue', title: 'Candidate Inbox', subtitle: 'Quickly save or ignore knowledge selected from a current conversation.', boundary: 'Only this explicitly sent batch is shown. Mobile quick review can save as new or ignore; use web review to compare, merge, or update.', batches: 'Pending batches', candidates: 'Candidates', empty: 'No candidates are waiting.', openSource: 'Open selected source', save: 'Save as new', ignore: 'Ignore', saving: 'Saving…', duplicate: 'possible duplicate', webMerge: 'Possible duplicate found. Use the web review for side-by-side merge or update.', retry: 'Try again', candidate: 'Candidate', batchCount: '{count} candidates', ignoreConfirm: 'Ignore “{title}”?', saveConfirm: 'Save “{title}” as a new confirmed item?' },
  ja: { back: '戻る', eyebrow: '非公開レビューキュー', title: '候補受信箱', subtitle: '現在の会話から選んだナレッジを保存または無視します。', boundary: '明示的に送信したこのバッチだけを表示します。モバイルでは新規保存か無視、比較・統合・更新はWebで行います。', batches: '保留中のバッチ', candidates: '候補', empty: '待機中の候補はありません。', openSource: '選択元を開く', save: '新規保存', ignore: '無視', saving: '保存中…', duplicate: '重複候補', webMerge: '重複候補があります。比較・統合・更新はWebレビューを使用してください。', retry: '再試行', candidate: '候補', batchCount: '候補{count}件', ignoreConfirm: '「{title}」を無視しますか？', saveConfirm: '「{title}」を確認済みの新規項目として保存しますか？' },
  'zh-CN': { back: '返回', eyebrow: '私密审核队列', title: '候选收件箱', subtitle: '快速保存或忽略当前对话中选出的知识。', boundary: '仅显示明确发送的当前批次。移动端可新建保存或忽略；比较、合并和更新请使用网页版。', batches: '待处理批次', candidates: '候选', empty: '没有待处理候选。', openSource: '打开所选来源', save: '另存为新项', ignore: '忽略', saving: '保存中…', duplicate: '可能重复', webMerge: '发现可能重复。请在网页版进行并排比较、合并或更新。', retry: '重试', candidate: '候选', batchCount: '{count} 个候选', ignoreConfirm: '忽略“{title}”吗？', saveConfirm: '将“{title}”另存为新的已确认项吗？' },
  es: { back: 'Volver', eyebrow: 'Cola privada', title: 'Bandeja de candidatos', subtitle: 'Guarda o ignora conocimiento elegido en la conversación actual.', boundary: 'Solo se muestra este lote enviado explícitamente. En móvil puedes guardar como nuevo o ignorar; usa la web para comparar, fusionar o actualizar.', batches: 'Lotes pendientes', candidates: 'Candidatos', empty: 'No hay candidatos pendientes.', openSource: 'Abrir fuente elegida', save: 'Guardar como nuevo', ignore: 'Ignorar', saving: 'Guardando…', duplicate: 'posible duplicado', webMerge: 'Hay un posible duplicado. Usa la revisión web para comparar, fusionar o actualizar.', retry: 'Reintentar', candidate: 'Candidato', batchCount: '{count} candidatos', ignoreConfirm: '¿Ignorar «{title}»?', saveConfirm: '¿Guardar «{title}» como un nuevo elemento confirmado?' },
  ar: { back: 'رجوع', eyebrow: 'قائمة مراجعة خاصة', title: 'صندوق المرشحات', subtitle: 'احفظ أو تجاهل المعرفة المختارة من المحادثة الحالية.', boundary: 'تظهر هذه الدفعة المرسلة صراحة فقط. على الهاتف يمكنك الحفظ كعنصر جديد أو التجاهل؛ استخدم الويب للمقارنة أو الدمج أو التحديث.', batches: 'دفعات معلقة', candidates: 'مرشحات', empty: 'لا توجد مرشحات معلقة.', openSource: 'فتح المصدر المختار', save: 'حفظ كجديد', ignore: 'تجاهل', saving: 'جارٍ الحفظ…', duplicate: 'تكرار محتمل', webMerge: 'يوجد تكرار محتمل. استخدم مراجعة الويب للمقارنة أو الدمج أو التحديث.', retry: 'إعادة المحاولة', candidate: 'مرشح', batchCount: '{count} مرشحات', ignoreConfirm: 'هل تريد تجاهل «{title}»؟', saveConfirm: 'هل تريد حفظ «{title}» كعنصر مؤكد جديد؟' },
  hi: { back: 'वापस', eyebrow: 'निजी समीक्षा कतार', title: 'उम्मीदवार इनबॉक्स', subtitle: 'मौजूदा बातचीत से चुने ज्ञान को जल्दी सहेजें या अनदेखा करें।', boundary: 'केवल स्पष्ट रूप से भेजा गया यह बैच दिखता है। मोबाइल पर नया सहेजें या अनदेखा करें; तुलना, मर्ज या अपडेट के लिए वेब समीक्षा उपयोग करें।', batches: 'लंबित बैच', candidates: 'उम्मीदवार', empty: 'कोई उम्मीदवार प्रतीक्षा में नहीं है।', openSource: 'चुना स्रोत खोलें', save: 'नया सहेजें', ignore: 'अनदेखा करें', saving: 'सहेज रहे हैं…', duplicate: 'संभावित डुप्लिकेट', webMerge: 'संभावित डुप्लिकेट मिला। तुलना, मर्ज या अपडेट के लिए वेब समीक्षा उपयोग करें।', retry: 'फिर प्रयास करें', candidate: 'उम्मीदवार', batchCount: '{count} उम्मीदवार', ignoreConfirm: '“{title}” को अनदेखा करें?', saveConfirm: '“{title}” को नए पुष्ट आइटम के रूप में सहेजें?' },
};

function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}

function isHttpsUrl(value: string | null) {
  if (!value) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function CandidateInboxContent() {
  const router = useRouter();
  const { direction, formatDate, locale, t } = useI18n();
  const copy = COPY[locale];
  const [batches, setBatches] = useState<MobileCandidateBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<MobileCandidateBatch | null>(null);
  const [drafts, setDrafts] = useState<MobileCandidateDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBatch = useCallback(async (batch: MobileCandidateBatch) => {
    setSelectedBatch(batch);
    setLoading(true);
    setError(null);
    try {
      const result = await mobileApi.candidateBatch(batch.id);
      setSelectedBatch(result.batch);
      setDrafts(result.drafts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('api.networkFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = (await mobileApi.candidateInbox()).batches;
      setBatches(next);
      if (next.length > 0) await loadBatch(next[0]!);
      else { setSelectedBatch(null); setDrafts([]); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('api.networkFailed'));
      setLoading(false);
    }
  }, [loadBatch, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const resolve = (draft: MobileCandidateDraft, action: 'approve-candidate' | 'ignore-candidate') => {
    const destructive = action === 'ignore-candidate';
    Alert.alert(
      destructive ? copy.ignore : copy.save,
      interpolate(destructive ? copy.ignoreConfirm : copy.saveConfirm, { title: draft.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: destructive ? copy.ignore : copy.save, style: destructive ? 'destructive' : 'default', onPress: () => {
          setMutatingId(draft.id);
          setError(null);
          void mobileApi.mutate({ action, batchId: draft.batch_id, draftId: draft.id, draftVersion: draft.version })
            .then(async () => {
              const refreshed = await mobileApi.candidateInbox();
              setBatches(refreshed.batches);
              const current = refreshed.batches.find((batch) => batch.id === draft.batch_id);
              if (current) await loadBatch(current);
              else { setSelectedBatch(null); setDrafts([]); }
            })
            .catch((reason) => setError(reason instanceof Error ? reason.message : t('api.networkFailed')))
            .finally(() => setMutatingId(null));
        } },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>← {copy.back}</Text></Pressable>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
        <View style={styles.boundary}><Text style={styles.boundaryText}>{copy.boundary}</Text></View>

        {error ? <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.retry}>{copy.retry}</Text></Pressable></View> : null}
        {loading ? <ActivityIndicator accessibilityLabel={t('common.loading')} color="#2563eb" size="large" /> : null}

        <Text accessibilityRole="header" style={styles.sectionTitle}>{copy.batches} · {batches.length}</Text>
        {batches.length === 0 && !loading ? <Text style={styles.empty}>{copy.empty}</Text> : (
          <View style={styles.batchRow}>
            {batches.map((batch) => <Pressable key={batch.id} accessibilityRole="button" accessibilityState={{ selected: selectedBatch?.id === batch.id }} onPress={() => void loadBatch(batch)} style={[styles.batchButton, selectedBatch?.id === batch.id && styles.batchButtonActive]}><Text style={[styles.batchProvider, selectedBatch?.id === batch.id && styles.batchTextActive]}>{batch.provider}</Text><Text style={[styles.batchMeta, selectedBatch?.id === batch.id && styles.batchTextActive]}>{batch.pending_count} · {formatDate(batch.created_at)}</Text></Pressable>)}
          </View>
        )}

        {selectedBatch ? (
          <>
            <View style={styles.sourceScope}>
              <Text style={styles.sourceTitle}>{selectedBatch.provider} · {interpolate(copy.batchCount, { count: selectedBatch.pending_count })}</Text>
              {selectedBatch.conversation_ref ? <Text style={styles.sourceRef}>{selectedBatch.conversation_ref}</Text> : null}
              {isHttpsUrl(selectedBatch.source_url) ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(selectedBatch.source_url!)}><Text style={styles.sourceLink}>{copy.openSource} ↗</Text></Pressable> : null}
            </View>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{copy.candidates}</Text>
            {drafts.map((draft) => (
              <View key={draft.id} style={styles.card}>
                <View style={styles.badgeRow}><Text style={styles.candidateBadge}>{copy.candidate}</Text><Text style={styles.versionBadge}>v{draft.version}</Text>{draft.knowledge_type ? <Text style={styles.typeBadge}>{knowledgeBundleTypeLabel(locale, draft.knowledge_type)}</Text> : null}</View>
                <Text style={styles.cardTitle}>{draft.title}</Text>
                {draft.central_question ? <Text style={styles.centralQuestion}>{draft.central_question}</Text> : null}
                {draft.summary ? <Text style={styles.body}>{draft.summary}</Text> : null}
                {draft.structured_content ? <View style={styles.bundle}><MobileKnowledgeBundleView content={draft.structured_content} locale={locale} /></View> : draft.explanation ? <Text style={styles.body}>{draft.explanation}</Text> : null}
                {draft.duplicate_suggestions.length > 0 ? <View style={styles.duplicateWarning}><Text style={styles.duplicateTitle}>{draft.duplicate_suggestions.length} {copy.duplicate}</Text><Text style={styles.duplicateBody}>{copy.webMerge}</Text>{draft.duplicate_suggestions.slice(0, 3).map((item) => <Text key={item.id} style={styles.duplicateItem}>• {item.title} · {Math.round(item.score * 100)}%</Text>)}</View> : null}
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" disabled={mutatingId === draft.id} onPress={() => resolve(draft, 'approve-candidate')} style={[styles.saveButton, mutatingId === draft.id && styles.disabled]}><Text style={styles.saveText}>{mutatingId === draft.id ? copy.saving : copy.save}</Text></Pressable>
                  <Pressable accessibilityRole="button" disabled={mutatingId === draft.id} onPress={() => resolve(draft, 'ignore-candidate')} style={[styles.ignoreButton, mutatingId === draft.id && styles.disabled]}><Text style={styles.ignoreText}>{copy.ignore}</Text></Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function CandidateInboxScreen() {
  return <AuthRequired><CandidateInboxContent /></AuthRequired>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 18, paddingBottom: 48, gap: 10 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  backText: { color: '#1d4ed8', fontSize: 15, fontWeight: '800' },
  eyebrow: { color: '#b45309', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.3 },
  title: { color: '#0f172a', fontSize: 32, lineHeight: 38, fontWeight: '900' },
  subtitle: { color: '#475569', fontSize: 15, lineHeight: 22 },
  boundary: { borderColor: '#fcd34d', borderWidth: 1, borderRadius: 12, backgroundColor: '#fffbeb', padding: 13, marginTop: 4 },
  boundaryText: { color: '#78350f', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  sectionTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', marginTop: 14 },
  batchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  batchButton: { borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 9 },
  batchButtonActive: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  batchProvider: { color: '#0f172a', fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
  batchMeta: { color: '#64748b', fontSize: 11, marginTop: 2 },
  batchTextActive: { color: '#fff' },
  sourceScope: { borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 14, backgroundColor: '#eff6ff', padding: 14, gap: 5 },
  sourceTitle: { color: '#1e3a8a', fontSize: 14, fontWeight: '900', textTransform: 'capitalize' },
  sourceRef: { color: '#475569', fontSize: 12 },
  sourceLink: { color: '#1d4ed8', fontSize: 13, fontWeight: '900' },
  card: { borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 16, backgroundColor: '#fff', padding: 16, gap: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  candidateBadge: { color: '#92400e', backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontSize: 10, fontWeight: '900' },
  versionBadge: { color: '#475569', backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontSize: 10, fontWeight: '900' },
  typeBadge: { color: '#6b21a8', backgroundColor: '#f3e8ff', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontSize: 10, fontWeight: '900' },
  cardTitle: { color: '#0f172a', fontSize: 18, lineHeight: 24, fontWeight: '900' },
  centralQuestion: { color: '#1e3a8a', fontSize: 15, lineHeight: 22, fontWeight: '800' },
  body: { color: '#475569', fontSize: 14, lineHeight: 21 },
  bundle: { borderColor: '#dbeafe', borderWidth: 1, borderRadius: 12, backgroundColor: '#eff6ff', padding: 12 },
  duplicateWarning: { borderColor: '#fcd34d', borderWidth: 1, borderRadius: 12, backgroundColor: '#fffbeb', padding: 12, gap: 4 },
  duplicateTitle: { color: '#92400e', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  duplicateBody: { color: '#78350f', fontSize: 12, lineHeight: 18 },
  duplicateItem: { color: '#854d0e', fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 3 },
  saveButton: { flex: 1, borderRadius: 10, backgroundColor: '#2563eb', padding: 12 },
  saveText: { color: '#fff', textAlign: 'center', fontWeight: '900' },
  ignoreButton: { borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, backgroundColor: '#fff', padding: 12 },
  ignoreText: { color: '#b91c1c', fontWeight: '900' },
  disabled: { opacity: .5 },
  empty: { color: '#64748b', borderColor: '#cbd5e1', borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, backgroundColor: '#fff', padding: 16 },
  errorCard: { borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, backgroundColor: '#fef2f2', padding: 13, gap: 7 },
  error: { color: '#b91c1c', fontSize: 13 },
  retry: { color: '#1d4ed8', fontWeight: '900' },
});
