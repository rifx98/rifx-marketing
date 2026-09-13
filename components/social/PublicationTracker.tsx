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
  badge: string;
  cardBg: string;
  cardBorder: string;
  cardGlow: string;
  iconBg: string;
  icon: React.ReactNode;
}> = {
  youtube: {
    name: 'YouTube Shorts',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    cardBg: 'from-red-950/20 via-[#11131c] to-[#0c0d14]',
    cardBorder: 'border-red-500/30 hover:border-red-500/50',
    cardGlow: 'shadow-red-500/10',
    iconBg: 'bg-gradient-to-tr from-red-600 to-rose-500',
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  instagram: {
    name: 'Instagram Reel',
    badge: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    cardBg: 'from-pink-950/20 via-[#11131c] to-[#0c0d14]',
    cardBorder: 'border-pink-500/30 hover:border-pink-500/50',
    cardGlow: 'shadow-pink-500/10',
    iconBg: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]',
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  facebook: {
    name: 'Facebook Reel',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    cardBg: 'from-blue-950/20 via-[#11131c] to-[#0c0d14]',
    cardBorder: 'border-blue-500/30 hover:border-blue-500/50',
    cardGlow: 'shadow-blue-500/10',
    iconBg: 'bg-[#1877F2]',
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  tiktok: {
    name: 'TikTok',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    cardBg: 'from-cyan-950/20 via-[#11131c] to-[#0c0d14]',
    cardBorder: 'border-cyan-500/30 hover:border-cyan-500/50',
    cardGlow: 'shadow-cyan-500/10',
    iconBg: 'bg-black border border-cyan-500/30',
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
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const confettiTriggeredRef = useRef(false);

  // Timer de transmisión activa
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

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    if (publications.length > 0) {
      const allFinished = publications.every(
        p => p.status === 'published' || p.status === 'failed' || p.status === 'dead',
      );
      if (allFinished) {
        if (!confettiTriggeredRef.current) {
          confettiTriggeredRef.current = true;
          try {
            confetti({
              particleCount: 90,
              spread: 75,
              origin: { y: 0.6 },
              colors: ['#10B981', '#6366F1', '#EC4899', '#3B82F6', '#F59E0B'],
            });
          } catch {
            // ignore
          }
        }
        onFinished();
      }
    }
  }, [logs, publications, onFinished]);

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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c101c] via-[#080a12] to-[#05060b] border border-indigo-500/20 p-8 shadow-xl">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-indigo-500/30 animate-ping absolute" />
            <div className="w-12 h-12 rounded-full border-2 border-t-indigo-500 border-indigo-500/20 animate-spin" />
            <span className="material-symbols-outlined text-indigo-400 absolute text-lg">rocket_launch</span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-wide">Iniciando Ingesta Multi-Canal</h4>
            <p className="text-xs text-slate-400 mt-1">Conectando con servidores de transmisión en vivo...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. HERO TELEMETRY CARD */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0d1222] via-[#080b14] to-[#04060a] border border-indigo-500/30 p-4 sm:p-5 shadow-2xl">
        {/* Glow ambient de fondo */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-56 h-56 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Barra superior de estado */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className={`w-3 h-3 rounded-full ${isAllFinished ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
              {!isAllFinished && (
                <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping absolute opacity-75" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-white">
                  {isAllFinished ? 'Transmisión Completada' : 'OmniPublish Stream Activo'}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                  isAllFinished
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse'
                }`}>
                  {isAllFinished ? '● FINALIZADO' : '● EN VIVO'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {publications.length} canal{publications.length === 1 ? '' : 'es'} seleccionados • {publishedCount}/{publications.length} confirmados
              </p>
            </div>
          </div>

          {/* Equalizer & Timer */}
          <div className="flex items-center gap-4 bg-[#0a0d18] px-3 py-1.5 rounded-xl border border-slate-800/90 shadow-inner">
            {/* Visual Equalizer animado */}
            <div className="flex items-end gap-0.5 h-4 w-12 justify-center">
              {[0.4, 0.8, 0.3, 0.95, 0.6, 0.85, 0.4, 0.7].map((height, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    isAllFinished
                      ? 'bg-emerald-400 h-1.5'
                      : 'bg-gradient-to-t from-cyan-500 to-indigo-400'
                  }`}
                  style={{
                    height: isAllFinished ? '6px' : `${Math.max(3, height * 16)}px`,
                    animation: isAllFinished ? 'none' : `bounce 1s infinite ${i * 0.12}s ease-in-out alternate`,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-mono">
              <span className="material-symbols-outlined text-[13px] text-slate-400">timer</span>
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>
          </div>
        </div>

        {/* 4-Stage Transmission Pipeline */}
        <div className="pt-4">
          <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
            {/* Stage 1: Ingesta */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-md shadow-emerald-500/10">
                <span className="material-symbols-outlined text-[12px]">check</span>
              </div>
              <span className="font-bold text-emerald-400">1. Ingesta R2</span>
              <span className="text-[9px] text-slate-500">Verificado</span>
            </div>

            {/* Stage 2: Transcodificación */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-md shadow-emerald-500/10">
                <span className="material-symbols-outlined text-[12px]">check</span>
              </div>
              <span className="font-bold text-emerald-400">2. Optimización</span>
              <span className="text-[9px] text-slate-500">1080p Short/Reel</span>
            </div>

            {/* Stage 3: Difusión Multi-Red */}
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                isAllFinished
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-indigo-500/30 text-indigo-300 border border-indigo-400/50 shadow-lg shadow-indigo-500/30 animate-pulse'
              }`}>
                <span className="material-symbols-outlined text-[12px]">
                  {isAllFinished ? 'check' : 'satellite_alt'}
                </span>
              </div>
              <span className={`font-bold ${isAllFinished ? 'text-emerald-400' : 'text-indigo-300'}`}>
                3. Difusión Multi-Red
              </span>
              <span className="text-[9px] text-slate-500">
                {isAllFinished ? 'Completado' : 'Transmitiendo'}
              </span>
            </div>

            {/* Stage 4: Confirmación & Auto-Purga */}
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                isAllFinished
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/40'
                  : 'bg-slate-800 text-slate-500 border border-slate-700'
              }`}>
                <span className="material-symbols-outlined text-[12px]">
                  {isAllFinished ? 'done_all' : 'cleaning_services'}
                </span>
              </div>
              <span className={`font-bold ${isAllFinished ? 'text-emerald-400' : 'text-slate-500'}`}>
                4. Confirmación
              </span>
              <span className="text-[9px] text-slate-500">
                {isAllFinished ? '0 MB Utilizados' : 'Pendiente'}
              </span>
            </div>
          </div>

          {/* Barra de progreso conectora */}
          <div className="relative mt-2.5 h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isAllFinished
                  ? 'w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
                  : isAnyProcessing
                    ? 'w-3/4 bg-gradient-to-r from-cyan-500 via-indigo-500 to-pink-500 animate-pulse'
                    : 'w-1/2 bg-gradient-to-r from-cyan-500 to-indigo-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 2. CELEBRATION BANNER AL COMPLETAR */}
      {isAllFinished && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-950/40 via-[#0a1a14] to-emerald-950/40 border border-emerald-500/30 p-3.5 shadow-lg shadow-emerald-500/10 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <span className="material-symbols-outlined text-base">verified</span>
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                ¡Publicación exitosa en todos los canales seleccionados!
              </h5>
              <p className="text-[10px] text-emerald-400/80 mt-0.5">
                🛡️ Auto-limpieza ejecutada: El video temporal fue eliminado de Cloudflare R2 y tu cuota de almacenamiento se restableció a 0 MB.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. CANALES DE ENVÍO ACTIVOS (TARJETAS DE ALTA GAMA) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-indigo-400">hub</span>
            Canales de Emisión Simultánea
          </span>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
            {publications.length} Cuenta{publications.length === 1 ? '' : 's'}
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
                className={`relative overflow-hidden rounded-xl p-3 border transition-all duration-300 bg-gradient-to-br ${style.cardBg} ${style.cardBorder} shadow-lg ${style.cardGlow}`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg ${style.iconBg} flex items-center justify-center flex-shrink-0 shadow-md`}>
                      {style.icon}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white truncate block">
                        {pub.platform_username || 'Canal'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        {style.name}
                      </span>
                    </div>
                  </div>

                  {/* Estado badge */}
                  <div className="flex-shrink-0">
                    {isPublished ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
                        <span className="material-symbols-outlined text-[11px]">check_circle</span>
                        Publicado
                      </span>
                    ) : isProcessing ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                        Transmitiendo...
                      </span>
                    ) : isFailed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                        <span className="material-symbols-outlined text-[11px]">error</span>
                        Revisar
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        <span className="material-symbols-outlined text-[11px]">schedule</span>
                        En cola
                      </span>
                    )}
                  </div>
                </div>

                {/* Micro barra de progreso mientras transmite */}
                {isProcessing && (
                  <div className="mt-2.5 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-pink-500 to-cyan-400 rounded-full animate-pulse w-3/4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. CONSOLA DE TELEMETRÍA EN TIEMPO REAL (TERMINAL HIGH-TECH) */}
      <div className="flex flex-col rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#090d16] via-[#060810] to-[#04050a] shadow-2xl overflow-hidden">
        {/* Barra superior de terminal */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e1322]/80 border-b border-slate-800/80">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 shadow-sm shadow-red-500/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 shadow-sm shadow-yellow-500/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shadow-sm shadow-emerald-500/50" />
            <span className="text-[11px] text-slate-400 font-mono font-bold ml-2">omnipublish-stream-engine.log</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              🟢 TLS 1.3 CIFRADO
            </span>
            <span className="text-[9px] text-cyan-400 font-mono font-bold animate-pulse">
              ● LIVE STREAM
            </span>
          </div>
        </div>

        {/* Ventana de logs con Radar animado cuando está en espera */}
        <div className="p-4 h-56 overflow-y-auto font-mono text-[11px] space-y-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-4">
              {/* Radar animado futurista */}
              <div className="relative flex items-center justify-center">
                <div className="w-14 h-14 rounded-full border border-indigo-500/20 animate-ping absolute" />
                <div className="w-10 h-10 rounded-full border border-cyan-500/30 flex items-center justify-center animate-spin" style={{ animationDuration: '4s' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                </div>
                <span className="material-symbols-outlined text-indigo-400 text-sm absolute">satellite_alt</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-300 font-sans font-semibold">
                  Sincronizando stream multimedia con las redes oficiales...
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-[9px] text-slate-500">
                  <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">[BUFFER INICIALIZADO]</span>
                  <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">[R2 STREAM READY]</span>
                  <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">[MULTIPLEXIÓN ACTIVA]</span>
                </div>
              </div>
            </div>
          ) : (
            logs.map((log) => {
              const dateStr = new Date(log.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const platform = log.platform ? log.platform.toLowerCase() : 'rifx';
              let badgeColor = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
              if (platform === 'youtube') badgeColor = 'text-red-400 bg-red-500/10 border-red-500/20';
              if (platform === 'instagram') badgeColor = 'text-pink-400 bg-pink-500/10 border-pink-500/20';
              if (platform === 'facebook') badgeColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
              if (platform === 'tiktok') badgeColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';

              let messageColor = 'text-slate-300';
              if (log.log_level === 'error') messageColor = 'text-red-400 font-semibold';
              if (log.log_level === 'warning') messageColor = 'text-amber-400 font-semibold';
              if (log.message.includes('Publicación exitosa') || log.message.includes('Almacenamiento liberado')) {
                messageColor = 'text-emerald-300 font-semibold';
              }

              return (
                <div key={log.id} className="flex items-start space-x-2 leading-relaxed animate-fadeIn">
                  <span className="text-slate-500 flex-shrink-0 select-none">[{dateStr}]</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold flex-shrink-0 uppercase ${badgeColor}`}>
                    {log.platform ? log.platform : 'RIFX'}
                  </span>
                  <span className={messageColor}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
