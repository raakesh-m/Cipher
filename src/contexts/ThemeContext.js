import React, { createContext, useContext } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// New design theme based on JSON specifications
const designTheme = {
  mode: 'light',
  colors: {
    // Chat List Colors
    primary: '#6C5CE7',
    primaryDark: '#5444E0',
    surface: '#FFFFFF',
    textPrimary: '#1F2328',
    textSecondary: '#6B7280',
    divider: '#EEF0F4',
    badge: '#6C5CE7',
    badgeText: '#FFFFFF',

    // Chat Thread Colors
    threadBackground: '#5B4BDE',
    incomingBubble: '#6F61FF',
    incomingText: '#FFFFFF',
    outgoingBubble: '#FFFFFF',
    outgoingText: '#27303A',
    chip: '#7A6CF8',
    chipText: '#FFFFFF',

    // Legacy mappings for compatibility
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1F2328',
    border: '#EEF0F4',

    // Status colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',

    // Input colors
    inputBackground: '#f9fafb',
    inputBorder: '#d1d5db',
    inputPlaceholder: '#9ca3af',

    // Translation colors
    translatedBackground: '#f0f9ff',
    translatedBorder: '#0ea5e9',

    // Shadow
    shadow: '#000000',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  radius: {
    lg: 20,
    md: 14,
    sm: 10,
    bubble: 18,
    input: 24,
  },
  spacing: {
    xl: 24,
    lg: 16,
    md: 12,
    sm: 8,
    msgGap: 8,
    sectionGap: 16,
  },
  borderRadius: {
    sm: 10,
    md: 14,
    lg: 20,
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

export const ThemeProvider = ({ children }) => {
  const value = {
    theme: designTheme,
    isDark: false,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export { designTheme };