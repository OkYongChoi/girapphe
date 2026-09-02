import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthRequired } from '@/components/auth-required';
import { mobileApi, type MobileCard } from '@/api';
import { useI18n } from '@/i18n';
import { localizeDomain, localizeType } from '@stem-brain/shared';
import { KnowledgeText } from '@/components/knowledge-text';
import { KnowledgeNotationGroup } from '@/components/knowledge-notation-group';
import { TranslationFallbackNotice } from '@/components/translation-fallback-notice';
import { buildKnowledgeNotationGroupBlocks } from '@/knowledge-bundle-notation';

export default function ReviewScreen() {
  return <AuthRequired><ReviewContent /></AuthRequired>;
}

function ReviewContent() {
  const router = useRouter();
  const { direction, formatNumber, locale, t } = useI18n();
  const [cards, setCards] = useState<MobileCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('all');
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setCards((await mobileApi.saved()).cards); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('review.loadError')); }
    finally { setLoading(false); }
  }, [t]);

  useFocusEffect(useCallback(() => { void load(); }, [load, locale]));

  function remove(card: MobileCard) {
    Alert.alert(t('review.removeTitle'), t('review.removeBody', { title: card.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.remove'), style: 'destructive', onPress: () => void mobileApi.mutate({ action: 'remove-saved', cardId: card.id }).then(load).catch((reason) => setError(reason.message)) },
    ]);
  }

  function reset() {
    Alert.alert(t('review.resetTitle'), t('review.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.reset'), style: 'destructive', onPress: () => void mobileApi.mutate({ action: 'reset-progress' }).then(load).catch((reason) => setError(reason.message)) },
    ]);
  }

  const domains = Array.from(new Set(cards.map((card) => card.domain))).sort((a, b) => a.localeCompare(b, locale));
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visibleCards = cards.filter((card) => (domain === 'all' || card.domain === domain) && (!normalizedQuery || [card.title, card.summary, card.domain, card.domain_label, card.type_label, localizeDomain(locale, card.domain), card.type ? localizeType(locale, card.type) : '', ...(card.aliases ?? [])].filter(Boolean).join(' ').toLocaleLowerCase(locale).includes(normalizedQuery)));

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList
        data={visibleCards}
        keyExtractor={(card) => card.id}
        contentContainerStyle={styles.content}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        ListHeaderComponent={(
          <View>
            <Text style={styles.kicker}>{t('review.kicker')}</Text>
            <Text style={styles.title}>{t('review.title')}</Text>
            <Text style={styles.sub}>{t('review.summary', { visible: formatNumber(visibleCards.length), total: formatNumber(cards.length) })}</Text>
            <TextInput accessibilityLabel={t('review.search')} value={query} onChangeText={setQuery} placeholder={t('review.search')} style={styles.input} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {['all', ...domains].map((value) => (
                <Pressable accessibilityRole="button" accessibilityState={{ selected: domain === value }} key={value} onPress={() => setDomain(value)} style={[styles.filter, domain === value && styles.filterActive]}>
                  <Text>{value === 'all' ? t('review.allDomains') : localizeDomain(locale, value)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" accessibilityLabel={t('review.resetAll')} onPress={reset} style={styles.reset}><Text style={styles.resetText}>{t('review.resetAll')}</Text></Pressable>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {loading ? <Text style={styles.sub}>{t('common.loading')}</Text> : null}
          </View>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('review.empty')}</Text>
            <Text style={styles.sub}>{t('review.emptyCopy')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('review.start')} onPress={() => router.push('/(tabs)/practice')} style={styles.primary}><Text style={styles.primaryText}>{t('review.start')}</Text></Pressable>
          </View>
        ) : null}
        renderItem={({ item }) => {
          const notationBlocks = buildKnowledgeNotationGroupBlocks([
            { source: item.title, tone: 'title', numberOfLines: 2 },
            { source: item.domain_label ?? localizeDomain(locale, item.domain), tone: 'meta' },
            { source: item.summary, tone: 'summary', numberOfLines: 3 },
          ]);
          return (
            <View style={styles.card}>
              <KnowledgeNotationGroup blocks={notationBlocks} direction={direction}>
                <KnowledgeText value={item.title} direction={direction} numberOfLines={2} style={styles.cardTitle} />
                <Text style={styles.sub}>{item.domain_label ?? localizeDomain(locale, item.domain)}</Text>
                <KnowledgeText value={item.summary} direction={direction} numberOfLines={3} style={styles.copy} />
              </KnowledgeNotationGroup>
              <TranslationFallbackNotice translation={item} />
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('common.remove')} ${item.title}`} onPress={() => remove(item)}><Text style={styles.link}>{t('common.remove')}</Text></Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8fb' }, content: { padding: 20, paddingBottom: 32, gap: 12 }, kicker: { color: '#47606f', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#111827', fontSize: 32, fontWeight: '800' }, sub: { color: '#607080', fontSize: 14, lineHeight: 21, marginTop: 4 }, input: { borderColor: '#d8dee8', borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff', marginTop: 12 },
  filters: { gap: 8, paddingTop: 8 }, filter: { backgroundColor: '#fff', borderColor: '#d8dee8', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }, filterActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  reset: { alignSelf: 'flex-start', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10 }, resetText: { color: '#b91c1c', fontWeight: '800' }, error: { color: '#b91c1c', marginTop: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 7 }, cardTitle: { color: '#111827', fontSize: 17, fontWeight: '800' }, copy: { color: '#374151', fontSize: 15, lineHeight: 22 }, link: { color: '#2563eb', fontWeight: '800', marginTop: 4 },
  empty: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', gap: 8, marginTop: 10 }, emptyTitle: { color: '#111827', fontWeight: '800', fontSize: 18 }, primary: { backgroundColor: '#111827', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginTop: 8 }, primaryText: { color: '#fff', fontWeight: '800' },
});
