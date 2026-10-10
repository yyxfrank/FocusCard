export function createReviewApi(client) {
  const unwrap = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  return {
    async summary(deckId) {
      const [deck, counts, reviewed] = await Promise.all([
        client.from('decks').select('*').eq('id', deckId).single(),
        client.rpc('get_due_counts'),
        client.rpc('get_daily_review_count', { p_deck_id: deckId }),
      ]);
      return { deck: unwrap(deck), due: Number(unwrap(counts)?.find((row) => row.deck_id === deckId)?.due_count ?? 0),
        reviewed: Number(unwrap(reviewed) ?? 0) };
    },
    async start(deckId, limit) {
      unwrap(await client.from('decks').update({ daily_review_limit: limit }).eq('id', deckId).select('id').single());
      const reviewed = Number(unwrap(await client.rpc('get_daily_review_count', { p_deck_id: deckId })) ?? 0);
      const remaining = Math.max(0, limit - reviewed);
      if (!remaining) return [];
      return unwrap(await client.from('cards').select('*').eq('deck_id', deckId)
        .lte('next_review', new Date().toISOString()).order('next_review', { ascending: true }).limit(remaining)) ?? [];
    },
    async persist(id, updates) {
      const { data, error } = await client.rpc('record_review', {
        p_card_id: id, p_interval_days: updates.interval_days,
        p_ease_factor: updates.ease_factor, p_next_review: updates.next_review,
      });
      return { data, error: error?.message ?? null };
    },
    async checkIn(date) {
      unwrap(await client.from('check_ins').upsert({ check_in_date: date }, { onConflict: 'user_id,check_in_date' }));
    },
  };
}
