"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CommercialVideoStudioProps {
  language?: string;
  setToast?: (toast: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
  configData?: {
    higgsfield_key?: string;
    fal_key_configured?: boolean;
    [key: string]: any;
  };
  initialProductImage?: string;
  initialOffer?: string;
  onContinueToCampaigns?: (videoUrl: string) => void;
  onSwitchToImageMode?: () => void;
}

interface VideoMotionPreset {
  id: string;
  name: string;
  badge: string;
  icon: string;
  desc: string;
  defaultPrompt: string;
  recommendedAspect: '9:16' | '16:9' | '1:1';
}

const MOTION_PRESETS: VideoMotionPreset[] = [
  {
    id: 'luxury_360',
    name: 'Rotación 360° de Lujo (Pedestal)',
    badge: 'Comercial Premium',
    icon: '360',
    desc: 'Cámara en órbita fluida de 360 grados alrededor del producto sobre pedestal con reflejos de iluminación de estudio de alta gama.',
    defaultPrompt: 'Cinematic luxury commercial advertising showcase. Smooth 360 camera rotation orbiting around the real product on a clean luxury pedestal, soft high-end studio lighting, subtle reflections, ultra-smooth motion, commercial quality 8k.',
    recommendedAspect: '9:16',
  },
  {
    id: 'dynamic_reels',
    name: 'Viral Reels & TikTok (Tracking Punchy)',
    badge: 'Alta Conversión',
    icon: 'bolt',
    desc: 'Movimiento enérgico y dinámico con zoom de acercamiento y seguimiento de cámara ideal para retener usuarios en redes sociales.',
    defaultPrompt: 'High-energy viral social media product commercial for TikTok and Instagram Reels, dynamic punchy camera tracking, modern subtle studio rim lighting, ultra-fluid movement, cinematic advertising impact.',
    recommendedAspect: '9:16',
  },
  {
    id: 'water_splash',
    name: 'Splash & Gotas Frescas de Agua',
    badge: 'Bebidas & Skincare',
    icon: 'water_drop',
    desc: 'Primer plano comercial con gotas de agua cristalina y salpicadura sutil en cámara lenta alrededor del producto.',
    defaultPrompt: 'Cinematic commercial product spot, dynamic close-up view, crystal clear fresh water droplets and delicate splash in slow motion, pristine studio lighting, ultra-sharp realistic details.',
    recommendedAspect: '9:16',
  },
  {
    id: 'warm_sunset',
    name: 'Atardecer Dorado & Luz Natural',
    badge: 'Lifestyle & Belleza',
    icon: 'wb_sunny',
    desc: 'Iluminación dorada tipo Golden Hour con sombras suaves, brisa cinematográfica y atmósfera cálida de estilo de vida.',
    defaultPrompt: 'Warm golden hour lifestyle product commercial, soft natural sunset rays, delicate shadows, cinematic breeze, luxury aesthetic, smooth professional camera motion.',
    recommendedAspect: '9:16',
  },
  {
    id: 'studio_minimal',
    name: 'Presentación Minimalista de Estudio',
    badge: 'Tecnología & Diseño',
    icon: 'token',
    desc: 'Fondo minimalista arquitectónico con pedestal limpio, iluminación de softbox difusa y cámara flotante con desplazamiento elegante.',
    defaultPrompt: 'Minimalist commercial presentation, modern matte architectural podium, subtle floating camera motion, high-end softbox commercial studio lighting, elegant shadows.',
    recommendedAspect: '9:16',
  },
  {
    id: 'smoke_neon',
    name: 'Cyberpunk & Humo de Neón Urbano',
    badge: 'Streetwear & Gamer',
    icon: 'flare',
    desc: 'Atmósfera nocturna urbana con humo volumétrico iluminado por aros de neón y contrastes de color dramáticos.',
    defaultPrompt: 'Dramatic urban cyberpunk commercial advertising spot, slow volumetric smoke drifting past, subtle neon rim light accents, premium commercial grade cinematic camera push.',
    recommendedAspect: '9:16',
  },
];

