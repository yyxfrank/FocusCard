import type { SupabaseClient } from '@supabase/supabase-js';

export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(username)) throw new Error('Username must be 3–32 letters, digits or underscores.');
  return username;
}

export async function signInWithUsername(client: SupabaseClient, username: string, password: string) {
  const { data, error } = await client.functions.invoke('username-login', {
    body: { username: normalizeUsername(username), password },
  });
  if (error) {
    let message = 'Unable to sign in. Check your credentials and try again.';
    if (error.context && typeof error.context.json === 'function') {
      try { message = (await error.context.json()).error || message; } catch { /* keep fallback */ }
    }
    throw new Error(message);
  }
  if (!data?.access_token || !data?.refresh_token) throw new Error('Login service returned an invalid session.');
  const result = await client.auth.setSession(data);
  if (result.error) throw result.error;
  return result;
}
