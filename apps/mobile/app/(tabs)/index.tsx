import { useEffect, useMemo, useState } from 'react';
import { type Href, useRouter } from 'expo-router';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  GRAPH_EDGES,
  GRAPH_NODES,
  getDomainColor,
  type GraphNode,
} from '@stem-brain/graph-engine';
import {
  FEATURED_NODE_IDS,
  ROOT_DOMAINS,
  type DomainOption,
  filterNodes,
  getDomainOptions,
  getFeaturedNodes,
  getLevelCount,
  getNodeSummary,
  getPrerequisiteCount,
} from '@/knowledge';
import { mobileApi, type PersonalNoteSummary } from '@/api';
import type { MobileCard } from '@/api';
import { useMobileAuth } from '@/auth';
import { LanguageSelector } from '@/components/language-selector';
import { TranslationFallbackNotice } from '@/components/translation-fallback-notice';
import { useI18n } from '@/i18n';
import { normalizeCardNodeId, useLocalizedContent } from '@/localized-content';
import { localizeDomain, localizeType } from '@stem-brain/shared';

export default function HomeScreen() {
  const router = useRouter();
  const auth = useMobileAuth();
  const { isSignedIn, userId } = auth;
  const { direction, formatNumber, locale, t } = useI18n();
  const [selectedDomain, setSelectedDomain] = useState<DomainOption>('All');
  const [selectedNode, setSelectedNode] = useState<GraphNode>(() => {
    return GRAPH_NODES.find((node) => node.id === FEATURED_NODE_IDS[0]) ?? GRAPH_NODES[0];
  });

  const domains = useMemo(() => getDomainOptions(), []);
  const featuredNodes = useMemo(() => getFeaturedNodes(), []);
  const levelCount = useMemo(() => getLevelCount(), []);
  const visibleNodes = useMemo(() => filterNodes({ domain: selectedDomain, limit: 36 }), [selectedDomain]);
  const prerequisiteCount = useMemo(() => getPrerequisiteCount(selectedNode.id), [selectedNode.id]);
  const [personalNotes, setPersonalNotes] = useState<PersonalNoteSummary[]>([]);
  const [cardsByNodeId, setCardsByNodeId] = useState<Map<string, MobileCard>>(new Map());
  const contentIds = useMemo(() => [...new Set([...visibleNodes.map((node) => node.id), ...featuredNodes.map((node) => node.id), selectedNode.id])], [featuredNodes, selectedNode.id, visibleNodes]);
  const localized = useLocalizedContent(contentIds, selectedNode.id);

  function cardFor(node: GraphNode) { return cardsByNodeId.get(node.id); }
  function labelFor(node: GraphNode) { return cardFor(node)?.title ?? localized.get(node.id)?.label ?? localized.get(node.id)?.title ?? node.label; }
  function domainFor(node: GraphNode) { return cardFor(node)?.domain_label ?? localized.get(node.id)?.domain_label ?? localizeDomain(locale, node.domain); }
  function typeFor(node: GraphNode) { return cardFor(node)?.type_label ?? localized.get(node.id)?.type_label ?? localizeType(locale, node.type); }
  function summaryFor(node: GraphNode) { return cardFor(node)?.summary ?? localized.get(node.id)?.summary ?? getNodeSummary(node.id); }

  useEffect(() => {
    let active = true;
    setPersonalNotes([]);
    setCardsByNodeId(new Map());
    if (!isSignedIn || !userId) return () => { active = false; };

    void mobileApi.graph().then(({ cards, personalItems }) => {
      if (!active) return;
      setPersonalNotes(personalItems);
      setCardsByNodeId(new Map(cards.map((card) => [normalizeCardNodeId(card.id), card])));
    }).catch(() => {
      if (!active) return;
      setPersonalNotes([]);
      setCardsByNodeId(new Map());
    });

    return () => { active = false; };
  }, [isSignedIn, locale, userId]);

  function openSelectedTopic() {
    router.push({ pathname: '/topic/[id]', params: { id: selectedNode.id } });
  }

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList
        data={visibleNodes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.kicker}>stem-brain</Text>
                <Text style={styles.title}>{t('home.title')}</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable accessibilityRole="button" onPress={() => isSignedIn ? void auth.signOut() : router.push('/sign-in' as Href)} style={styles.accountButton}>
                  <Text style={styles.accountButtonText}>{isSignedIn ? t('auth.signOut') : t('auth.signIn')}</Text>
                </Pressable>
                <LanguageSelector />
                <View style={styles.statPill}>
                  <Text style={styles.statValue}>{formatNumber(GRAPH_NODES.length)}</Text>
                  <Text style={styles.statLabel}>{t('home.nodes')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryPanel}>
                <Text style={styles.summaryValue}>{formatNumber(ROOT_DOMAINS.length)}</Text>
                <Text style={styles.summaryLabel}>{t('home.rootTracks')}</Text>
              </View>
              <View style={styles.summaryPanel}>
                <Text style={styles.summaryValue}>{formatNumber(GRAPH_EDGES.length)}</Text>
                <Text style={styles.summaryLabel}>{t('home.relations')}</Text>
              </View>
              <View style={styles.summaryPanel}>
                <Text style={styles.summaryValue}>{formatNumber(levelCount)}</Text>
                <Text style={styles.summaryLabel}>{t('home.levels')}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>{t('home.continue')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}
            >
              {featuredNodes.map((node) => (
                <Pressable
                  key={node.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('topic.openA11y', { topic: labelFor(node) })}
                  onPress={() => setSelectedNode(node)}
                  style={({ pressed }) => [
                    styles.featuredCard,
                    selectedNode.id === node.id && styles.featuredCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.domainDot, { backgroundColor: getDomainColor(node.domain) }]} />
                  <Text style={styles.featuredTitle} numberOfLines={2}>
                    {labelFor(node)}
                  </Text>
                  <Text style={styles.featuredMeta}>{t('home.difficulty', { value: formatNumber(node.difficulty) })}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.detailPanel}>
              <View style={styles.detailHeader}>
                <View style={[styles.domainDot, { backgroundColor: getDomainColor(selectedNode.domain) }]} />
                <Text style={styles.detailDomain}>{domainFor(selectedNode)}</Text>
              </View>
              <Text style={styles.detailTitle}>{labelFor(selectedNode)}</Text>
              <Text style={styles.detailText}>{summaryFor(selectedNode)}</Text>
              <TranslationFallbackNotice dark translation={cardFor(selectedNode) ?? localized.get(selectedNode.id)} />
              <View style={styles.metaRow}>
                <Text style={styles.metaChip}>{typeFor(selectedNode)}</Text>
                <Text style={styles.metaChip}>{t('home.level', { value: formatNumber(selectedNode.level) })}</Text>
                <Text style={styles.metaChip}>{t('home.prerequisites', { count: formatNumber(prerequisiteCount) })}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.openTopicA11y', { topic: labelFor(selectedNode) })}
                onPress={openSelectedTopic}
                style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
              >
                <Text style={styles.detailButtonText}>{t('home.openTopic')}</Text>
              </Pressable>
            </View>

            {isSignedIn && userId && personalNotes.length > 0 ? (
              <View style={styles.personalPanel}>
                <View style={styles.personalHeader}>
                  <Text style={styles.personalTitle}>{t('home.myNotesPrivate')}</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/notes' as Href)}>
                    <Text style={styles.personalLink}>{t('common.open')}</Text>
                  </Pressable>
                </View>
                <Text style={styles.personalCopy}>{t('home.privateNotesCopy')}</Text>
                {personalNotes.slice(0, 3).map((note) => <Text key={note.id} style={styles.personalNote} numberOfLines={1}>● {note.title}</Text>)}
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>{t('home.browse')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {domains.map((domain) => (
                <Pressable
                  key={domain}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedDomain === domain }}
                  onPress={() => setSelectedDomain(domain)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    selectedDomain === domain && styles.filterChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.filterText, selectedDomain === domain && styles.filterTextSelected]}>
                    {domain === 'All' ? t('common.all') : localizeDomain(locale, domain)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.selectTopic', { topic: labelFor(item) })}
            onPress={() => setSelectedNode(item)}
            style={({ pressed }) => [
              styles.nodeRow,
              selectedNode.id === item.id && styles.nodeRowSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.nodeAccent, { backgroundColor: getDomainColor(item.domain) }]} />
            <View style={styles.nodeTextBlock}>
              <Text style={styles.nodeTitle} numberOfLines={1}>
                {labelFor(item)}
              </Text>
              <Text style={styles.nodeMeta} numberOfLines={1}>
                {domainFor(item)} / {t('topic.difficulty', { value: formatNumber(item.difficulty) })}
              </Text>
            </View>
            <Text style={styles.nodeLevel}>{t('home.level', { value: formatNumber(item.level) })}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8fb',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 18,
    alignItems: 'flex-start',
    gap: 16,
  },
  kicker: {
    color: '#47606f',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: '#111827',
    fontSize: 34,
    fontWeight: '800',
  },
  statPill: {
    minWidth: 76,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  accountButton: { borderWidth: 1, borderColor: '#d8dee8', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#ffffff' },
  accountButtonText: { color: '#111827', fontSize: 12, fontWeight: '800' },
  statValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  summaryPanel: {
    flex: 1,
    minHeight: 78,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e4e7ec',
  },
  summaryValue: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#607080',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  featuredRow: {
    gap: 10,
    paddingBottom: 18,
  },
  featuredCard: {
    width: 148,
    minHeight: 122,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e7ec',
    padding: 14,
    justifyContent: 'space-between',
  },
  featuredCardSelected: {
    borderColor: '#111827',
  },
  domainDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  featuredTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  featuredMeta: {
    color: '#607080',
    fontSize: 13,
    fontWeight: '600',
  },
  detailPanel: {
    borderRadius: 8,
    backgroundColor: '#18212f',
    padding: 18,
    marginBottom: 24,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  detailDomain: {
    color: '#d7dee8',
    fontSize: 13,
    fontWeight: '700',
  },
  detailTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  detailText: {
    color: '#d7dee8',
    fontSize: 15,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  metaChip: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#253244',
    color: '#edf2f7',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: 'uppercase',
  },
  detailButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  detailButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  personalPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8b4fe',
    backgroundColor: '#faf5ff',
    padding: 14,
    marginBottom: 22,
  },
  personalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  personalTitle: { color: '#581c87', fontSize: 15, fontWeight: '800' },
  personalLink: { color: '#7e22ce', fontSize: 14, fontWeight: '800' },
  personalCopy: { color: '#6b21a8', fontSize: 13, lineHeight: 19, marginTop: 6 },
  personalNote: { color: '#7e22ce', fontSize: 14, marginTop: 8 },
  filterRow: {
    gap: 8,
    paddingBottom: 12,
  },
  filterChip: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  filterChipSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterText: {
    color: '#445463',
    fontSize: 14,
    fontWeight: '700',
  },
  filterTextSelected: {
    color: '#ffffff',
  },
  nodeRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e7ec',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  nodeRowSelected: {
    borderColor: '#111827',
    backgroundColor: '#f0f3f8',
  },
  nodeAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 4,
    marginVertical: 12,
  },
  nodeTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  nodeTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  nodeMeta: {
    color: '#607080',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  nodeLevel: {
    color: '#47606f',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
