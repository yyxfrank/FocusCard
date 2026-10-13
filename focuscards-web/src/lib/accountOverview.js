import { localDateKey, streakFromDates } from '../utils/calendar.js';

// Calendar-day arithmetic avoids 23/25-hour DST days and UTC date shifts.
export function tomorrowEnd(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();
}

export function registeredDays(createdAt, now = new Date()) {
  const created = new Date(createdAt);
  if (!createdAt || Number.isNaN(created.getTime())) return null;
  const day = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(1, Math.round((day(now) - day(created)) / 86400000) + 1);
}

export async function fetchAccountOverview(client, now = new Date()) {
  const { data, error } = await client.rpc('get_account_overview', { p_tomorrow_end: tomorrowEnd(now) });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('用户统计尚未启用，请先在 Supabase 执行 202610130001_account_overview.sql 迁移。');
    }
    throw new Error(error.message || '无法加载用户信息，请稍后重试。');
  }
  if (!data || !Array.isArray(data.decks) || !Array.isArray(data.check_in_dates)) {
    throw new Error('用户统计返回异常，请刷新重试。');
  }
  return {
    ...data,
    cardCount: data.decks.reduce((sum, deck) => sum + Number(deck.card_count), 0),
    dueCount: data.decks.reduce((sum, deck) => sum + Number(deck.due_count), 0),
    tomorrowDueCount: data.decks.reduce((sum, deck) => sum + Number(deck.tomorrow_due_count), 0),
    streak: streakFromDates(data.check_in_dates, now),
    checkedInToday: data.check_in_dates.some((row) => row.check_in_date === localDateKey(now)),
  };
}
