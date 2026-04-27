import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CardTile } from '@/components/card-tile';
import { Screen, Section } from '@/components/screen';
import { getCardById, type PracticeCard } from '@/data/learning';
import { useProgress } from '@/state/progress-context';

export default function SavedScreen() {
  const router = useRouter();
  const { notesByCard, progressByCard, setCurrentCardId } = useProgress();
  const noteEntries = Object.entries(notesByCard);
  const knownCards = Object.entries(progressByCard)
    .filter(([, status]) => status === 'known')
    .map(([cardId]) => getCardById(cardId))
    .filter((card): card is PracticeCard => Boolean(card));

  return (
    <Screen>
      <Section>
        <Text style={styles.title}>Saved knowledge</Text>
        <Text style={styles.subtitle}>
          Notes and explainable concepts from this session stay here while the app is open.
        </Text>
      </Section>

      <Section>
        <Text style={styles.sectionTitle}>Notes</Text>
        {noteEntries.length ? (
          noteEntries.map(([cardId, note]) => {
            const card = getCardById(cardId);
            if (!card) return null;

            return (
              <View key={cardId} style={styles.note}>
                <Text style={styles.noteTitle}>{card.label}</Text>
                <Text style={styles.noteBody}>{note}</Text>
              </View>
            );
          })
        ) : (
          <EmptyState text="Save a note from Practice to build your private review list." />
        )}
      </Section>

      <Section>
        <Text style={styles.sectionTitle}>Explainable</Text>
        {knownCards.length ? (
          knownCards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              status="known"
              onPress={() => {
                setCurrentCardId(card.id);
                router.push('/practice');
              }}
            />
          ))
        ) : (
          <EmptyState text="Mark concepts as explainable after you can teach them without looking." />
        )}
      </Section>
    </Screen>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: '#b6c5d8',
    fontSize: 16,
    lineHeight: 23,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
  },
  note: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#24476f',
    borderRadius: 8,
    backgroundColor: '#0d1a2d',
    padding: 14,
  },
  noteTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '900',
  },
  noteBody: {
    color: '#b6c5d8',
    fontSize: 15,
    lineHeight: 22,
  },
  empty: {
    borderWidth: 1,
    borderColor: '#1e3a5f',
    borderRadius: 8,
    backgroundColor: '#0d1a2d',
    padding: 16,
  },
  emptyText: {
    color: '#8fa6bf',
    fontSize: 14,
    lineHeight: 21,
  },
});
