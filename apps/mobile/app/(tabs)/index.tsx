import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
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

export default function HomeScreen() {
  const router = useRouter();
  const [selectedDomain, setSelectedDomain] = useState<DomainOption>('All');
  const [selectedNode, setSelectedNode] = useState<GraphNode>(() => {
    return GRAPH_NODES.find((node) => node.id === FEATURED_NODE_IDS[0]) ?? GRAPH_NODES[0];
  });

  const domains = useMemo(() => getDomainOptions(), []);
  const featuredNodes = useMemo(() => getFeaturedNodes(), []);
  const levelCount = useMemo(() => getLevelCount(), []);
  const visibleNodes = useMemo(() => filterNodes({ domain: selectedDomain, limit: 36 }), [selectedDomain]);
  const selectedContent = getNodeSummary(selectedNode.id);
  const prerequisiteCount = useMemo(() => getPrerequisiteCount(selectedNode.id), [selectedNode.id]);

  function openSelectedTopic() {
    router.push({ pathname: '/topic/[id]', params: { id: selectedNode.id } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={visibleNodes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.kicker}>stem-brain</Text>
                <Text style={styles.title}>Knowledge map</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statValue}>{GRAPH_NODES.length}</Text>
                <Text style={styles.statLabel}>nodes</Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryPanel}>
                <Text style={styles.summaryValue}>{ROOT_DOMAINS.length}</Text>
                <Text style={styles.summaryLabel}>root tracks</Text>
              </View>
              <View style={styles.summaryPanel}>
                <Text style={styles.summaryValue}>{GRAPH_EDGES.length}</Text>
                <Text style={styles.summaryLabel}>relations</Text>
              </View>
              <View style={styles.summaryPanel}>
                <Text style={styles.summaryValue}>{levelCount}</Text>
                <Text style={styles.summaryLabel}>levels</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Continue</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}
            >
              {featuredNodes.map((node) => (
                <Pressable
                  key={node.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${node.label}`}
                  onPress={() => setSelectedNode(node)}
                  style={({ pressed }) => [
                    styles.featuredCard,
                    selectedNode.id === node.id && styles.featuredCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.domainDot, { backgroundColor: getDomainColor(node.domain) }]} />
                  <Text style={styles.featuredTitle} numberOfLines={2}>
                    {node.label}
                  </Text>
                  <Text style={styles.featuredMeta}>Difficulty {node.difficulty}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.detailPanel}>
              <View style={styles.detailHeader}>
                <View style={[styles.domainDot, { backgroundColor: getDomainColor(selectedNode.domain) }]} />
                <Text style={styles.detailDomain}>{selectedNode.domain}</Text>
              </View>
              <Text style={styles.detailTitle}>{selectedNode.label}</Text>
              <Text style={styles.detailText}>{selectedContent}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaChip}>{selectedNode.type}</Text>
                <Text style={styles.metaChip}>level {selectedNode.level}</Text>
                <Text style={styles.metaChip}>{prerequisiteCount} prereqs</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${selectedNode.label} details`}
                onPress={openSelectedTopic}
                style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
              >
                <Text style={styles.detailButtonText}>Open topic</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Browse</Text>
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
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Select ${item.label}`}
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
                {item.label}
              </Text>
              <Text style={styles.nodeMeta} numberOfLines={1}>
                {item.domain} / difficulty {item.difficulty}
              </Text>
            </View>
            <Text style={styles.nodeLevel}>L{item.level}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
