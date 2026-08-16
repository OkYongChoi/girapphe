import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AuthRequired } from '@/components/auth-required';
import { mobileApi } from '@/api';
import { useI18n } from '@/i18n';

type Row = { rank: number; label: string; explainable: number; avgScore: number };
const medals = ['🥇', '🥈', '🥉'];

export default function RankingScreen() {
  return <AuthRequired><RankingContent /></AuthRequired>;
}

function RankingContent() {
  const { direction, formatNumber, formatPercent, locale, t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setRows((await mobileApi.ranking()).rows); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('ranking.loadError')); }
    finally { setLoading(false); }
  }, [t]);

  useFocusEffect(useCallback(() => { void load(); }, [load, locale]));
  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.rank)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View><Text style={styles.kicker}>{t('ranking.kicker')}</Text><Text style={styles.title}>{t('ranking.title')}</Text><Text style={styles.sub}>{t('ranking.copy')}</Text>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{loading ? <Text style={styles.sub}>{t('common.loading')}</Text> : null}</View>}
        ListEmptyComponent={!loading ? <View style={styles.empty}><Text style={styles.emptyTitle}>{t('ranking.empty')}</Text><Text style={styles.sub}>{t('ranking.emptyCopy')}</Text></View> : null}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Text style={styles.rank}>{medals[index] ?? `#${formatNumber(item.rank)}`}</Text>
            <View style={styles.user}>
              <Text style={styles.userName}>{item.label}</Text>
              <Text style={styles.sub}>{t('ranking.average', { score: formatPercent(item.avgScore) })}</Text>
            </View>
            <Text style={styles.score}>{formatNumber(item.explainable)}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8fb' }, content: { padding: 20, paddingBottom: 32, gap: 10 }, kicker: { color: '#47606f', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#111827', fontSize: 32, fontWeight: '800' }, sub: { color: '#607080', fontSize: 14, lineHeight: 21, marginTop: 4 }, error: { color: '#b91c1c', marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 15 }, rank: { fontSize: 18, width: 34, textAlign: 'center' },
  user: { flex: 1 }, userName: { color: '#111827', fontWeight: '800' }, score: { fontSize: 20, fontWeight: '800', color: '#2563eb' },
  empty: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', gap: 8, marginTop: 10 }, emptyTitle: { color: '#111827', fontWeight: '800', fontSize: 18 },
});
