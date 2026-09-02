import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getDomainColor, type GraphNode } from '@stem-brain/graph-engine';
import {
  type DifficultyOption,
  type DomainOption,
  filterNodes,
  getDomainOptions,
  getNodeSummary,
  getRelatedNodes,
} from '@/knowledge';
import { mobileApi, type CardStatus, type PersonalNoteSummary } from '@/api';
import {
  filterPersonalBrowseConcepts,
  isCurrentPrivateGraphOwner,
  mergeBrowseConcepts,
  mergeBrowseDomains,
  resolveBrowseDomain,
} from '@/browse-concepts';
import { useMobileAuth } from '@/auth';
import { useI18n } from '@/i18n';
import { knowledgeBundleTypeLabel, quickNoteLabel } from '@/knowledge-bundle-ui';
import { normalizeCardNodeId, useLocalizedContent } from '@/localized-content';
import { KNOWLEDGE_BUNDLE_TYPES, localizeDomain, localizeType, type KnowledgeBundleType } from '@stem-brain/shared';
import { MobileKnowledgeBundleView } from '@/components/knowledge-bundle-view';
import { KnowledgeText } from '@/components/knowledge-text';
import { TranslationFallbackNotice } from '@/components/translation-fallback-notice';

const DIFFICULTY_OPTIONS: DifficultyOption[] = ['All', 1, 2, 3, 4, 5];
const PUBLIC_DOMAINS: DomainOption[] = getDomainOptions();
const EMPTY_PERSONAL_NOTES: PersonalNoteSummary[] = [];
const EMPTY_STATUS_BY_NODE_ID = new Map<string, CardStatus | null>();

