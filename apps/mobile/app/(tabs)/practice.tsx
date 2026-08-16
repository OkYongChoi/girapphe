import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDomainColor } from '@stem-brain/graph-engine';
import { NativeSponsoredCard } from '@/components/native-sponsored-card';
import { TranslationFallbackNotice } from '@/components/translation-fallback-notice';
import { mobileApi, type MobileCard } from '@/api';
import { useMobileAuth } from '@/auth';
import { useI18n } from '@/i18n';
import {
  getNodeExplanation,
  getNodeSummary,
  getPracticeNodes,
  getPrerequisiteCount,
  getRelatedNodes,
} from '@/knowledge';
import { useLocalizedContent } from '@/localized-content';
import { useSubscription } from '@/subscriptions';
import { localizeDomain, localizeLevel, localizeType } from '@stem-brain/shared';

type Rating = 'again' | 'partial' | 'known';

const RATING_VALUES: Record<Rating, number> = { again: 0, partial: 0.5, known: 1 };

export default function PracticeScreen() {
  const auth = useMobileAuth();
  const { direction, t } = useI18n();
  if (!auth.isLoaded) {
    return <SafeAreaView style={[styles.safeArea, { direction }]}><View style={styles.emptyState}><Text style={styles.emptyText}>{t('auth.loading')}</Text></View></SafeAreaView>;
  }
  return auth.isSignedIn ? <SyncedPracticeScreen /> : <LocalPracticeScreen />;
}

