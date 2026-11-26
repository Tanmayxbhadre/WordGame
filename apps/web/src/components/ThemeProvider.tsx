'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface SettingsContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [reducedMotion, setReducedMotionState] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('wordshift_theme') as Theme | null;
    const savedSound = localStorage.getItem('wordshift_sound');
    const savedMotion = localStorage.getItem('wordshift_reduced_motion');

    const initialTheme = savedTheme === 'light' ? 'light' : 'dark';
    setThemeState(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');

    if (savedSound !== null) setSoundEnabledState(savedSound === 'true');
    if (savedMotion !== null) setReducedMotionState(savedMotion === 'true');
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('wordshift_theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const setSoundEnabled = (v: boolean) => {
    setSoundEnabledState(v);
    localStorage.setItem('wordshift_sound', String(v));
  };

  const setReducedMotion = (v: boolean) => {
    setReducedMotionState(v);
    localStorage.setItem('wordshift_reduced_motion', String(v));
  };

  return (
    <SettingsContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        soundEnabled,
        setSoundEnabled,
        reducedMotion,
        setReducedMotion,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within ThemeProvider');
  return ctx;
}
