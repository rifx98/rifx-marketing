import React, { useState, useEffect, useRef } from 'react';

interface Publication {
  id: string;
  status: 'pending' | 'processing' | 'published' | 'failed';
  last_error?: string;
  social_account_id: string;
  platform: 'facebook' | 'instagram';
  platform_username: string;
}

interface SocialLog {
  id: string;
  publication_id: string;
  log_level: 'info' | 'warning' | 'error';
  message: string;
  created_at: string;
  platform?: 'facebook' | 'instagram';
}

interface PublicationTrackerProps {
  postId: string;
  onFinished: () => void;
}

export default function PublicationTracker({ postId, onFinished }: PublicationTrackerProps) {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [logs, setLogs] = useState<SocialLog[]>([]);
  const [loading, setLoading] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let isMounted = true;

    const fetchData = async (showLoading = false) => {
      try {
        if (showLoading) setLoading(true);

        const token = localStorage.getItem('token');
        const res = await fetch(`/api/panel/social/tracker?postId=${postId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to fetch tracker data');
        if (!isMounted) return;

        setPublications(data.publications || []);

        // Avoid duplicate logs and sort them chronologically
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

      // Secure polling every 6 seconds if publications are pending/processing or on start
      pollInterval = setInterval(() => {
        setPublications((currentPubs) => {
          const hasActive = currentPubs.length === 0 || currentPubs.some(p => p.status === 'pending' || p.status === 'processing');
          if (hasActive) {
            fetchData(false);
          }
          return currentPubs;
        });
      }, 6000);
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [postId]);

  // Auto-scroll del terminal hacia abajo al entrar nuevos logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Verificar si todas las publicaciones han finalizado
    if (publications.length > 0) {
      const allFinished = publications.every(p => p.status === 'published' || p.status === 'failed');
      if (allFinished) {
        onFinished();
      }
    }
  }, [logs, publications]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'processing': return 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse';
      default: return 'text-[#727785] bg-[#1b1c24] border-[#2d3139]';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'published': return 'Publicado';
      case 'failed': return 'Fallido';
      case 'processing': return 'Procesando';
      default: return 'Pendiente';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <svg className="animate-spin h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-xs text-[#727785]">Iniciando monitor de publicación...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estado por Canal */}
      <div className="bg-[#111318]/40 border border-[#2d3139] rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-[#727785] uppercase tracking-wider">
          Canales de Envío Activos
        </p>
        <div className="space-y-2">
          {publications.map((pub) => (
            <div key={pub.id} className="flex items-center justify-between p-2.5 rounded-xl border border-[#1b1c24] bg-[#111318]/60">
              <div className="flex items-center space-x-2.5 overflow-hidden">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  pub.platform === 'facebook' ? 'bg-blue-500' : 'bg-pink-500'
                }`} />
                <div className="overflow-hidden">
                  <span className="text-xs font-semibold text-white truncate block">
                    {pub.platform_username}
                  </span>
                  <span className="text-[10px] text-[#727785] block capitalize">
                    {pub.platform} Reel
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-3 flex-shrink-0">
                <span className={`text-[10px] px-2 py-1 rounded-full border font-medium ${getStatusColor(pub.status)}`}>
                  {getStatusText(pub.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Terminal de Logs en Vivo */}
      <div className="flex flex-col rounded-2xl border border-[#2d3139] bg-[#0c0d12] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#111318]/80 border-b border-[#2d3139]">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="text-xs text-[#727785] font-semibold font-mono ml-2">omnipublish-worker.log</span>
          </div>
          <span className="text-[10px] text-indigo-400 font-mono animate-pulse">● LIVE</span>
        </div>

        <div className="p-4 h-64 overflow-y-auto font-mono text-[11px] space-y-2.5 scrollbar-thin scrollbar-thumb-[#2d3139] scrollbar-track-transparent">
          {logs.length === 0 ? (
            <div className="text-[#4b5263] italic">Esperando que inicie el procesamiento del video...</div>
          ) : (
            logs.map((log) => {
              const dateStr = new Date(log.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const platformLabel = log.platform ? `[${log.platform.toUpperCase()}]` : '[RIFX]';
              const platformColor = log.platform === 'facebook' ? 'text-blue-400' : log.platform === 'instagram' ? 'text-pink-400' : 'text-indigo-400';
              
              let messageColor = 'text-white/90';
              if (log.log_level === 'error') messageColor = 'text-red-400 font-semibold';
              if (log.log_level === 'warning') messageColor = 'text-amber-400';

              return (
                <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
                  <span className="text-[#4b5263] flex-shrink-0">[{dateStr}]</span>
                  <span className={`${platformColor} font-semibold flex-shrink-0`}>{platformLabel}</span>
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
