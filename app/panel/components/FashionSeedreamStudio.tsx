"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getBannerHistory, 
  saveBannersToHistory, 
  deleteBannerFromHistory, 
  type StoredBanner 
} from '@/lib/banner-history';

interface FashionSeedreamStudioProps {
  language?: string;
  setToast?: (toast: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
  falKeyConfigured?: boolean;
}

const BANNER_PRESETS = [
  {
    id: 'urban_pancarta',
    name: 'Pancarta Flyer Urbana (50% OFF)',
    tag: 'Sección de Moda',
    desc: 'Flyer publicitario en contraste verde esmeralda y amarillo dorado con tipografía NEW COLLECTION FASHION y badge de 50% OFF.',
    url: '/templates/fashion-banner-urban.png',
  },
  {
    id: 'creative_paper_bag',
    name: 'Pancarta Conceptual "Tunnel Perspective"',
    tag: 'Sección de Moda',
    desc: 'Perspectiva única desde el interior de bolsa comercial de papel kraft, tipografía stencil gigante, recibo impreso y lookbook urbano.',
    url: '/templates/fashion-concept-perspective.jpg',
  },
  {
    id: 'luxury_gold',
    name: 'Pancarta Lujo Editorial & Alta Costura',
    tag: 'Sección de Moda',
    desc: 'Estilo portada de revista de moda con iluminación dramática de alta costura, fondo minimalista oscuro y tipografía refinada.',
    url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'cyber_neon',
    name: 'Pancarta Cyber & Neon Streetwear',
    tag: 'Sección de Moda',
    desc: 'Atmósfera nocturna vibrante con luces de neón, estética moderna de streetwear futurista y tipografía audaz.',
    url: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=1000&q=80',
  },
];

const SAMPLE_MODELS = [
  {
    id: 'woman_studio',
    label: 'Modelo Mujer (Estudio)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'man_studio',
    label: 'Modelo Hombre (Estudio)',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'full_body_woman',
    label: 'Cuerpo Completo (Mujer)',
    url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
  },
];

const QUICK_OFFERS = [
  'HASTA 50% OFF',
  'NUEVA COLECCIÓN 2026',
  '2x1 ESTE FIN DE SEMANA',
  'OFERTA FLASH 24H',
  'LIQUIDACIÓN DE TEMPORADA',
  'ENVÍO GRATIS A TODO EL PAÍS',
];

export default function FashionSeedreamStudio({
  language = 'es',
  setToast,
  falKeyConfigured = true,
}: FashionSeedreamStudioProps) {
  // Motor de Inteligencia Artificial
  const [selectedEngine, setSelectedEngine] = useState<'openai-sunburst' | 'seedream-v4'>('openai-sunburst');
  const [selectedQuality, setSelectedQuality] = useState<'high' | 'medium'>('medium');

  // Modelo y Prendas
  const [modelImage, setModelImage] = useState<string>('');
  const [garmentImages, setGarmentImages] = useState<string[]>([]);
  
  // Fidelidad Facial Estricta
  const [preserveFace, setPreserveFace] = useState<boolean>(true);

  // Pancartas y Fondos
  const [selectedBannerMode, setSelectedBannerMode] = useState<'preset' | 'custom' | 'none'>('preset');
  const [selectedBannerPreset, setSelectedBannerPreset] = useState<string>('urban_pancarta');
  const [customBannerImage, setCustomBannerImage] = useState<string>('');

  // Datos del Local y Oferta Comercial
  const [storeName, setStoreName] = useState<string>('RIFX APPAREL');
  const [offerText, setOfferText] = useState<string>('GET UP TO 50% OFF');
  const [storeDescription, setStoreDescription] = useState<string>('Moda urbana contemporánea y ropa streetwear exclusiva de temporada.');
  const [contactInfo, setContactInfo] = useState<string>('WhatsApp: 0991234567 • @rifx_marketing • www.rifxmarketing.com');

  // Ajustes de Generación
  const [customPrompt] = useState<string>('');
  const [imageSize, setImageSize] = useState<'square_hd' | 'portrait_4_3' | 'portrait_16_9' | 'auto_2K'>('square_hd');
  const [enhanceMode] = useState<'standard' | 'fast'>('standard');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);

