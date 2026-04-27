import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDomainColor } from '@stem-brain/graph-engine';
import {
  getNodeExplanation,
  getNodeSummary,
  getPracticeNodes,
  getPrerequisiteCount,
  getRelatedNodes,
} from '@/knowledge';

type Rating = 'again' | 'partial' | 'known';

const RATING_META: Record<Rating, { label: string; value: number }> = {
  again: { label: 'Again', value: 0 },
  partial: { label: 'Partial', value: 0.5 },
  known: { label: 'Known', value: 1 },
};

export default function PracticeScreen() {
  const router = useRouter();
  const practiceNodes = useMemo(() => getPracticeNodes(), []);
  const [cardIndex, setCardIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const currentNode = practiceNodes[cardIndex % Math.max(practiceNodes.length, 1)];
  const relatedNodes = useMemo(() => (currentNode ? getRelatedNodes(currentNode.id, 3) : []), [currentNode]);
  const knownCount = Object.values(ratings).filter((rating) => rating === 'known').length;
  const progressRatio = practiceNodes.length > 0 ? (Object.keys(ratings).length / practiceNodes.length) * 100 : 0;

  if (practiceNodes.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No practice cards</Text>
          <Text style={styles.emptyText}>Add card content to the graph package to start reviewing.</Text>
        </View>
      </SafeAreaView>
    );
  }

  function rateCurrent(rating: Rating) {
    setRatings((current) => ({ ...current, [currentNode.id]: rating }));
    setIsRevealed(false);
    setCardIndex((index) => (index + 1) % practiceNodes.length);
  }

  function skipCurrent() {
    setIsRevealed(false);
    setCardIndex((index) => (index + 1) % practiceNodes.length);
  }

  function openCurrentTopic() {
    router.push({ pathname: '/topic/[id]', params: { id: currentNode.id } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Practice</Text>
        <Text style={styles.title}>Daily review</Text>

        <View style={styles.progressPanel}>
          <View>
            <Text style={styles.progressValue}>{Object.keys(ratings).length}</Text>
            <Text style={styles.progressLabel}>reviewed</Text>
          </View>
          <View>
            <Text style={styles.progressValue}>{knownCount}</Text>
            <Text style={styles.progressLabel}>known</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(progressRatio, 100)}%` }]} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.domainLine}>
              <View style={[styles.domainDot, { backgroundColor: getDomainColor(currentNode.domain) }]} />
              <Text style={styles.domainText}>{currentNode.domain}</Text>
            </View>
            <Text style={styles.difficultyText}>D{currentNode.difficulty}</Text>
          </View>

          <Text style={styles.cardTitle}>{currentNode.label}</Text>
          <Text style={styles.cardSummary}>{getNodeSummary(currentNode.id)}</Text>

          {isRevealed ? (
            <View style={styles.answerPanel}>
              <Text style={styles.answerTitle}>Explanation</Text>
              <Text style={styles.answerText}>{getNodeExplanation(currentNode.id)}</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reveal answer"
              onPress={() => setIsRevealed(true)}
              style={({ pressed }) => [styles.revealButton, pressed && styles.pressed]}
            >
              <Text style={styles.revealButtonText}>Reveal answer</Text>
            </Pressable>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.metaChip}>{currentNode.type}</Text>
            <Text style={styles.metaChip}>level {currentNode.level}</Text>
            <Text style={styles.metaChip}>{getPrerequisiteCount(currentNode.id)} prereqs</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${currentNode.label} details`}
            onPress={openCurrentTopic}
            style={({ pressed }) => [styles.topicButton, pressed && styles.pressed]}
          >
            <Text style={styles.topicButtonText}>Open topic</Text>
          </Pressable>
        </View>

        <View style={styles.ratingRow}>
          {Object.entries(RATING_META).map(([rating, meta]) => (
            <Pressable
              key={rating}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${meta.label}`}
              onPress={() => rateCurrent(rating as Rating)}
              style={({ pressed }) => [
                styles.ratingButton,
                rating === 'known' && styles.ratingButtonPrimary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.ratingText, rating === 'known' && styles.ratingTextPrimary]}>
                {meta.label}
              </Text>
              <Text style={[styles.ratingValue, rating === 'known' && styles.ratingTextPrimary]}>
                {meta.value}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip this card"
          onPress={skipCurrent}
          style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        {relatedNodes.length > 0 ? (
          <View style={styles.relatedPanel}>
            <Text style={styles.relatedTitle}>Connected topics</Text>
            {relatedNodes.map((node) => (
              <View key={node.id} style={styles.relatedRow}>
                <View style={[styles.relatedDot, { backgroundColor: getDomainColor(node.domain) }]} />
                <Text style={styles.relatedText} numberOfLines={1}>
                  {node.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
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
  progressPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e7ec',
    backgroundColor: '#ffffff',
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  progressValue: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
  },
  progressLabel: {
    color: '#607080',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#e9edf3',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 8,
    backgroundColor: '#111827',
  },
  card: {
    borderRadius: 8,
    backgroundColor: '#18212f',
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  domainLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  domainDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  domainText: {
    color: '#d7dee8',
    fontSize: 13,
    fontWeight: '700',
  },
  difficultyText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 12,
  },
  cardSummary: {
    color: '#d7dee8',
    fontSize: 16,
    lineHeight: 24,
  },
  revealButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  revealButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  answerPanel: {
    borderRadius: 8,
    backgroundColor: '#253244',
    padding: 14,
    marginTop: 22,
  },
  answerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  answerText: {
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
  topicButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  topicButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  ratingButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d8dee8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingButtonPrimary: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  ratingText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  ratingValue: {
    color: '#607080',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  ratingTextPrimary: {
    color: '#ffffff',
  },
  skipButton: {
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  skipText: {
    color: '#607080',
    fontSize: 15,
    fontWeight: '800',
  },
  relatedPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e7ec',
    backgroundColor: '#ffffff',
    padding: 14,
    marginTop: 14,
  },
  relatedTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  relatedRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  relatedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  relatedText: {
    flex: 1,
    color: '#445463',
    fontSize: 14,
    fontWeight: '700',
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
  emptyText: {
    color: '#607080',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
