'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// TYPES
// ============================================

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  link: string;
  cardBg: string;
  sidebarBg: string;
  bg: string;
  text: string;
  textSecondary: string;
  border: string;
  hover: string;
  success: string;
  warning: string;
  danger: string;
}

export type ThemeFont = 'Inter' | 'Poppins' | 'Montserrat';
export type ThemeBorderRadius = 'square' | 'semi' | 'rounded';
export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeConfig {
  preset: string;
  colors: ThemeColors;
  font: ThemeFont;
  borderRadius: ThemeBorderRadius;
  mode: ThemeMode;
  dynamicSidebar: boolean;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  mode: ThemeMode;
  icon: string;
}

// ============================================
// PRESETS
// ============================================

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'corporate-pro',
    name: 'Corporate Pro',
    description: 'Azul corporativo — Estilo empresarial',
    icon: '🏢',
    mode: 'light',
    colors: {
      primary: '#1E40AF',
      secondary: '#3B82F6',
      accent: '#2563EB',
      link: '#1D4ED8',
      cardBg: '#FFFFFF',
      sidebarBg: '#0F172A',
      bg: '#F8FAFC',
      text: '#1E293B',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      hover: '#EFF6FF',
      success: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626',
    },
  },
  {
    id: 'modern-dark',
    name: 'Modern Dark',
    description: 'Azul eléctrico — Tecnológico premium',
    icon: '🌑',
    mode: 'dark',
    colors: {
      primary: '#3B82F6',
      secondary: '#60A5FA',
      accent: '#2563EB',
      link: '#60A5FA',
      cardBg: '#1E293B',
      sidebarBg: '#0F172A',
      bg: '#0B0F1A',
      text: '#E2E8F0',
      textSecondary: '#94A3B8',
      border: '#334155',
      hover: '#1E293B',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
    },
  },
  {
    id: 'luxury-gold',
    name: 'Luxury Gold',
    description: 'Dorado sobre negro — Estilo lujo',
    icon: '✨',
    mode: 'dark',
    colors: {
      primary: '#D4A843',
      secondary: '#C9963C',
      accent: '#E2BB55',
      link: '#E2BB55',
      cardBg: '#1F1F1F',
      sidebarBg: '#141414',
      bg: '#0D0D0D',
      text: '#F5F0E1',
      textSecondary: '#A8A08E',
      border: '#2A2A2A',
      hover: '#2A2520',
      success: '#4ADE80',
      warning: '#FBBF24',
      danger: '#F87171',
    },
  },
  {
    id: 'medical-clean',
    name: 'Medical Clean',
    description: 'Azul médico y verde — Estilo clínico',
    icon: '🏥',
    mode: 'light',
    colors: {
      primary: '#0891B2',
      secondary: '#06B6D4',
      accent: '#0E7490',
      link: '#0891B2',
      cardBg: '#FFFFFF',
      sidebarBg: '#134E4A',
      bg: '#F0FDFA',
      text: '#1E293B',
      textSecondary: '#64748B',
      border: '#CCFBF1',
      hover: '#E6FFFA',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
    },
  },
  {
    id: 'minimal-white',
    name: 'Minimal White',
    description: 'Blanco y gris — Estilo minimalista',
    icon: '⬜',
    mode: 'light',
    colors: {
      primary: '#18181B',
      secondary: '#3F3F46',
      accent: '#27272A',
      link: '#18181B',
      cardBg: '#FFFFFF',
      sidebarBg: '#FAFAFA',
      bg: '#FFFFFF',
      text: '#27272A',
      textSecondary: '#71717A',
      border: '#E4E4E7',
      hover: '#F4F4F5',
      success: '#16A34A',
      warning: '#CA8A04',
      danger: '#DC2626',
    },
  },
];

// ============================================
// DEFAULT CONFIG
// ============================================

export const DEFAULT_THEME: ThemeConfig = {
  preset: 'corporate-pro',
  colors: { ...THEME_PRESETS[0].colors },
  font: 'Inter',
  borderRadius: 'semi',
  mode: 'light',
  dynamicSidebar: true,
};

// ============================================
// BORDER RADIUS MAP
// ============================================

export const BORDER_RADIUS_MAP: Record<ThemeBorderRadius, string> = {
  square: '0px',
  semi: '8px',
  rounded: '16px',
};

// ============================================
// CONTEXT
// ============================================

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: React.Dispatch<React.SetStateAction<ThemeConfig>>;
  applyPreset: (presetId: string) => void;
  saveTheme: () => Promise<void>;
  isSaving: boolean;
  isDark: boolean;
  resetToDefault: () => void;
  previewTheme: ThemeConfig | null;
  setPreviewTheme: React.Dispatch<React.SetStateAction<ThemeConfig | null>>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Return a dummy context when used outside of ThemeProvider (e.g., public pages)
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
      applyPreset: () => {},
      saveTheme: async () => {},
      isSaving: false,
      isDark: false,
      resetToDefault: () => {},
      previewTheme: null,
      setPreviewTheme: () => {},
    };
  }
  return ctx;
}