const SAMPLE_PRODUCTS = [
  {
    id: 'sample_sneaker',
    label: 'Zapatilla Urbana',
    category: 'Moda & Calzado',
    url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'sample_perfume',
    label: 'Perfume de Lujo',
    category: 'Belleza & Fragancias',
    url: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'sample_supplement',
    label: 'Suplemento Fitness',
    category: 'Salud & Deporte',
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'sample_energy_drink',
    label: 'Bebida Energética',
    category: 'Alimentos & Bebidas',
    url: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=800&q=80',
  },
];

export function CommercialVideoStudio({
  language = 'es',
  setToast,
  configData,
  initialProductImage,
  initialOffer = '',
  onContinueToCampaigns,
  onSwitchToImageMode,
}: CommercialVideoStudioProps) {
  // Estado del producto e imágenes
  const [productImage, setProductImage] = useState<string>(initialProductImage || '');
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuraciones de Video
  const [selectedPresetId, setSelectedPresetId] = useState<string>('luxury_360');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [duration, setDuration] = useState<5 | 10>(5);
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [commercialOffer, setCommercialOffer] = useState<string>(initialOffer);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Estado de Generación
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Historial de videos en la sesión
  const [videoHistory, setVideoHistory] = useState<Array<{ url: string; date: string; preset: string }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Sincronizar duración y resolución por defecto
  const handleDurationChange = (d: 5 | 10) => {
    setDuration(d);
    if (d === 5) setResolution('720p');
    else setResolution('1080p');
  };

  // Temporizador mientras genera
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  // Manejo de carga de imagen de producto
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setToast?.({ message: 'Por favor sube un archivo de imagen válido (PNG, JPG, WEBP).', type: 'error' });
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setToast?.({ message: 'La imagen excede el límite de 12MB.', type: 'error' });
      return;
    }

    setIsUploadingProduct(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setProductImage(result);
      setIsUploadingProduct(false);
      setToast?.({ message: '✅ Foto del producto cargada correctamente.', type: 'success' });
    };
    reader.onerror = () => {
      setIsUploadingProduct(false);
      setToast?.({ message: 'Error al leer el archivo.', type: 'error' });
    };
    reader.readAsDataURL(file);
  };

  // Construir el prompt comercial final
  const getSelectedPreset = () => {
    return MOTION_PRESETS.find((p) => p.id === selectedPresetId) || MOTION_PRESETS[0];
  };

  const buildFinalPrompt = () => {
    const preset = getSelectedPreset();
    let prompt = customPrompt.trim() ? customPrompt.trim() : preset.defaultPrompt;
    if (commercialOffer.trim()) {
      prompt += ` Commercial advertising hook and offer: "${commercialOffer.trim()}".`;
    }
    return prompt;
  };

  // Generar Video Comercial
  const handleGenerateVideo = async () => {
    const estimatedCost = duration === 5 ? '~$0.75 USD' : '~$1.50 USD';
    const confirmed = window.confirm(
      `🎬 INICIAR PRODUCCIÓN DE VIDEO IA (ByteDance Seedance 2.5)\n\n` +
      `• Duración: ${duration} segundos (${resolution})\n` +
      `• Formato: ${aspectRatio}\n` +
      `• Costo estimado de inferencia: ${estimatedCost} (~$0.15 USD/segundo)\n\n` +
      `¿Deseas procesar este video publicitario ahora?`
    );
    if (!confirmed) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setGenerationStep('Conectando con motor de inferencia ByteDance Seedance 2.5...');

    try {
      const finalPrompt = buildFinalPrompt();

      const effectiveKey = apiKeyInput.trim() || 
        (configData?.higgsfield_key && !configData.higgsfield_key.includes('••••') ? configData.higgsfield_key : '');

      setGenerationStep('Sintetizando escena publicitaria y movimiento de cámara...');

      const response = await fetch('/api/panel/banners/higgsfield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'video',
          prompt: finalPrompt,
          text_language: language,
          product_image: productImage || undefined,
          aspect_ratio: aspectRatio,
          resolution,
          duration,
          model: 'bytedance/seedance-2.5/text-to-video',
          api_key: effectiveKey || undefined,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'No se pudo generar el video comercial.');
      }

      const videoUrl = data.video;
      if (!videoUrl) {
        throw new Error('La respuesta no incluyó la URL del video resultante.');
      }

      setGeneratedVideo(videoUrl);
      setVideoHistory((prev) => [
        { url: videoUrl, date: new Date().toLocaleTimeString(), preset: getSelectedPreset().name },
        ...prev,
      ]);

      setToast?.({
        message: '🎉 ¡Video publicitario generado exitosamente con ByteDance Seedance 2.5!',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error generando video Seedance:', err);
      const msg = err.message || 'Error en la generación del video.';
      setErrorMsg(msg);
      setToast?.({ message: msg, type: 'error' });
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // Descargar el video MP4 generado
  const handleDownloadVideo = async () => {
    if (!generatedVideo) return;
    try {
      const link = document.createElement('a');
      link.href = generatedVideo;
      link.download = `seedance-comercial-${Date.now()}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setToast?.({ message: 'Descarga iniciada.', type: 'info' });
    } catch (err) {
      window.open(generatedVideo, '_blank');
    }
  };

  const preset = getSelectedPreset();

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-fadeIn">
      {/* TARJETA CABECERA DEL ESTUDIO CRM - DISEÑO BLANCO Y AZUL CORPORATIVO */}
      <div className="bg-white rounded-3xl border border-slate-200 p-7 md:p-9 shadow-sm relative overflow-hidden transition-all">
        {/* Barra superior de acento RIFX Blue */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0058bc] via-blue-600 to-indigo-600" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bg-blue-50 text-[#0058bc] border border-blue-200 text-xs font-black px-3.5 py-1 rounded-full uppercase flex items-center gap-1.5 shadow-xs">
                <span className="material-symbols-outlined text-sm">movie</span>
                Estudio de Video Comercial IA • ByteDance Seedance 2.5
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                <span className="material-symbols-outlined text-sm">payments</span>
                Tarifa Real: ~$0.15 USD / segundo
              </span>
              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">hd</span>
                Resolución 720p / 1080p FHD
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0b1c30] tracking-tight flex items-center gap-3">
              Crea Spots Comerciales para TikTok, Reels y Meta Ads con Video IA
            </h2>

            <p className="text-sm md:text-base text-slate-600 leading-relaxed">
              Transforma la foto de tu producto en spots publicitarios dinámicos de alto impacto visual. Movimientos de cámara cinematográficos, iluminación de estudio publicitario y renderizado ultra fluido para multiplicar tus ventas.
            </p>
          </div>

          {/* Selector rápido para volver a Pancartas Studio */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
            {onSwitchToImageMode && (
              <button
                type="button"
                onClick={onSwitchToImageMode}
                className="px-5 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:border-slate-300"
              >
                <span className="material-symbols-outlined text-base text-[#0058bc]">image</span>
                <span>Ir a Pancartas Estáticas ($0.03612)</span>
              </button>
            )}
            <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-3 text-center sm:text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Costo por generación</span>
              <span className="text-base font-black text-[#0058bc]">
                {duration === 5 ? '~$0.75 USD (5s)' : '~$1.50 USD (10s)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: 2 COLUMNAS AMPLIAS (CONTROLES A LA IZQUIERDA Y MONITOR DE VIDEO A LA DERECHA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* =========================================================================
            COLUMNA IZQUIERDA: CONFIGURACIÓN CREATIVA Y PRODUCTO (7 COLUMNAS)
            ========================================================================= */}
        <div className="lg:col-span-7 space-y-7">
          {/* PASO 1: FOTO DEL PRODUCTO REAL */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0058bc] flex items-center justify-center font-extrabold shadow-xs">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0b1c30]">Producto Real o Pancarta Base</h3>
                  <p className="text-xs text-slate-500">Sube la foto del producto o selecciona un ejemplo de prueba</p>
                </div>
              </div>

              {productImage && (
                <button
                  type="button"
                  onClick={() => setProductImage('')}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Quitar foto
                </button>
              )}
            </div>

            {/* Input oculto */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Dropzone o Vista Previa del Producto */}
            {productImage ? (
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-white border border-slate-300 shadow-xs shrink-0 group">
                  <img
                    src={productImage}
                    alt="Producto Seleccionado"
                    className="w-full h-full object-contain p-1"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 bg-white text-slate-800 rounded-lg shadow-sm hover:scale-105 transition-transform"
                      title="Cambiar foto"
                    >
                      <span className="material-symbols-outlined text-base">swap_horiz</span>
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 flex-1 text-center sm:text-left">
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    Producto Cargado
                  </span>
                  <p className="text-xs text-slate-600 leading-normal">
                    La IA de Seedance 2.5 mantendrá la identidad visual, colores y empaque de este producto durante toda la animación publicitaria.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-[#0058bc] hover:underline flex items-center gap-1 inline-flex cursor-pointer pt-1"
                  >
                    <span className="material-symbols-outlined text-sm">upload</span>
                    Cambiar por otra imagen
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#0058bc] rounded-2xl p-7 text-center cursor-pointer transition-all hover:bg-blue-50/30 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0058bc] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-xs">
                  <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                </div>
                <h4 className="text-sm font-bold text-[#0b1c30]">
                  Haz clic aquí para subir la foto de tu producto
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Formatos soportados: PNG (con fondo transparente o sólido), JPG, WEBP de alta resolución.
                </p>
              </div>
            )}

            {/* Ejemplos de prueba rápida */}
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                O prueba con uno de estos productos de demostración:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {SAMPLE_PRODUCTS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => setProductImage(sample.url)}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      productImage === sample.url
                        ? 'border-[#0058bc] bg-blue-50/50 shadow-xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <img
                      src={sample.url}
                      alt={sample.label}
                      className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-[#0b1c30] truncate">{sample.label}</p>
                      <p className="text-[9px] text-slate-500 truncate">{sample.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PASO 2: ESTILO DE MOVIMIENTO & CÁMARA COMERCIAL */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0058bc] flex items-center justify-center font-extrabold shadow-xs">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0b1c30]">Estilo de Movimiento Cinematográfico</h3>
                  <p className="text-xs text-slate-500">Selecciona el movimiento de cámara publicitario que mejor se adapte a tu producto</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {MOTION_PRESETS.map((item) => {
                const isSelected = selectedPresetId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedPresetId(item.id)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left ${
                      isSelected
                        ? 'border-[#0058bc] bg-blue-50/30 shadow-md ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                        <span className={`material-symbols-outlined text-lg ${isSelected ? 'text-[#0058bc]' : 'text-slate-400'}`}>
                          {isSelected ? 'check_circle' : item.icon}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-[#0b1c30] mb-1">{item.name}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{item.desc}</p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Seedance 2.5</span>
                      <span className={`font-bold ${isSelected ? 'text-[#0058bc]' : 'text-slate-500'}`}>
                        {isSelected ? 'Seleccionado' : 'Elegir'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PASO 3: FORMATO, DURACIÓN Y RESOLUCIÓN */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0058bc] flex items-center justify-center font-extrabold shadow-xs">
                3
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0b1c30]">Formato de Redes, Duración y Costo</h3>
                <p className="text-xs text-slate-500">Configura la relación de aspecto y tiempo del spot</p>
              </div>
            </div>

            {/* Selector de Relación de Aspecto */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider block">
                Formato y Relación de Aspecto:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-center gap-3 cursor-pointer ${
                    aspectRatio === '9:16'
                      ? 'border-[#0058bc] bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="w-8 h-12 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 font-black text-[10px] shrink-0">
                    9:16
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#0b1c30]">Vertical Reels</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded-full">Top</span>
                    </div>
                    <p className="text-[10px] text-slate-500">TikTok, Reels, Shorts</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-center gap-3 cursor-pointer ${
                    aspectRatio === '16:9'
                      ? 'border-[#0058bc] bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="w-12 h-8 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 font-black text-[10px] shrink-0">
                    16:9
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#0b1c30]">Horizontal</span>
                    <p className="text-[10px] text-slate-500">YouTube, Web & Ads</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAspectRatio('1:1')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-center gap-3 cursor-pointer ${
                    aspectRatio === '1:1'
                      ? 'border-[#0058bc] bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 font-black text-[10px] shrink-0">
                    1:1
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#0b1c30]">Cuadrado</span>
                    <p className="text-[10px] text-slate-500">Feed de Instagram / FB</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Selector de Duración y Costo Transparente */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider block">
                Duración del Video & Presupuesto:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => handleDurationChange(5)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start justify-between cursor-pointer ${
                    duration === 5
                      ? 'border-[#0058bc] bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-[#0058bc]">timer_5</span>
                      <span className="text-sm font-extrabold text-[#0b1c30]">5 Segundos (HD 720p)</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Ideal para anuncios rápidos de alto impacto y stories virales.
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-xs font-black text-[#0058bc] bg-white border border-blue-200 px-2 py-1 rounded-lg block shadow-xs">
                      ~$0.75 USD
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">5s x $0.15/s</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleDurationChange(10)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start justify-between cursor-pointer ${
                    duration === 10
                      ? 'border-[#0058bc] bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-indigo-600">timer_10</span>
                      <span className="text-sm font-extrabold text-[#0b1c30]">10 Segundos (FHD 1080p)</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Excelente para spots publicitarios completos y presentaciones de producto.
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-xs font-black text-indigo-700 bg-white border border-indigo-200 px-2 py-1 rounded-lg block shadow-xs">
                      ~$1.50 USD
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">10s x $0.15/s</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Mensaje / Oferta Comercial (Opcional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center justify-between">
                <span>Gancho u Oferta Comercial (Opcional):</span>
                <span className="text-[11px] text-slate-400 font-normal">Para guiar el contexto de la escena</span>
              </label>
              <input
                type="text"
                value={commercialOffer}
                onChange={(e) => setCommercialOffer(e.target.value)}
                placeholder="Ej: ¡50% de Descuento Solo Hoy! Envío Gratis a Todo el País"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0058bc] focus:ring-2 focus:ring-blue-100 transition-all bg-white"
              />
            </div>

            {/* Ajustes Avanzados Plegables */}
            <div className="border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="text-xs font-bold text-slate-600 hover:text-[#0058bc] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {showAdvancedSettings ? 'expand_less' : 'expand_more'}
                </span>
                <span>{showAdvancedSettings ? 'Ocultar prompt avanzado y credenciales' : 'Personalizar prompt de IA y API Key opcional'}</span>
              </button>

              {showAdvancedSettings && (
                <div className="mt-3.5 space-y-3.5 p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-fadeIn">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                      Prompt de Video Personalizado (Sobrescribe el Preset):
                    </label>
                    <textarea
                      rows={3}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder={preset.defaultPrompt}
                      className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0058bc] bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                      API Key de Higgsfield (Opcional si ya está en Ajustes):
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Key ID:Key Secret"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#0058bc] bg-white font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            COLUMNA DERECHA: MONITOR DE PRODUCCIÓN EN VIVO Y REPRODUCTOR (5 COLUMNAS)
            ========================================================================= */}
        <div className="lg:col-span-5 space-y-6 sticky top-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-7 shadow-sm space-y-5">
            {/* Cabecera del Monitor */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isGenerating ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isGenerating ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                </span>
                <h3 className="text-base font-extrabold text-[#0b1c30]">
                  Monitor de Renderizado en Vivo
                </h3>
              </div>
              <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full uppercase tracking-wider">
                {aspectRatio} • {duration}s • {resolution}
              </span>
            </div>

            {/* Pantalla del Monitor de Video */}
            <div
              className={`relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 flex items-center justify-center transition-all ${
                aspectRatio === '9:16'
                  ? 'aspect-[9/16] max-h-[560px] mx-auto w-full max-w-[320px]'
                  : aspectRatio === '16:9'
                  ? 'aspect-[16/9] w-full'
                  : 'aspect-square w-full max-w-[380px] mx-auto'
              }`}
            >
              {/* ESTADO 1: GENERANDO VIDEO */}
              {isGenerating ? (
                <div className="p-6 text-center text-white space-y-4 max-w-xs animate-fadeIn">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="w-16 h-16 rounded-full border-4 border-blue-500/30 border-t-blue-400 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="material-symbols-outlined text-blue-400 text-xl">movie</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">
                      Renderizando Video Comercial...
                    </h4>
                    <p className="text-xs text-blue-200/80 leading-relaxed font-mono">
                      {generationStep || 'Sintetizando frames hiperrealistas con ByteDance Seedance 2.5...'}
                    </p>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 inline-flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-sm animate-pulse">timer</span>
                    <span className="text-xs font-mono font-bold text-slate-200">
                      Tiempo transcurrido: {elapsedSeconds}s
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    La inferencia de video toma habitualmente entre 30 y 60 segundos.
                  </p>
                </div>
              ) : generatedVideo ? (
                /* ESTADO 2: VIDEO GENERADO CON ÉXITO */
                <div className="relative w-full h-full flex items-center justify-center bg-black group">
                  <video
                    ref={videoRef}
                    src={generatedVideo}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md border border-white/20">
                    Seedance 2.5 FHD
                  </div>
                </div>
              ) : (
                /* ESTADO 3: PLACEHOLDER DE ESPERA */
                <div className="p-6 text-center text-slate-400 space-y-3.5 max-w-xs">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto shadow-inner">
                    <span className="material-symbols-outlined text-3xl text-blue-400">videocam</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">
                      Esperando Producción
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Configura el producto y presiona el botón inferior para comenzar el renderizado con Seedance 2.5.
                    </p>
                  </div>
                  <div className="text-[10px] bg-slate-900 text-slate-400 py-1.5 px-3 rounded-lg border border-slate-800">
                    Estilo: <span className="text-slate-200 font-bold">{preset.name}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message si ocurrió algún problema */}
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800">
                <span className="material-symbols-outlined text-base text-rose-600 shrink-0 mt-0.5">error</span>
                <div className="flex-1">
                  <span className="font-bold block">Error al generar:</span>
                  <p className="mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* BOTÓN PRINCIPAL DE GENERACIÓN (CTA GIGANTE CRM) */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateVideo}
              className={`w-full py-4 px-6 rounded-2xl font-black text-sm md:text-base text-white transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg ${
                isGenerating
                  ? 'bg-slate-400 cursor-not-allowed opacity-80'
                  : 'bg-gradient-to-r from-[#0058bc] to-indigo-600 hover:from-[#054ada] hover:to-indigo-700 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Procesando Video con Seedance 2.5...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">auto_videocam</span>
                  <span>
                    Generar Video Comercial Seedance ({duration}s • {duration === 5 ? '~$0.75 USD' : '~$1.50 USD'})
                  </span>
                </>
              )}
            </button>

            {/* ACCIONES CUANDO HAY VIDEO GENERADO */}
            {generatedVideo && !isGenerating && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100 animate-fadeIn">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadVideo}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    <span>Descargar MP4</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        videoRef.current.play();
                      }
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">replay</span>
                    <span>Repetir Video</span>
                  </button>
                </div>

                {onContinueToCampaigns && (
                  <button
                    type="button"
                    onClick={() => onContinueToCampaigns(generatedVideo)}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">rocket_launch</span>
                    <span>Llevar este Video a Campañas de Anuncios</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* HISTORIAL RÁPIDO DE VIDEOS DE LA SESIÓN */}
          {videoHistory.length > 1 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#0058bc]">history</span>
                Videos Generados en esta Sesión ({videoHistory.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {videoHistory.map((v, i) => (
                  <div
                    key={i}
                    onClick={() => setGeneratedVideo(v.url)}
                    className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                      generatedVideo === v.url
                        ? 'border-[#0058bc] bg-blue-50/50 font-bold text-[#0058bc]'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="material-symbols-outlined text-sm">movie</span>
                      <span className="truncate">{v.preset}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-2">{v.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default CommercialVideoStudio;
