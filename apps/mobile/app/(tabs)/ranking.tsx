import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AuthRequired } from '@/components/auth-required';
import { mobileApi, type MobileRankingRow } from '@/api';
import { useI18n } from '@/i18n';

const medals = ['🥇', '🥈', '🥉'];

export default function RankingScreen() {
  return <AuthRequired><RankingContent /></AuthRequired>;
}

function RankingContent() {
  const { direction, formatNumber, formatPercent, locale, t } = useI18n();
  const [rows, setRows] = useState<MobileRankingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoading(true);
    setError(null);
    try {
      const nextRows = (await mobileApi.ranking()).rows;
      if (request === loadRequest.current) setRows(nextRows);
    } catch (reason) {
      if (request === loadRequest.current) {
        setError(reason instanceof Error ? reason.message : t('ranking.loadError'));
      }
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => {
      loadRequest.current += 1;
    };
  }, [load, locale]));
  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.participantId}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View><Text style={styles.kicker}>{t('ranking.kicker')}</Text><Text style={styles.title}>{t('ranking.title')}</Text><Text style={styles.sub}>{t('ranking.copy')}</Text>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{loading ? <Text style={styles.sub}>{t('common.loading')}</Text> : null}</View>}
        ListEmptyComponent={!loading ? <View style={styles.empty}><Text style={styles.emptyTitle}>{t('ranking.empty')}</Text><Text style={styles.sub}>{t('ranking.emptyCopy')}</Text></View> : null}
        renderItem={({ item, index }) => {
          const participantLabel = item.isCurrentUser ? t('ranking.you') : t('ranking.user', { id: item.participantId });
          return (
          <View
            accessible
            accessibilityLabel={t('ranking.rowA11y', {
              rank: formatNumber(item.rank),
              user: participantLabel,
              count: formatNumber(item.explainable),
              score: formatPercent(item.avgScore),
            })}
            style={[styles.row, item.isCurrentUser && styles.currentUserRow]}
          >
            <Text style={styles.rank}>{medals[index] ? `${medals[index]} #${formatNumber(item.rank)}` : `#${formatNumber(item.rank)}`}</Text>
            <View style={styles.user}>
              <Text style={styles.userName}>{participantLabel}</Text>
              <Text style={styles.sub}>{t('ranking.average', { score: formatPercent(item.avgScore) })}</Text>
            </View>
            <Text style={styles.score}>{formatNumber(item.explainable)}</Text>
          </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8fb' }, content: { padding: 20, paddingBottom: 32, gap: 10 }, kicker: { color: '#47606f', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#111827', fontSize: 32, fontWeight: '800' }, sub: { color: '#607080', fontSize: 14, lineHeight: 21, marginTop: 4 }, error: { color: '#b91c1c', marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: 'transparent', padding: 15 },
  currentUserRow: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  rank: { fontSize: 16, width: 62, textAlign: 'center' },
  user: { flex: 1 }, userName: { color: '#111827', fontWeight: '800' }, score: { fontSize: 20, fontWeight: '800', color: '#2563eb' },
  empty: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', gap: 8, marginTop: 10 }, emptyTitle: { color: '#111827', fontWeight: '800', fontSize: 18 },
});
