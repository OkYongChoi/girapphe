import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen, Section } from '@/components/screen';
import { getCardById, practiceCards } from '@/data/learning';
import { useProgress, type KnowledgeStatus } from '@/state/progress-context';

const actions: Array<{ label: string; status: KnowledgeStatus; style: 'known' | 'partial' | 'unknown' }> = [
  { label: 'I can explain it', status: 'known', style: 'known' },
  { label: 'Needs review', status: 'partial', style: 'partial' },
  { label: 'Still unclear', status: 'unknown', style: 'unknown' },
];

export default function PracticeScreen() {
  const {
    currentCardId,
    currentIndex,
    markCard,
    nextCard,
    notesByCard,
    progressByCard,
    saveNote,
    totalCount,
  } = useProgress();
  const card = getCardById(currentCardId) ?? practiceCards[0];
  const [draft, setDraft] = useState(notesByCard[card.id] ?? '');

  useEffect(() => {
    setDraft(notesByCard[card.id] ?? '');
  }, [card.id, notesByCard]);

  const status = progressByCard[card.id];

  return (
    <Screen>
      <Section>
        <Text style={styles.counter}>
          Card {currentIndex + 1} of {totalCount}
        </Text>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.domainDot, { backgroundColor: card.color }]} />
            <Text style={styles.domain}>{card.domain}</Text>
            <Text style={styles.level}>Level {card.difficulty}</Text>
          </View>
          <Text style={styles.title}>{card.label}</Text>
          <Text style={styles.summary}>{card.summary}</Text>
          <View style={styles.divider} />
          <Text style={styles.explanation}>{card.explanation}</Text>
          {status ? <Text style={styles.status}>Current mark: {status}</Text> : null}
        </View>
      </Section>

      <Section>
        <Text style={styles.sectionTitle}>Mark your recall</Text>
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.status}
              accessibilityRole="button"
              onPress={() => markCard(card.id, action.status)}
              style={({ pressed }) => [
                styles.action,
                styles[action.style],
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.actionText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section>
        <Text style={styles.sectionTitle}>Private note</Text>
        <TextInput
          multiline
          onChangeText={setDraft}
          placeholder="Write the shortest explanation that would help future you."
          placeholderTextColor="#657991"
          style={styles.noteInput}
          value={draft}
        />
        <View style={styles.noteActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => saveNote(card.id, draft)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Save note</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={nextCard}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Skip</Text>
          </Pressable>
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  counter: {
    color: '#8fb3dc',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  card: {
    gap: 14,
    borderWidth: 1,
    borderColor: '#24476f',
    borderRadius: 8,
    backgroundColor: '#0d1a2d',
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  domainDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  domain: {
    flex: 1,
    color: '#9cc7f0',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  level: {
    color: '#c7d2fe',
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  summary: {
    color: '#dbeafe',
    fontSize: 17,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#24476f',
  },
  explanation: {
    color: '#b6c5d8',
    fontSize: 15,
    lineHeight: 23,
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
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
  },
  actions: {
    gap: 10,
  },
  action: {
    minHeight: 52,
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  known: {
    backgroundColor: '#047857',
  },
  partial: {
    backgroundColor: '#2563eb',
  },
  unknown: {
    backgroundColor: '#b45309',
  },
  pressed: {
    opacity: 0.78,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  noteInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#24476f',
    borderRadius: 8,
    backgroundColor: '#0d1a2d',
    padding: 12,
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  noteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2f5c8d',
    borderRadius: 8,
    backgroundColor: '#10233b',
  },
  secondaryButtonText: {
    color: '#dbeafe',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
});
