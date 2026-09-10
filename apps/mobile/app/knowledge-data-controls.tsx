import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { mobileApi, type MobileKnowledgeImportJob } from '@/api';
import { AuthRequired } from '@/components/auth-required';
import { useI18n } from '@/i18n';
import { buildKnowledgeDataControlsHandoffUrl } from '@/knowledge-data-controls';

const dataControlsUrl = buildKnowledgeDataControlsHandoffUrl(
  process.env.EXPO_PUBLIC_APP_BASE_URL?.trim() || 'https://www.girapphe.com',
);

export default function KnowledgeDataControlsScreen() {
  return (
    <AuthRequired continuation={{ destination: 'knowledge-data-controls' }}>
      <KnowledgeDataControlsContent />
    </AuthRequired>
  );
}

function KnowledgeDataControlsContent() {
  const { direction, formatDate, formatNumber, t } = useI18n();
  const [jobs, setJobs] = useState<MobileKnowledgeImportJob[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const pageIntent = useRef(1);
  const deletingIdRef = useRef<string | null>(null);

  const loadPage = useCallback(async (targetPage: number) => {
    const request = ++requestSequence.current;
    setLoading(true);
    setListError(null);
    try {
      const result = await mobileApi.knowledgeDataControls(targetPage);
      if (request !== requestSequence.current) return;
      setJobs(result.jobs);
      setPage(result.page);
      pageIntent.current = result.page;
      setHasNextPage(result.hasNextPage);
    } catch (reason) {
      if (request === requestSequence.current) {
        setListError(reason instanceof Error ? reason.message : t('dataControls.loadError'));
      }
    } finally {
      if (request === requestSequence.current) setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    pageIntent.current = 1;
    void loadPage(1);
    return () => {
      requestSequence.current += 1;
    };
  }, [loadPage]));

  function navigateToPage(targetPage: number) {
    if (deletingIdRef.current) return;
    pageIntent.current = targetPage;
    void loadPage(targetPage);
  }

  async function openExport() {
    setExportError(null);
    if (!dataControlsUrl) {
      setExportError(t('dataControls.exportError'));
      return;
    }
    try {
      await Linking.openURL(dataControlsUrl);
    } catch {
      setExportError(t('dataControls.exportError'));
    }
  }

  async function deleteImportJob(job: MobileKnowledgeImportJob) {
    if (deletingIdRef.current || loading) return;
    deletingIdRef.current = job.id;
    setDeletingId(job.id);
    setMutationError(null);
    setNotice(null);
    try {
      const result = await mobileApi.deleteKnowledgeImportBatch(job.id);
      const preserved = result.deleted ? result.approvedKnowledgePreserved : job.approved_count;
      setNotice(t('dataControls.deleteSuccess', { count: formatNumber(preserved) }));
      const deletionPage = page;
      const nextPage = jobs.length === 1 && deletionPage > 1 ? deletionPage - 1 : deletionPage;
      if (pageIntent.current === deletionPage) {
        pageIntent.current = nextPage;
        await loadPage(nextPage);
      }
    } catch (reason) {
      setMutationError(reason instanceof Error ? reason.message : t('dataControls.loadError'));
    } finally {
      deletingIdRef.current = null;
      setDeletingId(null);
    }
  }

  function confirmDelete(job: MobileKnowledgeImportJob) {
    Alert.alert(
      t('dataControls.deleteTitle'),
      t('dataControls.deleteBody', {
        provider: job.provider,
        pending: formatNumber(job.pending_count),
        approved: formatNumber(job.approved_count),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('dataControls.deleteImport'),
          style: 'destructive',
          onPress: () => void deleteImportJob(job),
        },
      ],
    );
  }

  function scopeLabel(scope: MobileKnowledgeImportJob['scope']) {
    return scope === 'selected_export'
      ? t('dataControls.scopeSelectedExport')
      : t('dataControls.scopeCurrentConversation');
  }

  function statusLabel(status: MobileKnowledgeImportJob['status']) {
    switch (status) {
      case 'pending': return t('dataControls.statusPending');
      case 'partial': return t('dataControls.statusPartial');
      case 'approved': return t('dataControls.statusApproved');
      case 'discarded': return t('dataControls.statusDiscarded');
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList
        data={jobs}
        keyExtractor={(job) => job.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text style={styles.kicker}>{t('dataControls.kicker')}</Text>
            <Text accessibilityRole="header" style={styles.title}>{t('dataControls.title')}</Text>
            <Text style={styles.body}>{t('dataControls.body')}</Text>

            <View style={styles.exportCard}>
              <Text accessibilityRole="header" style={styles.cardTitle}>{t('dataControls.exportTitle')}</Text>
              <Text style={styles.cardBody}>{t('dataControls.exportBody')}</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityState={{ disabled: !dataControlsUrl }}
                disabled={!dataControlsUrl}
                onPress={() => void openExport()}
                style={[styles.exportButton, !dataControlsUrl && styles.disabled]}
              >
                <Text style={styles.exportButtonText}>{t('dataControls.exportAction')} ↗</Text>
              </Pressable>
              {exportError || !dataControlsUrl ? (
                <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>
                  {exportError ?? t('dataControls.exportError')}
                </Text>
              ) : null}
            </View>

            {notice ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
            {mutationError ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{mutationError}</Text> : null}
            {listError ? (
              <View style={styles.errorCard}>
                <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{listError}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: deletingId !== null }}
                  disabled={deletingId !== null}
                  onPress={() => navigateToPage(page)}
                  style={[styles.retryButton, deletingId !== null && styles.disabled]}
                >
                  <Text style={styles.retryText}>{t('dataControls.retry')}</Text>
                </Pressable>
              </View>
            ) : null}

            <Text accessibilityRole="header" style={styles.sectionTitle}>{t('dataControls.importsTitle')}</Text>
            <Text style={styles.body}>{t('dataControls.importsBody')}</Text>
            {loading ? <ActivityIndicator accessibilityLabel={t('common.loading')} color="#2563eb" size="large" /> : null}
          </View>
        )}
        ListEmptyComponent={!loading && !listError ? <Text style={styles.empty}>{t('dataControls.empty')}</Text> : null}
        renderItem={({ item: job }) => (
          <View style={styles.jobCard}>
            <View style={styles.jobHeader}>
              <View style={styles.jobTitleGroup}>
                <Text style={styles.jobProvider}>{job.provider}</Text>
                <Text style={styles.jobScope}>{scopeLabel(job.scope)}</Text>
                <Text style={styles.jobStatus}>{statusLabel(job.status)}</Text>
              </View>
              <Text style={styles.jobDate}>{formatDate(job.created_at)}</Text>
            </View>
            <Text selectable style={styles.jobId}>{job.id}</Text>
            <Text style={styles.jobCounts}>
              {t('dataControls.batchCounts', {
                total: formatNumber(job.draft_count),
                pending: formatNumber(job.pending_count),
                approved: formatNumber(job.approved_count),
              })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('dataControls.deleteImport')}: ${job.provider}, ${statusLabel(job.status)}, ${formatDate(job.created_at)}`}
              accessibilityState={{ busy: deletingId === job.id, disabled: deletingId !== null || loading }}
              disabled={deletingId !== null || loading}
              onPress={() => confirmDelete(job)}
              style={[styles.deleteButton, deletingId !== null && styles.disabled]}
            >
              <Text style={styles.deleteText}>
                {deletingId === job.id ? t('common.loading') : t('dataControls.deleteImport')}
              </Text>
            </Pressable>
          </View>
        )}
        ListFooterComponent={page > 1 || hasNextPage ? (
          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: loading || deletingId !== null || page <= 1 }}
              disabled={loading || deletingId !== null || page <= 1}
              onPress={() => navigateToPage(page - 1)}
              style={[styles.pageButton, (loading || deletingId !== null || page <= 1) && styles.disabled]}
            >
              <Text style={styles.pageButtonText}>{t('dataControls.previous')}</Text>
            </Pressable>
            <Text style={styles.pageLabel}>{t('dataControls.page', { page: formatNumber(page) })}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: loading || deletingId !== null || !hasNextPage }}
              disabled={loading || deletingId !== null || !hasNextPage}
              onPress={() => navigateToPage(page + 1)}
              style={[styles.pageButton, (loading || deletingId !== null || !hasNextPage) && styles.disabled]}
            >
              <Text style={styles.pageButtonText}>{t('dataControls.next')}</Text>
            </Pressable>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 18, paddingBottom: 48, gap: 12 },
  header: { gap: 10 },
  kicker: { color: '#0f766e', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.3 },
  title: { color: '#0f172a', fontSize: 32, lineHeight: 38, fontWeight: '900' },
  body: { color: '#475569', fontSize: 15, lineHeight: 22 },
  exportCard: { gap: 10, borderColor: '#99f6e4', borderWidth: 1, borderRadius: 16, backgroundColor: '#f0fdfa', padding: 16, marginTop: 8 },
  cardTitle: { color: '#134e4a', fontSize: 20, fontWeight: '900' },
  cardBody: { color: '#335c58', fontSize: 14, lineHeight: 21 },
  exportButton: { minHeight: 48, borderRadius: 10, backgroundColor: '#0f766e', justifyContent: 'center', paddingHorizontal: 16 },
  exportButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  notice: { color: '#166534', borderColor: '#86efac', borderWidth: 1, borderRadius: 10, backgroundColor: '#f0fdf4', padding: 12, lineHeight: 20 },
  errorCard: { gap: 8, borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, backgroundColor: '#fef2f2', padding: 12 },
  error: { color: '#991b1b', lineHeight: 20 },
  retryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  retryText: { color: '#b91c1c', fontWeight: '900' },
  sectionTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', marginTop: 14 },
  empty: { color: '#64748b', borderColor: '#cbd5e1', borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 18, textAlign: 'center' },
  jobCard: { gap: 10, borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 14, backgroundColor: '#ffffff', padding: 15 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  jobTitleGroup: { minWidth: 0, flex: 1, gap: 3 },
  jobProvider: { color: '#0f172a', fontSize: 17, fontWeight: '900' },
  jobScope: { color: '#475569', fontSize: 13, fontWeight: '700' },
  jobStatus: { color: '#0f766e', fontSize: 12, fontWeight: '900' },
  jobDate: { color: '#64748b', fontSize: 12 },
  jobId: { color: '#64748b', fontSize: 11, writingDirection: 'ltr', textAlign: 'left' },
  jobCounts: { color: '#334155', fontSize: 14, lineHeight: 20 },
  deleteButton: { minHeight: 44, borderColor: '#fca5a5', borderWidth: 1, borderRadius: 9, justifyContent: 'center', paddingHorizontal: 14 },
  deleteText: { color: '#b91c1c', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 10 },
  pageButton: { minHeight: 44, minWidth: 96, borderColor: '#93c5fd', borderWidth: 1, borderRadius: 9, justifyContent: 'center', paddingHorizontal: 12 },
  pageButtonText: { color: '#1d4ed8', fontWeight: '900', textAlign: 'center' },
  pageLabel: { color: '#475569', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
