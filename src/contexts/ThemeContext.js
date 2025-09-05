import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme definitions
const lightTheme = {
  mode: 'light',
  colors: {
    // Background colors
    background: '#ffffff',
    surface: '#f8fafc',
    card: '#ffffff',
    
    // Primary colors
    primary: '#6366f1',
    primaryLight: '#818cf8',
    primaryDark: '#4338ca',
    
    // Secondary colors
    secondary: '#10b981',
    secondaryLight: '#34d399',
    secondaryDark: '#059669',
    
    // Text colors
    text: '#1f2937',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
    
    // Status colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    // Border and divider colors
    border: '#e5e7eb',
    divider: '#f3f4f6',
    
    // Input colors
    inputBackground: '#f9fafb',
    inputBorder: '#d1d5db',
    inputPlaceholder: '#9ca3af',
    
    // Shadow
    shadow: '#000000',
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

const darkTheme = {
  mode: 'dark',
  colors: {
    // Background colors
    background: '#0f172a',
    surface: '#1e293b',
    card: '#334155',
    
    // Primary colors
    primary: '#818cf8',
    primaryLight: '#a5b4fc',
    primaryDark: '#6366f1',
    
    // Secondary colors
    secondary: '#34d399',
    secondaryLight: '#6ee7b7',
    secondaryDark: '#10b981',
    
    // Text colors
    text: '#f1f5f9',
    textSecondary: '#cbd5e1',
    textTertiary: '#94a3b8',
    
    // Status colors
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
    
    // Border and divider colors
    border: '#475569',
    divider: '#334155',
    
    // Input colors
    inputBackground: '#475569',
    inputBorder: '#64748b',
    inputPlaceholder: '#94a3b8',
    
    // Shadow
    shadow: '#000000',
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

const THEME_STORAGE_KEY = '@cipher_theme_preference';

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState('system'); // 'light', 'dark', 'system'
  const [currentTheme, setCurrentTheme] = useState(lightTheme);

  // Load theme preference from storage
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Update theme when system theme or preference changes
  useEffect(() => {
    updateCurrentTheme();
  }, [themePreference, systemColorScheme]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme) {
        setThemePreference(savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const updateCurrentTheme = () => {
    let newTheme;
    
    if (themePreference === 'system') {
      newTheme = systemColorScheme === 'dark' ? darkTheme : lightTheme;
    } else {
      newTheme = themePreference === 'dark' ? darkTheme : lightTheme;
    }
    
    setCurrentTheme(newTheme);
  };

  const setTheme = async (theme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
      setThemePreference(theme);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const value = {
    theme: currentTheme,
    themePreference,
    setTheme,
    isDark: currentTheme.mode === 'dark',
    systemTheme: systemColorScheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export { lightTheme, darkTheme };