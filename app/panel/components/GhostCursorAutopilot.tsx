'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface GhostCursorAutopilotProps {
  language: string;
  isActive: boolean;
  onClose: () => void;
  onComplete: () => void;
  campaignDraft: {
    description?: string;
    phone?: string;
    address?: string;
    dailyBudget?: number;
    durationDays?: number;
    locationName?: string;
    radiusKm?: number;
    locations?: Array<{ lat: number; lng: number; radius: number; name: string }>;
    productName?: string;
    offerPrice?: string;
    hook?: string;
    businessName?: string;
  };
  setAdDescription: (val: string) => void;
  setCampaignDesc: (val: string) => void;
  setAdPhone: (val: string) => void;
  setAdAddress: (val: string) => void;
  setDailyBudget: (val: number) => void;
  setCampaignDurationDays: (val: number) => void;
  setAdLocations: (locs: Array<{ lat: number; lng: number; radius: number; name: string }> | ((prev: any) => any)) => void;
  setAdLocationRadius: (r: number) => void;
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info' }) => void;
}

export default function GhostCursorAutopilot({
  language,
  isActive,
  onClose,
  onComplete,
  campaignDraft,
  setAdDescription,
  setCampaignDesc,
  setAdPhone,
  setAdAddress,
  setDailyBudget,
  setCampaignDurationDays,
  setAdLocations,
  setAdLocationRadius,
  setToast,
}: GhostCursorAutopilotProps) {
  const isEn = language === 'en';

  // Cursor position state
  const [cursorPos, setCursorPos] = useState({ x: 300, y: 250 });
  const [isClicking, setIsClicking] = useState(false);
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number } | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [actionText, setActionText] = useState(
    isEn ? '🤖 AI Autopilot initialized...' : '🤖 Piloto Automático IA inicializado...'
  );
  const [isPaused, setIsPaused] = useState(false);
  const [isSpeed2x, setIsSpeed2x] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const pausedRef = useRef(isPaused);
  pausedRef.current = isPaused;
  const speedRef = useRef(isSpeed2x);
  speedRef.current = isSpeed2x;
  const abortControllerRef = useRef(false);

  const steps = [
    {
      id: 'copy',
      title: isEn ? '1. High-Converting AIDA Copywriting' : '1. Redacción de Copy AIDA de Alta Conversión',
      bubble: isEn ? '✍️ Typing persuasive AIDA copy tailored to your offer...' : '✍️ Redactando copy persuasivo AIDA adaptado a tu oferta...',
    },
    {
      id: 'phone',
      title: isEn ? '2. Direct WhatsApp Channel' : '2. Canal Directo de WhatsApp',
      bubble: isEn ? '📲 Linking WhatsApp number for high-intent closing...' : '📲 Vinculando número de WhatsApp para cierre directo...',
    },
    {
      id: 'address',
      title: isEn ? '3. Location & Coverage' : '3. Dirección y Cobertura',
      bubble: isEn ? '🏢 Setting business address & coverage zone...' : '🏢 Registrando dirección y zona de cobertura...',
    },
    {
      id: 'budget',
      title: isEn ? '4. Algorithmic Daily Budget' : '4. Presupuesto Diario Algorítmico',
      bubble: isEn ? '💰 Calibrating optimal budget to exit Meta learning phase...' : '💰 Calibrando presupuesto óptimo para salir de fase de aprendizaje...',
    },
    {
      id: 'duration',
      title: isEn ? '5. Campaign Lifecycle & Remarketing' : '5. Ciclo de Campaña y Remarketing',
      bubble: isEn ? '📅 Scheduling 30-day cycle with automatic remarketing...' : '📅 Programando ciclo de 30 días con remarketing automático...',
    },
    {
      id: 'map',
      title: isEn ? '6. Precision Geofencing & Radius' : '6. Geolocalización y Radio de Cobertura',
      bubble: isEn ? '🗺️ Pinpointing local targeting radius on Meta Ads map...' : '🗺️ Fijando radio y geolocalización en el mapa de Meta Ads...',
    },
  ];

  // Utility sleep that respects speed and pause
  const delay = async (ms: number) => {
    const factor = speedRef.current ? 0.45 : 1;
    let elapsed = 0;
    const interval = 50;
    while (elapsed < ms * factor) {
      if (abortControllerRef.current) throw new Error('aborted');
      if (!pausedRef.current) {
        elapsed += interval;
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  };

  // Move cursor smoothly to target element or screen coordinates
  const moveCursorTo = async (targetX: number, targetY: number, durationMs = 600) => {
    const startX = cursorPos.x;
    const startY = cursorPos.y;
    const startTime = Date.now();
    const effectiveDuration = speedRef.current ? durationMs * 0.45 : durationMs;

    return new Promise<void>((resolve, reject) => {
      const animate = () => {
        if (abortControllerRef.current) {
          reject(new Error('aborted'));
          return;
        }
        if (pausedRef.current) {
          requestAnimationFrame(animate);
          return;
        }
        const now = Date.now();
        const progress = Math.min(1, (now - startTime) / effectiveDuration);
        // EaseInOutCubic
        const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        setCursorPos({
          x: startX + (targetX - startX) * ease,
          y: startY + (targetY - startY) * ease,
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  };

  // Trigger a visual click with ripple effect
  const triggerClick = async (x: number, y: number) => {
    setIsClicking(true);
    setClickRipple({ x, y });
    await delay(180);
    setIsClicking(false);
    setTimeout(() => setClickRipple(null), 600);
  };

  // Type text progressively
  const typeText = async (text: string, setter: (val: string) => void) => {
    const chunkSize = speedRef.current ? 6 : 3;
    let current = '';
    for (let i = 0; i < text.length; i += chunkSize) {
      if (abortControllerRef.current) throw new Error('aborted');
      current = text.slice(0, i + chunkSize);
      setter(current);
      await delay(25);
    }
    setter(text);
  };

  useEffect(() => {
    if (!isActive) return;
    abortControllerRef.current = false;

    const runAutopilot = async () => {
      try {
        await delay(500);

        // ─────────────────────────────────────────────────────────────
        // STEP 1: Copywriting / Descripción
        // ─────────────────────────────────────────────────────────────
        setCurrentStepIndex(0);
        setActionText(steps[0].bubble);

        // Scroll top smoothly
        window.scrollTo({ top: 320, behavior: 'smooth' });
        await delay(400);

        // Find description textarea
        const descEl = document.querySelector('textarea') as HTMLTextAreaElement | null;
        const descRect = descEl?.getBoundingClientRect();
        const descX = descRect ? descRect.left + 50 : 380;
        const descY = descRect ? descRect.top + 30 : 420;

        await moveCursorTo(descX, descY, 700);
        await triggerClick(descX, descY);
        descEl?.focus();

        const copyToType =
          campaignDraft.description ||
          `🚨 ¡ATENCIÓN! ¿Buscando el mejor ${campaignDraft.productName || 'producto'}? 🚨\n\nSi buscas la máxima calidad y un servicio garantizado, ¡esto es para ti! En ${campaignDraft.businessName || 'nuestro negocio'} tenemos exactamente lo que necesitas.\n\n✨ ¿Por qué elegirnos?\n✅ Calidad Premium 100% Garantizada\n✅ Atención personalizada y entrega rápida\n✅ La mejor relación calidad-precio\n\n💰 PROMOCIÓN ESPECIAL: ¡${campaignDraft.offerPrice || 'Descuento Exclusivo'}!\n\n👉 ¡Haz clic ahora y asegura tu pedido hoy mismo!\n\n#MetaAds #OfertaEspecial #CalidadGarantizada`;

        await typeText(copyToType, (val) => {
          setAdDescription(val);
          setCampaignDesc(val);
        });
        await delay(400);

        // ─────────────────────────────────────────────────────────────
        // STEP 2: Teléfono WhatsApp
        // ─────────────────────────────────────────────────────────────
        setCurrentStepIndex(1);
        setActionText(steps[1].bubble);

        const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement | null;
        const phoneRect = phoneInput?.getBoundingClientRect();
        const phoneX = phoneRect ? phoneRect.left + 40 : 380;
        const phoneY = phoneRect ? phoneRect.top + 20 : 540;

        await moveCursorTo(phoneX, phoneY, 650);
        await triggerClick(phoneX, phoneY);
        phoneInput?.focus();

        const phoneToSet = campaignDraft.phone || '+593 98 765 4321';
        await typeText(phoneToSet, setAdPhone);
        await delay(400);

        // ─────────────────────────────────────────────────────────────
        // STEP 3: Dirección Comercial
        // ─────────────────────────────────────────────────────────────
        setCurrentStepIndex(2);
        setActionText(steps[2].bubble);

        // Look for address input
        const inputs = Array.from(document.querySelectorAll('input[type="text"]')) as HTMLInputElement[];
        const addressInput = inputs.find((inp) =>
          inp.placeholder?.toLowerCase().includes('reforma') ||
          inp.placeholder?.toLowerCase().includes('main st') ||
          inp.placeholder?.toLowerCase().includes('direcci')
        ) || inputs[1] || null;

        const addrRect = addressInput?.getBoundingClientRect();
        const addrX = addrRect ? addrRect.left + 40 : 560;
        const addrY = addrRect ? addrRect.top + 20 : 540;

        await moveCursorTo(addrX, addrY, 650);
        await triggerClick(addrX, addrY);
        addressInput?.focus();

        const addressToSet = campaignDraft.address || (campaignDraft.locationName ? `Av. Principal, ${campaignDraft.locationName}` : 'Av. Amazonas y Naciones Unidas');
        await typeText(addressToSet, setAdAddress);
        await delay(400);

        // ─────────────────────────────────────────────────────────────
        // STEP 4: Presupuesto Diario
        // ─────────────────────────────────────────────────────────────
        setCurrentStepIndex(3);
        setActionText(steps[3].bubble);

        // Scroll to budget area
        window.scrollBy({ top: 220, behavior: 'smooth' });
        await delay(400);

        const numberInputs = Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
        const budgetInput = numberInputs[0] || null;
        const bRect = budgetInput?.getBoundingClientRect();
        const bX = bRect ? bRect.left + 40 : 400;
        const bY = bRect ? bRect.top + 20 : 620;

        await moveCursorTo(bX, bY, 700);
        await triggerClick(bX, bY);
        budgetInput?.focus();

        const budgetValue = campaignDraft.dailyBudget || 10;
        setDailyBudget(budgetValue);
        await delay(500);

        // ─────────────────────────────────────────────────────────────
        // STEP 5: Duración de Campaña
        // ─────────────────────────────────────────────────────────────
        setCurrentStepIndex(4);
        setActionText(steps[4].bubble);

        const durationInput = numberInputs[1] || null;
        const dRect = durationInput?.getBoundingClientRect();
        const dX = dRect ? dRect.left + 40 : 400;
        const dY = dRect ? dRect.top + 20 : 700;

        await moveCursorTo(dX, dY, 600);
        await triggerClick(dX, dY);
        durationInput?.focus();

        const durationValue = campaignDraft.durationDays || 30;
        setCampaignDurationDays(durationValue);
        await delay(500);

        // ─────────────────────────────────────────────────────────────
        // STEP 6: Geolocalización en el Mapa y Radio
        // ─────────────────────────────────────────────────────────────
        setCurrentStepIndex(5);
        setActionText(steps[5].bubble);

        // Scroll to map section
        window.scrollBy({ top: 380, behavior: 'smooth' });
        await delay(450);

        // Search bar or map target
        const locSearchInput = document.querySelector('input[placeholder*="Buscar ciudad"], input[placeholder*="Search city"]') as HTMLInputElement | null;
        const mapContainer = document.getElementById('ad-location-map');

        if (locSearchInput) {
          const sRect = locSearchInput.getBoundingClientRect();
          await moveCursorTo(sRect.left + 60, sRect.top + 18, 650);
          await triggerClick(sRect.left + 60, sRect.top + 18);
          locSearchInput.focus();
          const cityName = campaignDraft.locationName || 'Quito, Ecuador';
          await typeText(cityName, (v) => {
            locSearchInput.value = v;
          });
          await delay(350);
        }

        // Set locations data and calibrated radius
        const targetRadius = campaignDraft.radiusKm || 25;
        const targetCoords = campaignDraft.locations && campaignDraft.locations.length > 0
          ? campaignDraft.locations
          : [
              {
                lat: -0.1807,
                lng: -78.4678,
                radius: targetRadius,
                name: campaignDraft.locationName || 'Quito, Pichincha, Ecuador',
              },
            ];

        setAdLocations(targetCoords);
        setAdLocationRadius(targetRadius);

        // Slide the radius range slider
        const rangeSlider = document.querySelector('input[type="range"]') as HTMLInputElement | null;
        if (rangeSlider) {
          const rRect = rangeSlider.getBoundingClientRect();
          await moveCursorTo(rRect.left + 15, rRect.top + 8, 500);
          await triggerClick(rRect.left + 15, rRect.top + 8);
          await moveCursorTo(rRect.left + rRect.width * 0.45, rRect.top + 8, 600);
        }

        await delay(500);

        // ─────────────────────────────────────────────────────────────
        // STEP 7: Completion & Highlight Publish
        // ─────────────────────────────────────────────────────────────
        setActionText(
          isEn
            ? '✨ Campaign fully calibrated! Moving to Publish button...'
            : '✨ ¡Pauta Publicitaria 100% Calibrada! Enfocando botón de publicación...'
        );

        window.scrollBy({ top: 350, behavior: 'smooth' });
        await delay(400);

        const publishBtn = document.querySelector('button[style*="linear-gradient"]') as HTMLButtonElement | null;
        if (publishBtn) {
          const pRect = publishBtn.getBoundingClientRect();
          await moveCursorTo(pRect.left + pRect.width / 2, pRect.top + pRect.height / 2, 750);
        }

        setIsFinished(true);
        setToast({
          message: isEn
            ? '🎉 AI Autopilot complete! Your ad campaign is perfectly calibrated.'
            : '🎉 ¡Piloto Automático completado! Tu pauta publicitaria quedó perfectamente calibrada.',
          type: 'success',
        });

      } catch (err: any) {
        if (err?.message !== 'aborted') {
          console.error('[GhostCursorAutopilot] Execution error:', err);
        }
      }
    };

    runAutopilot();

    return () => {
      abortControllerRef.current = true;
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] select-none">
      {/* ─── HUD TOP BAR ─── */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -40 }}
        className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 bg-[#0b1c30]/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-blue-500/30 flex items-center gap-4 max-w-2xl w-[92vw] sm:w-auto"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30 relative">
          <span className="material-symbols-outlined text-white text-lg animate-pulse">smart_toy</span>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0b1c30] animate-ping" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
              {isEn ? 'AI Autopilot Active' : 'Piloto Automático IA'}
            </span>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-400/30">
              {currentStepIndex + 1}/{steps.length}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-100 truncate mt-0.5">
            {steps[currentStepIndex]?.title || actionText}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700"
            title={isPaused ? (isEn ? 'Resume' : 'Reanudar') : (isEn ? 'Pause' : 'Pausar')}
          >
            <span className="material-symbols-outlined text-sm block">
              {isPaused ? 'play_arrow' : 'pause'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsSpeed2x(!isSpeed2x)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
              isSpeed2x
                ? 'bg-blue-600 text-white border-blue-400'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title={isEn ? 'Toggle 2x Speed' : 'Velocidad 2x'}
          >
            2x
          </button>

          <button
            type="button"
            onClick={() => {
              abortControllerRef.current = true;
              onClose();
            }}
            className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-300 text-xs font-semibold transition-all border border-red-500/30"
            title={isEn ? 'Exit Autopilot' : 'Salir del Piloto'}
          >
            <span className="material-symbols-outlined text-sm block">close</span>
          </button>
        </div>
      </motion.div>

      {/* ─── GHOST CURSOR WITH TRAIL & SPEECH BUBBLE ─── */}
      <div
        className="absolute top-0 left-0 transition-all duration-75 ease-out"
        style={{
          transform: `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`,
          willChange: 'transform',
        }}
      >
        {/* Glow aura */}
        <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-500/25 rounded-full blur-md pointer-events-none animate-pulse" />

        {/* SVG Cursor Pointer */}
        <div
          className={`relative transition-transform duration-150 ${
            isClicking ? 'scale-90 rotate-[-8deg]' : 'scale-100'
          }`}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            className="drop-shadow-[0_4px_12px_rgba(24,119,242,0.85)] filter"
          >
            <path
              d="M3 3L10.07 20.97L13.58 13.58L20.97 10.07L3 3Z"
              fill="#1877F2"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Floating Speech Bubble next to cursor */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute left-7 top-2 bg-[#0b1c30]/90 backdrop-blur-md text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl shadow-xl border border-blue-500/40 whitespace-nowrap flex items-center gap-1.5 pointer-events-none"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
          <span>{actionText}</span>
        </motion.div>
      </div>

      {/* ─── CLICK RIPPLE EFFECT ─── */}
      {clickRipple && (
        <div
          className="absolute pointer-events-none w-10 h-10 -ml-5 -mt-5 rounded-full border-2 border-blue-400 bg-blue-400/20 animate-ping"
          style={{
            left: clickRipple.x,
            top: clickRipple.y,
            animationDuration: '0.45s',
          }}
        />
      )}

      {/* ─── COMPLETION CELEBRATION MODAL ─── */}
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="pointer-events-auto fixed inset-0 flex items-center justify-center p-4 bg-[#0b1c30]/50 backdrop-blur-sm z-[10000]"
          >
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-blue-100 shadow-2xl text-center space-y-5 relative overflow-hidden">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-blue-500/25">
                <span className="material-symbols-outlined text-3xl">auto_awesome</span>
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-[#0b1c30]">
                  {isEn ? '🎉 Ad Campaign Ready & Calibrated!' : '🎉 ¡Pauta Publicitaria Calibrada al 100%!'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {isEn
                    ? 'The AI completed all fields: high-converting AIDA copy, budget, duration, and geo-targeting. Everything is synchronized with the CRM Brain!'
                    : 'La IA ha rellenado y optimizado todo: copy persuasivo AIDA, número de WhatsApp, presupuesto algorítmico, duración y segmentación geográfica. ¡Todo sincronizado con el Cerebro del CRM!'}
                </p>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-left space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-blue-900">
                  <span className="material-symbols-outlined text-sm text-blue-600">check_circle</span>
                  <span>{isEn ? 'Synaptic Brain Registered' : 'Memoria del Cerebro Registrada'}</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  {isEn
                    ? 'This campaign strategy was added as an active marketing node in your Cerebro IA.'
                    : 'Esta campaña ya forma parte de los nodos y aprendizajes en tu Cerebro IA.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onComplete();
                  onClose();
                }}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/25 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <span>{isEn ? 'Review & Publish to Facebook' : 'Revisar y Publicar en Facebook'}</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
