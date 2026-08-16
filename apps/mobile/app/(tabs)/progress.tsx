import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AuthRequired } from '@/components/auth-required';
import { mobileApi } from '@/api';
import { useI18n } from '@/i18n';
import { localizeDomain } from '@stem-brain/shared';

type Domain = { domain: string; domain_label?: string; reviewed: number; explainable: number; unclear: number };

export default function ProgressScreen() {
  return <AuthRequired><ProgressContent /></AuthRequired>;
}

function ProgressContent() {
  const router = useRouter();
  const { direction, formatNumber, formatPercent, locale, t } = useI18n();
  const [stats, setStats] = useState({ explainable: 0, unclear: 0 });
  const [domains, setDomains] = useState<Domain[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mobileApi.dashboard();
      setStats(data.stats);
      setDomains(data.domains);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('progress.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void load(); }, [load, locale]));
  const total = stats.explainable + stats.unclear;

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList
        data={domains}
        keyExtractor={(item) => item.domain}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            <Text style={styles.kicker}>{t('progress.kicker')}</Text>
            <Text style={styles.title}>{t('progress.title')}</Text>
            <View style={styles.summary}>
              <Metric label={t('progress.explainable')} value={formatNumber(stats.explainable)} />
              <Metric label={t('progress.unclear')} value={formatNumber(stats.unclear)} />
              <Metric label={t('progress.reviewed')} value={formatNumber(total)} />
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {loading ? <Text style={styles.sub}>{t('common.loading')}</Text> : null}
          </View>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('progress.empty')}</Text>
            <Text style={styles.sub}>{t('progress.emptyCopy')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('progress.practiceNow')} onPress={() => router.push('/(tabs)/practice')} style={styles.primary}>
              <Text style={styles.primaryText}>{t('progress.practiceNow')}</Text>
            </Pressable>
          </View>
        ) : null}
        renderItem={({ item }) => {
          const ratio = item.reviewed ? item.explainable / item.reviewed : 0;
          return (
            <View style={styles.domain}>
              <View style={styles.row}>
                <Text style={styles.domainTitle}>{item.domain_label ?? localizeDomain(locale, item.domain)}</Text>
                <Text style={styles.percent}>{formatPercent(ratio, { maximumFractionDigits: 0 })}</Text>
              </View>
              <Text style={styles.sub}>{t('progress.domainSummary', { reviewed: formatNumber(item.reviewed), explainable: formatNumber(item.explainable), unclear: formatNumber(item.unclear) })}</Text>
              <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} /></View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8fb' }, content: { padding: 20, paddingBottom: 32, gap: 12 },
  kicker: { color: '#47606f', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' }, title: { color: '#111827', fontSize: 32, fontWeight: '800', marginBottom: 14 },
  summary: { flexDirection: 'row', gap: 8, marginBottom: 14 }, metric: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12 }, metricValue: { fontSize: 24, fontWeight: '800', color: '#111827' }, metricLabel: { fontSize: 12, fontWeight: '700', color: '#607080', marginTop: 3 },
  sub: { color: '#607080', fontSize: 14, lineHeight: 21 }, error: { color: '#b91c1c', marginBottom: 8 }, domain: { backgroundColor: '#fff', padding: 16, borderRadius: 12, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, domainTitle: { color: '#111827', fontSize: 16, fontWeight: '800', flex: 1 }, percent: { color: '#2563eb', fontWeight: '800' },
  track: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' }, fill: { height: 8, backgroundColor: '#22c55e', borderRadius: 8 },
  empty: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', gap: 8, marginTop: 10 }, emptyTitle: { color: '#111827', fontWeight: '800', fontSize: 18 },
  primary: { backgroundColor: '#111827', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginTop: 8 }, primaryText: { color: '#fff', fontWeight: '800' },
});
