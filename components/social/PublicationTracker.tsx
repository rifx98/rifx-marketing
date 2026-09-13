import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface Publication {
  id: string;
  status: 'pending' | 'processing' | 'retry' | 'published' | 'failed' | 'dead';
  last_error?: string;
  requires_reconciliation?: boolean;
  social_account_id: string;
  platform: 'facebook' | 'instagram' | 'youtube' | 'tiktok';
  platform_username: string;
}

interface SocialLog {
  id: string;
  publication_id: string;
  log_level: 'info' | 'warning' | 'error';
  message: string;
  created_at: string;
  platform?: 'facebook' | 'instagram' | 'youtube' | 'tiktok';
}

interface PublicationTrackerProps {
  postId: string;
  onFinished: () => void;
}

const platformStyles: Record<string, {
  name: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBorder: string;
  accentBg: string;
  iconBg: string;
  icon: React.ReactNode;
}> = {
  youtube: {
    name: 'YouTube Shorts',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    badgeBorder: 'border-red-200/80',
    cardBorder: 'border-slate-200/90 hover:border-red-300',
    accentBg: 'bg-red-500',
    iconBg: 'bg-red-600',
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  instagram: {
    name: 'Instagram Reel',
    badgeBg: 'bg-pink-50',
    badgeText: 'text-pink-700',
    badgeBorder: 'border-pink-200/80',
    cardBorder: 'border-slate-200/90 hover:border-pink-300',
    accentBg: 'bg-pink-500',
    iconBg: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]',
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  facebook: {
    name: 'Facebook Reel',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200/80',
    cardBorder: 'border-slate-200/90 hover:border-blue-300',
    accentBg: 'bg-[#1877F2]',
    iconBg: 'bg-[#1877F2]',
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  tiktok: {
    name: 'TikTok',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    badgeBorder: 'border-slate-300',
    cardBorder: 'border-slate-200/90 hover:border-slate-400',
    accentBg: 'bg-slate-900',
    iconBg: 'bg-slate-900',
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
  },
};

export default function PublicationTracker({ postId, onFinished }: PublicationTrackerProps) {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [logs, setLogs] = useState<SocialLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const confettiTriggeredRef = useRef(false);

  // Timer de duración
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let isMounted = true;

    const fetchData = async (showLoading = false) => {
      try {
        if (showLoading) setLoading(true);

        const res = await fetch(`/api/panel/social/tracker?postId=${postId}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to fetch tracker data');
        if (!isMounted) return;

        setPublications(data.publications || []);

        setLogs((prev) => {
          const merged = [...prev];
          (data.logs || []).forEach((newLog: any) => {
            if (!merged.some((existing) => existing.id === newLog.id)) {
              merged.push(newLog);
            }
          });
          return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });

      } catch (err) {
        console.error('Error fetching tracker data:', err);
      } finally {
        if (showLoading && isMounted) setLoading(false);
      }
    };

    if (postId) {
      fetchData(true);

      pollInterval = setInterval(() => {
        setPublications((currentPubs) => {
          const hasActive = currentPubs.length === 0 || currentPubs.some(
            p => p.status === 'pending' || p.status === 'processing' || p.status === 'retry',
          );
          if (hasActive) {
            fetchData(false);
          }
          return currentPubs;
        });
      }, 4000);
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [postId]);

  // Scroll ONLY the internal terminal box, never moving the window or parent page
  useEffect(() => {
    if (terminalContainerRef.current) {
      const el = terminalContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  // Verificar si todas las publicaciones han finalizado
  useEffect(() => {
    if (publications.length > 0) {
      const allFinished = publications.every(
        p => p.status === 'published' || p.status === 'failed' || p.status === 'dead',
      );
      if (allFinished) {
        if (!confettiTriggeredRef.current) {
          confettiTriggeredRef.current = true;
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#10B981', '#6366F1', '#EC4899', '#3B82F6'],
            });
          } catch {
            // ignore
          }
        }
        onFinished();
      }
    }
  }, [publications, onFinished]);

  const isAllFinished = publications.length > 0 && publications.every(
    p => p.status === 'published' || p.status === 'failed' || p.status === 'dead'
  );

  const publishedCount = publications.filter(p => p.status === 'published').length;
  const isAnyProcessing = publications.some(p => p.status === 'processing');

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading && publications.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200/80 p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center space-y-3 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
          <h4 className="text-xs font-bold text-slate-800 tracking-wide uppercase">Iniciando Ingesta Multi-Canal</h4>
          <p className="text-[11px] text-slate-500">Conectando con servidores de transmisión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. HERO TELEMETRY CARD (ADAPTADO AL ESTILO CRM) */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/70 border border-slate-200/80 p-4 sm:p-5 shadow-sm">
        {/* Cabecera superior con estado, ecualizador y cronómetro */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isAllFinished ? 'bg-emerald-500' : 'bg-indigo-600 animate-pulse'}`} />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                  {isAllFinished ? 'Transmisión Completada' : 'Publicación en Curso'}
                </h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isAllFinished
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}>
                  {isAllFinished ? '✓ 100% DISTRIBUIDO' : '● EN VIVO'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {publications.length} canal{publications.length === 1 ? '' : 'es'} seleccionados • {publishedCount}/{publications.length} confirmados
              </p>
            </div>
          </div>

          {/* Equalizer & Timer (Diseño limpio CRM) */}
          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
            {/* Visual Equalizer animado elegante */}
            <div className="flex items-end gap-1 h-3.5 w-10 justify-center">
              {[0.4, 0.85, 0.35, 0.95, 0.6, 0.8, 0.45].map((h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    isAllFinished ? 'bg-emerald-500 h-1' : 'bg-indigo-600'
                  }`}
                  style={{
                    height: isAllFinished ? '4px' : `${Math.max(3, h * 14)}px`,
                    animation: isAllFinished ? 'none' : `bounce 1s infinite ${i * 0.14}s ease-in-out alternate`,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 text-xs font-mono font-bold">
              <span className="material-symbols-outlined text-[14px] text-slate-400">timer</span>
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>
          </div>
        </div>

        {/* 4-Stage Transmission Pipeline (Limpio y armónico con CRM) */}
        <div className="pt-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            {/* Stage 1: Ingesta */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[13px]">check</span>
              </div>
              <span className="text-[11px] font-bold text-slate-800">1. Ingesta R2</span>
              <span className="text-[10px] text-slate-400 font-medium">Verificado</span>
            </div>

            {/* Stage 2: Optimización */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[13px]">check</span>
              </div>
              <span className="text-[11px] font-bold text-slate-800">2. Optimización</span>
              <span className="text-[10px] text-slate-400 font-medium">1080p Short/Reel</span>
            </div>

            {/* Stage 3: Difusión */}
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                isAllFinished
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 animate-pulse'
              }`}>
                <span className="material-symbols-outlined text-[13px]">
                  {isAllFinished ? 'check' : 'satellite_alt'}
                </span>
              </div>
              <span className={`text-[11px] font-bold ${isAllFinished ? 'text-slate-800' : 'text-indigo-600'}`}>
                3. Difusión
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {isAllFinished ? 'Completado' : 'Transmitiendo'}
              </span>
            </div>

            {/* Stage 4: Confirmación */}
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                isAllFinished
                  ? 'bg-emerald-600 text-white font-black shadow-sm shadow-emerald-600/20'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}>
                <span className="material-symbols-outlined text-[13px]">
                  {isAllFinished ? 'done_all' : 'cleaning_services'}
                </span>
              </div>
              <span className={`text-[11px] font-bold ${isAllFinished ? 'text-slate-800' : 'text-slate-400'}`}>
                4. Confirmación
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {isAllFinished ? '0 MB Utilizados' : 'Pendiente'}
              </span>
            </div>
          </div>

          {/* Barra conectora limpia */}
          <div className="relative mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isAllFinished
                  ? 'w-full bg-emerald-500'
                  : isAnyProcessing
                    ? 'w-3/4 bg-gradient-to-r from-indigo-500 to-indigo-600 animate-pulse'
                    : 'w-1/2 bg-indigo-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 2. CELEBRATION BANNER AL COMPLETAR (ESTILO CRM) */}
      {isAllFinished && (
        <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/80 p-3.5 shadow-2xs flex items-center gap-3 animate-fadeIn">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              ¡Publicación completada en todos los canales!
            </h5>
            <p className="text-[11px] text-emerald-700/90 mt-0.5 font-medium">
              🛡️ Auto-limpieza ejecutada: El video temporal fue eliminado de Cloudflare R2 y tu cuota está en 0 MB.
            </p>
          </div>
        </div>
      )}

      {/* 3. CANALES DE ENVÍO ACTIVOS (DISEÑO BLANCO / CRM) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-indigo-600">hub</span>
            Canales de Emisión Activos
          </span>
          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/60">
            {publications.length} {publications.length === 1 ? 'Cuenta' : 'Cuentas'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {publications.map((pub) => {
            const platform = pub.platform || 'facebook';
            const style = platformStyles[platform] || platformStyles.facebook;
            const isProcessing = pub.status === 'processing';
            const isPublished = pub.status === 'published';
            const isFailed = pub.status === 'failed' || pub.status === 'dead';

            return (
              <div
                key={pub.id}
                className={`relative rounded-xl p-3.5 bg-white border ${style.cardBorder} shadow-2xs transition-all duration-200`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg ${style.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      {style.icon}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 truncate block">
                        {pub.platform_username || 'Canal'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        {style.name}
                      </span>
                    </div>
                  </div>

                  {/* Estado badge armónico */}
                  <div className="flex-shrink-0">
                    {isPublished ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="material-symbols-outlined text-[12px]">check_circle</span>
                        Publicado
                      </span>
                    ) : isProcessing ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                        Transmitiendo...
                      </span>
                    ) : isFailed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                        <span className="material-symbols-outlined text-[12px]">error</span>
                        Error
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        En cola
                      </span>
                    )}
                  </div>
                </div>

                {/* Barra de progreso de transmisión */}
                {isProcessing && (
                  <div className="mt-2.5 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full animate-pulse w-3/4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. CONSOLA DE TELEMETRÍA (COMPACTA, ESTILO CRM, SIN JUMPS DE SCROLL) */}
      <div className="rounded-xl border border-slate-200/90 bg-slate-900 text-slate-200 shadow-sm overflow-hidden">
        {/* Barra superior de terminal estilo ventana limpia */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950/70 border-b border-slate-800 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-slate-400 font-mono font-medium ml-2">omnipublish-worker.log</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          </div>
        </div>

        {/* Ventana de logs acotada y contenida (NUNCA hace scroll en window ni parent) */}
        <div
          ref={terminalContainerRef}
          className="p-3.5 h-44 overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
        >
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-4">
              <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-[11px] text-slate-400 font-sans">
                Esperando que inicie el procesamiento del video en los canales seleccionados...
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const dateStr = new Date(log.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const platform = log.platform ? log.platform.toLowerCase() : 'rifx';
              let badgeClass = 'text-indigo-300 bg-indigo-950/80 border-indigo-800';
              if (platform === 'youtube') badgeClass = 'text-red-300 bg-red-950/80 border-red-800';
              if (platform === 'instagram') badgeClass = 'text-pink-300 bg-pink-950/80 border-pink-800';
              if (platform === 'facebook') badgeClass = 'text-blue-300 bg-blue-950/80 border-blue-800';
              if (platform === 'tiktok') badgeClass = 'text-cyan-300 bg-cyan-950/80 border-cyan-800';

              let msgClass = 'text-slate-300';
              if (log.log_level === 'error') msgClass = 'text-red-400 font-bold';
              if (log.log_level === 'warning') msgClass = 'text-amber-300';
              if (log.message.includes('Publicación exitosa') || log.message.includes('Almacenamiento liberado')) {
                msgClass = 'text-emerald-300 font-bold';
              }

              return (
                <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
                  <span className="text-slate-500 flex-shrink-0 select-none">[{dateStr}]</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold flex-shrink-0 uppercase ${badgeClass}`}>
                    {log.platform || 'RIFX'}
                  </span>
                  <span className={msgClass}>{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
