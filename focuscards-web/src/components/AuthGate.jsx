import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeUsername, signInWithUsername } from '../lib/usernameAuth';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [registering, setRegistering] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) { setSession(data.session); setReady(true); if (error) setMessage(error.message); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      setSession(value); setReady(true);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  async function authenticate(signUp) {
    setBusy(true); setMessage('');
    try {
      const chosen = normalizeUsername(username);
      if (signUp && chosen.startsWith('user_')) throw new Error('The user_ prefix is reserved. Choose another username.');
      const result = signUp ? await supabase.auth.signUp({ email: email.trim(), password,
        options: { data: { username: chosen } } }) : await signInWithUsername(supabase, chosen, password);
      if (result.error) throw result.error;
      if (signUp && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  if (!ready) return <p>Loading…</p>;
  if (session) return <div key={session.user.id} className="flex flex-col h-screen">
    <div className="flex justify-between px-4 py-2 text-sm">
      <span>{session.user.email}</span>
      <button onClick={async () => { const { error } = await supabase.auth.signOut(); if (error) setMessage(error.message); }}>Sign out</button>
    </div>
    {message && <p role="alert">{message}</p>}
    <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
  </div>;
  return <form className="max-w-sm mx-auto mt-20 flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void authenticate(registering); }}>
    <h1 className="text-2xl font-bold">FocusCards</h1>
    <h2>{registering ? 'Create account' : 'Sign in'}</h2>
    <label>Username<input className="block border p-2 w-full" autoComplete="username" autoCapitalize="none" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
    {registering && <>
      <p className="text-xs text-gray-500">3–32 letters, digits or underscores. Usernames ignore capitalization.</p>
      <label>Email<input className="block border p-2 w-full" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    </>}
    <label>Password<input className="block border p-2 w-full" type="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 6 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <button disabled={busy} type="submit">{busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</button>
    <button disabled={busy} type="button" onClick={() => { setRegistering(!registering); setPassword(''); setMessage(''); }}>{registering ? 'Already have an account? Sign in' : 'Create a new account'}</button>
    <p role="status">{message}</p>
  </form>;
}