// ============================================
// CSS VARIABLE INJECTOR
// ============================================

function injectCSSVariables(config: ThemeConfig) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const c = config.colors;

  // Colors
  root.style.setProperty('--theme-primary', c.primary);
  root.style.setProperty('--theme-secondary', c.secondary);
  root.style.setProperty('--theme-accent', c.accent);
  root.style.setProperty('--theme-link', c.link);
  root.style.setProperty('--theme-card-bg', c.cardBg);
  root.style.setProperty('--theme-sidebar-bg', config.dynamicSidebar ? c.sidebarBg : '#0F172A');
  root.style.setProperty('--theme-bg', c.bg);
  root.style.setProperty('--theme-text', c.text);
  root.style.setProperty('--theme-text-secondary', c.textSecondary);
  root.style.setProperty('--theme-border', c.border);
  root.style.setProperty('--theme-hover', c.hover);
  root.style.setProperty('--theme-success', c.success);
  root.style.setProperty('--theme-warning', c.warning);
  root.style.setProperty('--theme-danger', c.danger);

  // Font
  const fontMap: Record<ThemeFont, string> = {
    Inter: "'Inter', sans-serif",
    Poppins: "'Poppins', sans-serif",
    Montserrat: "'Montserrat', sans-serif",
  };
  root.style.setProperty('--theme-font', fontMap[config.font]);

  // Border radius
  root.style.setProperty('--theme-radius', BORDER_RADIUS_MAP[config.borderRadius]);
  root.style.setProperty('--theme-radius-lg', config.borderRadius === 'square' ? '0px' : config.borderRadius === 'semi' ? '12px' : '24px');
  root.style.setProperty('--theme-radius-sm', config.borderRadius === 'square' ? '0px' : config.borderRadius === 'semi' ? '4px' : '8px');

  // Activate the CSS override layer on .panel-root
  const panelRoot = document.querySelector('.panel-root');
  if (panelRoot) {
    panelRoot.setAttribute('data-theme-active', 'true');
    const resolvedMode = config.mode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : config.mode;
    panelRoot.setAttribute('data-theme-mode', resolvedMode);
  }
}

// ============================================
// PROVIDER
// ============================================

interface ThemeProviderProps {
  children: React.ReactNode;
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

export function ThemeProvider({ children, authFetch }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [previewTheme, setPreviewTheme] = useState<ThemeConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const loadedRef = useRef(false);

  // Resolve dark mode preference
  const resolvedMode = theme.mode === 'auto'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme.mode;

  const isDark = resolvedMode === 'dark';

  // Load theme from API or localStorage on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    // Try localStorage first (instant)
    try {
      const stored = localStorage.getItem('rifx_theme_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        setTheme({ ...DEFAULT_THEME, ...parsed });
      }
    } catch {}

    // Then load from server if authFetch is available
    if (authFetch) {
      authFetch('/api/panel/theme')
        .then(res => res.json())
        .then(data => {
          if (data && data.preset) {
            const serverTheme = { ...DEFAULT_THEME, ...data };
            setTheme(serverTheme);
            localStorage.setItem('rifx_theme_config', JSON.stringify(serverTheme));
          }
        })
        .catch(() => {}); // Silent fail — use localStorage version
    }
  }, [authFetch]);

  // Inject CSS variables whenever theme or preview changes
  useEffect(() => {
    injectCSSVariables(previewTheme || theme);
  }, [theme, previewTheme]);

  // Listen for system dark mode changes when mode is 'auto'
  useEffect(() => {
    if (theme.mode !== 'auto' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => injectCSSVariables(previewTheme || theme);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, previewTheme]);

  // Apply a preset by ID
  const applyPreset = useCallback((presetId: string) => {
    const preset = THEME_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setTheme(prev => ({
      ...prev,
      preset: preset.id,
      colors: { ...preset.colors },
      mode: preset.mode,
    }));
  }, []);

  // Save to server and localStorage
  const saveTheme = useCallback(async () => {
    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem('rifx_theme_config', JSON.stringify(theme));

      // Save to server
      if (authFetch) {
        await authFetch('/api/panel/theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(theme),
        });
      }

      // Clear preview
      setPreviewTheme(null);
    } catch (err) {
      console.error('Error saving theme:', err);
    }
    setIsSaving(false);
  }, [theme, authFetch]);

  // Reset to default
  const resetToDefault = useCallback(() => {
    setTheme(DEFAULT_THEME);
    setPreviewTheme(null);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        applyPreset,
        saveTheme,
        isSaving,
        isDark,
        resetToDefault,
        previewTheme,
        setPreviewTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
