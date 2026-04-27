import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { CardTile } from '@/components/card-tile';
import { Screen, Section } from '@/components/screen';
import { practiceCards } from '@/data/learning';
import { useProgress } from '@/state/progress-context';

export default function GraphScreen() {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { progressByCard, setCurrentCardId } = useProgress();

  const filteredCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return practiceCards.slice(0, 60);

    return practiceCards
      .filter(
        (card) =>
          card.label.toLowerCase().includes(normalized) ||
          card.domain.toLowerCase().includes(normalized) ||
          card.summary.toLowerCase().includes(normalized),
      )
      .slice(0, 80);
  }, [query]);

  return (
    <Screen>
      <Section>
        <Text style={styles.title}>Knowledge map</Text>
        <Text style={styles.subtitle}>
          Browse the shared AI/CS graph and jump any concept into practice.
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search concepts or domains"
          placeholderTextColor="#657991"
          style={styles.search}
          value={query}
        />
      </Section>

      <Section>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Concepts</Text>
          <Text style={styles.count}>{filteredCards.length}</Text>
        </View>
        {filteredCards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            status={progressByCard[card.id]}
            onPress={() => {
              setCurrentCardId(card.id);
              router.push('/practice');
            }}
          />
        ))}
      </Section>
    </Screen>
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
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#24476f',
    borderRadius: 8,
    backgroundColor: '#0d1a2d',
    paddingHorizontal: 12,
    color: '#f8fafc',
    fontSize: 16,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
  },
  count: {
    color: '#8fb3dc',
    fontSize: 13,
    fontWeight: '800',
  },
});
