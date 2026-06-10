'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useTheme,
  THEME_PRESETS,
  BORDER_RADIUS_MAP,
  DEFAULT_THEME,
  ThemeConfig,
  ThemeFont,
  ThemeBorderRadius,
  ThemeMode,
} from '../contexts/ThemeContext';

// ============================================
// REUSABLE: Color Picker Input
// ============================================

function ColorPicker({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: string;
}) {
  return (
    <div className="flex items-center gap-3 group">
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg cursor-pointer border-2 border-slate-200 group-hover:border-blue-400 transition-colors"
          style={{ padding: '2px' }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          {icon && <span className="material-symbols-outlined text-sm text-slate-400">{icon}</span>}
          {label}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v);
          }}
          className="text-[10px] font-mono text-slate-400 bg-transparent border-none outline-none p-0 w-20 uppercase"
        />
      </div>
    </div>
  );
}

// ============================================
// MINI PREVIEW COMPONENT
// ============================================

function MiniPreview({ config }: { config: ThemeConfig }) {
  const c = config.colors;
  const r = BORDER_RADIUS_MAP[config.borderRadius];
  const fontMap: Record<ThemeFont, string> = {
    Inter: "'Inter', sans-serif",
    Poppins: "'Poppins', sans-serif",
    Montserrat: "'Montserrat', sans-serif",
  };

  return (
    <div
      className="w-full overflow-hidden border border-slate-200 shadow-lg"
      style={{ borderRadius: '12px', fontFamily: fontMap[config.font] }}
    >
      {/* Preview Header */}
      <div className="flex h-[200px]">
        {/* Sidebar */}
        <div
          className="w-[52px] flex flex-col items-center py-3 gap-2"
          style={{ backgroundColor: config.dynamicSidebar ? c.sidebarBg : '#0F172A' }}
        >
          {['dashboard', 'chat', 'settings', 'person'].map((icon, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: i === 0 ? c.primary + '30' : 'transparent',
              }}
            >
              <span
                className="material-symbols-outlined text-[14px]"
                style={{
                  color: i === 0 ? c.primary : '#94A3B8',
                  fontVariationSettings: i === 0 ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {icon}
              </span>
            </div>
          ))}
        </div>

        {/* Main Area */}
        <div className="flex-1 p-3 space-y-2" style={{ backgroundColor: c.bg }}>
          {/* Top bar */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-bold" style={{ color: c.text }}>
              Panel de Control
            </div>
            <div
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: c.primary }}
            />
          </div>

          {/* Cards row */}
          <div className="grid grid-cols-3 gap-1.5">
            {['Ventas', 'Clientes', 'Mensajes'].map((label, i) => (
              <div
                key={i}
                className="p-1.5 space-y-0.5"
                style={{
                  backgroundColor: c.cardBg,
                  borderRadius: r,
                  border: `1px solid ${c.border}`,
                }}
              >
                <div className="text-[7px] font-medium" style={{ color: c.textSecondary }}>
                  {label}
                </div>
                <div className="text-[10px] font-bold" style={{ color: c.text }}>
                  {i === 0 ? '$4,200' : i === 1 ? '186' : '2,431'}
                </div>
              </div>
            ))}
          </div>

          {/* Button row */}
          <div className="flex gap-1.5 pt-1">
            <div
              className="px-2 py-1 text-[7px] font-bold text-white"
              style={{ backgroundColor: c.accent, borderRadius: BORDER_RADIUS_MAP[config.borderRadius === 'square' ? 'square' : 'semi'] }}
            >
              Nuevo
            </div>
            <div
              className="px-2 py-1 text-[7px] font-semibold"
              style={{
                color: c.link,
                backgroundColor: c.hover,
                borderRadius: BORDER_RADIUS_MAP[config.borderRadius === 'square' ? 'square' : 'semi'],
              }}
            >
              Ver todo →
            </div>
          </div>

          {/* Table mock */}
          <div
            className="mt-1 p-1.5"
            style={{
              backgroundColor: c.cardBg,
              borderRadius: r,
              border: `1px solid ${c.border}`,
            }}
          >
            {[1, 2, 3].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-0.5"
                style={{ borderBottom: i < 2 ? `1px solid ${c.border}` : 'none' }}
              >
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.primary + '20' }} />
                  <div className="text-[6px]" style={{ color: c.text }}>
                    {['Ana García', 'Carlos M.', 'Empresa X'][i]}
                  </div>
                </div>
                <div
                  className="text-[6px] font-bold px-1 py-0.5 rounded"
                  style={{
                    color: c.success,
                    backgroundColor: c.success + '15',
                  }}
                >
                  Activo
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ThemeSettings({
  language,
  onToast,
}: {
  language: string;
  onToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { theme, setTheme, applyPreset, saveTheme, isSaving, resetToDefault, previewTheme, setPreviewTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<'presets' | 'colors' | 'typography' | 'advanced'>('presets');
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  const initialRef = React.useRef<string>(JSON.stringify(theme));
  useEffect(() => {
    setHasChanges(JSON.stringify(theme) !== initialRef.current);
  }, [theme]);

  // Live preview
  useEffect(() => {
    setPreviewTheme(theme);
    return () => setPreviewTheme(null);
  }, [theme, setPreviewTheme]);

  const updateColor = useCallback(
    (key: keyof typeof theme.colors, value: string) => {
      setTheme((prev) => ({
        ...prev,
        preset: 'custom',
        colors: { ...prev.colors, [key]: value },
      }));
    },
    [setTheme]
  );

  const handleSave = async () => {
    await saveTheme();
    initialRef.current = JSON.stringify(theme);
    setHasChanges(false);
    onToast(
      language === 'en' ? '✅ Theme saved successfully!' : '✅ ¡Tema guardado exitosamente!',
      'success'
    );
  };

  const handleReset = () => {
    resetToDefault();
    onToast(
      language === 'en' ? '↩️ Theme reset to default' : '↩️ Tema restablecido',
      'success'
    );
  };

  const es = language !== 'en';

  const sections = [
    { key: 'presets' as const, label: es ? 'Plantillas' : 'Presets', icon: 'palette' },
    { key: 'colors' as const, label: es ? 'Colores' : 'Colors', icon: 'color_lens' },
    { key: 'typography' as const, label: es ? 'Tipografía' : 'Typography', icon: 'text_fields' },
    { key: 'advanced' as const, label: es ? 'Avanzado' : 'Advanced', icon: 'tune' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-blue-600" style={{ fontVariationSettings: "'FILL' 1" }}>
              palette
            </span>
            {es ? 'Personalización de Tema' : 'Theme Customization'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {es
              ? 'Personaliza la apariencia de tu panel de control'
              : 'Customize the look and feel of your dashboard'}
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              {es ? 'Restablecer' : 'Reset'}
            </motion.button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" opacity="0.75" />
                </svg>
                {es ? 'Guardando...' : 'Saving...'}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">save</span>
                {es ? 'Guardar Tema' : 'Save Theme'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeSection === s.key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: activeSection === s.key ? "'FILL' 1" : "'FILL' 0" }}
            >
              {s.icon}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content + Preview Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-3 space-y-4">
          <AnimatePresence mode="wait">
            {/* === PRESETS === */}
            {activeSection === 'presets' && (
              <motion.div
                key="presets"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                <h3 className="text-sm font-bold text-slate-700">
                  {es ? 'Temas Predeterminados' : 'Preset Themes'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset.id)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                        theme.preset === preset.id
                          ? 'border-blue-500 bg-blue-50/50 shadow-blue-100'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {theme.preset === preset.id && (
                        <div className="absolute top-2 right-2">
                          <span className="material-symbols-outlined text-blue-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{preset.icon}</span>
                        <span className="text-sm font-bold text-slate-800">{preset.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-3">{preset.description}</p>
                      {/* Color swatches */}
                      <div className="flex gap-1.5">
                        {[preset.colors.primary, preset.colors.bg, preset.colors.sidebarBg, preset.colors.cardBg, preset.colors.text].map(
                          (color, i) => (
                            <div
                              key={i}
                              className="w-5 h-5 rounded-full border border-slate-200 shadow-inner"
                              style={{ backgroundColor: color }}
                            />
                          )
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* === COLORS === */}
            {activeSection === 'colors' && (
              <motion.div
                key="colors"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-bold text-slate-700">
                  {es ? 'Colores Personalizados' : 'Custom Colors'}
                </h3>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ColorPicker
                      label={es ? 'Color Principal' : 'Primary'}
                      value={theme.colors.primary}
                      onChange={(v) => updateColor('primary', v)}
                      icon="star"
                    />
                    <ColorPicker
                      label={es ? 'Color Secundario' : 'Secondary'}
                      value={theme.colors.secondary}
                      onChange={(v) => updateColor('secondary', v)}
                      icon="auto_awesome"
                    />
                    <ColorPicker
                      label={es ? 'Botones' : 'Buttons'}
                      value={theme.colors.accent}
                      onChange={(v) => updateColor('accent', v)}
                      icon="smart_button"
                    />
                    <ColorPicker
                      label={es ? 'Enlaces' : 'Links'}
                      value={theme.colors.link}
                      onChange={(v) => updateColor('link', v)}
                      icon="link"
                    />
                    <ColorPicker
                      label={es ? 'Fondo de Tarjetas' : 'Card Background'}
                      value={theme.colors.cardBg}
                      onChange={(v) => updateColor('cardBg', v)}
                      icon="dashboard"
                    />
                    <ColorPicker
                      label={es ? 'Sidebar' : 'Sidebar'}
                      value={theme.colors.sidebarBg}
                      onChange={(v) => updateColor('sidebarBg', v)}
                      icon="side_navigation"
                    />
                    <ColorPicker
                      label={es ? 'Fondo General' : 'Background'}
                      value={theme.colors.bg}
                      onChange={(v) => updateColor('bg', v)}
                      icon="format_color_fill"
                    />
                    <ColorPicker
                      label={es ? 'Texto' : 'Text'}
                      value={theme.colors.text}
                      onChange={(v) => updateColor('text', v)}
                      icon="format_color_text"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* === TYPOGRAPHY === */}
            {activeSection === 'typography' && (
              <motion.div
                key="typography"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-bold text-slate-700">
                  {es ? 'Tipografía y Bordes' : 'Typography & Borders'}
                </h3>

                {/* Font selector */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-400">text_fields</span>
                    {es ? 'Fuente del Panel' : 'Panel Font'}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Inter', 'Poppins', 'Montserrat'] as ThemeFont[]).map((font) => (
                      <button
                        key={font}
                        onClick={() => setTheme((p) => ({ ...p, font, preset: 'custom' }))}
                        className={`py-3 px-3 rounded-xl border-2 text-center transition-all ${
                          theme.font === font
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div
                          className="text-base font-bold text-slate-800"
                          style={{ fontFamily: `'${font}', sans-serif` }}
                        >
                          Aa
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500 mt-1">{font}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Border Radius */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-400">rounded_corner</span>
                    {es ? 'Bordes' : 'Border Radius'}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: 'square' as const, label: es ? 'Cuadrado' : 'Square', radius: '0px' },
                      { key: 'semi' as const, label: es ? 'Semi Redondeado' : 'Semi Rounded', radius: '8px' },
                      { key: 'rounded' as const, label: es ? 'Redondeado' : 'Rounded', radius: '16px' },
                    ]).map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setTheme((p) => ({ ...p, borderRadius: opt.key, preset: 'custom' }))}
                        className={`py-3 px-3 border-2 text-center transition-all ${
                          theme.borderRadius === opt.key
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                        style={{ borderRadius: opt.radius }}
                      >
                        <div
                          className="w-8 h-8 mx-auto bg-blue-500 mb-1.5"
                          style={{ borderRadius: opt.radius }}
                        />
                        <div className="text-[10px] font-semibold text-slate-600">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* === ADVANCED === */}
            {activeSection === 'advanced' && (
              <motion.div
                key="advanced"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-bold text-slate-700">
                  {es ? 'Opciones Avanzadas' : 'Advanced Options'}
                </h3>

                {/* Dark Mode */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-400">dark_mode</span>
                    {es ? 'Modo de Apariencia' : 'Appearance Mode'}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: 'light' as const, label: es ? 'Claro' : 'Light', icon: 'light_mode' },
                      { key: 'dark' as const, label: es ? 'Oscuro' : 'Dark', icon: 'dark_mode' },
                      { key: 'auto' as const, label: 'Auto', icon: 'contrast' },
                    ]).map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setTheme((p) => ({ ...p, mode: opt.key }))}
                        className={`py-3 px-3 rounded-xl border-2 text-center transition-all flex flex-col items-center gap-1.5 ${
                          theme.mode === opt.key
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-xl"
                          style={{
                            color: theme.mode === opt.key ? '#2563EB' : '#94A3B8',
                            fontVariationSettings: "'FILL' 1",
                          }}
                        >
                          {opt.icon}
                        </span>
                        <div className="text-[10px] font-semibold text-slate-600">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                  {theme.mode === 'auto' && (
                    <p className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded-lg">
                      💡 {es
                        ? 'El tema se ajustará automáticamente según las preferencias de tu sistema operativo.'
                        : 'Theme will automatically adjust based on your OS preferences.'}
                    </p>
                  )}
                </div>

                {/* Dynamic Sidebar Toggle */}
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-slate-400">side_navigation</span>
                        {es ? 'Sidebar Dinámico' : 'Dynamic Sidebar'}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {es
                          ? 'El sidebar cambia de color con el tema seleccionado'
                          : 'Sidebar color changes with the selected theme'}
                      </p>
                    </div>
                    <button
                      onClick={() => setTheme((p) => ({ ...p, dynamicSidebar: !p.dynamicSidebar }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        theme.dynamicSidebar ? 'bg-blue-500' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          theme.dynamicSidebar ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Current Theme Info */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {es ? 'Configuración Actual' : 'Current Config'}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                    <div>
                      <span className="text-slate-400">{es ? 'Preset:' : 'Preset:'}</span>{' '}
                      <span className="font-semibold">{theme.preset}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{es ? 'Fuente:' : 'Font:'}</span>{' '}
                      <span className="font-semibold">{theme.font}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{es ? 'Bordes:' : 'Radius:'}</span>{' '}
                      <span className="font-semibold">{BORDER_RADIUS_MAP[theme.borderRadius]}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{es ? 'Modo:' : 'Mode:'}</span>{' '}
                      <span className="font-semibold">{theme.mode}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Sidebar:</span>{' '}
                      <span className="font-semibold">{theme.dynamicSidebar ? 'Dinámico' : 'Fijo'}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-2 space-y-3">
          <div className="sticky top-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">visibility</span>
              {es ? 'Vista Previa en Vivo' : 'Live Preview'}
              <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-green-100 text-green-700">
                ● LIVE
              </span>
            </div>
            <MiniPreview config={theme} />
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              {es
                ? 'Los cambios se aplican instantáneamente al panel actual'
                : 'Changes apply instantly to the current panel'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
