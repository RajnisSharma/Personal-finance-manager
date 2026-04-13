import React, { useState, useEffect } from 'react';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const [themeMode, setThemeMode] = useState('system'); // system | light | dark
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const systemPrefersDark = systemQuery.matches;
    const savedThemeMode = localStorage.getItem('themeMode') || 'system';

    setThemeMode(savedThemeMode);
    applyTheme(savedThemeMode, systemPrefersDark);
    setIsLoading(false);

    const handleSystemChange = (e) => {
      if (localStorage.getItem('themeMode') === 'system') {
        applyTheme('system', e.matches);
      }
    };

    systemQuery.addEventListener('change', handleSystemChange);
    return () => systemQuery.removeEventListener('change', handleSystemChange);
  }, []);

  const applyTheme = (mode, systemDark) => {
    const root = document.documentElement;
    const useDark = mode === 'dark' || (mode === 'system' && systemDark);

    if (useDark) root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');

    const metaThemeColor = document.querySelector('meta[name=theme-color]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', useDark ? '#0F172A' : '#FFFFFF');
    }
  };

  const toggleThemeMode = () => {
    const nextMode = themeMode === 'system' ? 'dark' : themeMode === 'dark' ? 'light' : 'system';
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    setThemeMode(nextMode);
    localStorage.setItem('themeMode', nextMode);
    applyTheme(nextMode, systemDark);
  };

  if (isLoading) {
    return (
      <div className="theme-toggle-container">
        <div className="theme-toggle-loading">
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-toggle-container">
      <button
        className="dark-mode-toggle btn btn-outline-secondary btn-sm"
        onClick={toggleThemeMode}
        aria-label={
          themeMode === 'system'
            ? 'Switch to dark mode'
            : themeMode === 'dark'
            ? 'Switch to light mode'
            : 'Switch to system mode'
        }
        title={
          themeMode === 'system'
            ? 'System theme'
            : themeMode === 'dark'
            ? 'Dark theme'
            : 'Light theme'
        }
      >
        {themeMode === 'system' ? '🖥️' : themeMode === 'dark' ? '🌙' : '☀️'}
      </button>
    </div>
  );
}
