import { createClient } from 'npm:@supabase/supabase-js@2.110.1';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[a-z0-9_]{3,32}$/.test(username) || !password || password.length > 4096) {
      return reply({ error: 'Invalid username or password' }, 401);
    }
    const url = Deno.env.get('SUPABASE_URL')!;
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);
    const { data: allowed, error: rateError } = await admin.rpc('consume_username_login_attempt', { p_username: username });
    if (rateError) return reply({ error: 'Login service unavailable' }, 503);
    if (!allowed) return reply({ error: 'Too many attempts. Try again in 5 minutes.' }, 429);
    const { data: profile, error: lookupError } = await admin.from('account_usernames')
      .select('user_id').eq('username', username).maybeSingle();
    if (lookupError) return reply({ error: 'Login service unavailable' }, 503);
    let email = 'unknown-account@invalid.invalid';
    if (profile) {
      const { data, error } = await admin.auth.admin.getUserById(profile.user_id);
      if (error) return reply({ error: 'Login service unavailable' }, 503);
      email = data.user.email ?? email;
    }
    const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, options);
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (!profile || error || !data.session) return reply({ error: 'Invalid username or password' }, 401);
    // Only session credentials are returned; email is never exposed on failed login.
    return reply({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch {
    return reply({ error: 'Login could not be completed' }, 400);
  }
});
