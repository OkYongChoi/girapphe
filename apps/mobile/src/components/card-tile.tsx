import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PracticeCard } from '@/data/learning';
import type { KnowledgeStatus } from '@/state/progress-context';

const statusLabels: Record<KnowledgeStatus, string> = {
  known: 'Explainable',
  partial: 'Needs review',
  unknown: 'Unclear',
};

export function CardTile({
  card,
  status,
  onPress,
}: {
  card: PracticeCard;
  status?: KnowledgeStatus;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: card.color }]} />
        <Text style={styles.domain} numberOfLines={1}>
          {card.domain}
        </Text>
        <Text style={styles.difficulty}>L{card.difficulty}</Text>
      </View>
      <Text style={styles.title}>{card.label}</Text>
      <Text style={styles.summary} numberOfLines={2}>
        {card.summary}
      </Text>
      {status ? <Text style={styles.status}>{statusLabels[status]}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#1e3a5f',
    borderRadius: 8,
    backgroundColor: '#0d1a2d',
    padding: 14,
  },
  pressed: {
    opacity: 0.82,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  domain: {
    flex: 1,
    color: '#8fb3dc',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  difficulty: {
    color: '#c7d2fe',
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  summary: {
    color: '#b6c5d8',
    fontSize: 14,
    lineHeight: 20,
  },
  status: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#132b47',
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#dbeafe',
    fontSize: 12,
    fontWeight: '700',
  },
});