  // Historial y Galería "Ver Pancartas Generadas"
  const [savedBanners, setSavedBanners] = useState<StoredBanner[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [selectedBannerDetail, setSelectedBannerDetail] = useState<StoredBanner | null>(null);

  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const garmentFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Cargar historial persistente al montar
  useEffect(() => {
    try {
      const history = getBannerHistory();
      setSavedBanners(history);
    } catch (e) {
      console.warn('Error loading banners history:', e);
    }
  }, []);

  const handleModelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setModelImage(dataUri);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  // Límite dinámico de prendas para controlar estrictamente el costo
  const maxGarments = selectedEngine === 'openai-sunburst' ? (selectedQuality === 'high' ? 4 : 2) : 2;

  const handleGarmentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remainingSlots = Math.max(0, maxGarments - garmentImages.length);
    if (remainingSlots === 0) {
      setToast?.({
        message:
          selectedQuality === 'medium'
            ? 'En modo Estándar el límite es de 2 prendas para asegurar la tarifa de $0.03612 USD. Activa "Máxima Calidad ($0.10)" para hasta 4 prendas.'
            : 'Has alcanzado el límite máximo de 4 prendas.',
        type: 'info',
      });
      if (e.target) e.target.value = '';
      return;
    }
    const filesToRead = Array.from(files).slice(0, remainingSlots);

    filesToRead.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUri = event.target?.result as string;
        setGarmentImages((prev) => [...prev, dataUri].slice(0, maxGarments));
        setErrorMsg(null);
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  };