export default function BrowseScreen() {
  const router = useRouter();
  const { isSignedIn, userId } = useMobileAuth();
  const { direction, formatNumber, locale, plural, t } = useI18n();
  const [query, setQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<DomainOption>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyOption>('All');
  const [selectedKnowledgeType, setSelectedKnowledgeType] = useState<'all' | 'legacy' | KnowledgeBundleType>('all');
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedPublicNode, setSelectedPublicNode] = useState<GraphNode | null>(null);
  const [statusByNodeId, setStatusByNodeId] = useState<Map<string, CardStatus | null>>(new Map());
  const [personalNotes, setPersonalNotes] = useState<PersonalNoteSummary[]>([]);
  const [graphOwnerId, setGraphOwnerId] = useState<string | null>(null);
  const hasCurrentPrivateGraph = isCurrentPrivateGraphOwner(isSignedIn, userId, graphOwnerId);
  const currentPersonalNotes = hasCurrentPrivateGraph ? personalNotes : EMPTY_PERSONAL_NOTES;
  const currentStatusByNodeId = hasCurrentPrivateGraph ? statusByNodeId : EMPTY_STATUS_BY_NODE_ID;

  const domains = useMemo<DomainOption[]>(
    () => mergeBrowseDomains(PUBLIC_DOMAINS, currentPersonalNotes),
    [currentPersonalNotes],
  );
  const candidateNodes = useMemo(
    () =>
      filterNodes({
        domain: selectedDomain,
        difficulty: selectedDifficulty,
        limit: 80,
      }),
    [selectedDifficulty, selectedDomain],
  );
  const selectedPublicNodeId = selectedPublicNode?.id ?? (candidateNodes.some((node) => node.id === selectedConceptId)
    ? selectedConceptId ?? undefined
    : undefined);
  const localized = useLocalizedContent(
    candidateNodes.map((node) => node.id),
    selectedPublicNodeId ?? candidateNodes[0]?.id,
  );
  const publicNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    if (selectedKnowledgeType !== 'all') return [];
    if (!normalizedQuery) return candidateNodes;
    return candidateNodes.filter((node) => {
      const content = localized.get(node.id);
      return [content?.label, content?.title, content?.domain_label, content?.type_label, ...(content?.aliases ?? []), node.label, node.domain, node.type, localizeDomain(locale, node.domain), localizeType(locale, node.type)]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase(locale).includes(normalizedQuery));
    });
  }, [candidateNodes, locale, localized, query, selectedKnowledgeType]);
  const visiblePersonalNotes = useMemo(
    () => filterPersonalBrowseConcepts(currentPersonalNotes, {
      query,
      domain: selectedDomain,
      difficulty: selectedDifficulty,
      locale,
      knowledgeType: selectedKnowledgeType,
    }),
    [currentPersonalNotes, locale, query, selectedDifficulty, selectedDomain, selectedKnowledgeType],
  );
  const concepts = useMemo(
    () => mergeBrowseConcepts(publicNodes, visiblePersonalNotes),
    [publicNodes, visiblePersonalNotes],
  );
  const activeConcept = concepts.find((concept) => concept.id === selectedConceptId)
    ?? (selectedPublicNode
      ? { kind: 'public' as const, id: selectedPublicNode.id, node: selectedPublicNode }
      : null)
    ?? concepts[0]
    ?? null;
  const activeNode = activeConcept?.kind === 'public' ? activeConcept.node : null;
  const activeNote = activeConcept?.kind === 'personal' ? activeConcept.note : null;
  const relatedNodes = useMemo(() => (activeNode ? getRelatedNodes(activeNode.id) : []), [activeNode]);

  function labelFor(node: GraphNode) { return localized.get(node.id)?.label ?? localized.get(node.id)?.title ?? node.label; }
  function domainFor(node: GraphNode) { return localized.get(node.id)?.domain_label ?? localizeDomain(locale, node.domain); }
  function typeFor(node: GraphNode) { return localized.get(node.id)?.type_label ?? localizeType(locale, node.type); }
  function summaryFor(node: GraphNode) { return localized.get(node.id)?.summary ?? getNodeSummary(node.id); }

  function resetConceptSelection() {
    setSelectedConceptId(null);
    setSelectedPublicNode(null);
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setGraphOwnerId(null);
      setStatusByNodeId(new Map());
      setPersonalNotes([]);
      if (!isSignedIn || !userId) {
        setSelectedDomain((current) => resolveBrowseDomain(current, PUBLIC_DOMAINS, []));
        return () => { active = false; };
      }
      const requestUserId = userId;

      void mobileApi.graph().then(({ cards, personalItems }) => {
        if (!active) return;
        setStatusByNodeId(new Map(cards.map((card) => [normalizeCardNodeId(card.id), card.status])));
        setPersonalNotes(personalItems);
        setGraphOwnerId(requestUserId);
        setSelectedDomain((current) => resolveBrowseDomain(current, PUBLIC_DOMAINS, personalItems));
      }).catch(() => {
        if (!active) return;
        setGraphOwnerId(null);
        setStatusByNodeId(new Map());
        setPersonalNotes([]);
        setSelectedDomain((current) => resolveBrowseDomain(current, PUBLIC_DOMAINS, []));
      });

      return () => { active = false; };
    }, [isSignedIn, locale, userId]),
  );

  function openActiveTopic() {
    if (!activeNode) return;
    router.push({ pathname: '/topic/[id]', params: { id: activeNode.id } });
  }

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList
        data={concepts}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={styles.kicker}>{t('browse.title')}</Text>
            <Text style={styles.title}>{t('browse.findTopic')}</Text>
                {isSignedIn && userId && currentPersonalNotes.length > 0 ? <View style={styles.personalPanel}><Text style={styles.personalTitle}>● {plural('browse.privateNotes', currentPersonalNotes.length)}</Text><Text style={styles.personalCopy}>{t('browse.privateCopy')}</Text></View> : null}

            <TextInput
              accessibilityLabel={t('browse.searchA11y')}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={(nextQuery) => {
                resetConceptSelection();
                setQuery(nextQuery);
              }}
              placeholder={t('browse.searchPlaceholder')}
              placeholderTextColor="#8a96a3"
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />

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
                  onPress={() => {
                    resetConceptSelection();
                    setSelectedDomain(domain);
                  }}
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

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(['all', 'legacy', ...KNOWLEDGE_BUNDLE_TYPES] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedKnowledgeType === value }}
                  onPress={() => { resetConceptSelection(); setSelectedKnowledgeType(value); }}
                  style={[styles.smallChip, selectedKnowledgeType === value && styles.filterChipSelected]}
                >
                  <Text style={[styles.filterText, selectedKnowledgeType === value && styles.filterTextSelected]}>
                    {value === 'all' ? t('common.all') : value === 'legacy' ? quickNoteLabel(locale) : knowledgeBundleTypeLabel(locale, value)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {DIFFICULTY_OPTIONS.map((difficulty) => (
                <Pressable
                  key={difficulty}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedDifficulty === difficulty }}
                  onPress={() => {
                    resetConceptSelection();
                    setSelectedDifficulty(difficulty);
                  }}
                  style={({ pressed }) => [
                    styles.smallChip,
                    selectedDifficulty === difficulty && styles.filterChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.filterText, selectedDifficulty === difficulty && styles.filterTextSelected]}
                  >
                    {difficulty === 'All'
                      ? t('browse.anyLevel')
                      : t('home.difficulty', { value: formatNumber(difficulty) })}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {activeConcept ? (
              <View style={styles.previewPanel}>
                <View style={styles.previewHeader}>
                  <View
                    style={[
                      styles.domainDot,
                      { backgroundColor: activeNote ? '#a855f7' : getDomainColor(activeNode?.domain ?? 'misc') },
                    ]}
                  />
                  <Text style={styles.previewDomain}>
                    {activeNote
                      ? activeNote.topic ? localizeDomain(locale, activeNote.topic) : t('notes.title')
                      : activeNode
                        ? domainFor(activeNode)
                        : ''}
                  </Text>
                </View>
                <KnowledgeText
                  value={activeNote?.title ?? (activeNode ? labelFor(activeNode) : '')}
                  direction={direction}
                  numberOfLines={2}
                  style={styles.previewTitle}
                />
                {activeNote?.knowledge_type ? <Text style={styles.bundleBadge}>{knowledgeBundleTypeLabel(locale, activeNote.knowledge_type)}</Text> : null}
                {activeNote?.central_question ? <KnowledgeText value={activeNote.central_question} direction={direction} numberOfLines={3} style={styles.previewQuestion} /> : null}
                <KnowledgeText
                  value={activeNote
                    ? activeNote.summary || activeNote.content || t('browse.privateCopy')
                    : activeNode
                      ? summaryFor(activeNode)
                      : ''}
                  direction={direction}
                  numberOfLines={6}
                  style={styles.previewText}
                />
                {activeNote?.structured_content ? (
                  <View style={styles.previewBundle}>
                    <MobileKnowledgeBundleView content={activeNote.structured_content} locale={locale} />
                  </View>
                ) : null}
                {activeNode ? <TranslationFallbackNotice dark translation={localized.get(activeNode.id)} /> : null}
                {activeNote?.tags.length ? (
                  <View style={styles.relatedRow}>
                    {activeNote.tags.map((tag) => (
                      <View key={tag} style={styles.relatedChip}>
                        <Text style={styles.relatedText} numberOfLines={1}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {activeNode && relatedNodes.length > 0 ? (
                  <View style={styles.relatedRow}>
                    {relatedNodes.map((node) => (
                      <Pressable
                        key={node.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setSelectedConceptId(node.id);
                          setSelectedPublicNode(node);
                        }}
                        style={({ pressed }) => [styles.relatedChip, pressed && styles.pressed]}
                      >
                        <Text style={styles.relatedText} numberOfLines={1}>
                          {labelFor(node)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {activeNode ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('home.openTopicA11y', { topic: labelFor(activeNode) })}
                    onPress={openActiveTopic}
                    style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.openButtonText}>{t('home.openTopic')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>{t('browse.results')}</Text>
              <Text style={styles.resultCount}>{formatNumber(concepts.length)}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('browse.noMatches')}</Text>
            <Text style={styles.emptyText}>{t('browse.noMatchesCopy')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('browse.previewTopic', {
              topic: item.kind === 'personal' ? item.note.title : labelFor(item.node),
            })}
            onPress={() => {
              setSelectedConceptId(item.id);
              setSelectedPublicNode(item.kind === 'public' ? item.node : null);
            }}
            style={({ pressed }) => [
              styles.nodeRow,
              activeConcept?.id === item.id && styles.nodeRowSelected,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.nodeAccent,
                { backgroundColor: item.kind === 'personal' ? '#a855f7' : getDomainColor(item.node.domain) },
              ]}
            />
            <View style={styles.nodeTextBlock}>
              <Text style={styles.nodeTitle} numberOfLines={1}>
                {item.kind === 'personal' ? item.note.title : labelFor(item.node)}
              </Text>
              <Text style={styles.nodeMeta} numberOfLines={1}>
                {item.kind === 'personal'
                  ? `${item.note.topic ? localizeDomain(locale, item.note.topic) : t('notes.title')} / ${t('notes.private')}`
                  : `${domainFor(item.node)} / ${typeFor(item.node)}${currentStatusByNodeId.get(item.node.id) === 'known' ? ` / ${t('browse.explainable')}` : currentStatusByNodeId.get(item.node.id) === 'saved' ? ` / ${t('browse.unclear')}` : ''}`}
              </Text>
            </View>
            <Text style={styles.nodeLevel}>
              {item.kind === 'personal'
                ? t('notes.title')
                : t('home.difficulty', { value: formatNumber(item.node.difficulty) })}
            </Text>
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
    paddingTop: 14,
    paddingBottom: 32,
  },
  kicker: {
    color: '#47606f',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 16,
  },
  searchInput: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee8',
    backgroundColor: '#ffffff',
    color: '#111827',
    fontSize: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  personalPanel: { borderColor: '#d8b4fe', borderWidth: 1, backgroundColor: '#faf5ff', borderRadius: 8, padding: 12, marginBottom: 12 },
  personalTitle: { color: '#581c87', fontWeight: '800' },
  personalCopy: { color: '#6b21a8', fontSize: 13, marginTop: 4 },
  filterRow: {
    gap: 8,
    paddingBottom: 10,
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
  smallChip: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
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
  previewPanel: {
    borderRadius: 8,
    backgroundColor: '#18212f',
    padding: 18,
    marginTop: 4,
    marginBottom: 18,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  domainDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  previewDomain: {
    color: '#d7dee8',
    fontSize: 13,
    fontWeight: '700',
  },
  previewTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  bundleBadge: {
    alignSelf: 'flex-start',
    color: '#ede9fe',
    backgroundColor: '#5b21b6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    marginBottom: 10,
  },
  previewQuestion: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '800',
    marginBottom: 8,
  },
  previewText: {
    color: '#d7dee8',
    fontSize: 15,
    lineHeight: 22,
  },
  previewBundle: {
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    padding: 12,
  },
  relatedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  relatedChip: {
    maxWidth: '100%',
    borderRadius: 8,
    backgroundColor: '#253244',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  relatedText: {
    color: '#edf2f7',
    fontSize: 12,
    fontWeight: '700',
  },
  openButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  openButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  resultCount: {
    color: '#607080',
    fontSize: 14,
    fontWeight: '800',
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
  emptyState: {
    minHeight: 120,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e7ec',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
  },
  emptyText: {
    color: '#607080',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
