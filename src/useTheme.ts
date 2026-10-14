/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'sepia';

export const THEME_STORAGE_KEY = 'xuong_theme';

/**
 * Custom hook to read and save user's selected theme (dark, light, sepia) in localStorage.
 * Automatically synchronizes DOM attributes, avoids flash of unstyled content,
 * and responds to cross-tab storage events and system preference.
 */
export function useTheme(defaultTheme: Theme = 'dark') {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (saved && (saved === 'dark' || saved === 'light' || saved === 'sepia')) {
        return saved;
      }
    } catch {
      // In restricted iframes localStorage might throw
    }

    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : defaultTheme;
    }
    return defaultTheme;
  });

  // Effect to persist theme in localStorage, apply data-theme to document and body,
  // and listen for cross-tab storage updates
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage quota / sandbox restrictions
    }

    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);

    // Cross-tab sync effect
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && event.newValue) {
        const incomingTheme = event.newValue as Theme;
        if (incomingTheme === 'dark' || incomingTheme === 'light' || incomingTheme === 'sepia') {
          setThemeState(incomingTheme);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleLightDark = useCallback(() => {
    setThemeState((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  return {
    theme,
    setTheme,
    toggleLightDark,
    isDark: theme !== 'light',
  };
}
