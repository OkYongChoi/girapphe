import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
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

const DIFFICULTY_OPTIONS: DifficultyOption[] = ['All', 1, 2, 3, 4, 5];

export default function BrowseScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<DomainOption>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyOption>('All');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const domains = useMemo(() => getDomainOptions(), []);
  const nodes = useMemo(
    () =>
      filterNodes({
        query,
        domain: selectedDomain,
        difficulty: selectedDifficulty,
        limit: 80,
      }),
    [query, selectedDifficulty, selectedDomain],
  );

  const activeNode = selectedNode ?? nodes[0] ?? null;
  const relatedNodes = useMemo(() => (activeNode ? getRelatedNodes(activeNode.id) : []), [activeNode]);

  function openActiveTopic() {
    if (!activeNode) return;
    router.push({ pathname: '/topic/[id]', params: { id: activeNode.id } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={nodes}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={styles.kicker}>Browse</Text>
            <Text style={styles.title}>Find a topic</Text>

            <TextInput
              accessibilityLabel="Search knowledge topics"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setQuery}
              placeholder="Search concepts, domains, or types"
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
                  onPress={() => setSelectedDomain(domain)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    selectedDomain === domain && styles.filterChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.filterText, selectedDomain === domain && styles.filterTextSelected]}>
                    {domain}
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
                  onPress={() => setSelectedDifficulty(difficulty)}
                  style={({ pressed }) => [
                    styles.smallChip,
                    selectedDifficulty === difficulty && styles.filterChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.filterText, selectedDifficulty === difficulty && styles.filterTextSelected]}
                  >
                    {difficulty === 'All' ? 'Any level' : `D${difficulty}`}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {activeNode ? (
              <View style={styles.previewPanel}>
                <View style={styles.previewHeader}>
                  <View style={[styles.domainDot, { backgroundColor: getDomainColor(activeNode.domain) }]} />
                  <Text style={styles.previewDomain}>{activeNode.domain}</Text>
                </View>
                <Text style={styles.previewTitle}>{activeNode.label}</Text>
                <Text style={styles.previewText}>{getNodeSummary(activeNode.id)}</Text>
                {relatedNodes.length > 0 ? (
                  <View style={styles.relatedRow}>
                    {relatedNodes.map((node) => (
                      <Pressable
                        key={node.id}
                        accessibilityRole="button"
                        onPress={() => setSelectedNode(node)}
                        style={({ pressed }) => [styles.relatedChip, pressed && styles.pressed]}
                      >
                        <Text style={styles.relatedText} numberOfLines={1}>
                          {node.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${activeNode.label} details`}
                  onPress={openActiveTopic}
                  style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
                >
                  <Text style={styles.openButtonText}>Open topic</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Results</Text>
              <Text style={styles.resultCount}>{nodes.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No matching topics</Text>
            <Text style={styles.emptyText}>Try a broader search or remove one filter.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Preview ${item.label}`}
            onPress={() => setSelectedNode(item)}
            style={({ pressed }) => [
              styles.nodeRow,
              activeNode?.id === item.id && styles.nodeRowSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.nodeAccent, { backgroundColor: getDomainColor(item.domain) }]} />
            <View style={styles.nodeTextBlock}>
              <Text style={styles.nodeTitle} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={styles.nodeMeta} numberOfLines={1}>
                {item.domain} / {item.type}
              </Text>
            </View>
            <Text style={styles.nodeLevel}>D{item.difficulty}</Text>
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
  previewText: {
    color: '#d7dee8',
    fontSize: 15,
    lineHeight: 22,
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
