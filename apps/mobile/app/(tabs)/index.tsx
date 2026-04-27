import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CardTile } from '@/components/card-tile';
import { Screen, Section } from '@/components/screen';
import { domains, featuredCards, getCardById } from '@/data/learning';
import { useProgress } from '@/state/progress-context';

export default function HomeScreen() {
  const { currentCardId, knownCount, partialCount, totalCount, progressByCard, setCurrentCardId } =
    useProgress();
  const currentCard = getCardById(currentCardId) ?? featuredCards[0];
  const completion = Math.round(((knownCount + partialCount * 0.5) / totalCount) * 100);

  return (
    <Screen>
      <Section>
        <Text style={styles.eyebrow}>Personal STEM Brain</Text>
        <Text style={styles.title}>Train the concepts you can actually explain.</Text>
        <Text style={styles.subtitle}>
          Practice high-value AI, CS, and math cards, track weak spots, and keep short notes while
          you study.
        </Text>
      </Section>

      <View style={styles.statsGrid}>
        <Stat value={`${completion}%`} label="Session score" />
        <Stat value={String(knownCount)} label="Explainable" />
        <Stat value={String(partialCount)} label="Reviewing" />
      </View>

      <Section>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Continue</Text>
          <Link href="/practice" style={styles.link}>
            Practice
          </Link>
        </View>
        <CardTile
          card={currentCard}
          status={progressByCard[currentCard.id]}
          onPress={() => setCurrentCardId(currentCard.id)}
        />
      </Section>

      <Section>
        <Text style={styles.sectionTitle}>Core paths</Text>
        <View style={styles.domainGrid}>
          {domains.slice(0, 8).map((domain) => (
            <View key={domain} style={styles.domainPill}>
              <Text style={styles.domainText}>{domain}</Text>
            </View>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: '#67e8f9',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
  },
  subtitle: {
    color: '#b6c5d8',
    fontSize: 16,
    lineHeight: 23,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1e3a5f',
    borderRadius: 8,
    backgroundColor: '#0d1a2d',
    padding: 12,
  },
  statValue: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: '#8aa0b8',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
  },
  link: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '800',
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  domainPill: {
    borderWidth: 1,
    borderColor: '#24476f',
    borderRadius: 8,
    backgroundColor: '#0d1a2d',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  domainText: {
    color: '#dbeafe',
    fontSize: 13,
    fontWeight: '700',
  },
});
