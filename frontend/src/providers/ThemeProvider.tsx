import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const themeStorageKey = '@themePreference';

type ThemeMode = 'light' | 'dark' | 'system';
type ThemeColors = Record<string, string>;
type ThemeContextValue = {
  isDark: boolean;
  themeMode: ThemeMode;
  setTheme: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => void;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const lightColors = {
  background: '#F5F8F7',
  surface: '#EFF7F4',
  surfaceAlt: '#EFF7F4',
  card: '#FFFFFF',
  border: '#E2E8F0',
  borderColor: '#E2E8F0',
  textPrimary: '#111827',
  textSecondary: '#64748B',
  textDisabled: '#9CA3AF',
  placeholder: '#94A3B8',
  accent: '#476A5E',
  accentSoft: 'rgba(71, 106, 94, 0.06)',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  muted: '#CBD5E1',
};

const darkColors = {
  background: '#121212',
  surface: '#1C1C1E',
  surfaceAlt: '#1C1C1E',
  card: '#1E1E1E',
  border: 'rgba(255,255,255,0.08)',
  borderColor: 'rgba(255,255,255,0.08)',
  textPrimary: '#E4E4E4',
  textSecondary: '#B0B0B0',
  textDisabled: '#6F6F6F',
  placeholder: '#6F6F6F',
  accent: '#609C8A',
  accentSoft: 'rgba(96, 156, 138, 0.12)',
  success: '#6EE7B7',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',
  muted: '#A1A1AA',
};

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(themeStorageKey);
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemeMode(savedTheme);
        }
      } catch (e) {
        console.warn('ThemeProvider: Failed to load theme preference', e);
      }
    };
    loadTheme();
  }, []);

  const updateTheme = useCallback(async (mode: ThemeMode) => {
    setThemeMode(mode);
    try {
      await AsyncStorage.setItem(themeStorageKey, mode);
    } catch (e) {
      console.warn('ThemeProvider: Failed to save theme preference', e);
    }
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') return systemColorScheme === 'dark';
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const colors: ThemeColors = isDark ? darkColors : lightColors;

  const toggleTheme = useCallback(() => {
    updateTheme(isDark ? 'light' : 'dark');
  }, [isDark, updateTheme]);

  const value = useMemo(() => ({
    isDark,
    themeMode,
    setTheme: updateTheme,
    toggleTheme,
    colors,
  }), [isDark, themeMode, updateTheme, colors]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
