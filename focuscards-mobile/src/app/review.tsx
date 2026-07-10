import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { createCheckIn, fetchDueCards, updateCard } from '@/lib/syncEngine';
import { calculateNextReview, evaluateSessionAction } from '@/utils/srsEngine';

type Feedback = 'Forgotten' | 'Unfamiliar' | 'Familiar';

export default function ReviewScreen() {
  const { deckId, limit: limitParam } = useLocalSearchParams<{
    deckId: string;
    limit: string;
  }>();
  const limit = parseInt(limitParam ?? '20', 10);
  const { height: screenHeight } = useWindowDimensions();

  const [pendingQueue, setPendingQueue] = useState<any[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [initialTotal, setInitialTotal] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const flipAnim = useSharedValue(0);

  // Track cards already persisted to DB (first action only per card per session)
  const writtenCardIds = useRef<Set<string>>(new Set());
  const hasCheckedIn = useRef(false);

  // ── Fetch cards ────────────────────────────────────────────────────
  const loadCards = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchDueCards(deckId, limit);
      const errMsg = result.error;
      if (errMsg) throw new Error(errMsg);

      const cards = result.data ?? [];
      setPendingQueue(cards);
      setInitialTotal(cards.length);
      setCompletedCount(0);
      writtenCardIds.current = new Set();
      hasCheckedIn.current = false;
    } catch (e: any) {
      setError(e.message ?? 'Unable to load cards for review.');
    }

    setLoading(false);
  }, [deckId, limit]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Reset flip when advancing to next card
  useEffect(() => {
    flipAnim.value = 0;
    setFlipped(false);
  }, [pendingQueue[0]?.id]);

  // Create daily check-in when session completes
  useEffect(() => {
    if (pendingQueue.length === 0 && completedCount > 0 && !hasCheckedIn.current) {
      hasCheckedIn.current = true;
      const today = new Date().toISOString().split('T')[0];
      createCheckIn(today).catch(() => {
        // Silently ignore — streak computation will handle gaps
      });
    }
  }, [pendingQueue.length, completedCount]);

  // ── Flip handlers ──────────────────────────────────────────────────
  function handleFlip() {
    if (processing) return;
    const target = flipped ? 0 : 1;
    setFlipped(!flipped);
    flipAnim.value = withTiming(target, { duration: 350 });
  }

  async function handleFeedback(feedback: Feedback) {
    if (processing) return;
    setProcessing(true);

    const card = pendingQueue[0] as any;
    if (!card) {
      setProcessing(false);
      return;
    }

    // ── DB Write-Back (first action only on this card this session) ──
    if (!writtenCardIds.current.has(card.id)) {
      const { intervalDays, easeFactor, nextReview } = calculateNextReview(
        card.interval_days ?? 0,
        card.ease_factor ?? 2.5,
        feedback,
      );

      const result = await updateCard(card.id, {
        interval_days: intervalDays,
        ease_factor: easeFactor,
        next_review: nextReview,
      });

      if (result.error) {
        Alert.alert(
          'Sync Error',
          'Could not save your progress to the server. Please check your connection.',
        );
      } else {
        writtenCardIds.current.add(card.id);
      }
    }

    // ── Intraday queue update ──────────────────────────────────
    const { requeue } = evaluateSessionAction(feedback);

    setPendingQueue((prev) => {
      if (prev.length === 0) return prev;

      if (requeue) {
        const [head, ...rest] = prev;
        return [...rest, head];
      } else {
        return prev.slice(1);
      }
    });

    if (!requeue) {
      setCompletedCount((prev) => prev + 1);
    }

    setTimeout(() => {
      setFlipped(false);
      flipAnim.value = 0;
      setProcessing(false);
    }, 100);
  }

  function handleFinish() {
    router.back();
  }

  // ── Animated styles ────────────────────────────────────────────────
  const frontAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flipAnim.value, [0, 0.5, 1], [1, 0, 0]),
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flipAnim.value, [0, 1], [0, 180])}deg` },
    ],
    backfaceVisibility: 'hidden' as const,
  }));

  const backAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flipAnim.value, [0, 0.5, 1], [0, 1, 1]),
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flipAnim.value, [0, 1], [180, 360])}deg` },
    ],
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden' as const,
  }));

  // ── Derived values ─────────────────────────────────────────────────
  const currentCard = pendingQueue[0] as any;
  const CARD_HEIGHT = screenHeight * 0.55;

  // ── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <SafeAreaView style={styles.centeredSafeArea}>
          <ActivityIndicator size="large" />
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <SafeAreaView style={styles.centeredSafeArea}>
          <ThemedText style={styles.errorMessage}>{error}</ThemedText>
          <Pressable onPress={loadCards} style={styles.retryButton}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── Empty state (no due cards to begin with) ───────────────────────
  if (initialTotal === 0) {
    return (
      <ThemedView style={styles.centered}>
        <SafeAreaView style={styles.centeredSafeArea}>
          <ThemedText style={styles.emptyTitle}>All caught up!</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            No cards due for review in this deck.
          </ThemedText>
          <Pressable onPress={handleFinish} style={styles.retryButton}>
            <ThemedText style={styles.retryButtonText}>Go Back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── Session complete ───────────────────────────────────────────────
  if (pendingQueue.length === 0 && completedCount > 0) {
    return (
      <ThemedView style={styles.centered}>
        <SafeAreaView style={styles.centeredSafeArea}>
          <ThemedText style={styles.emptyTitle}>Session Complete!</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            You reviewed all {completedCount} card
            {completedCount !== 1 ? 's' : ''}.
          </ThemedText>
          <Pressable onPress={handleFinish} style={styles.retryButton}>
            <ThemedText style={styles.retryButtonText}>Done</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── Card view ──────────────────────────────────────────────────────
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* ── Progress ─────────────────────────────────── */}
        <ThemedText style={styles.progress}>
          Completed: {completedCount} / {initialTotal}{'  ·  '}
          {pendingQueue.length} remaining
        </ThemedText>

        {/* ── Card ─────────────────────────────────────── */}
        <Pressable onPress={handleFlip} style={styles.cardWrapper}>
          <View style={[styles.cardContainer, { minHeight: CARD_HEIGHT }]}>
            <Animated.View
              key={`front-${currentCard?.id ?? 0}`}
              style={[styles.cardFace, frontAnimatedStyle]}
            >
              <ScrollView
                style={styles.cardScroll}
                contentContainerStyle={styles.cardScrollContent}
              >
                <Markdown style={markdownStyles}>
                  {currentCard?.front ?? ''}
                </Markdown>
              </ScrollView>
            </Animated.View>

            <Animated.View
              key={`back-${currentCard?.id ?? 0}`}
              style={[styles.cardFace, backAnimatedStyle]}
            >
              <ScrollView
                style={styles.cardScroll}
                contentContainerStyle={styles.cardScrollContent}
              >
                <Markdown style={markdownStyles}>
                  {currentCard?.back ?? ''}
                </Markdown>
              </ScrollView>
            </Animated.View>
          </View>
        </Pressable>

        {/* ── Tap hint ──────────────────────────────────── */}
        <ThemedText style={styles.tapHint}>
          {flipped ? 'Tap to show front' : 'Tap to reveal answer'}
        </ThemedText>

        {/* ── Action buttons (shown only after flip) ────── */}
        {flipped && (
          <View style={styles.actions}>
            <Pressable
              onPress={() => handleFeedback('Forgotten')}
              style={({ pressed }) => [
                styles.actionButton,
                styles.forgottenButton,
                pressed && styles.actionButtonPressed,
                processing && styles.actionButtonDisabled,
              ]}
              disabled={processing}
            >
              <ThemedText style={styles.actionButtonText}>
                Forgotten
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => handleFeedback('Unfamiliar')}
              style={({ pressed }) => [
                styles.actionButton,
                styles.unfamiliarButton,
                pressed && styles.actionButtonPressed,
                processing && styles.actionButtonDisabled,
              ]}
              disabled={processing}
            >
              <ThemedText style={styles.actionButtonText}>
                Unfamiliar
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => handleFeedback('Familiar')}
              style={({ pressed }) => [
                styles.actionButton,
                styles.familiarButton,
                pressed && styles.actionButtonPressed,
                processing && styles.actionButtonDisabled,
              ]}
              disabled={processing}
            >
              <ThemedText style={styles.actionButtonText}>
                Familiar
              </ThemedText>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

// ── Markdown theme ──────────────────────────────────────────────────
const markdownStyles = {
  body: {
    fontSize: 18,
    lineHeight: 26,
  },
  heading1: { fontSize: 24, fontWeight: '700' as const, marginBottom: 8 },
  heading2: { fontSize: 20, fontWeight: '600' as const, marginBottom: 6 },
  heading3: { fontSize: 18, fontWeight: '600' as const, marginBottom: 4 },
  code_inline: {
    backgroundColor: '#E8E8ED',
    fontFamily: 'monospace' as const,
    fontSize: 16,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: '#E8E8ED',
    fontFamily: 'monospace' as const,
    fontSize: 14,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  fence: {
    backgroundColor: '#E8E8ED',
    fontFamily: 'monospace' as const,
    fontSize: 14,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
};

// ── Colors ──────────────────────────────────────────────────────────
const COLORS = {
  forgotten: '#EF4444',
  unfamiliar: '#F59E0B',
  familiar: '#22C55E',
  white: '#FFFFFF',
};

// ── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  centeredSafeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Progress ─────────────────────────────────────────────────────
  progress: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: Spacing.three,
    color: '#60646C',
  },

  // ── Card ──────────────────────────────────────────────────────────
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  cardContainer: {
    borderRadius: Spacing.three,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  cardFace: {
    flex: 1,
    padding: Spacing.four,
  },
  cardScroll: {
    flex: 1,
  },
  cardScrollContent: {
    paddingBottom: Spacing.three,
  },

  // ── Tap hint ─────────────────────────────────────────────────────
  tapHint: {
    fontSize: 13,
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },

  // ── Action buttons ───────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    marginBottom: Spacing.six,
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  actionButtonPressed: {
    opacity: 0.8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  forgottenButton: {
    backgroundColor: COLORS.forgotten,
  },
  unfamiliarButton: {
    backgroundColor: COLORS.unfamiliar,
  },
  familiarButton: {
    backgroundColor: COLORS.familiar,
  },

  // ── Error state ──────────────────────────────────────────────────
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.four,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Empty / Complete ─────────────────────────────────────────────
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.four,
    color: '#60646C',
  },
});
