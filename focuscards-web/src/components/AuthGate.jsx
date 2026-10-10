import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeUsername, signInWithUsername } from '../lib/usernameAuth';
import { ThemeProvider, ThemeSwitch } from './ThemeProvider.jsx';
import { useWebTheme } from '../hooks/useWebTheme.js';

export default function AuthGate({ children }) {
  return <ThemeProvider><AuthContent>{children}</AuthContent></ThemeProvider>;
}

function AuthContent({ children }) {
  const { theme } = useWebTheme();
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
  if (!ready) return <div className={`${theme === 'dark' ? 'dark' : ''} auth-loading`}><span className="brand-mark">F</span><p>INITIALIZING WORKSPACE…</p></div>;
  if (session) return <div key={session.user.id} className={`${theme === 'dark' ? 'dark' : ''} app-shell flex flex-col h-screen`}>
    <div className="account-bar flex justify-between px-4 py-2 text-sm">
      <span className="account-identity"><span className="status-dot" />{session.user.email}</span>
      <div className="account-actions"><ThemeSwitch /><button onClick={async () => { const { error } = await supabase.auth.signOut(); if (error) setMessage(error.message); }}>Sign out</button></div>
    </div>
    {message && <p role="alert">{message}</p>}
    <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
  </div>;
  return <div className={`${theme === 'dark' ? 'dark' : ''} auth-page`}>
    <header className="auth-nav"><a href="/" className="brand"><span className="brand-mark">F</span>FocusCards<span className="brand-tag">/ MEMORY SYSTEM</span></a><div className="account-actions"><span className="auth-nav-note">BUILD KNOWLEDGE. KEEP IT.</span><ThemeSwitch /></div></header>
    <main className="auth-layout">
      <section className="auth-intro">
        <p className="eyebrow"><span className="status-dot" /> YOUR PERSONAL KNOWLEDGE BASE</p>
        <h1>Learn deeply.<br /><span>Remember longer.</span></h1>
        <p className="intro-copy">A focused workspace for the things you want to know by heart. Write, review, repeat.</p>
        <div className="terminal-card" aria-hidden="true">
          <div className="terminal-heading"><span>STACK / KNOWLEDGE</span><span>01 — 03</span></div>
          <div className="terminal-row"><span>01</span><strong>Capture the idea.</strong><code>Markdown + code</code></div>
          <div className="terminal-row"><span>02</span><strong>Test your recall.</strong><code>Spaced repetition</code></div>
          <div className="terminal-row"><span>03</span><strong>Make it stick.</strong><code>One day at a time</code></div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-heading"><p className="eyebrow">{registering ? 'NEW WORKSPACE' : 'WELCOME BACK'}</p><h2>{registering ? 'Create your account' : 'Sign in to FocusCards'}</h2><p>{registering ? 'Start building your personal deck library.' : 'Your next review starts here.'}</p></div>
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void authenticate(registering); }}>
    <label>Username<input placeholder="your_username" disabled={busy} className="block border p-2 w-full" autoComplete="username" autoCapitalize="none" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
    {registering && <>
      <p className="text-xs text-gray-500">3–32 letters, digits or underscores. Usernames ignore capitalization.</p>
      <label>Email<input placeholder="you@example.com" disabled={busy} className="block border p-2 w-full" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    </>}
    <label>Password<input placeholder={registering ? 'At least 6 characters' : 'Enter your password'} disabled={busy} className="block border p-2 w-full" type="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 6 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <button className="auth-submit" disabled={busy} type="submit">{busy ? 'Please wait…' : registering ? 'Create account' : 'Continue'}<span aria-hidden="true">→</span></button>
    <button className="auth-switch" disabled={busy} type="button" onClick={() => { setRegistering(!registering); setPassword(''); setMessage(''); }}>{registering ? 'Already have an account? Sign in' : 'New here? Create an account'}<span aria-hidden="true">↗</span></button>
    {message && <p className="auth-message" role="status">{message}</p>}
  </form><div className="auth-panel-footer"><span className="status-dot" /> PRIVATE DECKS. ONE ACCOUNT. EVERY DEVICE.</div>
      </section>
    </main>
    <footer className="auth-footer"><span>FOCUSCARDS</span><span>LESS NOISE. MORE RECALL.</span></footer>
  </div>;
}
