import { writable } from 'svelte/store';
import darkTheme from '../../themes/dark.json';
import lightTheme from '../../themes/light.json';

export type ThemeMode = 'dark' | 'light';

export interface ThemeSettings {
  theme: ThemeMode;
  accentColor: string;
  reduceEffects: boolean;
  scale: number;
  wallpaper: string;
}

export const ACCENT_PALETTE = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#6366f1', // Indigo (Saturn default)
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#14b8a6'  // Teal
];

function loadSettings(): ThemeSettings {
  try {
    const saved = localStorage.getItem('saturn.settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        theme: parsed.theme || 'dark',
        accentColor: parsed.accentColor || parsed.accent || '#6366f1',
        reduceEffects: parsed.reduceEffects !== undefined ? parsed.reduceEffects : (parsed.effects === false),
        scale: parsed.scale || 1.0,
        wallpaper: parsed.wallpaper || '/saturnOS.png'
      };
    }
  } catch (e) {}

  return {
    theme: 'dark',
    accentColor: '#6366f1',
    reduceEffects: false,
    scale: 1.0,
    wallpaper: '/saturnOS.png'
  };
}

export const themeSettingsStore = writable<ThemeSettings>(loadSettings());

export function applyTheme(settings: ThemeSettings) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const tokens = settings.theme === 'light' ? lightTheme.tokens : darkTheme.tokens;

  // Apply JSON theme tokens
  Object.entries(tokens).forEach(([prop, val]) => {
    root.style.setProperty(prop, val);
  });

  // Base semantic tokens
  if (settings.theme === 'light') {
    root.style.setProperty('--bg-window', '#f8fafc');
    root.style.setProperty('--bg-surface', '#ffffff');
    root.style.setProperty('--bg-card', '#f1f5f9');
    root.style.setProperty('--bg-hover', 'rgba(0, 0, 0, 0.05)');
    root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.12)');
    root.style.setProperty('--border-active', settings.accentColor);
    root.style.setProperty('--text-primary', '#0f172a');
    root.style.setProperty('--text-secondary', '#475569');
    root.style.setProperty('--text-muted', '#94a3b8');
  } else {
    root.style.setProperty('--bg-window', '#0e111a');
    root.style.setProperty('--bg-surface', '#141824');
    root.style.setProperty('--bg-card', '#1a2030');
    root.style.setProperty('--bg-hover', 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--border-active', settings.accentColor);
    root.style.setProperty('--text-primary', '#f8fafc');
    root.style.setProperty('--text-secondary', '#94a3b8');
    root.style.setProperty('--text-muted', '#64748b');
  }

  // Radii
  root.style.setProperty('--radius-sm', '4px');
  root.style.setProperty('--radius-md', '8px');
  root.style.setProperty('--radius-lg', '12px');

  // Accent tokens
  const hex = settings.accentColor;
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-primary', hex);
  root.style.setProperty('--accent-surface', `${hex}26`); // ~15% alpha
  root.style.setProperty('--accent-alpha', `${hex}38`);

  root.classList.toggle('light-theme', settings.theme === 'light');
  document.body.classList.toggle('reduce-effects', settings.reduceEffects);
  root.style.zoom = String(settings.scale);

  try {
    localStorage.setItem('saturn.settings', JSON.stringify(settings));
  } catch (e) {}
}

export function updateThemeSettings(partial: Partial<ThemeSettings>) {
  themeSettingsStore.update(curr => {
    const next = { ...curr, ...partial };
    applyTheme(next);
    return next;
  });
}

// Convenience wrapper
export const themeStore = {
  subscribe: themeSettingsStore.subscribe,
  setTheme: (theme: ThemeMode) => updateThemeSettings({ theme }),
  toggleTheme: () => {
    themeSettingsStore.update(curr => {
      const next: ThemeSettings = { ...curr, theme: curr.theme === 'dark' ? 'light' : 'dark' };
      applyTheme(next);
      return next;
    });
  },
  setAccentColor: (accentColor: string) => updateThemeSettings({ accentColor }),
  setReduceEffects: (reduceEffects: boolean) => updateThemeSettings({ reduceEffects }),
  setScale: (scale: number) => updateThemeSettings({ scale }),
  setWallpaper: (wallpaper: string) => updateThemeSettings({ wallpaper })
};
