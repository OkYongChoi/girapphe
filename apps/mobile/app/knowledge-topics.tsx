import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AuthRequired } from '@/components/auth-required';
import { mobileApi, type MobileTopicSummary } from '@/api';
import { useI18n } from '@/i18n';

export default function KnowledgeTopicsScreen() {
  return <AuthRequired><TopicsContent /></AuthRequired>;
}

function TopicsContent() {
  const router = useRouter();
  const { direction, formatDate, formatNumber, t } = useI18n();
  const [topics, setTopics] = useState<MobileTopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoading(true);
    setError(null);
    try {
      const nextTopics = (await mobileApi.topics()).topics;
      if (request === loadRequest.current) setTopics(nextTopics);
    } catch (reason) {
      if (request === loadRequest.current) {
        setError(reason instanceof Error ? reason.message : t('topics.loadError'));
      }
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { loadRequest.current += 1; };
  }, [load]));

  const totals = useMemo(() => topics.reduce((current, topic) => ({
    items: current.items + topic.item_count,
    open: current.open + topic.open_question_count,
  }), { items: 0, open: 0 }), [topics]);

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList
        data={topics}
        keyExtractor={(topic) => topic.topic}
        contentContainerStyle={styles.content}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>← {t('common.back')}</Text>
            </Pressable>
            <Text style={styles.kicker}>{t('topics.kicker')}</Text>
            <Text accessibilityRole="header" style={styles.title}>{t('topics.title')}</Text>
            <Text style={styles.copy}>{t('topics.copy')}</Text>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{formatNumber(topics.length)}</Text>
                <Text style={styles.statLabel}>{t('topics.title')}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{formatNumber(totals.items)}</Text>
                <Text style={styles.statLabel}>{t('topics.confirmed')}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{formatNumber(totals.open)}</Text>
                <Text style={styles.statLabel}>{t('topics.open')}</Text>
              </View>
            </View>
            {loading ? <ActivityIndicator accessibilityLabel={t('common.loading')} color="#2563eb" size="large" /> : null}
            {error ? (
              <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorCard}>
                <Text style={styles.error}>{error}</Text>
                <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retryButton}>
                  <Text style={styles.retryText}>{t('topics.retry')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={!loading && !error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('topics.empty')}</Text>
            <Text style={styles.emptyCopy}>{t('topics.emptyCopy')}</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={[
              t('topics.openA11y', { topic: item.topic }),
              [formatNumber(item.item_count), t('topics.confirmed')].join(' '),
              [formatNumber(item.open_question_count), t('topics.open')].join(' '),
              [formatNumber(item.decision_count), t('topics.decisions')].join(' '),
              [formatNumber(item.event_count), t('topics.events')].join(' '),
              [formatNumber(item.source_count), t('topics.sources')].join(' '),
              ...item.sample_titles,
              t('topics.updated', { date: formatDate(item.last_updated_at) }),
            ].join('. ')}
            onPress={() => router.push({ pathname: '/knowledge-topic/[topic]', params: { topic: item.topic } })}
            style={({ pressed }) => [styles.topicCard, pressed && styles.pressed]}
          >
            <View style={styles.topicHeader}>
              <Text style={styles.topicTitle}>{item.topic}</Text>
              <Text style={styles.arrow}>→</Text>
            </View>
            <View style={styles.chips}>
              <Text style={styles.chip}>{formatNumber(item.item_count)} {t('topics.confirmed')}</Text>
              {item.open_question_count > 0 ? <Text style={[styles.chip, styles.openChip]}>{formatNumber(item.open_question_count)} {t('topics.open')}</Text> : null}
              {item.decision_count > 0 ? <Text style={[styles.chip, styles.decisionChip]}>{formatNumber(item.decision_count)} {t('topics.decisions')}</Text> : null}
              {item.event_count > 0 ? <Text style={[styles.chip, styles.eventChip]}>{formatNumber(item.event_count)} {t('topics.events')}</Text> : null}
              {item.source_count > 0 ? <Text style={[styles.chip, styles.sourceChip]}>{formatNumber(item.source_count)} {t('topics.sources')}</Text> : null}
            </View>
            {item.sample_titles.length > 0 ? (
              <View style={styles.samples}>
                {item.sample_titles.map((title, index) => <Text key={`${item.topic}:${index}`} numberOfLines={1} style={styles.sample}>• {title}</Text>)}
              </View>
            ) : null}
            <Text style={styles.updated}>{t('topics.updated', { date: formatDate(item.last_updated_at) })}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8fb' },
  content: { padding: 18, paddingBottom: 48, gap: 12 },
  header: { gap: 10 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  backText: { color: '#1d4ed8', fontSize: 15, fontWeight: '800' },
  kicker: { color: '#1d4ed8', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.3 },
  title: { color: '#0f172a', fontSize: 32, lineHeight: 38, fontWeight: '900' },
  copy: { color: '#475569', fontSize: 15, lineHeight: 22 },
  stats: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  stat: { flex: 1, minWidth: 0, borderRadius: 12, backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, padding: 12 },
  statValue: { color: '#0f172a', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', marginTop: 2 },
  errorCard: { borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, backgroundColor: '#fef2f2', padding: 14, gap: 10 },
  error: { color: '#b91c1c', fontSize: 14 },
  retryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', borderRadius: 8, backgroundColor: '#b91c1c', paddingHorizontal: 14 },
  retryText: { color: '#fff', fontWeight: '800' },
  emptyCard: { borderColor: '#cbd5e1', borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, backgroundColor: '#fff', padding: 24, gap: 6 },
  emptyTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { color: '#64748b', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  topicCard: { minHeight: 44, borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 16, backgroundColor: '#fff', padding: 16, gap: 12 },
  pressed: { opacity: 0.72 },
  topicHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  topicTitle: { flex: 1, color: '#0f172a', fontSize: 20, lineHeight: 26, fontWeight: '900' },
  arrow: { color: '#2563eb', fontSize: 22, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#f1f5f9', color: '#334155', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '800' },
  openChip: { backgroundColor: '#ede9fe', color: '#6d28d9' },
  decisionChip: { backgroundColor: '#fef3c7', color: '#92400e' },
  eventChip: { backgroundColor: '#cffafe', color: '#155e75' },
  sourceChip: { backgroundColor: '#d1fae5', color: '#065f46' },
  samples: { gap: 3 },
  sample: { color: '#475569', fontSize: 13, lineHeight: 19 },
  updated: { borderTopColor: '#f1f5f9', borderTopWidth: 1, color: '#64748b', fontSize: 12, paddingTop: 10 },
});
