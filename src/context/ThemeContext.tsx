import { Sun, Moon } from 'lucide-react';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  isDark: boolean;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Initial theme: stored preference first, otherwise follow the OS setting. */
function resolveInitialTheme(): Theme {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  const prefersDark =
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ isDark: theme === 'dark', theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Compact floating toggle for pages rendered outside the main layout
 * (e.g. LoginPage), so users can switch theme before they sign in.
 */
export const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-200 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 shadow-sm hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
    >
      <Icon className={`w-4 h-4 ${isDark ? 'text-amber-500' : 'text-indigo-500'}`} />
      <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
    </button>
  );
};
