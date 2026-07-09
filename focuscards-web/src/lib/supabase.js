/**
 * FocusCards Web — Supabase Client
 *
 * The sole gateway to the Supabase PostgreSQL database.
 * All frontends import this single client instance.
 *
 * @module lib/supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in .env',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
