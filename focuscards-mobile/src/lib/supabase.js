/**
 * FocusCards Mobile — Supabase Client
 *
 * Gateway to the Supabase PostgreSQL database from the Expo app.
 * Uses EXPO_PUBLIC_* env vars which Expo injects at build time.
 *
 * @module lib/supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set in .env',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
