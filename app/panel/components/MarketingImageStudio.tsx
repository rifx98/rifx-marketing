"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getBannerHistory, 
  saveBannersToHistory, 
  deleteBannerFromHistory, 
  type StoredBanner 
} from '@/lib/banner-history';

interface MarketingImageStudioProps {
  language?: string;
  setToast?: (toast: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
  falKeyConfigured?: boolean;
  onContinueToCampaigns?: (imageUrl: string) => void;
}

export interface BannerItem {
  id: string;
  name: string;
  tag: string;
  desc: string;
  url: string;
  isCustom?: boolean;
}

const BANNER_PRESETS: BannerItem[] = [
  {
    id: 'infografia_comercial_4b',
    name: 'Alto Impacto Comercial (4 Beneficios + Pedestal)',
    tag: 'E-commerce Ganador',
    desc: 'Producto real sobre pedestal 3D a la derecha con titular de alto impacto y 4 beneficios con sellos de garantía.',
    url: '/templates/infografia-comercial-producto.jpg',
  },
  {
    id: 'ruleta_beneficios',
    name: 'Ruleta Circular 360 (5 Beneficios Clave)',
    tag: 'Conversión Meta Ads',
    desc: 'Producto central rodeado por aro dinámico de 5 beneficios destacados con iconos e iluminación de estudio.',
    url: '/templates/ruleta-beneficios-circular.jpg',
  },
  {
    id: 'ruleta_fitness',
    name: 'Pancarta Suplementos & Nutrición Fitness',
    tag: 'Fitness & Salud',
    desc: 'Tarjetas flotantes con beneficios nutricionales, estética deportiva y contraste de iluminación de alto rendimiento.',
    url: '/templates/ruleta-fitness-suplemento.jpg',
  },
  {
    id: 'urban_pancarta',
    name: 'Pancarta Flyer Urbana (50% OFF)',
    tag: 'Streetwear & Moda',
    desc: 'Flyer publicitario en contraste verde esmeralda y amarillo dorado con tipografía NEW COLLECTION y badge de 50% OFF.',
    url: '/templates/fashion-banner-urban.png',
  },
  {
    id: 'creative_paper_bag',
    name: 'Pancarta Conceptual "Tunnel Perspective"',
    tag: 'Creativo & Viral',
    desc: 'Perspectiva única desde el interior de bolsa comercial de papel kraft, tipografía stencil gigante y recibo impreso.',
    url: '/templates/fashion-concept-perspective.jpg',
  },
  {
    id: 'luxury_gold',
    name: 'Pancarta Lujo Editorial & Alta Gama',
    tag: 'Joyería & Perfumería',
    desc: 'Estilo de alta gama con iluminación dramática de estudio, fondo minimalista oscuro y reflejos dorados refinados.',
    url: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'cyber_neon',
    name: 'Pancarta Cyber & Neon Streetwear',
    tag: 'Tech & Streetwear',
    desc: 'Atmósfera nocturna vibrante con aros y halos de neón, estética moderna futurista y tipografía publicitaria audaz.',
    url: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'splash_energy',
    name: 'Pancarta Splash Dinámico & Bebidas',
    tag: 'Bebidas & Alimentos',
    desc: 'Explosión de agua cristalina, gotas congeladas en el aire y fondo degradado dinámico con alto contraste.',
    url: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'minimal_pedestal',
    name: 'Pancarta Podio Minimalista & Titanio',
    tag: 'Arquitectura & Gadgets',
    desc: 'Pedestal arquitectónico de piedra pulida con sombras suaves de estudio y atmósfera comercial ultra limpia.',
    url: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'beauty_skincare',
    name: 'Pancarta Belleza & Glow Skincare',
    tag: 'Belleza & Cosmética',
    desc: 'Atmósfera luminosa con tonos pastel suaves, reflejos de agua fresca y estética premium para cosméticos.',
    url: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=1000&q=80',
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

export default function MarketingImageStudio({
  language = 'es',
  setToast,
  falKeyConfigured = true,
  onContinueToCampaigns,
}: MarketingImageStudioProps) {
  // Producto y Activos
  const [productImage, setProductImage] = useState<string>('');
  const [secondaryAssetImage, setSecondaryAssetImage] = useState<string>('');
  const [subjectType, setSubjectType] = useState<'person' | 'product'>('person');

  // Pancartas y Fondos
  const [selectedBannerMode, setSelectedBannerMode] = useState<'preset' | 'custom' | 'none'>('preset');
  const [selectedBannerPreset, setSelectedBannerPreset] = useState<string>('infografia_comercial_4b');
  const [customBannerImage, setCustomBannerImage] = useState<string>('');
  const [customBannerDimensions, setCustomBannerDimensions] = useState<{ width: number; height: number } | null>(null);
  const [zoomModalUrl, setZoomModalUrl] = useState<string | null>(null);

  // Plantillas dinámicas de la base de datos y segmentación
  const [dbBanners, setDbBanners] = useState<Array<{ id: string; name: string; tag: string; desc: string; url: string; isCustom?: boolean }>>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem('rifx_cached_panel_banners');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [showAddBannerModal, setShowAddBannerModal] = useState<boolean>(false);
  const [newBannerTitle, setNewBannerTitle] = useState<string>('');
  const [newBannerCategory, setNewBannerCategory] = useState<string>('Streetwear & Moda');
  const [newBannerImage, setNewBannerImage] = useState<string>('');
  const [isSavingNewBanner, setIsSavingNewBanner] = useState<boolean>(false);
  const newBannerFileInputRef = useRef<HTMLInputElement>(null);

  // Datos del Local y Oferta Comercial (Idea del Cliente mejorable con IA)
  const [storeName, setStoreName] = useState<string>('RIFX Marketing');
  const [offerText, setOfferText] = useState<string>('ARMAMOS UNA ESTRATEGIA PARA TU NEGOCIO');
  const [storeDescription, setStoreDescription] = useState<string>('Somos estrategas: estudiamos el mercado y lanzamos pautas publicitarias con una estrategia para captar nuevos clientes.');
  const [contactInfo, setContactInfo] = useState<string>('WhatsApp: 0991234567 • @rifx_marketing • www.rifxmarketing.com');
  const [isEnhancingCopy, setIsEnhancingCopy] = useState<boolean>(false);
  const [bulletPoints, setBulletPoints] = useState<string[]>([
    'Análisis de Mercado & Competencia',
    'Estrategias Personalizadas',
    'Campañas Publicitarias Efectivas',
    'Crecimiento Real de tu Negocio',
  ]);
  const [highlightCopyField, setHighlightCopyField] = useState<boolean>(false);

  // Ajustes de Generación (Predeterminado 1024x768 / 768x1024 sin recortes)
  const [imageSize, setImageSize] = useState<'square_hd' | 'portrait_4_3' | 'portrait_16_9' | 'auto_2K'>('portrait_4_3');
  const [selectedQuality, setSelectedQuality] = useState<'medium' | 'high'>('medium');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);

  // Detección Automática de Colores del Producto
  const [detectedColors, setDetectedColors] = useState<{
    colorName: string;
    hexCodes: string[];
  } | null>(null);
  const [isAnalyzingColors, setIsAnalyzingColors] = useState<boolean>(false);

  // Historial de Pancartas
  const [savedBanners, setSavedBanners] = useState<StoredBanner[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [selectedBannerDetail, setSelectedBannerDetail] = useState<StoredBanner | null>(null);

  const productFileInputRef = useRef<HTMLInputElement>(null);
  const secondaryFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Cargar plantillas desde /api/panel/templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const token = typeof window !== 'undefined'
          ? (localStorage.getItem('rifx_session_token') || localStorage.getItem('token') || '')
          : '';
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/panel/templates', { headers, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.templates)) {
            const items = data.templates
              .filter((t: any) => t.preview_image_url && t.name)
              .map((t: any) => ({
                id: t.id,
                name: t.name,
                tag: t.category || 'Streetwear & Moda',
                desc: t.config_json?.description || `Pancarta publicitaria para ${t.category || 'tu producto'}.`,
                url: t.preview_image_url,
                isCustom: true,
              }));
            setDbBanners(items);
            try {
              localStorage.setItem('rifx_cached_panel_banners', JSON.stringify(items));
            } catch {}
          }
        }
      } catch (e) {
        console.warn('No se pudieron cargar plantillas de DB:', e);
      }
    };
    fetchTemplates();
  }, []);

  // Combinación y filtrado reactivo de pancartas
  const allBannerPresets: BannerItem[] = React.useMemo(() => {
    const presetIds = new Set(BANNER_PRESETS.map((b) => b.id));
    const extra = dbBanners.filter((b) => !presetIds.has(b.id));
    return [...BANNER_PRESETS, ...extra];
  }, [dbBanners]);

  const filteredBannerPresets: BannerItem[] = React.useMemo(() => {
    if (selectedSegment === 'all') return allBannerPresets;
    const seg = selectedSegment.toLowerCase();
    return allBannerPresets.filter((b) => {
      const tag = (b.tag || '').toLowerCase();
      const name = (b.name || '').toLowerCase();
      if (seg === 'moda') {
        return tag.includes('moda') || tag.includes('streetwear') || tag.includes('ropa') || name.includes('moda') || name.includes('ropa');
      }
      if (seg === 'ecom') {
        return tag.includes('e-commerce') || tag.includes('comercial') || tag.includes('ganador');
      }
      if (seg === 'fitness') {
        return tag.includes('fitness') || tag.includes('salud') || tag.includes('suplement');
      }
      if (seg === 'lujo') {
        return tag.includes('lujo') || tag.includes('joyería') || tag.includes('perfum');
      }
      if (seg === 'viral') {
        return tag.includes('viral') || tag.includes('creativo') || tag.includes('concept');
      }
      if (seg === 'belleza') {
        return tag.includes('belleza') || tag.includes('cosmética') || tag.includes('skincare');
      }
      if (seg === 'alimentos') {
        return tag.includes('bebida') || tag.includes('alimento') || tag.includes('splash');
      }
      return tag.includes(seg) || name.includes(seg);
    });
  }, [allBannerPresets, selectedSegment]);

  // Cargar historial persistente al montar
  useEffect(() => {
    try {
      const history = getBannerHistory();
      setSavedBanners(history);
    } catch (e) {
      console.warn('Error loading banners history:', e);
    }
  }, []);

  // Extracción automática de color mediante HTML5 Canvas
  const extractColors = (dataUri: string) => {
    if (typeof window === 'undefined' || !dataUri) return;
    setIsAnalyzingColors(true);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size).data;

        const buckets: Record<string, { name: string; hex: string; count: number; isNeutral?: boolean }> = {
          naranja: { name: 'Naranja Vibrante', hex: '#FF6B00', count: 0 },
          azulMarino: { name: 'Azul Marino / Navy', hex: '#0F2744', count: 0 },
          azul: { name: 'Azul Eléctrico', hex: '#0058bc', count: 0 },
          cyan: { name: 'Turquesa / Cian', hex: '#06B6D4', count: 0 },
          dorado: { name: 'Dorado / Oro', hex: '#F59E0B', count: 0 },
          amarillo: { name: 'Amarillo Brillante', hex: '#FACC15', count: 0 },
          verde: { name: 'Verde Esmeralda', hex: '#10B981', count: 0 },
          verdeLima: { name: 'Verde Neón', hex: '#84CC16', count: 0 },
          rojo: { name: 'Rojo Rubí', hex: '#EF4444', count: 0 },
          rosa: { name: 'Rosa / Fucsia', hex: '#EC4899', count: 0 },
          morado: { name: 'Morado / Violeta', hex: '#8B5CF6', count: 0 },
          blanco: { name: 'Blanco Puro', hex: '#FFFFFF', count: 0, isNeutral: true },
          negro: { name: 'Negro Profundo', hex: '#0B1C30', count: 0, isNeutral: true },
        };

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 50) continue;
          if (r > 248 && g > 248 && b > 248) continue;

          const rN = r / 255, gN = g / 255, bN = b / 255;
          const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
          let h = 0, s = 0;
          const l = (max + min) / 2;

          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case rN: h = (gN - bN) / d + (gN < bN ? 6 : 0); break;
              case gN: h = (bN - rN) / d + 2; break;
              case bN: h = (rN - gN) / d + 4; break;
            }
            h *= 60;
          }

          if (l < 0.12) buckets.negro.count++;
          else if (s < 0.12 && l > 0.85) buckets.blanco.count++;
          else if (h >= 14 && h < 42 && s > 0.28) buckets.naranja.count++;
          else if (h >= 42 && h < 58 && s > 0.35) buckets.dorado.count++;
          else if (h >= 58 && h < 75 && s > 0.35) buckets.amarillo.count++;
          else if (h >= 75 && h < 115 && s > 0.25) buckets.verdeLima.count++;
          else if (h >= 115 && h < 165 && s > 0.20) buckets.verde.count++;
          else if (h >= 165 && h < 200 && s > 0.20) buckets.cyan.count++;
          else if (h >= 200 && h < 250 && s > 0.18) {
            if (l < 0.35) buckets.azulMarino.count++;
            else buckets.azul.count++;
          }
          else if (h >= 250 && h < 320 && s > 0.18) buckets.morado.count++;
          else if (h >= 320 && h < 350 && s > 0.20) buckets.rosa.count++;
          else if ((h >= 350 || h < 14) && s > 0.25) buckets.rojo.count++;
        }

        const chromatic = Object.values(buckets).filter(b => !b.isNeutral && b.count > 10).sort((a, b) => b.count - a.count);
        const neutrals = Object.values(buckets).filter(b => b.isNeutral && b.count > 10).sort((a, b) => b.count - a.count);

        const chosen: typeof buckets[string][] = [];
        // Extraer hasta un máximo de 3 colores del logotipo/imagen (priorizando cromáticos)
        for (const c of chromatic) {
          if (chosen.length < 3) chosen.push(c);
        }
        for (const n of neutrals) {
          if (chosen.length < 3) chosen.push(n);
        }

        if (chosen.length > 0) {
          const names = chosen.length === 1
            ? chosen[0].name
            : chosen.length === 2
            ? `${chosen[0].name} y ${chosen[1].name}`
            : `${chosen[0].name}, ${chosen[1].name} y ${chosen[2].name}`;
          setDetectedColors({
            colorName: names,
            hexCodes: chosen.map(c => c.hex),
          });
        } else {
          setDetectedColors(null);
        }
      } catch (err) {
        console.warn('Error extracting colors:', err);
      } finally {
        setIsAnalyzingColors(false);
      }
    };
    img.src = dataUri;
  };

  const handleProductFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setProductImage(dataUri);
      // Solo extraer colores si el sujeto es un producto comercial (envase).
      // Si es una persona / modelo, NO extraer colores de marca de su foto.
      if (subjectType === 'product') {
        extractColors(dataUri);
      } else if (!secondaryAssetImage) {
        setDetectedColors(null);
      }
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSecondaryFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setSecondaryAssetImage(dataUri);
      extractColors(dataUri); // El logotipo de la marca sí define la paleta corporativa
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
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
      // Extraer las dimensiones originales reales de la imagen subida sin recortar
      const img = new Image();
      img.onload = () => {
        setCustomBannerDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        setImageSize('portrait_4_3'); // Adaptar al estándar sin recortes
      };
      img.src = dataUri;
    };
    reader.readAsDataURL(file);
  };

  const handleAddNewBanner = async () => {
    if (!newBannerTitle.trim()) {
      setToast?.({ message: 'Escribe un título para la pancarta.', type: 'error' });
      return;
    }
    if (!newBannerImage) {
      setToast?.({ message: 'Sube una imagen para la pancarta.', type: 'error' });
      return;
    }

    setIsSavingNewBanner(true);
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('rifx_session_token') || localStorage.getItem('token') || '')
        : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/panel/templates', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          name: newBannerTitle.trim(),
          category: newBannerCategory,
          preview_image_url: newBannerImage,
        }),
      });

      const data = await res.json().catch(() => ({}));

      const newId = data?.template?.id || `custom_${Date.now()}`;
      const newPresetItem = {
        id: newId,
        name: newBannerTitle.trim(),
        tag: newBannerCategory,
        desc: `Pancarta publicitaria especializada para ${newBannerCategory}.`,
        url: newBannerImage,
        isCustom: true,
      };

      const updated = [newPresetItem, ...dbBanners];
      setDbBanners(updated);
      try {
        localStorage.setItem('rifx_cached_panel_banners', JSON.stringify(updated));
      } catch {}

      setSelectedBannerMode('preset');
      setSelectedBannerPreset(newId);
      setShowAddBannerModal(false);
      setNewBannerTitle('');
      setNewBannerImage('');

      setToast?.({
        message: '🎉 ¡Pancarta agregada exitosamente al catálogo!',
        type: 'success',
      });
    } catch (err: any) {
      console.warn('Error guardando pancarta en servidor, usando almacenamiento local:', err);
      const localId = `custom_${Date.now()}`;
      const newPresetItem = {
        id: localId,
        name: newBannerTitle.trim(),
        tag: newBannerCategory,
        desc: `Pancarta publicitaria personalizada para ${newBannerCategory}.`,
        url: newBannerImage,
        isCustom: true,
      };
      const updated = [newPresetItem, ...dbBanners];
      setDbBanners(updated);
      try {
        localStorage.setItem('rifx_cached_panel_banners', JSON.stringify(updated));
      } catch {}
      setSelectedBannerMode('preset');
      setSelectedBannerPreset(localId);
      setShowAddBannerModal(false);
      setNewBannerTitle('');
      setNewBannerImage('');
      setToast?.({
        message: '✅ Pancarta guardada en tu catálogo local.',
        type: 'success',
      });
    } finally {
      setIsSavingNewBanner(false);
    }
  };

  const getActiveBannerUrl = (): string => {
    if (selectedBannerMode === 'none') return '';
    if (selectedBannerMode === 'custom') return customBannerImage;
    const preset = allBannerPresets.find((b) => b.id === selectedBannerPreset);
    return preset ? preset.url : '';
  };

  const handleEnhanceCopy = async () => {
    if (!storeName && !offerText && !storeDescription) {
      setToast?.({ message: 'Escribe al menos el nombre o una idea en tu oferta para mejorarla.', type: 'info' });
      return;
    }

    setIsEnhancingCopy(true);
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('rifx_session_token') || localStorage.getItem('token') || '')
        : '';

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/panel/banners/enhance-copy', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          brand_name: storeName,
          offer_text: offerText,
          store_description: storeDescription,
          contact_info: contactInfo,
          language: 'es',
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.enhanced) {
        throw new Error(data?.error || 'No se pudo mejorar la idea.');
      }

      const { brandName, headline, offerText: newOffer, storeDescription: newDesc, bulletPoints: newBullets, contactInfo: newContact } = data.enhanced;

      if (brandName) setStoreName(brandName);
      if (headline || newOffer) setOfferText(newOffer || headline);
      if (newDesc) setStoreDescription(newDesc);
      if (newContact) setContactInfo(newContact);
      if (Array.isArray(newBullets) && newBullets.length > 0) setBulletPoints(newBullets);

      setHighlightCopyField(true);
      setTimeout(() => setHighlightCopyField(false), 3000);

      setToast?.({
        message: '✨ ¡Idea mejorada con éxito! Se elevó el copywriting y se corrigió la ortografía.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error enhancing copy:', err);
      setToast?.({ message: err.message || 'Error al conectar con la IA de copywriting', type: 'error' });
    } finally {
      setIsEnhancingCopy(false);
    }
  };

  const handleGenerate = async () => {
    if (!productImage && selectedBannerMode === 'none') {
      const msg = 'Sube al menos la foto de tu producto, envase o logotipo.';
      setErrorMsg(msg);
      setToast?.({ message: msg, type: 'info' });
      return;
    }

    setIsGenerating(true);
    setStatusMessage('Enviando a OpenAI GPT Image 2.5 (Sunburst Edit) en Fal.ai ($0.03612 USD)...');
    setErrorMsg(null);

    const activeBanner = getActiveBannerUrl();
    const effectiveColors = (secondaryAssetImage && detectedColors) ? detectedColors.colorName : undefined;

    try {
      setStatusMessage('Unificando plantilla y logotipo en 1-Tile con Sharp ($0.03612 USD)...');

      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('rifx_session_token') || localStorage.getItem('token') || '')
        : '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/panel/banners/higgsfield', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          mode: 'image',
          template_image: activeBanner,
          banner_image: activeBanner,
          product_image: productImage,
          secondary_image: secondaryAssetImage || undefined,
          logo_image: secondaryAssetImage || undefined,
          subject_type: subjectType,
          brand_name: storeName,
          store_name: storeName,
          headline_text: offerText,
          offer_text: offerText,
          subheadline_text: storeDescription,
          store_description: storeDescription,
          contact_info: contactInfo,
          product_colors: effectiveColors,
          aspect_ratio: imageSize === 'square_hd' ? '1:1' : imageSize === 'portrait_16_9' ? '9:16' : '3:4',
          image_size: imageSize === 'square_hd' ? 'square_hd' : imageSize === 'portrait_16_9' ? 'portrait_16_9' : 'portrait_4_3',
          quality: 'medium', // Calidad medium para fijar estrictamente el costo en $0.03612 USD
          template_mode: selectedBannerMode,
          is_custom_banner: selectedBannerMode === 'custom',
          template_name: selectedBannerMode === 'custom' ? 'Pancarta Personalizada' : allBannerPresets.find((b) => b.id === selectedBannerPreset)?.name,
          bullet_points: bulletPoints,
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

        const errorDetail = data?.error || 'Error al procesar con OpenAI GPT Image 2.5';
        throw new Error(errorDetail);
      }

      const generatedUrl = data.image?.url || data.image || data.imageUrl;
      setResultImage(generatedUrl);

      const newSavedItem = {
        templateId: 'marketing_openai_sunburst',
        templateName: storeName ? `${storeName} • ${offerText || 'Pancarta'}` : 'Pancarta Marketing OpenAI GPT 2.5',
        templateIcon: 'shopping_bag',
        imageUrl: generatedUrl,
        costTier: '$0.03612 USD',
        mediaType: 'image' as const,
        metadata: {
          storeName,
          offerText,
          storeDescription,
          contactInfo,
          quality: 'high',
          engine: 'openai/gpt-image-2.5/sunburst/edit',
          date: new Date().toISOString(),
        },
      };

      const updatedHistory = saveBannersToHistory([newSavedItem]);
      setSavedBanners(updatedHistory);

      setToast?.({
        message: '🎉 ¡Pancarta comercial generada con éxito con OpenAI GPT Image 2.5 ($0.03612 USD)!',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error generating marketing banner:', err);
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

  return (
    <div className="space-y-8 w-full max-w-[1600px] mx-auto pb-12">
      {/* Encabezado Principal Expansivo - Modelo RIFX CRM */}
      <div className="bg-white rounded-3xl border border-slate-200 p-7 md:p-9 shadow-sm relative overflow-hidden w-full">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0058bc] via-blue-500 to-indigo-600" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10 w-full">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[#0058bc] text-2xl">shopping_bag</span>
              <span className="bg-blue-50 text-[#0058bc] border border-blue-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                OpenAI GPT Image 2.5 (Sunburst Edit)
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">verified</span>
                Fidelidad Geométrica 100%
              </span>
              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-1 rounded-full uppercase">
                Fal.ai Direct Endpoint
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0b1c30] leading-tight">
              Marketing Studio • Pancartas y Productos Comerciales
            </h3>
            <p className="text-sm md:text-base text-slate-600 max-w-4xl leading-relaxed">
              Crea pancartas publicitarias de alta conversión para tus productos: la IA clona la composición, adapta la iluminación, halos de neón y fondos a los colores exactos de tu envase o producto.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full lg:w-auto">
            {/* Botón Ver Pancartas Generadas */}
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="bg-slate-50 hover:bg-slate-100 text-[#0b1c30] font-bold text-xs px-5 py-3.5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg text-[#0058bc]">collections</span>
              <span>VER PANCARTAS GUARDADAS</span>
              <span className="bg-[#0058bc] text-white text-[11px] px-2 py-0.5 rounded-full font-black">
                {savedBanners.length}
              </span>
            </button>

            {/* Tarjeta de Costo Dinámico Fijo */}
            <div className="bg-blue-50/70 border border-blue-200/80 px-5 py-3 rounded-2xl text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#0058bc] block">Costo Fijo Protegido</span>
              <span className="text-2xl font-black text-[#0b1c30]">$0.03612 <span className="text-xs font-normal text-slate-500">USD</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: 2 COLUMNAS (CATÁLOGO A LA IZQUIERDA Y PRODUCTO + GENERADOR A LA DERECHA) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 items-start w-full">
        {/* =========================================================================
            COLUMNA IZQUIERDA: CATÁLOGO DE PANCARTAS + LOCAL Y OFERTA (7 COLUMNAS)
            ========================================================================= */}
        <div className="xl:col-span-7 space-y-6">
          {/* SECCIÓN 1: SELECTOR DE PANCARTAS PUBLICITARIAS */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-blue-100 text-[#0058bc] border border-blue-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">check</span>
                    Sección de Marketing Exclusiva
                  </span>
                </div>
                <h4 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#0058bc]">view_carousel</span>
                  1. Selecciona o Sube tu Pancarta Publicitaria • Catálogo Visual
                </h4>
                <p className="text-xs text-slate-500">
                  Catálogo exclusivo de <strong>Pancartas de Marketing</strong>. La IA integrará tu producto directamente en el diseño de esta pancarta.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBannerMode('preset')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedBannerMode === 'preset'
                      ? 'bg-[#0058bc] text-white shadow-sm ring-2 ring-blue-400/30 font-extrabold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">palette</span>
                  Plantillas (Activo)
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddBannerModal(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer transform active:scale-95"
                  title="Subir y agregar una nueva pancarta al catálogo sin necesidad de JSON"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  <span>+ Agregar Pancarta</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBannerMode('custom');
                    bannerFileInputRef.current?.click();
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    selectedBannerMode === 'custom'
                      ? 'bg-[#0058bc] text-white shadow-sm font-extrabold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">upload</span>
                  Subir Flyer Rápido
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBannerMode('none')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedBannerMode === 'none'
                      ? 'bg-slate-800 text-white shadow-sm font-extrabold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Estudio Puro
                </button>
              </div>
            </div>

            {/* Barra de Segmentación / Categorías (Filtros: Moda/Ropa, E-commerce, Fitness, etc.) */}
            {selectedBannerMode === 'preset' && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
                {[
                  { id: 'all', label: 'Todas', icon: 'apps' },
                  { id: 'moda', label: 'Streetwear & Moda (Ropa)', icon: 'checkroom' },
                  { id: 'ecom', label: 'E-commerce Ganador', icon: 'shopping_bag' },
                  { id: 'fitness', label: 'Fitness & Salud', icon: 'fitness_center' },
                  { id: 'lujo', label: 'Joyería & Perfumería', icon: 'diamond' },
                  { id: 'viral', label: 'Creativo & Viral', icon: 'auto_awesome' },
                  { id: 'belleza', label: 'Belleza & Cosmética', icon: 'spa' },
                  { id: 'alimentos', label: 'Bebidas & Alimentos', icon: 'restaurant' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedSegment(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      selectedSegment === cat.id
                        ? 'bg-[#0058bc] text-white shadow-sm ring-2 ring-blue-400/20'
                        : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/90'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input Oculto para Subir Pancarta Personalizada */}
            <input
              type="file"
              ref={bannerFileInputRef}
              onChange={handleBannerFileUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Galería de Pancartas - Muestra exactamente 6 pancartas a la vista (2 filas de 3) con scroll interno */}
            {selectedBannerMode === 'preset' && (
              <div className="space-y-2">
                <div className="max-h-[570px] overflow-y-auto pr-1.5 pt-1 rounded-2xl scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-blue-400 focus:outline-none transition-all">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {filteredBannerPresets.map((banner) => {
                      const isSelected = selectedBannerPreset === banner.id;
                      return (
                        <div
                          key={banner.id}
                          onClick={() => setSelectedBannerPreset(banner.id)}
                          className={`group relative rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#0058bc] shadow-md ring-2 ring-blue-500/30'
                              : 'border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="aspect-square w-full bg-slate-900 relative overflow-hidden">
                            <img
                              src={banner.url}
                              alt={banner.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-sm text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 max-w-[140px] truncate">
                              {banner.tag}
                            </div>
                            {banner.isCustom && (
                              <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase flex items-center gap-0.5 shadow-sm">
                                <span className="material-symbols-outlined text-[10px]">person</span>
                                Tuya
                              </div>
                            )}
                            {/* Botón de Zoom / Ampliar */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomModalUrl(banner.url);
                              }}
                              className="absolute bottom-2 right-2 bg-slate-950/70 hover:bg-slate-900 text-white rounded-lg p-1.5 backdrop-blur-xs transition-all shadow-md flex items-center gap-1 text-[10px] font-bold opacity-0 group-hover:opacity-100 z-10"
                              title="Ver en pantalla completa"
                            >
                              <span className="material-symbols-outlined text-xs">zoom_in</span>
                              <span>Ampliar</span>
                            </button>
                            {isSelected && (
                              <div className="absolute inset-0 bg-[#0058bc]/20 backdrop-blur-[1px] flex items-center justify-center">
                                <span className="bg-[#0058bc] text-white rounded-full p-1.5 shadow-md material-symbols-outlined text-lg">
                                  check
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-2.5 bg-white">
                            <h5 className="font-bold text-xs text-slate-900 line-clamp-1">{banner.name}</h5>
                            <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">{banner.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Indicador de Desplazamiento si hay más de 6 pancartas */}
                {filteredBannerPresets.length > 6 && (
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-2 pt-1 border-t border-slate-100">
                    <span>Mostrando 6 a la vista de {filteredBannerPresets.length} pancartas disponibles</span>
                    <span className="flex items-center gap-1 text-[#0058bc]">
                      <span className="material-symbols-outlined text-xs animate-bounce">south</span>
                      Desliza dentro del recuadro para ver más
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Pancarta Personalizada Subida */}
            {selectedBannerMode === 'custom' && (
              <div className="pt-2">
                {customBannerImage ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="h-32 min-w-[90px] max-w-[130px] rounded-2xl overflow-hidden border-2 border-blue-500/30 shrink-0 bg-slate-950 flex items-center justify-center p-1.5 shadow-md">
                      <img src={customBannerImage} alt="Tu pancarta" className="h-full w-auto max-w-full object-contain rounded-lg" />
                    </div>
                    <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="font-extrabold text-sm text-[#0b1c30]">Pancarta Personalizada Cargada</h5>
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">verified</span>
                          100% Sin Recortes
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {customBannerDimensions
                          ? `Dimensiones originales: ${customBannerDimensions.width} × ${customBannerDimensions.height} px • La IA recreará la composición y proporciones completas sin recortar bordes ni cabezas.`
                          : 'La IA adaptará y respetará la composición y geometría completa de esta imagen sin recortar.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => bannerFileInputRef.current?.click()}
                      className="px-4 py-2 bg-white border border-slate-300 hover:border-[#0058bc] hover:text-[#0058bc] text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      Cambiar Imagen
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => bannerFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-[#0058bc] rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-50/70 hover:bg-blue-50/30"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-[#0058bc] flex items-center justify-center mx-auto mb-2">
                      <span className="material-symbols-outlined text-3xl">upload_file</span>
                    </div>
                    <p className="text-sm font-extrabold text-slate-800">Haz clic para subir tu pancarta o flyer</p>
                    <p className="text-xs text-slate-400 mt-0.5">Soporta PNG, JPG o WebP en alta resolución</p>
                  </div>
                )}
              </div>
            )}

            {selectedBannerMode === 'none' && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#0058bc] text-lg">info</span>
                <span>Generará una sesión de estudio fotográfico pura con podio minimalista sin marco exterior.</span>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: FORMULARIO DE LOCAL Y OFERTA PARA LA PANCARTA - CRM DESIGN */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-lg font-extrabold text-[#0b1c30] flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-xl">storefront</span>
                  2. Datos de tu Local y Oferta para la Pancarta
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Escribe tu idea o borrador comercial. La IA la perfeccionará automáticamente con copywriting profesional.
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnhanceCopy}
                disabled={isEnhancingCopy}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                title="Pulir y elevar la idea comercial con IA, corrigiendo ortografía y creando un gancho vendedor"
              >
                <span className={`material-symbols-outlined text-sm ${isEnhancingCopy ? 'animate-spin' : ''}`}>
                  {isEnhancingCopy ? 'refresh' : 'auto_awesome'}
                </span>
                <span>{isEnhancingCopy ? 'Mejorando idea...' : '✨ Mejorar Idea con IA'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nombre de la Tienda / Marca */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de tu Tienda / Marca
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Ej: RIFX Marketing, Tech Store..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border focus:border-[#0058bc] focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-800 transition-all bg-white ${
                    highlightCopyField ? 'border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/20' : 'border-slate-300'
                  }`}
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
                  placeholder="Ej: ARMAMOS LA ESTRATEGIA DIGITAL DE TU NEGOCIO..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border focus:border-[#0058bc] focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-800 transition-all bg-white ${
                    highlightCopyField ? 'border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/20' : 'border-slate-300'
                  }`}
                />
              </div>
            </div>

            {/* Botones Rápidos de Oferta */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
                Opciones rápidas de oferta (1 clic):
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_OFFERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setOfferText(q)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                      offerText === q
                        ? 'bg-amber-500 text-white border-amber-600 shadow-2xs ring-2 ring-amber-300/40'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Breve descripción del local o estilo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción Breve del Producto o Estilo
                </label>
                <textarea
                  rows={2}
                  value={storeDescription}
                  onChange={(e) => setStoreDescription(e.target.value)}
                  placeholder="Ej: Analizamos tu mercado a fondo y diseñamos estrategias personalizadas..."
                  className={`w-full px-3.5 py-2 rounded-xl border focus:border-[#0058bc] focus:ring-2 focus:ring-blue-500/20 text-xs text-slate-700 transition-all bg-white ${
                    highlightCopyField ? 'border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/20' : 'border-slate-300'
                  }`}
                />
              </div>

              {/* Contacto / Redes / Sitio Web */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contacto, Redes o Web
                </label>
                <textarea
                  rows={2}
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Ej: WhatsApp: 0991234567 • @rifx_marketing"
                  className={`w-full px-3.5 py-2 rounded-xl border focus:border-[#0058bc] focus:ring-2 focus:ring-blue-500/20 text-xs text-slate-700 transition-all bg-white ${
                    highlightCopyField ? 'border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/20' : 'border-slate-300'
                  }`}
                />
              </div>
            </div>

            {/* Puntos clave / Beneficios para las medallas o insignias de la pancarta */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="material-symbols-outlined text-xs text-amber-600">verified</span>
                  Beneficios y Tarjetas para el Diseño (Extraídos por IA):
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">Adaptados a las tarjetas del diseño</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {bulletPoints.map((point, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs"
                  >
                    <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-extrabold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate" title={point}>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SELECTOR DE FORMATO */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-[#0b1c30]">
                  Formato de la Pancarta:
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['square_hd', 'portrait_4_3', 'portrait_16_9', 'auto_2K'] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setImageSize(size)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      imageSize === size
                        ? 'bg-[#0b1c30] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>
                      {size === 'portrait_4_3' && '1024×768 (Estándar Pro)'}
                      {size === 'square_hd' && '1:1 Cuadrado'}
                      {size === 'portrait_16_9' && '9:16 Stories'}
                      {size === 'auto_2K' && 'Auto 2K'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            COLUMNA DERECHA: FOTO DEL PRODUCTO + BOTÓN DE GENERAR (5 COLUMNAS - STICKY)
            ========================================================================= */}
        <div className="xl:col-span-5 space-y-6 sticky top-6">
          
          {/* SECCIÓN 3: FOTO DE TU MODELO / PERSONA O PRODUCTO */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-7 shadow-sm space-y-5">
            {/* Selector de Tipo de Sujeto: Modelo / Persona Real vs Producto Comercial */}
            <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setSubjectType('person')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  subjectType === 'person'
                    ? 'bg-[#0058bc] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-sm">person</span>
                Modelo / Persona Real
              </button>
              <button
                type="button"
                onClick={() => setSubjectType('product')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  subjectType === 'product'
                    ? 'bg-[#0058bc] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-sm">inventory_2</span>
                Producto / Envase
              </button>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-[#0b1c30] flex items-center gap-2 text-base md:text-lg">
                <span className="material-symbols-outlined text-amber-600">
                  {subjectType === 'person' ? 'person' : 'inventory_2'}
                </span>
                3. Foto de tu {subjectType === 'person' ? 'Modelo o Persona' : 'Producto o Envase'}
              </h4>
              <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                subjectType === 'person'
                  ? 'text-blue-800 bg-blue-100 border border-blue-300'
                  : 'text-emerald-800 bg-emerald-100 border border-emerald-300'
              }`}>
                <span className="material-symbols-outlined text-xs">verified</span>
                {subjectType === 'person' ? '100% Fidelidad de Rostro' : '100% Producto Real'}
              </span>
            </div>

            {/* Dropzone o Vista Previa del Sujeto / Producto */}
            {productImage ? (
              <div className="relative group rounded-2xl overflow-hidden aspect-[4/3] bg-slate-950 max-h-72 mx-auto border-2 border-amber-500/30 shadow-inner flex items-center justify-center p-3">
                <img src={productImage} alt={subjectType === 'person' ? 'Modelo' : 'Producto'} className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => productFileInputRef.current?.click()}
                    className="p-2.5 bg-white text-slate-900 rounded-full font-bold text-xs shadow-lg hover:bg-slate-100 cursor-pointer"
                    title="Cambiar foto"
                  >
                    <span className="material-symbols-outlined text-base">swap_horiz</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProductImage('');
                      setDetectedColors(null);
                    }}
                    className="p-2.5 bg-rose-600 text-white rounded-full font-bold text-xs shadow-lg hover:bg-rose-500 cursor-pointer"
                    title="Eliminar"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => productFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#0058bc] rounded-3xl p-7 text-center cursor-pointer transition-colors bg-slate-50/70 hover:bg-blue-50/30 flex flex-col items-center justify-center min-h-[170px]"
              >
                <div className="w-14 h-14 rounded-full bg-blue-100 text-[#0058bc] flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-3xl">
                    {subjectType === 'person' ? 'person_add' : 'add_photo_alternate'}
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-800">
                  {subjectType === 'person'
                    ? 'Subir foto del modelo o persona (Rostro 100% Real)'
                    : 'Subir foto de tu producto, envase o logotipo'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {subjectType === 'person'
                    ? 'La IA reemplazará al personaje de la plantilla manteniendo 100% el rostro y cabello'
                    : 'PNG transparente, JPG o WebP con buena iluminación'}
                </p>
              </div>
            )}

            <input
              type="file"
              ref={productFileInputRef}
              onChange={handleProductFileUpload}
              accept="image/*"
              className="hidden"
            />

          </div>

          {/* SECCIÓN 4: ADAPTACIÓN Y COLORES AUTOMÁTICOS */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0058bc] text-base">palette</span>
                <span className="text-xs font-bold text-slate-800">4. Colores y Logotipo de la Pancarta</span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                ✓ Auto-Sincronizado
              </span>
            </div>

            {detectedColors && secondaryAssetImage ? (
              <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 pl-1 shrink-0">
                  {detectedColors.hexCodes.map((hex, idx) => (
                    <span
                      key={idx}
                      className="w-5 h-5 rounded-full border border-black/20 shadow-2xs shrink-0"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-[#0b1c30] truncate block">
                    {detectedColors.colorName}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold truncate block">
                    ✓ Colores extraídos del logo • Se adaptarán a la tipografía y acentos
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 text-base">palette</span>
                <span>Sin logotipo cargado • <strong>Se replicarán exactamente los colores originales de la pancarta</strong>.</span>
              </div>
            )}

            {/* Ranura para Logo o Elemento Secundario (Opcional) */}
            <div className="pt-1 border-t border-slate-100">
              {secondaryAssetImage ? (
                <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <img src={secondaryAssetImage} alt="Logo" className="w-8 h-8 object-contain rounded bg-white border border-slate-200" />
                    <span className="text-[11px] font-bold text-slate-700">Logo cargado</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSecondaryAssetImage('');
                      setDetectedColors(null);
                    }}
                    className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => secondaryFileInputRef.current?.click()}
                  className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-[#0058bc] rounded-xl text-[11px] font-semibold text-slate-600 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-[#0058bc]">add_photo_alternate</span>
                  <span>Añadir Logo Comercial (Opcional)</span>
                </button>
              )}
              <input
                type="file"
                ref={secondaryFileInputRef}
                onChange={handleSecondaryFileUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          {/* TARJETA DEL BOTÓN DE GENERACIÓN CRM (EN LA PARTE DERECHA) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costo de Generación</span>
                <span className="text-2xl font-black text-[#0058bc]">
                  $0.03612 <span className="text-xs font-normal text-slate-500">USD</span>
                </span>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">lock</span>
                Tarifa Fija Bloqueada
              </span>
            </div>

            {/* Badge de Garantía de Tarifa Anti-Sobrecostos */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <span className="material-symbols-outlined text-[#0058bc] text-base">verified</span>
                <span>Optimización 1-Tile en 768×1024</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Logotipo y plantilla se unifican en 1 sola imagen compuesta con Sharp. Fal.ai computa 1 sola referencia, eliminando el sobrecosto de $0.0622 y fijando la generación en <strong>$0.03612 USD</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full py-4 px-5 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                isGenerating
                  ? 'bg-slate-400 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#0058bc] via-blue-600 to-indigo-600 hover:from-[#054ADA] hover:to-indigo-700 text-white shadow-blue-500/25 active:scale-98'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{statusMessage || 'Procesando en Fal.ai ($0.03612 USD)...'}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">palette</span>
                  <span>Generar Pancarta ($0.03612 USD)</span>
                </>
              )}
            </button>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span className="truncate">{errorMsg}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RESULTADO GENERADO */}
      {resultImage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200 p-7 md:p-9 shadow-xl space-y-6 w-full"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full uppercase">
                  Generación Exitosa
                </span>
                <span className="bg-blue-100 text-[#0058bc] text-xs font-black px-3 py-1 rounded-full uppercase">
                  OpenAI GPT Image 2.5
                </span>
                <span className="bg-purple-100 text-purple-800 text-xs font-black px-3 py-1 rounded-full uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">bookmark</span>
                  Guardada en Historial
                </span>
              </div>
              <h4 className="text-xl font-black text-[#0b1c30] mt-1.5">
                Pancarta Comercial Finalizada
              </h4>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={resultImage}
                target="_blank"
                rel="noreferrer"
                download="pancarta_comercial_openai.png"
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Descargar HD
              </a>
              {onContinueToCampaigns && (
                <button
                  type="button"
                  onClick={() => onContinueToCampaigns(resultImage)}
                  className="px-5 py-2.5 bg-[#0058bc] hover:bg-[#054ADA] text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <span>Llevar a Campañas</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative rounded-3xl overflow-hidden max-w-2xl mx-auto bg-slate-900 border border-slate-200 shadow-xl">
            <img src={resultImage} alt="Pancarta generada" className="w-full h-auto object-contain" />
          </div>
        </motion.div>
      )}

      {/* MODAL DE HISTORIAL COMPLETO */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#0058bc] flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">collections</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-[#0b1c30]">Historial de Pancartas Guardadas</h3>
                  <p className="text-xs text-slate-500">Todas tus creaciones generadas con IA listas para reutilizar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {savedBanners.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <span className="material-symbols-outlined text-5xl mb-2 text-slate-300">image_not_supported</span>
                  <p className="font-bold text-sm text-slate-600">No hay pancartas guardadas todavía</p>
                  <p className="text-xs mt-1">Genera tu primera pancarta con OpenAI GPT Image 2.5 para verla aquí.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                  {savedBanners.map((banner) => (
                    <div
                      key={banner.id}
                      className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-square flex flex-col justify-end shadow-sm hover:shadow-md transition-all"
                    >
                      <img src={banner.imageUrl} alt={banner.templateName} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent p-3.5 flex flex-col justify-end">
                        <span className="text-xs font-bold text-white line-clamp-1">{banner.templateName}</span>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-blue-300 font-semibold">{banner.costTier}</span>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={banner.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="p-1.5 rounded-lg bg-white/20 hover:bg-white text-white hover:text-slate-900 transition-colors"
                              title="Descargar"
                            >
                              <span className="material-symbols-outlined text-xs">download</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteSavedBanner(banner.id)}
                              className="p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <span className="material-symbols-outlined text-xs">delete</span>
                            </button>
                          </div>
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

      {/* Lightbox Modal de Visualización Ampliada de Pancarta */}
      {zoomModalUrl && (
        <div
          onClick={() => setZoomModalUrl(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full border border-slate-200 flex flex-col relative"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0058bc]">image</span>
                <span className="text-sm font-black text-[#0b1c30]">Vista Previa Ampliada de la Pancarta</span>
              </div>
              <button
                type="button"
                onClick={() => setZoomModalUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img
                src={zoomModalUrl}
                alt="Vista previa ampliada"
                className="w-full h-auto max-h-[70vh] object-contain rounded-2xl shadow-lg border border-slate-200"
              />
            </div>
            <div className="p-4 bg-white flex items-center justify-between">
              <p className="text-xs text-slate-500">
                La IA clonará la iluminación, tipografía y composición exacta de esta pancarta integrando tu producto.
              </p>
              <button
                type="button"
                onClick={() => setZoomModalUrl(null)}
                className="px-4 py-2 bg-[#0058bc] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal para Agregar Pancarta al Catálogo (Sin JSON, solo Imagen, Título y Segmentación) */}
      {showAddBannerModal && (
        <div
          onClick={() => setShowAddBannerModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0058bc] text-2xl">add_photo_alternate</span>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                    Agregar Nueva Pancarta al Catálogo
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Sube la imagen y título; la IA la integrará automáticamente con tus productos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBannerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  1. Título de la Pancarta
                </label>
                <input
                  type="text"
                  value={newBannerTitle}
                  onChange={(e) => setNewBannerTitle(e.target.value)}
                  placeholder="Ej: Pancarta Streetwear Hoodie Oversize"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0058bc] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  2. Segmentación / Categoría
                </label>
                <select
                  value={newBannerCategory}
                  onChange={(e) => setNewBannerCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0058bc] focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                >
                  <option value="Streetwear & Moda">Streetwear & Moda (Ropa)</option>
                  <option value="E-commerce Ganador">E-commerce Ganador</option>
                  <option value="Fitness & Salud">Fitness & Salud</option>
                  <option value="Joyería & Perfumería">Joyería & Perfumería</option>
                  <option value="Creativo & Viral">Creativo & Viral</option>
                  <option value="Belleza & Cosmética">Belleza & Cosmética</option>
                  <option value="Bebidas & Alimentos">Bebidas & Alimentos</option>
                  <option value="Tech & Gadgets">Tech & Gadgets</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  3. Imagen de la Pancarta Publicitaria
                </label>
                <input
                  type="file"
                  ref={newBannerFileInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setNewBannerImage(ev.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />

                {newBannerImage ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-44 bg-slate-950 flex items-center justify-center">
                    <img src={newBannerImage} alt="Preview" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setNewBannerImage('')}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all cursor-pointer"
                      title="Quitar imagen"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => newBannerFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-[#0058bc] rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-50 hover:bg-blue-50/30 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0058bc] flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 group-hover:text-[#0058bc] transition-colors">
                      Haz clic para subir la imagen de tu pancarta
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Soporta PNG, JPG o WebP</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddBannerModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddNewBanner}
                disabled={isSavingNewBanner || !newBannerTitle.trim() || !newBannerImage}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#0058bc] hover:bg-blue-700 text-white shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingNewBanner ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-sm">check</span>
                )}
                <span>Guardar en el Catálogo</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
