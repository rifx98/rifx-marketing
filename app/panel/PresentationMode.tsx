'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

// ─── Slide definitions ────────────────────────────────────────────────────────
interface Slide {
  tab: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: string;
  accent: string; // tailwind color class for the accent glow
  duration: number; // ms to show this slide
}

const SLIDES: Slide[] = [
  {
    tab: 'dashboard',
    eyebrow: 'Vista General',
    title: 'Panel\nInteligente',
    subtitle: 'Métricas en tiempo real, ventas del día y alertas del sistema en un solo lugar.',
    icon: 'dashboard',
    accent: '#6366f1',
    duration: 5000,
  },
  {
    tab: 'crm',
    eyebrow: 'CRM & Leads',
    title: 'Gestión de\nClientes con IA',
    subtitle: 'Kanban drag & drop con lead scoring automático. Identifica quién está listo para comprar.',
    icon: 'group',
    accent: '#f27121',
    duration: 5000,
  },
  {
    tab: 'conversations',
    eyebrow: 'WhatsApp IA',
    title: 'Conversaciones\nAutomatizadas',
    subtitle: 'Tu bot responde, clasifica y cierra ventas 24/7 — sin intervención humana.',
    icon: 'sms',
    accent: '#22c55e',
    duration: 5000,
  },
  {
    tab: 'playground',
    eyebrow: 'Playground IA',
    title: 'Configura tu\nAsistente de IA',
    subtitle: 'Personaliza tono, modelo, base de conocimiento y handoff humano desde un editor visual.',
    icon: 'smart_toy',
    accent: '#a855f7',
    duration: 5000,
  },
  {
    tab: 'campaigns',
    eyebrow: 'Publicidad Digital',
    title: 'Campañas\nde Alto Impacto',
    subtitle: 'Crea y lanza campañas en Meta y Google con copies generados por IA y segmentación geográfica.',
    icon: 'campaign',
    accent: '#3b82f6',
    duration: 5000,
  },
  {
    tab: 'banners',
    eyebrow: 'Diseño Creativo',
    title: 'Generador\nde Pancartas',
    subtitle: 'Diseña creativos publicitarios profesionales sin salir del panel.',
    icon: 'palette',
    accent: '#ec4899',
    duration: 5000,
  },
  {
    tab: 'social',
    eyebrow: 'OmniPublish',
    title: 'Publica en Todas\nlas Plataformas',
    subtitle: 'Sube un video y publícalo simultáneamente en TikTok, Instagram, Facebook y YouTube.',
    icon: 'rocket_launch',
    accent: '#f97316',
    duration: 5000,
  },
  {
    tab: 'appointments',
    eyebrow: 'Citas y Reservas',
    title: 'Agenda\nInteligente',
    subtitle: 'Sistema de citas integrado con Google Calendar. Tu bot agenda, recuerda y reagenda automáticamente.',
    icon: 'calendar_month',
    accent: '#14b8a6',
    duration: 5000,
  },
  {
    tab: 'analytics',
    eyebrow: 'Análisis',
    title: 'Datos que\nImpulsan Decisiones',
    subtitle: 'Visualiza el embudo de conversión, tasa de respuesta del bot y ROI de cada campaña.',
    icon: 'monitoring',
    accent: '#eab308',
    duration: 5000,
  },
  {
    tab: 'pricing',
    eyebrow: 'Catálogo',
    title: 'Gestión de\nPrecios y Productos',
    subtitle: 'Administra tu catálogo de precios y servicios que el bot menciona automáticamente.',
    icon: 'sell',
    accent: '#f27121',
    duration: 5000,
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface PresentationModeProps {
  isActive: boolean;
  onClose: () => void;
  onTabChange: (tab: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PresentationMode({ isActive, onClose, onTabChange }: PresentationModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'slide' | 'outro'>('intro');
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStart = useRef(0);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
  }, []);

  const goToSlide = useCallback((index: number) => {
    clearTimers();
    setProgress(0);
    setCurrentIndex(index);
    onTabChange(SLIDES[index].tab);
    setPhase('slide');
    progressStart.current = Date.now();
  }, [clearTimers, onTabChange]);

  const advance = useCallback(() => {
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next >= SLIDES.length) {
        // End of presentation
        setPhase('outro');
        return prev;
      }
      onTabChange(SLIDES[next].tab);
      progressStart.current = Date.now();
      setProgress(0);
      return next;
    });
  }, [onTabChange]);

  // Start/stop presentation
  useEffect(() => {
    if (isActive) {
      setCurrentIndex(0);
      setProgress(0);
      setPhase('intro');
      setIsVisible(false);
      // Fade in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      // Show intro for 2.5s then start slides
      timerRef.current = setTimeout(() => {
        goToSlide(0);
      }, 2500);
    } else {
      clearTimers();
      setIsVisible(false);
      setPhase('intro');
      setCurrentIndex(0);
      setProgress(0);
    }
    return clearTimers;
  }, [isActive, goToSlide, clearTimers]);

  // Progress bar & auto-advance
  useEffect(() => {
    if (phase !== 'slide' || isPaused) {
      if (progressRef.current) clearInterval(progressRef.current);
      return;
    }

    const slide = SLIDES[currentIndex];
    progressStart.current = Date.now();

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - progressStart.current;
      const pct = Math.min((elapsed / slide.duration) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        if (progressRef.current) clearInterval(progressRef.current);
        advance();
      }
    }, 50);

    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [phase, currentIndex, isPaused, advance]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') {
        const prev = Math.max(0, currentIndex - 1);
        goToSlide(prev);
      }
      if (e.key === ' ') setIsPaused(p => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, advance, currentIndex, goToSlide]);

  if (!isActive) return null;

  const slide = SLIDES[currentIndex];

  const overlay = (
    <div
      className="fixed inset-0 z-[99999] flex flex-col pointer-events-auto"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.6s ease',
      }}
    >
      {/* ── Background ── */}
      <div
        className="absolute inset-0"
        style={{
          background: phase === 'intro' || phase === 'outro'
            ? 'linear-gradient(135deg, #020510 0%, #0b1229 100%)'
            : `radial-gradient(ellipse 60% 60% at 65% 50%, ${slide.accent}18 0%, #020510 70%)`,
          transition: 'background 1s ease',
        }}
      />

      {/* ── Grid texture overlay ── */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* ── INTRO SCREEN ── */}
      {phase === 'intro' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 select-none">
          {/* Logo glow */}
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, #f27121, #ff9a56)',
              boxShadow: '0 0 80px rgba(242,113,33,0.5)',
            }}
          >
            <span className="material-symbols-outlined text-5xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
              psychology
            </span>
          </div>

          <div className="text-center">
            <p
              className="text-[#f27121] font-bold tracking-[0.4em] uppercase text-sm mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Rifx Marketing
            </p>
            <h1
              className="text-white font-black text-6xl md:text-8xl leading-none tracking-tighter"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Panel de<br />
              <span style={{ color: '#f27121' }}>Control</span>
            </h1>
            <p className="text-white/40 mt-6 text-lg" style={{ fontFamily: "'Inter', sans-serif" }}>
              Tour completo de funcionalidades
            </p>
          </div>

          {/* Loading dots */}
          <div className="flex gap-2 mt-8">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-white/30"
                style={{
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  backgroundColor: '#f27121',
                  opacity: 0.6,
                }}
              />
            ))}
          </div>

          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 0.3; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1.2); }
            }
          `}</style>
        </div>
      )}

      {/* ── OUTRO SCREEN ── */}
      {phase === 'outro' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 select-none">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, #f27121, #ff9a56)',
              boxShadow: '0 0 60px rgba(242,113,33,0.4)',
            }}
          >
            <span className="material-symbols-outlined text-4xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
          </div>
          <h2
            className="text-white font-black text-5xl md:text-6xl text-center leading-tight tracking-tighter"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Todo en un<br /><span style={{ color: '#f27121' }}>Solo Panel</span>
          </h2>
          <p className="text-white/50 text-lg text-center max-w-md" style={{ fontFamily: "'Inter', sans-serif" }}>
            WhatsApp IA · CRM · Campañas · OmniPublish · Citas · Analytics
          </p>
          <button
            onClick={onClose}
            className="mt-8 px-10 py-4 rounded-2xl font-bold text-white text-base tracking-widest uppercase transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #f27121, #ff9a56)',
              boxShadow: '0 0 40px rgba(242,113,33,0.35)',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Explorar el Panel →
          </button>
        </div>
      )}

      {/* ── SLIDE ── */}
      {phase === 'slide' && (
        <>
          {/* Left — cinematic text block */}
          <div
            className="absolute left-0 top-0 bottom-0 flex flex-col justify-center px-16 md:px-24"
            style={{ width: '46%' }}
          >
            {/* Eyebrow */}
            <div
              className="flex items-center gap-3 mb-6"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: slide.accent, boxShadow: `0 0 20px ${slide.accent}60` }}
              >
                <span className="material-symbols-outlined text-base text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {slide.icon}
                </span>
              </div>
              <span
                className="text-xs font-bold tracking-[0.35em] uppercase"
                style={{ color: slide.accent, fontFamily: "'Inter', sans-serif" }}
              >
                {slide.eyebrow}
              </span>
            </div>

            {/* Big title */}
            <h2
              className="font-black leading-[0.9] tracking-tighter text-white mb-8"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 'clamp(3rem, 6vw, 7rem)',
                whiteSpace: 'pre-line',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s',
              }}
            >
              {slide.title}
            </h2>

            {/* Subtitle */}
            <p
              className="text-white/60 leading-relaxed max-w-md"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 'clamp(1rem, 1.4vw, 1.25rem)',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.35s',
              }}
            >
              {slide.subtitle}
            </p>

            {/* Slide counter */}
            <div
              className="flex items-center gap-3 mt-12"
              style={{
                opacity: isVisible ? 0.5 : 0,
                transition: 'opacity 0.6s ease 0.5s',
              }}
            >
              <span className="text-white/40 text-xs font-mono">
                {String(currentIndex + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
              </span>
              <div className="flex gap-1.5">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    className="transition-all duration-300 rounded-full"
                    style={{
                      width: i === currentIndex ? '20px' : '6px',
                      height: '6px',
                      background: i === currentIndex ? slide.accent : 'rgba(255,255,255,0.2)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right — panel preview frame */}
          <div
            className="absolute right-0 top-0 bottom-0 flex items-center justify-center pr-8"
            style={{
              width: '56%',
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(40px) scale(0.97)',
              transition: 'all 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s',
            }}
          >
            <div
              className="relative w-full h-full flex items-center"
              style={{ maxHeight: '90vh' }}
            >
              {/* Glow behind frame */}
              <div
                className="absolute inset-8 rounded-3xl blur-3xl"
                style={{
                  background: `radial-gradient(circle, ${slide.accent}30 0%, transparent 70%)`,
                }}
              />

              {/* Browser chrome frame */}
              <div
                className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  border: `1px solid rgba(255,255,255,0.08)`,
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: `0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 40px rgba(255,255,255,0.02)`,
                }}
              >
                {/* Browser top bar */}
                <div
                  className="flex items-center gap-2 px-4 py-3"
                  style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <div
                    className="flex-1 mx-4 px-3 py-1 rounded text-center text-xs text-white/20"
                    style={{ background: 'rgba(255,255,255,0.04)', fontFamily: "'Inter', sans-serif" }}
                  >
                    rifxmarketing.com/panel
                  </div>
                </div>

                {/* iFrame showing the real panel */}
                <iframe
                  src={`/panel?tab=${slide.tab}&demo=1`}
                  className="w-full"
                  style={{
                    height: 'calc(80vh - 44px)',
                    border: 'none',
                    pointerEvents: 'none',
                    transform: 'scale(0.75)',
                    transformOrigin: 'top left',
                    width: '133.33%',
                    height: 'calc(106.67vh - 58px)',
                  }}
                  title={slide.title}
                />
              </div>

              {/* Feature callout pill */}
              <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-bold"
                style={{
                  background: slide.accent,
                  boxShadow: `0 0 30px ${slide.accent}70`,
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: '0.1em',
                  opacity: isVisible ? 1 : 0,
                  transition: 'opacity 0.6s ease 0.6s',
                }}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {slide.icon}
                </span>
                {slide.eyebrow.toUpperCase()}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Top Bar Controls ── */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5 z-10"
        style={{
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.5s ease 0.3s',
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: '#f27121' }}
          >
            <span className="material-symbols-outlined text-sm text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
              psychology
            </span>
          </div>
          <span className="text-white/60 text-xs font-bold tracking-widest uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Rifx Panel
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {phase === 'slide' && (
            <>
              <button
                onClick={() => setIsPaused(p => !p)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                title={isPaused ? 'Continuar' : 'Pausar'}
              >
                <span className="material-symbols-outlined text-base">
                  {isPaused ? 'play_arrow' : 'pause'}
                </span>
              </button>
              <button
                onClick={() => goToSlide(Math.max(0, currentIndex - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
              </button>
              <button
                onClick={advance}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
              >
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Cerrar (Esc)"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      {phase === 'slide' && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="h-full transition-none"
            style={{
              width: `${progress}%`,
              background: slide.accent,
              boxShadow: `0 0 8px ${slide.accent}`,
            }}
          />
        </div>
      )}

      {/* ── Keyboard hint ── */}
      {phase === 'slide' && (
        <div
          className="absolute bottom-6 left-8 text-white/20 text-[10px] flex items-center gap-4"
          style={{
            fontFamily: "'Inter', sans-serif",
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 0.5s ease 1s',
          }}
        >
          <span>← → Navegar</span>
          <span>Espacio Pausar</span>
          <span>Esc Cerrar</span>
        </div>
      )}
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(overlay, document.body);
}
