import React, { useState } from 'react';

interface SocialAccount {
  id: string;
  platform: 'facebook' | 'instagram' | 'tiktok' | 'youtube';
  platform_username: string;
  profile_picture_url?: string;
}

interface PublishFormProps {
  accounts: SocialAccount[];
  onSubmit: (data: { caption: string; title: string; selectedAccountIds: string[]; scheduledAt?: string | null }) => void;
  isPublishing: boolean;
  videoStoragePath: string | null;
  mode?: 'single' | 'batch';
}

const platformConfig: Record<string, {
  gradient: string;
  selectedBg: string;
  selectedBorder: string;
  ringColor: string;
  badgeColor: string;
  label: string;
  icon: React.ReactNode;
}> = {
  facebook: {
    gradient: 'from-[#1877F2] to-[#0d5bc4]',
    selectedBg: 'bg-blue-50',
    selectedBorder: 'border-blue-300',
    ringColor: 'ring-blue-400/30',
    badgeColor: 'bg-[#1877F2]',
    label: 'Facebook Page',
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  instagram: {
    gradient: 'from-[#E4405F] via-[#C13584] to-[#833AB4]',
    selectedBg: 'bg-pink-50',
    selectedBorder: 'border-pink-300',
    ringColor: 'ring-pink-400/30',
    badgeColor: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]',
    label: 'Instagram Business',
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  tiktok: {
    gradient: 'from-[#000000] to-[#25F4EE]',
    selectedBg: 'bg-slate-50',
    selectedBorder: 'border-slate-400',
    ringColor: 'ring-slate-400/30',
    badgeColor: 'bg-black',
    label: 'TikTok',
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
  },
  youtube: {
    gradient: 'from-[#FF0000] to-[#cc0000]',
    selectedBg: 'bg-red-50',
    selectedBorder: 'border-red-300',
    ringColor: 'ring-red-400/30',
    badgeColor: 'bg-[#FF0000]',
    label: 'YouTube Shorts',
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
};

export default function PublishForm({ accounts, onSubmit, isPublishing, videoStoragePath, mode = 'single' }: PublishFormProps) {
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFormLoadedRef = React.useRef(false);

  // Load states from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCaption = localStorage.getItem('omnipublish_caption');
      if (savedCaption) setCaption(savedCaption);

      const savedTitle = localStorage.getItem('omnipublish_title');
      if (savedTitle) setTitle(savedTitle);

      const savedSelectedAccounts = localStorage.getItem('omnipublish_selected_accounts');
      if (savedSelectedAccounts) {
        try {
          setSelectedAccountIds(JSON.parse(savedSelectedAccounts));
        } catch (_) {}
      }

      const savedIsScheduled = localStorage.getItem('omnipublish_is_scheduled');
      if (savedIsScheduled) setIsScheduled(savedIsScheduled === 'true');

      const savedScheduledAt = localStorage.getItem('omnipublish_scheduled_at');
      if (savedScheduledAt) setScheduledAt(savedScheduledAt);

      isFormLoadedRef.current = true;
    }
  }, []);

  // Save states to localStorage on change (only after initial load has finished)
  React.useEffect(() => {
    if (!isFormLoadedRef.current) return;
    localStorage.setItem('omnipublish_caption', caption);
  }, [caption]);

  React.useEffect(() => {
    if (!isFormLoadedRef.current) return;
    localStorage.setItem('omnipublish_title', title);
  }, [title]);

  React.useEffect(() => {
    if (!isFormLoadedRef.current) return;
    localStorage.setItem('omnipublish_selected_accounts', JSON.stringify(selectedAccountIds));
  }, [selectedAccountIds]);

  React.useEffect(() => {
    if (!isFormLoadedRef.current) return;
    localStorage.setItem('omnipublish_is_scheduled', String(isScheduled));
  }, [isScheduled]);

  React.useEffect(() => {
    if (!isFormLoadedRef.current) return;
    localStorage.setItem('omnipublish_scheduled_at', scheduledAt);
  }, [scheduledAt]);

  React.useEffect(() => {
    if (!isFormLoadedRef.current) return;
    if (!videoStoragePath) {
      setCaption('');
      setTitle('');
      setIsScheduled(false);
      setScheduledAt('');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('omnipublish_caption');
        localStorage.removeItem('omnipublish_title');
        localStorage.removeItem('omnipublish_is_scheduled');
        localStorage.removeItem('omnipublish_scheduled_at');
      }
    }
  }, [videoStoragePath]);

  const getMinDateTime = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const handleGenerateIA = async () => {
    if (!title.trim() && !caption.trim()) {
      setError('Por favor, escribe un borrador, ideas o palabras clave en el título o descripción primero.');
      return;
    }
    setIsGeneratingIA(true);
    setError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      const res = await fetch('/api/panel/social/generate-metadata', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ title, caption })
      });

      const data = await res.json();
      if (data.success) {
        if (data.title) setTitle(data.title);
        if (data.caption) setCaption(data.caption);
      } else {
        setError(data.error || 'Error al optimizar con IA.');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setIsGeneratingIA(false);
    }
  };

  const handleToggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllPlatform = (platformAccounts: SocialAccount[]) => {
    const allIds = platformAccounts.map(a => a.id);
    const allSelected = allIds.every(id => selectedAccountIds.includes(id));
    if (allSelected) {
      setSelectedAccountIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedAccountIds(prev => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!videoStoragePath) {
      setError('Por favor sube primero un video para publicar.');
      return;
    }

    if (mode === 'single' && !caption.trim()) {
      setError('La descripción del video (caption) es obligatoria.');
      return;
    }

    if (selectedAccountIds.length === 0) {
      setError('Por favor selecciona al menos una plataforma para publicar.');
      return;
    }

    if (isScheduled && !scheduledAt) {
      setError('Por favor selecciona una fecha y hora para la publicación programada.');
      return;
    }

    if (isScheduled && scheduledAt) {
      const selectedTime = new Date(scheduledAt).getTime();
      if (selectedTime < Date.now()) {
        setError('La fecha y hora programada debe ser en el futuro.');
        return;
      }
    }

    onSubmit({
      caption,
      title,
      selectedAccountIds,
      scheduledAt: isScheduled ? scheduledAt : null
    });
  };


  // Filtrar cuentas por plataforma para mostrarlas organizadas
  const facebookAccounts = accounts.filter(acc => acc.platform === 'facebook');
  const instagramAccounts = accounts.filter(acc => acc.platform === 'instagram');
  const tiktokAccounts = accounts.filter(acc => acc.platform === 'tiktok');
  const youtubeAccounts = accounts.filter(acc => acc.platform === 'youtube');

  // Render a platform group
  const renderPlatformGroup = (platformAccounts: SocialAccount[], platform: string) => {
    if (platformAccounts.length === 0) return null;
    const config = platformConfig[platform];
    const allSelected = platformAccounts.every(a => selectedAccountIds.includes(a.id));

    return (
      <div className="space-y-2.5">
        {/* Platform header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-md ${config.badgeColor} flex items-center justify-center shadow-sm`}>
              {config.icon}
            </div>
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{config.label}</span>
            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{platformAccounts.length}</span>
          </div>
          <button
            type="button"
            onClick={() => handleSelectAllPlatform(platformAccounts)}
            className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors"
          >
            {allSelected ? 'Deseleccionar' : 'Seleccionar todo'}
          </button>
        </div>

        {/* Account cards */}
        <div className="space-y-2">
          {platformAccounts.map((acc) => {
            const isSelected = selectedAccountIds.includes(acc.id);
            return (
              <div
                key={acc.id}
                onClick={() => handleToggleAccount(acc.id)}
                className={`
                  group relative flex items-center gap-3.5 p-3 rounded-2xl border-2 cursor-pointer select-none
                  transition-all duration-300 ease-out
                  ${isSelected
                    ? `${config.selectedBg} ${config.selectedBorder} shadow-md ring-4 ${config.ringColor}`
                    : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                  }
                `}
                style={{
                  transform: isSelected ? 'perspective(600px) rotateX(1deg) translateY(-2px)' : 'perspective(600px) rotateX(0deg)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Profile picture */}
                <div className={`
                  relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0
                  transition-all duration-300
                  ${isSelected
                    ? `ring-2 ${config.selectedBorder.replace('border-', 'ring-')} shadow-lg`
                    : 'ring-1 ring-slate-200'
                  }
                `}>
                  {acc.profile_picture_url ? (
                    <img
                      src={acc.profile_picture_url}
                      alt={acc.platform_username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                      <span className="text-white text-sm font-black uppercase">
                        {acc.platform_username?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                  {/* Platform badge overlay */}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 ${config.badgeColor} rounded-md flex items-center justify-center border-2 border-white shadow-sm`}>
                    <div className="scale-[0.6]">{config.icon}</div>
                  </div>
                </div>

                {/* Account info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate transition-colors ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                    {acc.platform_username}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                    {config.label}
                  </p>
                </div>

                {/* Selection indicator */}
                <div className="flex-shrink-0 ml-auto">
                  <div
                    className={`
                      w-6 h-6 rounded-lg flex items-center justify-center
                      transition-all duration-300
                      ${isSelected
                        ? `bg-gradient-to-br ${config.gradient} text-white shadow-md`
                        : 'border-2 border-slate-200 bg-white group-hover:border-slate-300'
                      }
                    `}
                  >
                    {isSelected && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* 1. Selección de Canales */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center border border-indigo-100/50">
              <span className="text-[10px] font-black text-indigo-600">01</span>
            </div>
            <label className="text-xs font-bold text-slate-700">
              Selecciona Plataformas de Destino
            </label>
          </div>
          {selectedAccountIds.length > 0 && (
            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
              {selectedAccountIds.length} seleccionadas
            </span>
          )}
        </div>

        {accounts.length === 0 ? (
          <div className="p-8 bg-slate-50 border border-slate-100 rounded-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-xl text-slate-300">link_off</span>
            </div>
            <p className="text-xs font-bold text-slate-500">Sin cuentas conectadas</p>
            <p className="text-[10px] text-slate-400 mt-1">Vincula tus redes sociales desde los botones de arriba</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {renderPlatformGroup(facebookAccounts, 'facebook')}
            {renderPlatformGroup(instagramAccounts, 'instagram')}
            {renderPlatformGroup(tiktokAccounts, 'tiktok')}
            {renderPlatformGroup(youtubeAccounts, 'youtube')}
          </div>
        )}
      </div>

      {/* 2. Metadatos del Reel (Solo en modo individual) */}
      {mode === 'single' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center border border-violet-100/50">
                <span className="text-[10px] font-black text-violet-600">02</span>
              </div>
              <label className="text-xs font-bold text-slate-700">
                Detalles del Contenido
              </label>
            </div>
            <button
              type="button"
              onClick={handleGenerateIA}
              disabled={isGeneratingIA || isPublishing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-500/15"
            >
              {isGeneratingIA ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Optimizando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                  <span>Mejorar con IA</span>
                </>
              )}
            </button>
          </div>

          <div>
            <input
              type="text"
              placeholder="Título del Reel (escribe ideas o un borrador para mejorar con IA)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPublishing}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-300 outline-none transition-all duration-200"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px] text-slate-400">description</span>
                Descripción / Caption
              </span>
              <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md">
                {caption.length} / 2200
              </span>
            </div>
            <textarea
              placeholder="Escribe un borrador de tu descripción o ideas clave para que la IA las optimice..."
              value={caption}
              onChange={(e) => setCaption(e.target.value.substring(0, 2200))}
              disabled={isPublishing}
              rows={4}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-300 outline-none transition-all duration-200 resize-none"
            />
          </div>

          {/* Programación Horaria */}
          <div className="p-4 bg-slate-50/80 border border-slate-100 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px] text-indigo-500">schedule</span>
                </div>
                <span className="text-xs font-bold text-slate-700">Programar Publicación</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  disabled={isPublishing}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:bg-indigo-500" />
              </label>
            </div>

            {isScheduled && (
              <div className="pt-3 border-t border-slate-200/60 flex flex-col space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Fecha y Hora de Publicación
                </label>
                <input
                  type="datetime-local"
                  min={getMinDateTime()}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  disabled={isPublishing}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 text-xs text-slate-800 outline-none transition-all duration-200"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alertas de error */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200/60 text-red-600 text-xs font-semibold rounded-xl flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[14px] text-red-500">warning</span>
          </div>
          <span>{error}</span>
        </div>
      )}

      {/* Botón de Publicar */}
      <button
        type="submit"
        disabled={isPublishing || !videoStoragePath || selectedAccountIds.length === 0}
        className={`
          w-full py-4 px-6 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5
          transition-all duration-300
          ${isPublishing || !videoStoragePath || selectedAccountIds.length === 0
            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:brightness-110 active:scale-[0.98]'
          }
        `}
        style={{
          transform: (!isPublishing && videoStoragePath && selectedAccountIds.length > 0)
            ? 'perspective(600px) rotateX(1deg)'
            : undefined,
        }}
      >
        {isPublishing ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>{isScheduled ? 'Programando Publicación...' : 'Publicando en Canales Seleccionados...'}</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-lg">send</span>
            <span>{isScheduled ? 'Programar Envío' : `Publicar en ${selectedAccountIds.length || '0'} canales`}</span>
          </>
        )}
      </button>
    </form>
  );
}
