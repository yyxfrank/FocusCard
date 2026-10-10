import { useEffect, useState } from 'react';
import { ThemeContext, useWebTheme } from '../hooks/useWebTheme.js';

const storageKey = 'focuscards.theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem(storageKey, theme); } catch { /* Storage may be disabled. */ }
  }, [theme]);
  useEffect(() => {
    const synchronize = (event) => {
      if (event.key === storageKey) setTheme(event.newValue === 'dark' ? 'dark' : 'light');
    };
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, []);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function ThemeSwitch() {
  const { theme, setTheme } = useWebTheme();
  return <div className="theme-switch" role="group" aria-label="页面主题">
    <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><span aria-hidden="true">☀</span> Light</button>
    <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><span aria-hidden="true">☾</span> Dark</button>
  </div>;
}
