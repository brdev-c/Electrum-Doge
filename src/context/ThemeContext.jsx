import React, { createContext, useState, useContext, useEffect } from 'react';

const lightTheme = {
  name: 'light',
  darkMode: false,
  color: '#333',
  background: '#f0f0f0',
  menubarBg: '#ececec',
  panelBg: '#ffffff',
  borderColor: '#ccc',
  tableHeaderBg: '#f1f1f1',
  tableRowHover: 'rgba(0,0,0,0.04)',
  sideBg: '#efefef',
  tabActiveBg: '#ddd',
  tabActiveColor: '#000',
  inputBorder: '#ccc',
  inputBg: '#fff'
};

const darkTheme = {
  name: 'dark',
  darkMode: true,
  color: 'rgb(223,225,226)',
  background: 'rgb(25,35,45)',
  menubarBg: 'rgb(69,83,100)',
  panelBg: 'rgb(69,83,100)',
  borderColor: 'transparent',
  tableHeaderBg: 'rgb(69,83,100)',
  tableRowHover: 'rgba(255,255,255,0.07)',
  sideBg: 'rgb(69,83,100)',
  tabActiveBg: '#777',
  tabActiveColor: '#fff',
  inputBorder: '#777',
  inputBg: 'rgb(25,35,45)'
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  function getInitialThemeName() {
    try {
      const saved = localStorage.getItem('app_theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  const [themeName, setThemeName] = useState(getInitialThemeName);

  useEffect(() => {
    try {
      localStorage.setItem('app_theme', themeName);
    } catch (err) {
      console.error('Failed to save theme to localStorage:', err);
    }
  }, [themeName]);

  const currentTheme = themeName === 'dark' ? darkTheme : lightTheme;

  const setTheme = (newName) => {
    if (newName !== 'light' && newName !== 'dark') {
      console.warn('Unknown theme name:', newName);
      return;
    }
    setThemeName(newName);
  };

  const value = {
    theme: currentTheme,
    setTheme
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
