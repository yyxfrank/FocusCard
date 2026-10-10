import { createContext, useContext } from 'react';

export const ThemeContext = createContext({ theme: 'light', setTheme: () => {} });
export function useWebTheme() { return useContext(ThemeContext); }
