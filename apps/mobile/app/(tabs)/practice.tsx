import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AccessibilityInfo, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDomainColor } from '@stem-brain/graph-engine';
import { NativeSponsoredCard } from '@/components/native-sponsored-card';
import { TranslationFallbackNotice } from '@/components/translation-fallback-notice';
import { isTransientMobileApiError, mobileApi, type MobileCard, type MobilePracticeStats } from '@/api';
import { useMobileAuth } from '@/auth';
import { useI18n } from '@/i18n';
import { expressionHasReverseRecallCue, expressionRecallCue, expressionRecallDirectionLabel, knowledgeBundleRecallPrompt, knowledgeBundleTypeLabel, type ExpressionRecallDirection } from '@/knowledge-bundle-ui';
import { MobileKnowledgeBundleView } from '@/components/knowledge-bundle-view';
import { KnowledgeText } from '@/components/knowledge-text';
import {
  getNodeExplanation,
  getNodeSummary,
  getPracticeNodes,
  getPrerequisiteCount,
  getRelatedNodes,
} from '@/knowledge';
import { useLocalizedContent } from '@/localized-content';
import {
  createPracticeHistoryState,
  createReviewRoundProgress,
  loadPracticeWithRetry,
  prerequisiteKnowledgeState,
  recordCompletedPracticeAction,
  recordReviewRoundAdvance,
  recoverPreviousPracticeCard,
  resolvePracticeFocusMode,
  reviewQueueCount,
  reviewedPracticeCardCount,
  type PracticeMode,
} from '@/practice-parity';
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
  const cardAdvanceCountRef = useRef(0);
  const [showSponsoredCard, setShowSponsoredCard] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const currentNode = practiceNodes[cardIndex % Math.max(practiceNodes.length, 1)];
  const relatedNodes = useMemo(
    () => (currentNode ? getRelatedNodes(currentNode.id, 3, isAdFree) : []),
    [currentNode, isAdFree],
  );
  const localized = useLocalizedContent(practiceNodes.map((node) => node.id), currentNode?.id);
  const content = currentNode ? localized.get(currentNode.id) : undefined;
  const knownCount = Object.values(ratings).filter((rating) => rating === 'known').length;
  const reviewedCount = Object.keys(ratings).length;
  const progressRatio = practiceNodes.length > 0 ? (reviewedCount / practiceNodes.length) * 100 : 0;

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
            <Text style={styles.progressValue}>{formatNumber(reviewedCount)}</Text>
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

              <KnowledgeText value={labelFor(currentNode)} direction={direction} style={styles.cardTitle} />
              <KnowledgeText value={content?.summary ?? getNodeSummary(currentNode.id)} direction={direction} style={styles.cardSummary} />
              <TranslationFallbackNotice dark translation={content} />

              {isRevealed ? (
                <View style={styles.answerPanel}>
                  <Text style={styles.answerTitle}>{t('practice.explanation')}</Text>
                  <KnowledgeText value={content?.explanation ?? getNodeExplanation(currentNode.id)} direction={direction} legacyDollarMath style={styles.answerText} />
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
                <Text style={styles.metaChip}>{t('home.prerequisites', { count: formatNumber(getPrerequisiteCount(currentNode.id, isAdFree)) })}</Text>
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
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const { direction, formatNumber, locale, t } = useI18n();
  const { isAdFree, isReady: subscriptionReady } = useSubscription();
  const [mode, setMode] = useState<PracticeMode>('new');
  const [card, setCard] = useState<MobileCard | null>(null);
  const [stats, setStats] = useState<MobilePracticeStats>({ explainable: 0, unclear: 0, reviewable: 0 });
  const [historyState, setHistoryState] = useState(() => createPracticeHistoryState<MobileCard>());
  const [previousAction, setPreviousAction] = useState<'known' | 'saved' | 'skip' | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSponsoredCard, setShowSponsoredCard] = useState(false);
  const [reviewRoundProgress, setReviewRoundProgress] = useState(createReviewRoundProgress);
  const [expressionDirection, setExpressionDirection] = useState<ExpressionRecallDirection>('forward');
  const routeModeRef = useRef(params.mode);
  const modeRef = useRef<PracticeMode>('new');
  const cursorRef = useRef<string | null>(null);
  const initialReviewPoolRef = useRef(0);
  const sessionGenerationRef = useRef(0);
  const requestSequenceRef = useRef(0);
  const busyRef = useRef(false);
  routeModeRef.current = params.mode;

  const load = useCallback(async (
    nextMode: PracticeMode,
    cursor: string | null,
    sessionGeneration: number,
    cycleOnEmpty = false,
    captureReviewPool = false,
  ): Promise<{ ok: boolean; cycled: boolean }> => {
    if (sessionGeneration !== sessionGenerationRef.current) return { ok: false, cycled: false };
    const requestSequence = ++requestSequenceRef.current;
    const isCurrentRequest = () => (
      sessionGeneration === sessionGenerationRef.current
      && requestSequence === requestSequenceRef.current
    );
    busyRef.current = true;
    setLoading(true);
    setError(null);
    setIsRevealed(false);
    setPreviousAction(null);
    setExpressionDirection('forward');
    try {
      const result = await loadPracticeWithRetry(
        () => mobileApi.practice(nextMode, cursor, cycleOnEmpty),
        undefined,
        isTransientMobileApiError,
      );
      if (!isCurrentRequest()) return { ok: false, cycled: false };
      cursorRef.current = result.nextCursor;
      setCard(result.card);
      setStats(result.stats);
      if (captureReviewPool) {
        initialReviewPoolRef.current = reviewQueueCount(result.stats);
        setReviewRoundProgress(createReviewRoundProgress());
      }
      return { ok: true, cycled: result.cycled };
    } catch (cause) {
      if (isCurrentRequest()) {
        setError(cause instanceof Error ? cause.message : t('practice.loadError'));
      }
      return { ok: false, cycled: false };
    } finally {
      if (isCurrentRequest()) {
        busyRef.current = false;
        setLoading(false);
      }
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    const focusMode = resolvePracticeFocusMode(routeModeRef.current, modeRef.current);
    const sessionGeneration = ++sessionGenerationRef.current;
    modeRef.current = focusMode.mode;
    cursorRef.current = null;
    setMode(focusMode.mode);
    setCard(null);
    setHistoryState((current) => ({ ...current, history: [] }));
    setPreviousAction(null);
    setShowSponsoredCard(false);
    setReviewRoundProgress(createReviewRoundProgress());
    if (focusMode.consumeRouteIntent) router.setParams({ mode: undefined });
    void load(focusMode.mode, null, sessionGeneration, false, true);
    return () => {
      requestSequenceRef.current += 1;
      sessionGenerationRef.current += 1;
      busyRef.current = false;
    };
  }, [load, router]));

  useEffect(() => {
    if (isAdFree) setShowSponsoredCard(false);
  }, [isAdFree]);

  function recordAdvance(completedCard: MobileCard, action: 'known' | 'saved' | 'skip') {
    setHistoryState((current) => {
      const next = recordCompletedPracticeAction(current, completedCard, action);
      if (subscriptionReady && !isAdFree && next.completedCardActions % 5 === 0) {
        setShowSponsoredCard(true);
      }
      return next;
    });
  }

  async function rate(status: 'known' | 'saved') {
    if (!card || busyRef.current) return;
    const completedCard = card;
    const actionMode = modeRef.current;
    const cursor = cursorRef.current;
    const sessionGeneration = sessionGenerationRef.current;
    const replacesRatedAction = previousAction === 'known' || previousAction === 'saved';
    busyRef.current = true;
    setLoading(true);
    setError(null);
    setReviewRoundProgress((current) => ({ ...current, completed: false }));
    try {
      await mobileApi.mutate({ action: 'rate-card', cardId: completedCard.id, status });
      if (sessionGeneration !== sessionGenerationRef.current) return;
      const advanced = await load(actionMode, cursor, sessionGeneration, true);
      if (!advanced.ok || sessionGeneration !== sessionGenerationRef.current) return;
      if (actionMode === 'review') {
        setReviewRoundProgress((current) => recordReviewRoundAdvance(current, {
          pool: initialReviewPoolRef.current,
          action: status,
          replacesRatedAction,
          cycled: advanced.cycled,
        }));
      }
      recordAdvance(completedCard, status);
    } catch (cause) {
      if (sessionGeneration === sessionGenerationRef.current) {
        setError(cause instanceof Error ? cause.message : t('practice.saveError'));
      }
    } finally {
      if (sessionGeneration === sessionGenerationRef.current) {
        busyRef.current = false;
        setLoading(false);
      }
    }
  }

  async function skip() {
    if (!card || busyRef.current) return;
    const completedCard = card;
    const actionMode = modeRef.current;
    const cursor = cursorRef.current;
    const sessionGeneration = sessionGenerationRef.current;
    busyRef.current = true;
    setReviewRoundProgress((current) => ({ ...current, completed: false }));
    try {
      const advanced = await load(actionMode, cursor, sessionGeneration, true);
      if (!advanced.ok || sessionGeneration !== sessionGenerationRef.current) return;
      if (actionMode === 'review') {
        setReviewRoundProgress((current) => recordReviewRoundAdvance(current, {
          pool: initialReviewPoolRef.current,
          action: 'skip',
          replacesRatedAction: false,
          cycled: advanced.cycled,
        }));
      }
      recordAdvance(completedCard, 'skip');
    } finally {
      if (sessionGeneration === sessionGenerationRef.current) {
        busyRef.current = false;
        setLoading(false);
      }
    }
  }

  function showPrevious() {
    if (busyRef.current) return;
    const recovered = recoverPreviousPracticeCard(historyState);
    if (!recovered.entry) return;
    setHistoryState(recovered.state);
    setCard(recovered.entry.card);
    setPreviousAction(recovered.entry.action);
    setError(null);
    setIsRevealed(true);
    setExpressionDirection('forward');
  }

  function changeMode(nextMode: PracticeMode) {
    if (busyRef.current || nextMode === modeRef.current) return;
    const sessionGeneration = ++sessionGenerationRef.current;
    modeRef.current = nextMode;
    cursorRef.current = null;
    setMode(nextMode);
    setCard(null);
    setHistoryState((current) => ({ ...current, history: [] }));
    setPreviousAction(null);
    setShowSponsoredCard(false);
    setReviewRoundProgress(createReviewRoundProgress());
    void load(nextMode, null, sessionGeneration, false, true);
  }

  const expressionContent = card?.structured_content?.type === 'expression' ? card.structured_content : null;
  const expressionCue = expressionContent ? expressionRecallCue(expressionContent, locale, expressionDirection) : '';
  const hasExpressionReverseCue = expressionContent ? expressionHasReverseRecallCue(expressionContent) : false;
  const reviewable = reviewQueueCount(stats);
  const reviewedCount = reviewedPracticeCardCount(historyState);
  const reviewPool = initialReviewPoolRef.current;
  const reviewProgress = Math.min(reviewRoundProgress.reviewed, reviewPool);

  useEffect(() => {
    if (Platform.OS === 'ios' && reviewRoundProgress.completed) {
      AccessibilityInfo.announceForAccessibility(
        t('practice.roundComplete', { count: formatNumber(reviewPool) }),
      );
    }
  }, [formatNumber, reviewPool, reviewRoundProgress.completed, t]);

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{t('practice.title')}</Text>
        <Text style={styles.title}>{t('practice.dailyReview')}</Text>

        <PracticeSubscriptionBanner isAdFree={isAdFree} onPress={() => router.push('/subscription')} />

        <View style={styles.progressPanel}>
          <View><Text style={styles.progressValue}>{formatNumber(stats.explainable)}</Text><Text style={styles.progressLabel}>{t('progress.explainable')}</Text></View>
          <View><Text style={styles.progressValue}>{formatNumber(stats.unclear)}</Text><Text style={styles.progressLabel}>{t('progress.unclear')}</Text></View>
          <View><Text style={styles.progressValue}>{formatNumber(reviewedCount)}</Text><Text style={styles.progressLabel}>{t('practice.recentlyReviewed')}</Text></View>
        </View>

        <View style={styles.modeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'new', disabled: loading }}
            disabled={loading}
            onPress={() => changeMode('new')}
            style={[styles.modeButton, mode === 'new' && styles.modeButtonActive, loading && styles.modeButtonDisabled]}
          >
            <Text style={styles.modeText}>{t('practice.learnNew')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'review', disabled: loading }}
            disabled={loading}
            onPress={() => changeMode('review')}
            style={[styles.modeButton, mode === 'review' && styles.modeButtonActive, loading && styles.modeButtonDisabled]}
          >
            <Text style={styles.modeText}>{t('practice.review', { count: formatNumber(reviewable) })}</Text>
          </Pressable>
        </View>

        {mode === 'review' ? (
          <View style={styles.reviewRoundPanel}>
            <View style={styles.reviewRoundHeader}>
              <Text style={styles.reviewRoundTitle}>{t('practice.reviewingQueue')}</Text>
              <Text accessibilityLiveRegion="polite" style={styles.reviewRoundCount}>
                {t('practice.reviewProgress', {
                  done: formatNumber(reviewProgress),
                  total: formatNumber(reviewPool),
                })}
              </Text>
            </View>
            <View
              accessible
              accessibilityLabel={t('practice.reviewProgress', {
                done: formatNumber(reviewProgress),
                total: formatNumber(reviewPool),
              })}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: Math.max(reviewPool, 1), now: reviewProgress }}
              style={styles.reviewRoundTrack}
            >
              <View style={[styles.reviewRoundFill, { width: reviewPool > 0 ? `${Math.min(100, Math.round((reviewProgress / reviewPool) * 100))}%` : '0%' }]} />
            </View>
            {reviewRoundProgress.completed ? <Text accessibilityLiveRegion="polite" style={styles.reviewRoundComplete}>{t('practice.roundComplete', { count: formatNumber(reviewPool) })}</Text> : null}
          </View>
        ) : null}
        {error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : null}
        {loading ? <Text style={styles.emptyText}>{t('common.loading')}</Text> : null}

        {showSponsoredCard && subscriptionReady && !isAdFree ? (
          <NativeSponsoredCard onContinue={() => setShowSponsoredCard(false)} onUpgrade={() => router.push('/subscription')} />
        ) : !loading && card ? (
          <>
            <View style={styles.navigationRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('practice.previousAria')}
                disabled={historyState.history.length === 0}
                onPress={showPrevious}
                style={({ pressed }) => [
                  styles.navigationButton,
                  historyState.history.length === 0 && styles.navigationButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.navigationText}>{t('practice.previous')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('practice.skip')}
                onPress={skip}
                style={({ pressed }) => [styles.navigationButton, pressed && styles.pressed]}
              >
                <Text style={styles.navigationText}>{t('practice.skip')}</Text>
              </Pressable>
            </View>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.domainText}>{card.domain_label ?? localizeDomain(locale, card.domain)}</Text>
                <Text style={styles.difficultyText}>{localizeLevel(locale, card.level)}</Text>
              </View>
              {card.knowledge_type ? <Text style={styles.bundleBadge}>{knowledgeBundleTypeLabel(locale, card.knowledge_type)}</Text> : null}
              <KnowledgeText value={expressionContent && !isRevealed ? expressionCue : card.title} direction={direction} style={styles.cardTitle} />
              {!expressionContent || isRevealed ? <KnowledgeText value={card.central_question || card.summary} direction={direction} style={styles.cardSummary} /> : null}
              {expressionContent && hasExpressionReverseCue && !isRevealed ? <View style={styles.expressionDirectionRow}>{(['forward', 'reverse'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: expressionDirection === value }} onPress={() => setExpressionDirection(value)} style={[styles.expressionDirectionButton, expressionDirection === value && styles.expressionDirectionButtonActive]}><Text style={[styles.expressionDirectionText, expressionDirection === value && styles.expressionDirectionTextActive]}>{expressionRecallDirectionLabel(locale, value)}</Text></Pressable>)}</View> : null}
              {!isRevealed && card.knowledge_type ? <Text style={styles.recallPrompt}>{knowledgeBundleRecallPrompt(locale, card.knowledge_type)}</Text> : null}
              <TranslationFallbackNotice dark translation={card} />
              {isRevealed ? (
                <View style={styles.answerPanel}>
                  <Text style={styles.answerTitle}>{t('practice.explanation')}</Text>
                  {card.structured_content
                    ? <MobileKnowledgeBundleView content={card.structured_content} locale={locale} />
                    : <KnowledgeText value={card.explanation} direction={direction} legacyDollarMath style={styles.answerText} />}
                </View>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={t('practice.reveal')} onPress={() => setIsRevealed(true)} style={styles.revealButton}><Text style={styles.revealButtonText}>{t('practice.reveal')}</Text></Pressable>
              )}
            </View>
            {card.prerequisites && card.prerequisites.length > 0 ? (
              <View style={styles.prerequisitesPanel}>
                <Text style={styles.prerequisitesTitle}>
                  {t('home.prerequisites', { count: formatNumber(card.prerequisites.length) })}
                </Text>
                {card.prerequisites.map((prerequisite) => {
                  const state = prerequisiteKnowledgeState(prerequisite.status);
                  const stateLabel = state === 'explainable'
                    ? t('practice.canExplain')
                    : state === 'unclear'
                      ? t('practice.stillUnclear')
                      : t('practice.learnNew');
                  return (
                    <View
                      key={prerequisite.id}
                      accessible
                      accessibilityLabel={`${prerequisite.label}: ${stateLabel}`}
                      style={styles.prerequisiteRow}
                    >
                      <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.prerequisiteSymbol}>
                        {state === 'explainable' ? '✓' : state === 'unclear' ? '◐' : '○'}
                      </Text>
                      <KnowledgeText value={prerequisite.label} direction={direction} numberOfLines={2} style={styles.prerequisiteLabel} />
                      <Text style={styles.prerequisiteStatus}>{stateLabel}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {isRevealed ? (
              <View style={styles.ratingRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('practice.stillUnclear')}
                  accessibilityState={{ selected: previousAction === 'saved' }}
                  disabled={loading}
                  onPress={() => void rate('saved')}
                  style={[styles.ratingButton, previousAction === 'saved' && styles.ratingButtonSelected]}
                >
                  <Text style={styles.ratingText}>{t('practice.stillUnclear')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('practice.canExplain')}
                  accessibilityState={{ selected: previousAction === 'known' }}
                  disabled={loading}
                  onPress={() => void rate('known')}
                  style={[styles.ratingButton, styles.ratingButtonPrimary, previousAction === 'known' && styles.ratingButtonPrimarySelected]}
                >
                  <Text style={[styles.ratingText, styles.ratingTextPrimary]}>{t('practice.canExplain')}</Text>
                </Pressable>
              </View>
            ) : null}
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
  modeButtonDisabled: {
    opacity: 0.5,
  },
  modeText: {
    color: '#111827',
    fontWeight: '800',
  },
  reviewRoundPanel: {
    borderColor: '#dbeafe',
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  reviewRoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewRoundTitle: {
    flex: 1,
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '800',
  },
  reviewRoundCount: {
    color: '#607080',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewRoundTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#eef2f7',
    overflow: 'hidden',
  },
  reviewRoundFill: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#3b82f6',
  },
  reviewRoundComplete: {
    color: '#047857',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    padding: 10,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  errorText: {
    color: '#b42318',
    fontWeight: '700',
    marginBottom: 12,
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  navigationButton: {
    minHeight: 44,
    minWidth: 96,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  navigationButtonDisabled: {
    opacity: 0.35,
  },
  navigationText: {
    color: '#607080',
    fontSize: 14,
    fontWeight: '800',
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
  bundleBadge: {
    alignSelf: 'flex-start',
    color: '#ede9fe',
    backgroundColor: '#5b21b6',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    marginBottom: 10,
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
  expressionDirectionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  expressionDirectionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  expressionDirectionButtonActive: {
    borderColor: '#c4b5fd',
    backgroundColor: '#4c1d95',
  },
  expressionDirectionText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  expressionDirectionTextActive: {
    color: '#ffffff',
  },
  recallPrompt: {
    color: '#c4b5fd',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 14,
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
  prerequisitesPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e7ec',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 8,
    marginTop: 10,
  },
  prerequisitesTitle: {
    color: '#607080',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  prerequisiteRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prerequisiteSymbol: {
    color: '#47606f',
    fontSize: 16,
    fontWeight: '800',
  },
  prerequisiteLabel: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  prerequisiteStatus: {
    color: '#607080',
    fontSize: 12,
    fontWeight: '700',
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
  ratingButtonSelected: {
    backgroundColor: '#fef3c7',
    borderColor: '#d97706',
    borderWidth: 2,
  },
  ratingButtonPrimarySelected: {
    borderColor: '#34d399',
    borderWidth: 2,
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
