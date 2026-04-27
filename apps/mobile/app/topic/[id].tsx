import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDomainColor, type GraphNode } from '@stem-brain/graph-engine';
import {
  getDependentNodes,
  getNodeById,
  getNodeExplanation,
  getNodeSummary,
  getPrerequisiteNodes,
  getRelatedNodes,
} from '@/knowledge';

export default function TopicDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const node = getNodeById(id);

  if (!node) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Topic' }} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Topic not found</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const prerequisites = getPrerequisiteNodes(node.id);
  const dependents = getDependentNodes(node.id);
  const related = getRelatedNodes(node.id, 6);

  function openTopic(nextNode: GraphNode) {
    router.push({ pathname: '/topic/[id]', params: { id: nextNode.id } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: node.label }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.heroPanel}>
          <View style={styles.domainLine}>
            <View style={[styles.domainDot, { backgroundColor: getDomainColor(node.domain) }]} />
            <Text style={styles.domainText}>{node.domain}</Text>
          </View>
          <Text style={styles.title}>{node.label}</Text>
          <Text style={styles.summary}>{getNodeSummary(node.id)}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaChip}>{node.type}</Text>
            <Text style={styles.metaChip}>level {node.level}</Text>
            <Text style={styles.metaChip}>difficulty {node.difficulty}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explanation</Text>
          <Text style={styles.bodyText}>{getNodeExplanation(node.id)}</Text>
        </View>

        <RelationshipSection title="Prerequisites" nodes={prerequisites} onPress={openTopic} />
        <RelationshipSection title="Builds toward" nodes={dependents} onPress={openTopic} />
        <RelationshipSection title="Related" nodes={related} onPress={openTopic} />
      </ScrollView>
    </SafeAreaView>
  );
}

function RelationshipSection({
  title,
  nodes,
  onPress,
}: {
  title: string;
  nodes: GraphNode[];
  onPress: (node: GraphNode) => void;
}) {
  if (nodes.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {nodes.map((node) => (
        <Pressable
          key={node.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${node.label}`}
          onPress={() => onPress(node)}
          style={({ pressed }) => [styles.topicRow, pressed && styles.pressed]}
        >
          <View style={[styles.topicAccent, { backgroundColor: getDomainColor(node.domain) }]} />
          <View style={styles.topicTextBlock}>
            <Text style={styles.topicTitle} numberOfLines={1}>
              {node.label}
            </Text>
            <Text style={styles.topicMeta} numberOfLines={1}>
              {node.domain} / D{node.difficulty}
            </Text>
          </View>
          <Text style={styles.topicArrow}>Open</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8fb',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    marginBottom: 10,
  },
  backButtonText: {
    color: '#445463',
    fontSize: 15,
    fontWeight: '800',
  },
  heroPanel: {
    borderRadius: 8,
    backgroundColor: '#18212f',
    padding: 20,
    marginBottom: 14,
  },
  domainLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  domainDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  domainText: {
    color: '#d7dee8',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
  },
  summary: {
    color: '#d7dee8',
    fontSize: 16,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
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
  section: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e7ec',
    backgroundColor: '#ffffff',
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  bodyText: {
    color: '#445463',
    fontSize: 15,
    lineHeight: 23,
  },
  topicRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    backgroundColor: '#f7f8fb',
    paddingHorizontal: 12,
    marginTop: 8,
  },
  topicAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 4,
    marginVertical: 12,
  },
  topicTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  topicTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  topicMeta: {
    color: '#607080',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  topicArrow: {
    color: '#445463',
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
