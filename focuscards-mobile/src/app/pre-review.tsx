import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchDeck, fetchDueCards, updateDeck } from '@/lib/syncEngine';

export default function PreReviewScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();

  const [deck, setDeck] = useState<any>(null);
  const [limit, setLimit] = useState(20);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deckId) return;
    loadDeck();
  }, [deckId]);

  async function loadDeck() {
    setLoading(true);
    setError(null);

    try {
      const [deckResult, dueResult] = await Promise.all([
        fetchDeck(deckId),
        fetchDueCards(deckId, 9999),
      ]);

      const errMsg = deckResult.error ?? dueResult.error;
      if (errMsg) {
        throw new Error(errMsg);
      }

      if (deckResult.data) {
        setDeck(deckResult.data);
        setLimit((deckResult.data as any).daily_review_limit ?? 20);
      }
      if (dueResult.data) {
        setDueCount(dueResult.data.length);
      }
    } catch (e: any) {
      setError(e.message ?? 'Unable to connect to server. Please check your connection.');
    }

    setLoading(false);
  }

  const handleDecrement = useCallback(() => {
    setLimit((prev) => Math.max(1, prev - 5));
  }, []);

  const handleIncrement = useCallback(() => {
    setLimit((prev) => Math.min(200, prev + 5));
  }, []);

  const reviewCount = useMemo(() => Math.min(dueCount, limit), [dueCount, limit]);

  const handleStartReview = useCallback(async () => {
    if (!deckId || starting) return;
    setStarting(true);

    // Persist the adjusted limit
    await updateDeck(deckId, { daily_review_limit: limit });

    router.push(`/review?deckId=${deckId}&limit=${limit}`);
  }, [deckId, limit, starting]);

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <SafeAreaView style={styles.centeredSafeArea}>
          <ActivityIndicator size="large" />
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── Error state ──────────────────────────────────────────────────
  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <SafeAreaView style={styles.centeredSafeArea}>
          <ThemedText style={styles.errorMessage}>{error}</ThemedText>
          <Pressable onPress={loadDeck} style={styles.retryButton}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* ── Deck name ──────────────────────────────── */}
        <ThemedView style={styles.header}>
          <ThemedText type="title">{deck?.name ?? 'Deck'}</ThemedText>
        </ThemedView>

        {/* ── Due cards count ────────────────────────── */}
        <ThemedView type="backgroundElement" style={styles.infoCard}>
          <ThemedText style={styles.infoLabel}>Cards due today</ThemedText>
          <ThemedText style={styles.infoValue}>{dueCount}</ThemedText>
        </ThemedView>

        {/* ── Daily limit stepper ────────────────────── */}
        <ThemedView style={styles.stepperSection}>
          <ThemedText style={styles.stepperLabel}>Daily review limit</ThemedText>
          <View style={styles.stepperRow}>
            <Pressable onPress={handleDecrement} style={styles.stepButton}>
              <ThemedText style={styles.stepButtonText}>−</ThemedText>
            </Pressable>
            <ThemedView type="backgroundElement" style={styles.stepValue}>
              <ThemedText style={styles.stepValueText}>{limit}</ThemedText>
            </ThemedView>
            <Pressable onPress={handleIncrement} style={styles.stepButton}>
              <ThemedText style={styles.stepButtonText}>+</ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        {/* ── Review summary ─────────────────────────── */}
        <ThemedText style={styles.summary}>
          You will review {reviewCount} card{reviewCount !== 1 ? 's' : ''} today.
        </ThemedText>

        {/* ── Spacer ─────────────────────────────────── */}
        <View style={styles.spacer} />

        {/* ── Start Review button ────────────────────── */}
        <Pressable
          onPress={handleStartReview}
          disabled={starting || dueCount === 0}
          style={({ pressed }) => [
            styles.startButton,
            (starting || dueCount === 0) && styles.startButtonDisabled,
            pressed && styles.startButtonPressed,
          ]}
        >
          {starting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <ThemedText style={styles.startButtonText}>
              {dueCount === 0 ? 'No cards due' : 'Start Review'}
            </ThemedText>
          )}
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
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
  // ── Header ─────────────────────────────────────────────────────
  header: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.half,
    alignItems: 'center',
  },
  // ── Info card ──────────────────────────────────────────────────
  infoCard: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
  },
  infoLabel: {
    fontSize: 14,
    color: '#60646C',
    marginBottom: Spacing.one,
  },
  infoValue: {
    fontSize: 48,
    fontWeight: '700',
  },
  // ── Stepper ────────────────────────────────────────────────────
  stepperSection: {
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  stepperLabel: {
    fontSize: 14,
    marginBottom: Spacing.three,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  stepValue: {
    minWidth: 80,
    height: 48,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  stepValueText: {
    fontSize: 22,
    fontWeight: '600',
  },
  // ── Summary ────────────────────────────────────────────────────
  summary: {
    textAlign: 'center',
    fontSize: 14,
    color: '#60646C',
    marginBottom: Spacing.four,
  },
  // ── Spacer ─────────────────────────────────────────────────────
  spacer: {
    flex: 1,
  },
  // ── Start button ───────────────────────────────────────────────
  startButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.six,
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButtonPressed: {
    opacity: 0.8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  // ── Error state ────────────────────────────────────────────────
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
});