function LocalPracticeScreen() {
  const router = useRouter();
  const { direction, formatNumber, locale, t } = useI18n();
  const { isAdFree, isReady: subscriptionReady } = useSubscription();
  const practiceNodes = useMemo(() => getPracticeNodes(), []);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardAdvanceCount, setCardAdvanceCount] = useState(0);
  const cardAdvanceCountRef = useRef(0);
  const [showSponsoredCard, setShowSponsoredCard] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const currentNode = practiceNodes[cardIndex % Math.max(practiceNodes.length, 1)];
  const relatedNodes = useMemo(() => (currentNode ? getRelatedNodes(currentNode.id, 3) : []), [currentNode]);
  const localized = useLocalizedContent(practiceNodes.map((node) => node.id), currentNode?.id);
  const content = currentNode ? localized.get(currentNode.id) : undefined;
  const knownCount = Object.values(ratings).filter((rating) => rating === 'known').length;
  const progressRatio = practiceNodes.length > 0 ? (cardAdvanceCount / practiceNodes.length) * 100 : 0;

  function labelFor(node: (typeof practiceNodes)[number]) {
    return localized.get(node.id)?.label ?? localized.get(node.id)?.title ?? node.label;
  }

  function relatedLabel(node: (typeof relatedNodes)[number]) {
    return content?.related_nodes?.find((item) => item.id === node.id)?.label ?? labelFor(node);
  }

  function ratingLabel(rating: Rating) {
    if (rating === 'again') return t('practice.ratingAgain');
    if (rating === 'partial') return t('practice.ratingPartial');
    return t('practice.ratingKnown');
  }

  useEffect(() => {
    if (isAdFree) setShowSponsoredCard(false);
  }, [isAdFree]);

  if (practiceNodes.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { direction }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('practice.noCards')}</Text>
          <Text style={styles.emptyText}>{t('practice.localEmptyCopy')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  function rateCurrent(rating: Rating) {
    setRatings((current) => ({ ...current, [currentNode.id]: rating }));
    advanceCurrentCard();
  }

  function skipCurrent() {
    advanceCurrentCard();
  }

  function advanceCurrentCard() {
    const nextAdvanceCount = cardAdvanceCountRef.current + 1;
    cardAdvanceCountRef.current = nextAdvanceCount;
    setIsRevealed(false);
    setCardIndex((index) => (index + 1) % practiceNodes.length);
    setCardAdvanceCount(nextAdvanceCount);
    if (subscriptionReady && !isAdFree && nextAdvanceCount % 5 === 0) setShowSponsoredCard(true);
  }

  function openCurrentTopic() {
    router.push({ pathname: '/topic/[id]', params: { id: currentNode.id } });
  }

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{t('practice.title')}</Text>
        <Text style={styles.title}>{t('practice.dailyReview')}</Text>

        <PracticeSubscriptionBanner isAdFree={isAdFree} onPress={() => router.push('/subscription')} />

        <View style={styles.progressPanel}>
          <View>
            <Text style={styles.progressValue}>{formatNumber(cardAdvanceCount)}</Text>
            <Text style={styles.progressLabel}>{t('practice.reviewed')}</Text>
          </View>
          <View>
            <Text style={styles.progressValue}>{formatNumber(knownCount)}</Text>
            <Text style={styles.progressLabel}>{t('practice.known')}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(progressRatio, 100)}%` }]} />
          </View>
        </View>

        {showSponsoredCard && subscriptionReady && !isAdFree ? (
          <NativeSponsoredCard
            onContinue={() => setShowSponsoredCard(false)}
            onUpgrade={() => router.push('/subscription')}
          />
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.domainLine}>
                  <View
                    style={[styles.domainDot, { backgroundColor: getDomainColor(currentNode.domain) }]}
                  />
                  <Text style={styles.domainText}>{content?.domain_label ?? localizeDomain(locale, currentNode.domain)}</Text>
                </View>
                <Text style={styles.difficultyText}>{t('home.difficulty', { value: formatNumber(currentNode.difficulty) })}</Text>
              </View>

              <Text style={styles.cardTitle}>{labelFor(currentNode)}</Text>
              <Text style={styles.cardSummary}>{content?.summary ?? getNodeSummary(currentNode.id)}</Text>
              <TranslationFallbackNotice dark translation={content} />

              {isRevealed ? (
                <View style={styles.answerPanel}>
                  <Text style={styles.answerTitle}>{t('practice.explanation')}</Text>
                  <Text style={styles.answerText}>{content?.explanation ?? getNodeExplanation(currentNode.id)}</Text>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('practice.reveal')}
                  onPress={() => setIsRevealed(true)}
                  style={({ pressed }) => [styles.revealButton, pressed && styles.pressed]}
                >
                  <Text style={styles.revealButtonText}>{t('practice.reveal')}</Text>
                </Pressable>
              )}

              <View style={styles.metaRow}>
                <Text style={styles.metaChip}>{content?.type_label ?? localizeType(locale, currentNode.type)}</Text>
                <Text style={styles.metaChip}>{t('home.level', { value: formatNumber(currentNode.level) })}</Text>
                <Text style={styles.metaChip}>{t('home.prerequisites', { count: formatNumber(getPrerequisiteCount(currentNode.id)) })}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.openTopicA11y', { topic: labelFor(currentNode) })}
                onPress={openCurrentTopic}
                style={({ pressed }) => [styles.topicButton, pressed && styles.pressed]}
              >
                <Text style={styles.topicButtonText}>{t('home.openTopic')}</Text>
              </Pressable>
            </View>

            <View style={styles.ratingRow}>
              {(Object.keys(RATING_VALUES) as Rating[]).map((rating) => (
                <Pressable
                  key={rating}
                  accessibilityRole="button"
                  accessibilityLabel={t('practice.markRating', { rating: ratingLabel(rating) })}
                  onPress={() => rateCurrent(rating)}
                  style={({ pressed }) => [
                    styles.ratingButton,
                    rating === 'known' && styles.ratingButtonPrimary,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.ratingText, rating === 'known' && styles.ratingTextPrimary]}>
                    {ratingLabel(rating)}
                  </Text>
                  <Text style={[styles.ratingValue, rating === 'known' && styles.ratingTextPrimary]}>
                    {formatNumber(RATING_VALUES[rating])}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('practice.skip')}
              onPress={skipCurrent}
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            >
              <Text style={styles.skipText}>{t('practice.skip')}</Text>
            </Pressable>

            {relatedNodes.length > 0 ? (
              <View style={styles.relatedPanel}>
                <Text style={styles.relatedTitle}>{t('practice.connectedTopics')}</Text>
                {relatedNodes.map((node) => (
                  <View key={node.id} style={styles.relatedRow}>
                    <View style={[styles.relatedDot, { backgroundColor: getDomainColor(node.domain) }]} />
                    <Text style={styles.relatedText} numberOfLines={1}>
                      {relatedLabel(node)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SyncedPracticeScreen() {
  const router = useRouter();
  const { direction, formatNumber, locale, t } = useI18n();
  const { isAdFree, isReady: subscriptionReady } = useSubscription();
  const [mode, setMode] = useState<'new' | 'review'>('new');
  const [card, setCard] = useState<MobileCard | null>(null);
  const [stats, setStats] = useState({ explainable: 0, unclear: 0 });
  const [seen, setSeen] = useState<string[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardAdvanceCount, setCardAdvanceCount] = useState(0);
  const [showSponsoredCard, setShowSponsoredCard] = useState(false);

  const load = useCallback(async (nextMode: 'new' | 'review', exclude: string[]) => {
    setLoading(true);
    setError(null);
    setIsRevealed(false);
    try {
      const result = await mobileApi.practice(nextMode, exclude);
      setCard(result.card);
      setStats(result.stats);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('practice.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    setMode('new');
    setSeen([]);
    void load('new', []);
  }, [load]));

  useEffect(() => {
    if (isAdFree) setShowSponsoredCard(false);
  }, [isAdFree]);

  function recordAdvance() {
    setCardAdvanceCount((current) => {
      const next = current + 1;
      if (subscriptionReady && !isAdFree && next % 5 === 0) setShowSponsoredCard(true);
      return next;
    });
  }

  async function rate(status: 'known' | 'saved') {
    if (!card) return;
    try {
      await mobileApi.mutate({ action: 'rate-card', cardId: card.id, status });
      const nextSeen = [...seen, card.id].slice(-100);
      setSeen(nextSeen);
      recordAdvance();
      await load(mode, nextSeen);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('practice.saveError'));
    }
  }

  function skip() {
    if (!card) return;
    const nextSeen = [...seen, card.id].slice(-100);
    setSeen(nextSeen);
    recordAdvance();
    void load(mode, nextSeen);
  }

  function changeMode(nextMode: 'new' | 'review') {
    setMode(nextMode);
    setSeen([]);
    setShowSponsoredCard(false);
    void load(nextMode, []);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{t('practice.title')}</Text>
        <Text style={styles.title}>{t('practice.dailyReview')}</Text>

        <PracticeSubscriptionBanner isAdFree={isAdFree} onPress={() => router.push('/subscription')} />

        <View style={styles.progressPanel}>
          <View><Text style={styles.progressValue}>{formatNumber(stats.explainable)}</Text><Text style={styles.progressLabel}>{t('progress.explainable')}</Text></View>
          <View><Text style={styles.progressValue}>{formatNumber(stats.unclear)}</Text><Text style={styles.progressLabel}>{t('progress.unclear')}</Text></View>
          <View><Text style={styles.progressValue}>{formatNumber(cardAdvanceCount)}</Text><Text style={styles.progressLabel}>{t('practice.reviewed')}</Text></View>
        </View>

        <View style={styles.modeRow}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'new' }} onPress={() => changeMode('new')} style={[styles.modeButton, mode === 'new' && styles.modeButtonActive]}><Text style={styles.modeText}>{t('practice.learnNew')}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'review' }} onPress={() => changeMode('review')} style={[styles.modeButton, mode === 'review' && styles.modeButtonActive]}><Text style={styles.modeText}>{t('practice.review', { count: formatNumber(stats.unclear) })}</Text></Pressable>
        </View>

        {error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : null}
        {loading ? <Text style={styles.emptyText}>{t('common.loading')}</Text> : null}

        {showSponsoredCard && subscriptionReady && !isAdFree ? (
          <NativeSponsoredCard onContinue={() => setShowSponsoredCard(false)} onUpgrade={() => router.push('/subscription')} />
        ) : !loading && card ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.domainText}>{card.domain_label ?? localizeDomain(locale, card.domain)}</Text>
                <Text style={styles.difficultyText}>{localizeLevel(locale, card.level)}</Text>
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardSummary}>{card.summary}</Text>
              <TranslationFallbackNotice dark translation={card} />
              {isRevealed ? (
                <View style={styles.answerPanel}><Text style={styles.answerTitle}>{t('practice.explanation')}</Text><Text style={styles.answerText}>{card.explanation}</Text></View>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={t('practice.reveal')} onPress={() => setIsRevealed(true)} style={styles.revealButton}><Text style={styles.revealButtonText}>{t('practice.reveal')}</Text></Pressable>
              )}
            </View>
            {isRevealed ? (
              <View style={styles.ratingRow}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('practice.stillUnclear')} onPress={() => void rate('saved')} style={styles.ratingButton}><Text style={styles.ratingText}>{t('practice.stillUnclear')}</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t('practice.canExplain')} onPress={() => void rate('known')} style={[styles.ratingButton, styles.ratingButtonPrimary]}><Text style={[styles.ratingText, styles.ratingTextPrimary]}>{t('practice.canExplain')}</Text></Pressable>
              </View>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel={t('practice.skip')} onPress={skip} style={styles.skipButton}><Text style={styles.skipText}>{t('practice.skip')}</Text></Pressable>
          </>
        ) : !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{mode === 'review' ? t('practice.noReview') : t('practice.noNewCards')}</Text>
            <Text style={styles.emptyText}>{t('practice.syncedEmptyCopy')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PracticeSubscriptionBanner({ isAdFree, onPress }: { isAdFree: boolean; onPress: () => void }) {
  const { formatNumber, t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isAdFree ? t('practice.adFreeActiveA11y') : t('practice.openAdFreeA11y')}
      onPress={onPress}
      style={({ pressed }) => [styles.subscriptionBanner, pressed && styles.pressed]}
    >
      <View style={styles.subscriptionTextBlock}>
        <Text style={styles.subscriptionTitle}>{isAdFree ? t('practice.adFreeActive') : t('practice.practiceYourWay')}</Text>
        <Text style={styles.subscriptionText}>
          {isAdFree ? t('practice.sponsoredRemoved') : t('practice.sponsoredCadence', { count: formatNumber(5) })}
        </Text>
      </View>
      <Text style={styles.subscriptionAction}>{isAdFree ? t('practice.manage') : t('practice.goAdFree')}</Text>
    </Pressable>
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
  subscriptionBanner: {
    minHeight: 82,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd3df',
    backgroundColor: '#ffffff',
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subscriptionTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  subscriptionTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  subscriptionText: {
    color: '#607080',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 4,
  },
  subscriptionAction: {
    color: '#1f5fd1',
    fontSize: 13,
    fontWeight: '900',
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
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modeButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee8',
    backgroundColor: '#ffffff',
  },
  modeButtonActive: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  modeText: {
    color: '#111827',
    fontWeight: '800',
  },
  errorText: {
    color: '#b42318',
    fontWeight: '700',
    marginBottom: 12,
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
