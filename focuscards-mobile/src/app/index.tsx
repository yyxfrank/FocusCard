import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchDecks, fetchAllDueCards, computeStreak } from '@/lib/syncEngine';
import { getCompletedDeckIds, addCompletedDeckId } from '@/lib/completedDecks';

export default function DashboardScreen() {
  const { reviewedDeckId: rawReviewedDeckId } = useLocalSearchParams<{
    reviewedDeckId?: string;
  }>();

  const [decks, setDecks] = useState<any[]>([]);
  const [dueCounts, setDueCounts] = useState<Record<string, number>>({});
  const [streak, setStreak] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedDeckIds, setCompletedDeckIds] = useState<string[]>(() => getCompletedDeckIds());

  // Track a deck that was just reviewed and navigated back from
  useEffect(() => {
    if (rawReviewedDeckId) {
      addCompletedDeckId(rawReviewedDeckId);
      setCompletedDeckIds((prev) => (prev.includes(rawReviewedDeckId) ? prev : [...prev, rawReviewedDeckId]));
      // Clear the param from the URL so it doesn't re-trigger
      if (Platform.OS === 'web') {
        window.history.replaceState(null, '', '/');
      }
    }
  }, [rawReviewedDeckId]);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setCompletedDeckIds(getCompletedDeckIds());
    }
    else setLoading(true);
    setError(null);

    try {
      const [decksResult, allDueCardsResult, streakResult] = await Promise.all([
        fetchDecks(),
        fetchAllDueCards(),
        computeStreak(),
      ]);

      const errMsg = decksResult.error ?? allDueCardsResult.error ?? streakResult.error;
      if (errMsg) {
        throw new Error(errMsg);
      }

      if (decksResult.data) setDecks(decksResult.data);

      if (allDueCardsResult.data) {
        const counts: Record<string, number> = {};
        for (const card of allDueCardsResult.data) {
          counts[card.deck_id] = (counts[card.deck_id] || 0) + 1;
        }
        setDueCounts(counts);
      }

      if (streakResult.data !== undefined) setStreak(streakResult.data);
    } catch (e: any) {
      setError(e.message ?? 'Unable to connect to server. Please check your connection.');
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleDeckPress = useCallback((deckId: string) => {
    router.push(`/pre-review?deckId=${deckId}`);
  }, []);

  const renderDeckItem = useCallback(
    ({ item }: { item: any }) => {
      const due = dueCounts[item.id] ?? 0;
      const isCompleted = completedDeckIds.includes(item.id);
      return (
        <Pressable onPress={() => handleDeckPress(item.id)}>
          <ThemedView type="backgroundElement" style={styles.deckRow}>
            <ThemedText style={styles.deckName}>{item.name}</ThemedText>
            {isCompleted ? (
              <ThemedView style={styles.completedBadge}>
                <ThemedText style={styles.completedBadgeText}>✓ Completed</ThemedText>
              </ThemedView>
            ) : (
              due > 0 && (
                <ThemedView style={styles.badge}>
                  <ThemedText style={styles.badgeText}>{due}</ThemedText>
                </ThemedView>
              )
            )}
          </ThemedView>
        </Pressable>
      );
    },
    [dueCounts, handleDeckPress, completedDeckIds],
  );

  const keyExtractor = useCallback((item: any) => item.id, []);

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
          <Pressable onPress={() => loadDashboard()} style={styles.retryButton}>
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
        {/* ── Header ────────────────────────────────── */}
        <ThemedView style={styles.header}>
          <ThemedText type="title">FocusCards</ThemedText>
          <ThemedView style={styles.streakBadge}>
            <ThemedText style={styles.streakText}>
              🔥 {streak !== null ? streak : '—'}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* ── Deck list ─────────────────────────────── */}
        {decks.length === 0 ? (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText>No decks yet. Create one in the web app.</ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={decks}
            keyExtractor={keyExtractor}
            renderItem={renderDeckItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadDashboard(true)}
              />
            }
          />
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.half,
  },
  streakBadge: {
    backgroundColor: '#FED7AA',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  streakText: {
    color: '#9A3412',
    fontSize: 16,
    fontWeight: '600',
  },
  // ── Deck list ──────────────────────────────────────────────────
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  deckName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  badge: {
    backgroundColor: '#3B82F6',
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  completedBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  completedBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // ── Empty state ────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
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
