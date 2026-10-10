/**
 * Persistently track which decks have been completed today.
 * Uses AsyncStorage on native and web. Keys include the account and calendar
 * day so badges survive restarts and cannot leak between signed-in users.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from '../utils/calendar';
import { supabase } from './supabase';
const STORAGE_PREFIX = 'focuscards_completed_';
let pending: Promise<void> = Promise.resolve();

async function getTodayKey(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in to access progress');
  const today = localDateKey();
  return `${STORAGE_PREFIX}${data.session.user.id}_${today}`;
}

export async function getCompletedDeckIds(): Promise<string[]> {
  await pending;
  try {
    const raw = await AsyncStorage.getItem(await getTodayKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export async function addCompletedDeckId(deckId: string): Promise<void> {
  const key = await getTodayKey();
  const write = pending.then(async () => {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    const ids = Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    if (!ids.includes(deckId)) await AsyncStorage.setItem(key, JSON.stringify([...ids, deckId]));
  });
  pending = write.catch(() => {});
  return write;
}