  const handleBannerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setCustomBannerImage(dataUri);
      setSelectedBannerMode('custom');
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveGarment = (index: number) => {
    setGarmentImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Obtener URL de la pancarta según el modo
  const getActiveBannerUrl = (): string => {
    if (selectedBannerMode === 'none') return '';
    if (selectedBannerMode === 'custom') return customBannerImage;
    const preset = BANNER_PRESETS.find((b) => b.id === selectedBannerPreset);
    return preset ? preset.url : '';
  };

  const isSunburst = selectedEngine === 'openai-sunburst';

  const handleGenerate = async () => {
    if (!modelImage && garmentImages.length === 0 && selectedBannerMode === 'none') {
      const msg = 'Sube al menos la foto de un modelo/persona o una prenda de ropa.';
      setErrorMsg(msg);
      setToast?.({ message: msg, type: 'info' });
      return;
    }

    setIsGenerating(true);
    setStatusMessage(
      isSunburst
        ? 'Enviando a OpenAI GPT Image 2.5 (Sunburst Edit) en Fal.ai...'
        : 'Enviando imágenes a ByteDance SeedDream v4 en Fal.ai...'
    );
    setErrorMsg(null);

    const activeBanner = getActiveBannerUrl();

    try {
      setStatusMessage(
        isSunburst
          ? 'Razonando composición: vistiendo modelo, calzando zapatos en pies y ajustando tipografía...'
          : 'Fijando rasgos faciales y adaptando prendas con SeedDream v4...'
      );
      
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('rifx_session_token') || localStorage.getItem('token') || '')
        : '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/panel/fashion/seedream', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          model_image: modelImage,
          garment_images: garmentImages.slice(0, maxGarments),
          banner_image: activeBanner,
          banner_mode: selectedBannerMode,
          store_name: storeName,
          offer_text: offerText,
          store_description: storeDescription,
          contact_info: contactInfo,
          preserve_face: preserveFace,
          engine: isSunburst ? 'openai/gpt-image-2.5/sunburst/edit' : 'seedream',
          pricing_tier: selectedQuality === 'high' ? 'pro' : 'standard',
          quality: selectedQuality,
          prompt: customPrompt,
          image_size: imageSize,
          enhance_prompt_mode: enhanceMode,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        if (
          res.status === 401 ||
          data?.session_expired ||
          data?.error?.toLowerCase().includes('expirad') ||
          data?.error?.toLowerCase().includes('no autorizado') ||
          data?.error?.toLowerCase().includes('no autenticado')
        ) {
          setSessionExpired(true);
          const msg = 'Tu sesión ha expirado. Por favor, vuelve a iniciar la aplicación.';
          setErrorMsg(msg);
          setToast?.({ message: msg, type: 'error' });
          return;
        }

        const errorDetail = data?.error || `Error al procesar con ${isSunburst ? 'OpenAI GPT Image 2.5' : 'SeedDream v4'}`;
        throw new Error(errorDetail);
      }

      const generatedUrl = data.image;
      setResultImage(generatedUrl);

      // Guardar automáticamente en el almacén persistente de pancartas
      const newSavedItem = {
        templateId: isSunburst ? 'fashion_openai_sunburst' : 'fashion_seedream_v4',
        templateName: storeName ? `${storeName} • ${offerText || 'Moda'}` : (isSunburst ? 'Pancarta Moda OpenAI GPT 2.5' : 'Pancarta Moda SeedDream v4'),
        templateIcon: 'checkroom',
        imageUrl: generatedUrl,
        costTier: isSunburst ? (selectedQuality === 'high' ? '$0.10' : '$0.03612') : '$0.03',
        mediaType: 'image' as const,
        metadata: {
          storeName,
          offerText,
          storeDescription,
          contactInfo,
          preserveFace,
          engine: selectedEngine,
          quality: selectedQuality,
          date: new Date().toISOString(),
        },
      };

      const updatedHistory = saveBannersToHistory([newSavedItem]);
      setSavedBanners(updatedHistory);

      setToast?.({
        message: `🎉 ¡Pancarta generada con éxito con ${isSunburst ? 'OpenAI GPT Image 2.5' : 'SeedDream v4'} y guardada en tu historial!`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error generating fashion banner:', err);
      const errText = err.message || 'Error al conectar con la API de Fal.ai';
      setErrorMsg(errText);
      setToast?.({ message: errText, type: 'error' });
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const handleDeleteSavedBanner = (bannerId: string) => {
    const updated = deleteBannerFromHistory(bannerId);
    setSavedBanners(updated);
    if (selectedBannerDetail?.id === bannerId) {
      setSelectedBannerDetail(null);
    }
    setToast?.({ message: 'Pancarta eliminada del historial', type: 'info' });
  };

  // Costo mostrado exacto según tier fijado
  const currentCostText = isSunburst
    ? selectedQuality === 'high'
      ? '$0.10'
      : '$0.03612'
    : '$0.03';

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Encabezado Principal con Botón Destacado "Ver Pancartas Generadas" */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 border border-blue-500/30 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-blue-400 text-3xl">checkroom</span>
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 text-slate-950 font-black text-[11px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                {isSunburst ? 'OpenAI GPT Image 2.5 (Sunburst Edit)' : 'ByteDance SeedDream v4'}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">face</span>
                Fidelidad Facial 100%
              </span>
              <span className="bg-purple-500/20 text-purple-200 border border-purple-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Fal.ai Powered
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Sección de Ropa • Pancartas y Probador Comercial
            </h3>
            <p className="text-sm text-blue-100/80 mt-1 max-w-2xl">
              Viste a tu modelo con ropa en su posición anatómica real (zapatos en los pies, ropa en el cuerpo, gafas en la cara), sin objetos flotantes y con tipografía publicitaria limpia.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Botón Ver Pancartas Generadas */}
            <button
              onClick={() => setShowHistoryModal(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-95 border border-blue-400/30"
            >
              <span className="material-symbols-outlined text-xl">collections</span>
              <span>VER PANCARTAS GENERADAS</span>
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-black">
                {savedBanners.length}
              </span>
            </button>

            {/* Tarjeta de Costo Dinámico */}
            <div className="bg-white/10 backdrop-blur-md border border-white/15 px-4 py-2.5 rounded-2xl text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">Costo estimado</span>
              <span className="text-xl font-black text-white">{currentCostText} <span className="text-xs font-normal text-blue-200">USD</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* SELECTOR DE MOTOR DE INTELIGENCIA ARTIFICIAL */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600">psychology</span>
              Motor de IA para Generación de Ropa y Pancarta
            </h4>
            <p className="text-xs text-slate-500">
              Selecciona el motor de inteligencia artificial que editará la imagen y colocará las prendas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Opción 1: OpenAI GPT Image 2.5 Sunburst Edit */}
          <div
            onClick={() => setSelectedEngine('openai-sunburst')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
              selectedEngine === 'openai-sunburst'
                ? 'border-blue-600 bg-blue-50/20 ring-2 ring-blue-500/20 shadow-md'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-900">
                    OpenAI GPT Image 2.5 (Sunburst Edit)
                  </span>
                  <span className="bg-emerald-500/10 text-emerald-700 border border-emerald-400/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                    Recomendado
                  </span>
                </div>
                {selectedEngine === 'openai-sunburst' && (
                  <span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Razonamiento espacial avanzado:</strong> Coloca cada prenda anatómicamente en su lugar (zapatos en los pies, pantalones en las piernas, ropa en el cuerpo, gafas en la cara). <em>Evita objetos flotantes sueltos</em> y genera textos claros.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">Tarifa oficial Fal.ai:</span>
              <span className="font-black text-blue-700">~$0.013 (Medio) a ~$0.036 (Alto) USD</span>
            </div>
          </div>

          {/* Opción 2: ByteDance SeedDream v4 */}
          <div
            onClick={() => setSelectedEngine('seedream-v4')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
              selectedEngine === 'seedream-v4'
                ? 'border-pink-600 bg-pink-50/20 ring-2 ring-pink-500/20 shadow-md'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-extrabold text-sm text-slate-900">
                  ByteDance SeedDream v4 Edit
                </span>
                {selectedEngine === 'seedream-v4' && (
                  <span className="material-symbols-outlined text-pink-600 text-lg">check_circle</span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Modelo de difusión textil directa. Excelente para probar 1 o 2 prendas individuales sencillas en estudio fotográfico.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">Tarifa oficial Fal.ai:</span>
              <span className="font-black text-pink-700">$0.03 USD fijos</span>
            </div>
          </div>
        </div>

        {/* Ajuste de Calidad y Control Estricto de Tarifa */}
        {selectedEngine === 'openai-sunburst' && (
          <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-base">lock</span>
              <div>
                <span className="font-bold text-slate-800 block">Control Estricto de Tarifa:</span>
                <span className="text-[10px] text-slate-500">
                  {selectedQuality === 'medium'
                    ? 'Bloqueado en $0.03612 • Máx 2 prendas combinadas'
                    : 'Modo Pro en $0.10 • Hasta 4 prendas detalladas'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedQuality('medium');
                  if (garmentImages.length > 2) {
                    setGarmentImages((prev) => prev.slice(0, 2));
                    setToast?.({
                      message: 'Ajustado a 2 prendas para garantizar la tarifa fija de $0.03612 USD.',
                      type: 'info',
                    });
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
                  selectedQuality === 'medium'
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/30'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-xs">verified</span>
                Estándar ($0.03612) • 2 Prendas Máx
              </button>
              <button
                type="button"
                onClick={() => setSelectedQuality('high')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
                  selectedQuality === 'high'
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/30'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-xs">star</span>
                Máxima Calidad ($0.10) • Hasta 4 Prendas
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Switch de Fidelidad Facial */}
      <div className="bg-gradient-to-r from-slate-900 to-purple-950/80 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
            <span className="material-symbols-outlined text-2xl">verified_user</span>
          </div>
          <div>
            <h4 className="font-bold text-sm sm:text-base flex items-center gap-2">
              Preservar Rasgos Faciales Fielmente
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase font-bold">
                Activo
              </span>
            </h4>
            <p className="text-xs text-slate-300">
              Instruye a la IA a conservar ojos, nariz, boca, forma del rostro y expresión del modelo sin morphing ni deformaciones.
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={preserveFace}
            onChange={(e) => setPreserveFace(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          <span className="ml-2 text-xs font-semibold text-slate-200">
            {preserveFace ? 'Fidelidad Máxima' : 'Desactivado'}
          </span>
        </label>
      </div>

      {/* SECCIÓN 1: SELECTOR DE PANCARTAS PUBLICITARIAS - SECCIÓN DE MODA */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-pink-100 text-pink-800 border border-pink-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">check</span>
                Sección de Moda Exclusiva
              </span>
            </div>
            <h4 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-pink-600">view_carousel</span>
              1. Selecciona o Sube tu Pancarta Publicitaria • Sección de Moda
            </h4>
            <p className="text-xs text-slate-500">
              Catálogo exclusivo de la <strong>Sección de Moda</strong>. La IA integrará al modelo con la ropa que elijas directamente en el diseño de esta pancarta.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedBannerMode('preset')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedBannerMode === 'preset'
                  ? 'bg-pink-600 text-white shadow-sm ring-2 ring-pink-400/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-xs">checkroom</span>
              Plantillas de Moda (Activo)
            </button>
            <button
              onClick={() => {
                setSelectedBannerMode('custom');
                bannerFileInputRef.current?.click();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                selectedBannerMode === 'custom'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-sm">upload</span>
              Subir Mi Pancarta
            </button>
            <button
              onClick={() => setSelectedBannerMode('none')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedBannerMode === 'none'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Sin Pancarta (Estudio Puro)
            </button>
          </div>
        </div>

        {/* Input Oculto para Subir Pancarta Personalizada */}
        <input
          type="file"
          ref={bannerFileInputRef}
          onChange={handleBannerFileUpload}
          accept="image/*"
          className="hidden"
        />

        {/* Galería de Pancartas Preconfiguradas */}
        {selectedBannerMode === 'preset' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            {BANNER_PRESETS.map((banner) => {
              const isSelected = selectedBannerPreset === banner.id;
              return (
                <div
                  key={banner.id}
                  onClick={() => setSelectedBannerPreset(banner.id)}
                  className={`group relative rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                    isSelected
                      ? 'border-pink-500 shadow-md ring-2 ring-pink-500/30'
                      : 'border-slate-200 hover:border-pink-300'
                  }`}
                >
                  <div className="aspect-square w-full bg-slate-900 relative overflow-hidden">
                    <img
                      src={banner.url}
                      alt={banner.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-sm text-pink-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-pink-500/20">
                      {banner.tag}
                    </div>
                    {isSelected && (
                      <div className="absolute inset-0 bg-pink-500/20 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="bg-pink-600 text-white rounded-full p-1.5 shadow-md material-symbols-outlined text-lg">
                          check
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-white">
                    <h5 className="font-bold text-xs text-slate-900 line-clamp-1">{banner.name}</h5>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{banner.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pancarta Personalizada Subida */}
        {selectedBannerMode === 'custom' && (
          <div className="pt-2">
            {customBannerImage ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="h-32 min-w-[90px] max-w-[130px] rounded-2xl overflow-hidden border-2 border-pink-500/30 shrink-0 bg-slate-950 flex items-center justify-center p-1.5 shadow-md">
                  <img src={customBannerImage} alt="Tu pancarta" className="h-full w-auto max-w-full object-contain rounded-lg" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="font-bold text-sm text-slate-800">Pancarta Personalizada Cargada</h5>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">verified</span>
                      100% Sin Recortes
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    La IA adaptará el modelo y la ropa seleccionada dentro del marco y composición exacta de esta imagen.
                  </p>
                </div>
                <button
                  onClick={() => bannerFileInputRef.current?.click()}
                  className="px-4 py-2 bg-white border border-slate-300 hover:border-pink-500 text-slate-700 font-semibold text-xs rounded-xl shadow-sm transition-all"
                >
                  Cambiar Imagen
                </button>
              </div>
            ) : (
              <div
                onClick={() => bannerFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-pink-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-50 hover:bg-pink-50/20"
              >
                <span className="material-symbols-outlined text-4xl text-slate-400">upload_file</span>
                <p className="text-sm font-bold text-slate-700 mt-2">Haz clic para subir tu diseño de pancarta o flyer</p>
                <p className="text-xs text-slate-400 mt-1">Soporta PNG, JPG o WebP en formato cuadrado o vertical</p>
              </div>
            )}
          </div>
        )}

        {selectedBannerMode === 'none' && (
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400">info</span>
            <span>Generará una sesión de estudio fotográfico pura sin marco publicitario exterior.</span>
          </div>
        )}
      </div>

      {/* SECCIÓN 2: FORMULARIO DE LOCAL Y OFERTA PARA LA PANCARTA */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h4 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">storefront</span>
            2. Datos de tu Local y Oferta para la Pancarta
          </h4>
          <p className="text-xs text-slate-500">
            Rellena la información para que la IA adapte los textos, badges promocionales y el estilo comercial a tu negocio sin errores de duplicación.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Nombre del Local */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nombre de tu Tienda / Marca
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Ej: BOUTIQUE AURORA, URBAN CLOTHES..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-800"
            />
          </div>

          {/* Oferta / Gancho Principal */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Oferta o Gancho Comercial
            </label>
            <input
              type="text"
              value={offerText}
              onChange={(e) => setOfferText(e.target.value)}
              placeholder="Ej: HASTA 50% OFF, NUEVA COLECCIÓN 2026..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-800"
            />
          </div>
        </div>

        {/* Botones Rápidos de Oferta */}
        <div>
          <span className="text-[11px] font-bold text-slate-500 block mb-1.5">
            Opciones rápidas de oferta (1 clic):
          </span>
          <div className="flex flex-wrap gap-2">
            {QUICK_OFFERS.map((q) => (
              <button
                key={q}
                onClick={() => setOfferText(q)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                  offerText === q
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Breve descripción del local o estilo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Breve Descripción de tu Local o Estilo
            </label>
            <textarea
              rows={2}
              value={storeDescription}
              onChange={(e) => setStoreDescription(e.target.value)}
              placeholder="Ej: Tienda de ropa juvenil con lo último en tendencias street style y looks modernos..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs text-slate-700"
            />
          </div>

          {/* Contacto / Redes / Sitio Web */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contacto, Redes Sociales o Sitio Web
            </label>
            <textarea
              rows={2}
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Ej: WhatsApp: 0991234567 • @mitienda • www.mitienda.com"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs text-slate-700"
            />
          </div>
        </div>

        {/* SELECTOR DE DIMENSIONES / FORMATO DE LA PANCARTA */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-blue-600">aspect_ratio</span>
              Dimensiones / Formato de la Pancarta
            </label>
            <p className="text-[10px] text-slate-400">
              Elige la proporción ideal para tus anuncios de moda o historias comerciales.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['square_hd', 'portrait_4_3', 'portrait_16_9', 'auto_2K'] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setImageSize(size)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  imageSize === size
                    ? 'bg-slate-900 text-white shadow-md ring-2 ring-slate-900/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {size === 'square_hd' ? 'crop_square' : size === 'portrait_4_3' ? 'crop_portrait' : size === 'portrait_16_9' ? 'stay_current_portrait' : 'hd'}
                </span>
                <span>
                  {size === 'square_hd' && '1:1 Pancarta (Cuadrado)'}
                  {size === 'portrait_4_3' && '3:4 Catálogo (Vertical)'}
                  {size === 'portrait_16_9' && '9:16 Historia (Reels/Stories)'}
                  {size === 'auto_2K' && 'Auto 2K'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: SUBIDA DE MODELO Y PRENDAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* LADO 1: FOTO DEL MODELO / PERSONA */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-extrabold text-slate-900 flex items-center gap-2 text-base">
                <span className="material-symbols-outlined text-purple-600">person</span>
                3. Foto del Modelo / Persona
              </h4>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                {preserveFace ? 'Rostros Protegidos' : 'Cara Libre'}
              </span>
            </div>

            {/* Preview o Drag/Drop */}
            {modelImage ? (
              <div className="relative group rounded-2xl overflow-hidden aspect-[3/4] bg-slate-950 max-h-80 mx-auto border-2 border-purple-500/30 shadow-inner">
                <img src={modelImage} alt="Modelo" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => modelFileInputRef.current?.click()}
                    className="p-2 bg-white text-slate-900 rounded-full font-bold text-xs shadow-md hover:bg-slate-100"
                    title="Cambiar foto"
                  >
                    <span className="material-symbols-outlined text-base">swap_horiz</span>
                  </button>
                  <button
                    onClick={() => setModelImage('')}
                    className="p-2 bg-rose-600 text-white rounded-full font-bold text-xs shadow-md hover:bg-rose-500"
                    title="Eliminar"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => modelFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-purple-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-purple-50/30 flex flex-col items-center justify-center min-h-[200px]"
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
                </div>
                <p className="text-xs font-bold text-slate-700">Subir foto de tu modelo o persona</p>
                <p className="text-[10px] text-slate-400 mt-1">PNG, JPG o WebP con buena iluminación facial</p>
              </div>
            )}

            <input
              type="file"
              ref={modelFileInputRef}
              onChange={handleModelFileUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Presets de Modelos de Muestra */}
            <div className="mt-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                O usa un modelo de prueba:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {SAMPLE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModelImage(m.url)}
                    className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-purple-500 aspect-square text-left transition-all"
                  >
                    <img src={m.url} alt={m.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-1">
                      <span className="text-[9px] font-bold text-white block truncate text-center">{m.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* LADO 2: PRENDAS DE ROPA */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-extrabold text-slate-900 flex items-center gap-2 text-base">
                <span className="material-symbols-outlined text-blue-600">styler</span>
                4. Prendas de Ropa ({selectedQuality === 'high' ? 'Hasta 4 prendas' : 'Máximo 2 prendas'})
              </h4>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                selectedQuality === 'medium'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                  : 'bg-amber-50 text-amber-800 border border-amber-300/60'
              }`}>
                <span className="material-symbols-outlined text-xs">
                  {selectedQuality === 'medium' ? 'lock' : 'star'}
                </span>
                {garmentImages.length}/{maxGarments} Prendas {selectedQuality === 'medium' ? '($0.03612)' : '($0.10)'}
              </span>
            </div>

            {/* Grid de Prendas */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {garmentImages.map((gImg, idx) => (
                <div key={idx} className="relative group rounded-2xl overflow-hidden aspect-square bg-slate-950 border border-slate-200 shadow-sm">
                  <img src={gImg} alt={`Prenda ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Prenda {idx + 1}
                  </div>
                  <button
                    onClick={() => handleRemoveGarment(idx)}
                    className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500"
                    title="Eliminar prenda"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </div>
              ))}

              {garmentImages.length < maxGarments && (
                <div
                  onClick={() => garmentFileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-blue-50/20 hover:bg-blue-50/50 flex flex-col items-center justify-center aspect-square"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-xl">add</span>
                  </div>
                  <p className="text-xs font-bold text-blue-700">Añadir Prenda</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    {selectedQuality === 'medium' ? 'Máx 2 para fijar $0.03612' : 'Hasta 4 prendas Pro'}
                  </p>
                </div>
              )}

              {/* Si llegó al tope de 2 en modo estándar, dar opción rápida de ampliar a 4 */}
              {garmentImages.length >= maxGarments && selectedQuality === 'medium' && (
                <div
                  onClick={() => setSelectedQuality('high')}
                  className="border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 hover:border-indigo-400 rounded-2xl p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-center aspect-square text-xs shadow-sm"
                >
                  <span className="material-symbols-outlined text-indigo-600 text-2xl mb-1">lock_open</span>
                  <span className="font-bold text-slate-800 text-[11px] leading-tight">¿Deseas 4 prendas?</span>
                  <span className="text-[10px] text-indigo-600 font-semibold mt-1 underline">
                    Activar Máxima Calidad ($0.10)
                  </span>
                </div>
              )}
            </div>

            <input
              type="file"
              ref={garmentFileInputRef}
              onChange={handleGarmentFileUpload}
              accept="image/*"
              multiple
              className="hidden"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs text-slate-600 flex items-start gap-2">
            <span className="material-symbols-outlined text-blue-500 text-base shrink-0 mt-0.5">
              {selectedQuality === 'medium' ? 'shield' : 'verified'}
            </span>
            <span>
              {selectedQuality === 'medium' ? (
                <>
                  <strong>Control Anti-Disparo de Tarifa ($0.03612):</strong> Se admiten máximo 2 prendas que el sistema combina inteligentemente para que Fal.ai no compute imágenes adicionales (evitando que el precio suba a $0.06).
                </>
              ) : (
                <>
                  <strong>Modo Pro Máxima Calidad ($0.10):</strong> Puedes incluir hasta 4 prendas separadas completas (camisa, pantalón, zapatos en los pies y accesorios) con resolución nativa.
                </>
              )}
            </span>
          </div>
        </div>
      </div>


      {/* LETRERO DESTACADO: SESIÓN EXPIRADA */}
      {sessionExpired ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white rounded-3xl p-6 sm:p-7 shadow-2xl border-2 border-red-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 animate-pulse"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-3xl text-white">lock_clock</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-white/25 border border-white/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider text-white">
                  Aviso de Seguridad
                </span>
              </div>
              <h4 className="text-xl font-black text-white tracking-tight">
                ¡Tu sesión ha expirado!
              </h4>
              <p className="text-xs text-red-100 max-w-xl leading-relaxed mt-1">
                Por motivos de seguridad tu sesión caducó por inactividad. Debes volver a iniciar la aplicación para continuar generando tus pancartas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem('rifx_session_token');
                localStorage.removeItem('token');
              } catch (_) {}
              window.location.reload();
            }}
            className="w-full sm:w-auto px-6 py-3.5 bg-white text-red-700 hover:bg-red-50 active:scale-95 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl transition-all shrink-0 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">login</span>
            <span>Volver a Iniciar la Aplicación</span>
          </button>
        </motion.div>
      ) : errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* MODAL POPUP: LETRERO DE SESIÓN EXPIRADA */}
      {sessionExpired && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 text-center shadow-2xl border border-red-100 relative overflow-hidden"
          >
            <div className="w-16 h-16 bg-red-100 border border-red-200 text-red-600 rounded-full mx-auto flex items-center justify-center mb-4 shadow-sm">
              <span className="material-symbols-outlined text-3xl">lock_clock</span>
            </div>
            <span className="text-[10px] font-black tracking-wider uppercase bg-red-100 text-red-800 px-3 py-1 rounded-full border border-red-200">
              Seguridad RIFX Marketing
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-3 mb-2">
              Tu sesión ha expirado
            </h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Por motivos de seguridad, tu sesión ha caducado. Vuelve a iniciar la aplicación para continuar generando tus pancartas publicitarias y proteger tu cuenta.
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('rifx_session_token');
                    localStorage.removeItem('token');
                  } catch (_) {}
                  window.location.reload();
                }}
                className="w-full py-4 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-red-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">login</span>
                Volver a Iniciar la Aplicación
              </button>
              <button
                type="button"
                onClick={() => setSessionExpired(false)}
                className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors"
              >
                Cerrar aviso
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* BOTÓN DE GENERACIÓN */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 p-6 rounded-3xl text-white shadow-xl">
        <div>
          <h4 className="font-extrabold text-base text-white">¿Listo para generar tu pancarta de ropa?</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Costo: <strong className="text-emerald-400">{currentCostText} USD</strong> • Motor: <span className="text-blue-300 font-bold">{isSunburst ? 'OpenAI GPT Image 2.5' : 'SeedDream v4'}</span> • Posición anatómica asegurada
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-3 transition-all ${
            isGenerating
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 active:scale-95'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>{statusMessage || 'Procesando en Fal.ai...'}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-xl">palette</span>
              <span>Generar con {isSunburst ? 'OpenAI GPT Image 2.5' : 'SeedDream v4'}</span>
            </>
          )}
        </button>
      </div>

      {/* RESULTADO GENERADO */}
      {resultImage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-0.5 rounded-full uppercase">
                  Generación Exitosa
                </span>
                <span className="bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-0.5 rounded-full uppercase">
                  {isSunburst ? 'OpenAI GPT Image 2.5' : 'SeedDream v4'}
                </span>
                <span className="bg-purple-100 text-purple-800 text-xs font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">bookmark</span>
                  Guardada en Historial
                </span>
              </div>
              <h4 className="text-xl font-black text-slate-900 mt-2">
                Pancarta de Ropa Finalizada
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {storeName} • {offerText} • Posición anatómica y rasgos faciales conservados
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={resultImage}
                target="_blank"
                rel="noreferrer"
                download="pancarta-ropa-hd.png"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Descargar en HD
              </a>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-base">collections</span>
                Ver Pancartas Guardadas ({savedBanners.length})
              </button>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-slate-950 max-w-2xl mx-auto border border-slate-300 shadow-lg">
            <img
              src={resultImage}
              alt="Pancarta generada"
              className="w-full h-auto object-contain max-h-[700px] mx-auto"
            />
          </div>
        </motion.div>
      )}

      {/* MODAL / GALERÍA: "VER PANCARTAS GENERADAS" */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200"
            >
              {/* Encabezado del Modal */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300">
                    <span className="material-symbols-outlined text-2xl">collections</span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-white">
                      Pancartas Generadas ({savedBanners.length})
                    </h3>
                    <p className="text-xs text-blue-200/80">
                      Historial permanente de pancartas comerciales y sesiones de ropa creadas con IA.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Contenido: Galería */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {savedBanners.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <span className="material-symbols-outlined text-5xl text-slate-300">image_not_supported</span>
                    <h4 className="font-bold text-slate-700 text-sm">Aún no has generado pancartas</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Sube la foto de tu modelo y las prendas en el formulario para generar tu primera pancarta comercial con IA.
                    </p>
                    <button
                      onClick={() => setShowHistoryModal(false)}
                      className="px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-blue-500 transition-all"
                    >
                      Crear Mi Primera Pancarta
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {savedBanners.map((banner) => (
                      <div
                        key={banner.id}
                        className="group bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div
                          onClick={() => setSelectedBannerDetail(banner)}
                          className="aspect-square w-full bg-slate-900 relative overflow-hidden cursor-pointer"
                        >
                          <img
                            src={banner.imageUrl}
                            alt={banner.templateName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="bg-white/90 text-slate-900 text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">zoom_in</span>
                              Ver en Grande
                            </span>
                          </div>
                        </div>

                        <div className="p-3.5 space-y-2">
                          <div>
                            <h5 className="font-extrabold text-xs text-slate-900 line-clamp-1">
                              {banner.templateName}
                            </h5>
                            <span className="text-[10px] text-slate-400">
                              {new Date(banner.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                            <a
                              href={banner.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              download={`pancarta-${banner.id}.png`}
                              className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">download</span>
                              Descargar
                            </a>

                            <button
                              onClick={() => handleDeleteSavedBanner(banner.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              title="Eliminar pancarta"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX DE DETALLE EN GRANDE */}
      <AnimatePresence>
        {selectedBannerDetail && (
          <div
            onClick={() => setSelectedBannerDetail(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full p-4 overflow-hidden relative shadow-2xl text-white space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="font-extrabold text-sm text-white">
                  {selectedBannerDetail.templateName}
                </h4>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedBannerDetail.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    download="pancarta-hd.png"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">download</span>
                    Descargar HD
                  </a>
                  <button
                    onClick={() => setSelectedBannerDetail(null)}
                    className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black max-h-[70vh] flex items-center justify-center">
                <img
                  src={selectedBannerDetail.imageUrl}
                  alt={selectedBannerDetail.templateName}
                  className="max-h-[70vh] w-auto object-contain mx-auto"
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
