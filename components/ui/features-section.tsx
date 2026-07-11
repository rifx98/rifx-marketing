"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import AnimatedText from "@/app/components/AnimatedText";

/* ═══════════════════════════════════════════
   MOCKUP 1 — OmniPublish (Publicación)
═══════════════════════════════════════════ */
function PublicacionMockup() {
  const canales = [
    "Solidariamente Cevallos",
    "Rifx-Marketing",
    "Rossy Fashion",
    "Comprafacil",
  ];
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40 bg-white">
      {/* Header purple gradient */}
      <div
        className="px-5 py-4"
        style={{ background: "linear-gradient(135deg,#1e1b6b 0%,#3730a3 60%,#6d28d9 100%)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-base">OmniPublish</span>
              <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold tracking-wide">MULTI-REDES</span>
            </div>
            <p className="text-white/60 text-[11px]">Publica y distribuye tus videos automáticamente</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center gap-1 text-[11px] bg-white/15 text-white/90 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />12 Canales
          </span>
          <span className="flex items-center gap-1 text-[11px] bg-white/15 text-white/90 px-2.5 py-1 rounded-full">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>IA Integrada
          </span>
        </div>
      </div>

      {/* Platform tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {[
          { label: "Meta", icon: "f" },
          { label: "TikTok", icon: "T" },
          { label: "YouTube", icon: "▶" },
          { label: "Manual", icon: "+" },
        ].map((p, i) => (
          <button key={i} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold border-b-2 transition-colors ${i === 0 ? "border-[#3730a3] text-[#3730a3]" : "border-transparent text-gray-400"}`}>
            <span className="text-[11px]">{p.icon}</span>{p.label}
          </button>
        ))}
      </div>

      <div className="p-4 bg-gray-50 grid grid-cols-2 gap-3">
        {/* Upload area */}
        <div className="col-span-1">
          <div className="border-2 border-dashed border-gray-300 rounded-xl h-28 flex flex-col items-center justify-center bg-white gap-1.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p className="text-[10px] text-gray-400 text-center px-2">Arrastra tu video aquí</p>
            <span className="text-[9px] text-gray-300">MP4, MOV · Máx 100MB</span>
          </div>
          {/* Mode */}
          <div className="flex gap-1.5 mt-2">
            <span className="flex-1 text-center text-[10px] bg-[#3730a3] text-white py-1.5 rounded-lg font-semibold">▶ Individual</span>
            <span className="flex-1 text-center text-[10px] bg-white border border-gray-200 text-gray-500 py-1.5 rounded-lg font-semibold">⊞ Lote</span>
          </div>
        </div>

        {/* Canales list */}
        <div className="col-span-1 bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-semibold text-gray-700">Canales Vinculados</span>
            <span className="text-[10px] bg-[#3730a3]/10 text-[#3730a3] font-bold px-1.5 py-0.5 rounded">12</span>
          </div>
          {canales.map((c, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 border-t border-gray-100 first:border-0">
              <div className="w-5 h-5 rounded-full bg-[#1877F2] flex items-center justify-center text-white text-[8px] font-bold shrink-0">f</div>
              <span className="text-[10px] text-gray-600 truncate">{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MOCKUP 2 — Creative Lab (Publicidad IA)
═══════════════════════════════════════════ */
function PublicidadMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40 bg-white">
      {/* Title bar */}
      <div className="px-5 pt-4 pb-3 bg-white border-b border-gray-100">
        <h3 className="text-[15px] font-black text-gray-900">Creative Lab</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Crea anuncios impactantes usando tus plantillas y{" "}
          <span className="text-[#3730a3] font-semibold">ChatGPT</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100">
        {["✏️ Creative Lab", "📣 Campañas", "📊 Analíticas"].map((t, i) => (
          <button key={i} className={`flex-1 text-[11px] py-2.5 font-semibold border-b-2 ${i === 0 ? "border-[#3730a3] text-[#3730a3]" : "border-transparent text-gray-400"}`}>{t}</button>
        ))}
      </div>

      {/* Step bar */}
      <div className="flex items-center px-4 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-[#3730a3] flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
          </div>
          <span className="text-[10px] text-[#3730a3] font-bold tracking-wide">ESTILO Y DIAGNÓSTICO</span>
        </div>
        <div className="flex-1 h-px bg-gray-200 mx-3" />
        <span className="text-[10px] text-gray-300 font-semibold tracking-wide">CONFIGURAR Y PUBLICAR</span>
      </div>

      {/* AI Agent banner */}
      <div className="mx-4 mt-3 rounded-xl overflow-hidden" style={{ background: "linear-gradient(90deg,#0f1f6b,#1e3a8a)" }}>
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <p className="text-white text-[11px] font-bold">AGENTE EXPERTO EN META ADS</p>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                <span className="text-green-400 text-[9px]">En línea</span>
                <span className="text-white/40 text-[9px] mx-1">·</span>
                <span className="text-white/60 text-[9px]">Optimización Estratégica</span>
              </div>
            </div>
          </div>
          <button className="flex items-center gap-1 text-[10px] text-white/70 border border-white/20 px-2 py-1 rounded-lg">↺ Reiniciar</button>
        </div>
      </div>

      {/* Chat message */}
      <div className="px-4 py-3 bg-white">
        <div className="flex gap-2">
          <div className="w-7 h-7 rounded-full bg-[#3730a3]/10 flex items-center justify-center shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#3730a3"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-[11px] text-gray-700 leading-relaxed flex-1">
            <p>¡Hola! 🤖 Soy tu Agente Experto en Meta Ads. Estoy aquí para diseñar tu campaña perfecta.</p>
            <p className="mt-1 text-gray-500">Para empezar: <span className="text-[#3730a3] font-semibold">¿Cuál es el objetivo principal de tu campaña?</span></p>
          </div>
        </div>
        {/* Quick replies */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {["→ Atraer clientes locales", "→ Vender por WhatsApp", "→ Tienda online"].map((r, i) => (
            <button key={i} className="text-[10px] text-[#3730a3] border border-[#3730a3]/30 px-2.5 py-1 rounded-full bg-[#3730a3]/5 hover:bg-[#3730a3]/10 transition-colors">{r}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MOCKUP 3 — Crear Pancartas (Creativos)
═══════════════════════════════════════════ */
function CreativosMockup() {
  const templates = [
    { label: "Ropa Deportiva", bg: "from-green-400 to-blue-600" },
    { label: "Alpha Men", bg: "from-yellow-600 to-gray-900" },
    { label: "Naisigoo SPF", bg: "from-purple-400 to-violet-600" },
  ];
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40 bg-white">
      {/* Title */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-[15px] font-black text-gray-900">Crear Pancartas</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Diseña pancartas de alta conversión con plantillas inteligentes</p>
      </div>

      {/* Step progress */}
      <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-100 gap-2">
        {[
          { label: "ELEGIR ESTILO", active: true, icon: "🎨" },
          { label: "COPIAR PROMPT", active: false, icon: "📋" },
          { label: "CREAR PUBLICIDAD", active: false, icon: "✨" },
          { label: "SUBIR A PAUTAS", active: false, icon: "☁️" },
        ].map((step, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step.active ? "bg-[#3730a3] text-white" : "bg-gray-200 text-gray-400"}`}>
                {step.active ? "●" : "○"}
              </div>
              <span className={`text-[8px] font-bold tracking-wide ${step.active ? "text-[#3730a3]" : "text-gray-300"}`}>{step.label}</span>
            </div>
            {i < 3 && <div className="flex-1 h-px bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-0">
        {/* Template grid */}
        <div className="col-span-3 p-3 border-r border-gray-100">
          <p className="text-[11px] font-semibold text-gray-700 mb-2">Seleccionar Plantilla de Diseño</p>
          {/* Category pills */}
          <div className="flex gap-1 mb-3 flex-wrap">
            {["Todos", "Belleza", "Tech", "Moda"].map((cat, i) => (
              <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${i === 0 ? "bg-gray-900 text-white" : "border border-gray-200 text-gray-500"}`}>{cat}</span>
            ))}
          </div>
          {/* Templates */}
          <div className="grid grid-cols-3 gap-1.5">
            {templates.map((t, i) => (
              <div
                key={i}
                className={`aspect-[3/4] rounded-lg bg-gradient-to-b ${t.bg} flex items-end p-1.5 overflow-hidden relative cursor-pointer ${i === 0 ? "ring-2 ring-[#3730a3]" : ""}`}
              >
                <span className="text-white text-[8px] font-bold drop-shadow-md relative z-10">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Preview panel */}
        <div className="col-span-2 p-3">
          <p className="text-[9px] font-bold text-[#3730a3] tracking-widest mb-2">ESTILO DE COMPOSICIÓN</p>
          <div className="aspect-[3/4] rounded-lg bg-gradient-to-b from-green-400 to-blue-600 flex items-end p-2 mb-2">
            <span className="text-white text-[9px] font-bold">Plantilla de ropa deportiva</span>
          </div>
          <button className="w-full py-2 rounded-xl bg-[#3730a3] text-white text-[11px] font-bold">
            Continuar con el Diseño →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MOCKUP 4 — Bot WhatsApp (Chatbot)
═══════════════════════════════════════════ */
function ChatbotMockup() {
  const msgs = [
    { from: "bot", text: "¡Hola! Soy Alpha-One. ¿En qué puedo ayudarte hoy con nuestro portafolio de servicios?", time: "10:12 AM" },
    { from: "client", text: "¿Puedes explicarme la política de reembolso del plan Pro?", time: "10:13 AM" },
    { from: "bot", text: "Según nuestra Guía de Producto, el plan Pro ofrece una garantía de devolución completa de 30 días. ¿Deseas que inicie una solicitud?", time: "10:13 AM" },
  ];

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40 bg-white">
      {/* Title */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-[15px] font-black text-gray-900">Configuración del Bot</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Elige el enfoque y flujo principal de tu agente de IA</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {["⚙️ Ajustes", "📖 Fuentes"].map((t, i) => (
          <button key={i} className={`flex-1 text-[11px] py-2.5 font-semibold border-b-2 ${i === 0 ? "border-[#3730a3] text-[#3730a3]" : "border-transparent text-gray-400"}`}>{t}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-0">
        {/* Left: config */}
        <div className="p-3 border-r border-gray-100">
          <p className="text-[10px] font-bold text-gray-500 tracking-wider mb-2">MODO DE OPERACIÓN</p>
          {/* Cards */}
          <div className="space-y-2">
            <div className="border-2 border-[#3730a3] rounded-xl p-2.5 bg-[#3730a3]/5 relative">
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#3730a3] flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="w-6 h-6 rounded-lg bg-[#3730a3] flex items-center justify-center mb-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
              </div>
              <p className="text-[11px] font-bold text-gray-800">Venta de Servicios</p>
              <p className="text-[9px] text-green-500 font-semibold mb-1">ACTIVO</p>
              <p className="text-[9px] text-gray-400 leading-tight">Asesora, califica leads y vende servicios.</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-2.5">
              <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center mb-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#9ca3af"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              </div>
              <p className="text-[11px] font-bold text-gray-700">Dropshipping</p>
              <p className="text-[9px] text-green-500 font-semibold mb-1">ACTIVO</p>
              <p className="text-[9px] text-gray-400 leading-tight">Promueve productos y genera órdenes.</p>
            </div>
          </div>
        </div>

        {/* Right: WhatsApp preview */}
        <div className="flex flex-col">
          <div className="px-3 pt-2 pb-1 bg-gray-50 border-b border-gray-100">
            <p className="text-[9px] font-bold text-[#3730a3] tracking-widest">VISTA PREVIA EN VIVO</p>
          </div>
          {/* Phone mockup */}
          <div className="flex-1 bg-gray-100 p-2 flex flex-col" style={{ minHeight: 0 }}>
            <div className="bg-[#075E54] rounded-t-xl px-2 py-2 flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
              </div>
              <div>
                <p className="text-white text-[10px] font-bold">Alpha-One Support</p>
                <p className="text-green-300 text-[8px]">● en línea</p>
              </div>
            </div>
            <div className="flex-1 bg-[#e5ddd5] px-2 py-2 space-y-2 overflow-hidden">
              <div className="flex justify-center">
                <span className="text-[8px] bg-black/20 text-white/80 px-2 py-0.5 rounded-full">martes, 23 de junio</span>
              </div>
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.from === "bot" ? "justify-start" : "justify-end"}`}>
                  {m.from === "bot" && (
                    <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center mr-1 shrink-0 mt-0.5">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="3"/></svg>
                    </div>
                  )}
                  <div className={`max-w-[80%] px-2 py-1.5 rounded-xl text-[9px] leading-relaxed ${m.from === "bot" ? "bg-white text-gray-800 rounded-tl-none" : "bg-[#dcf8c6] text-gray-800 rounded-tr-none"}`}>
                    {m.text}
                    <div className="text-right text-[7px] text-gray-400 mt-0.5">{m.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-200 rounded-b-xl px-2 py-1.5 flex items-center gap-1">
              <div className="flex-1 bg-white rounded-full px-2 py-1 text-[8px] text-gray-400">Mensaje…</div>
              <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FEATURE DATA
═══════════════════════════════════════════ */
const features = [
  {
    index: "01",
    category: "PUBLICACIÓN MULTI-REDES",
    title: "Publica en todas tus redes a la vez",
    description: "Sube un video una sola vez y distribúyelo en Facebook, TikTok y YouTube automáticamente. Programa la hora y olvídate.",
    list: [
      "Un solo panel para 12+ canales vinculados",
      "Programación anticipada con IA integrada",
      "El formato se adapta a cada plataforma",
    ],
    mockup: <PublicacionMockup />,
    flip: false,
  },
  {
    index: "02",
    category: "PUBLICIDAD CON IA",
    title: "Anuncios con IA que venden solos",
    description: "Tu agente experto en Meta Ads diseña, escribe y optimiza tus campañas de forma automática para maximizar el ROI.",
    list: [
      "Agente IA especializado en Meta Ads",
      "Segmentación de audiencia automática",
      "Optimiza presupuesto en tiempo real",
    ],
    mockup: <PublicidadMockup />,
    flip: true,
  },
  {
    index: "03",
    category: "CREATIVOS & PANCARTAS",
    title: "Pancartas de alta conversión en segundos",
    description: "Selecciona una plantilla, personaliza con IA y publica tu pancarta publicitaria directamente a tus campañas en pocos clics.",
    list: [
      "Plantillas por industria (Moda, Tech, Belleza…)",
      "Editor guiado paso a paso con IA",
      "Exporta y sube a pautas al instante",
    ],
    mockup: <CreativosMockup />,
    flip: false,
  },
  {
    index: "04",
    category: "BOT WHATSAPP IA",
    title: "Un bot que atiende y vende por ti",
    description: "Configura tu agente de IA en minutos. Atiende a tus clientes en WhatsApp las 24 horas, califica leads y cierra ventas automáticamente.",
    list: [
      "Modos: Venta de Servicios y Dropshipping",
      "Vista previa en vivo del bot en WhatsApp",
      "Base de conocimiento personalizada",
    ],
    mockup: <ChatbotMockup />,
    flip: true,
  },
];

/* ═══════════════════════════════════════════
   MAIN COMPONENT — Sticky Scroll
═══════════════════════════════════════════ */
export function FeaturesSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(
      Math.floor(v * features.length),
      features.length - 1
    );
    setActiveIndex(idx);
  });

  const f = features[activeIndex];

  return (
    <div ref={containerRef} style={{ height: `${features.length * 65}vh` }} className="relative">

      {/* Sticky viewport */}
      <div className="sticky top-0 h-screen flex flex-col overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Header — always visible */}
        <div className="container mx-auto px-6 max-w-6xl pt-12 pb-6 shrink-0">
          <motion.span
            className="block text-xs font-bold tracking-[0.18em] uppercase text-[#F27121] mb-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Capacidades
          </motion.span>
          <AnimatedText
            as="h2"
            mode="word"
            className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.05]"
            stagger={45}
          >
            Todo lo que tu marca necesita
          </AnimatedText>
        </div>

        {/* Content grid */}
        <div className="flex-1 container mx-auto px-6 max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center pb-10 min-h-0">

          {/* LEFT — text */}
          <div className="relative flex flex-col justify-center">
            {/* Step dots */}
            <div className="flex gap-2 mb-6">
              {features.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (!containerRef.current) return;
                    const el = containerRef.current;
                    const top = el.getBoundingClientRect().top + window.scrollY;
                    const h = el.offsetHeight;
                    const target = top + (h / features.length) * i + 1;
                    window.scrollTo({ top: target, behavior: "smooth" });
                  }}
                  className="flex items-center gap-2 group"
                >
                  <div
                    className="h-1 rounded-full transition-all duration-500"
                    style={{
                      width: i === activeIndex ? "28px" : "12px",
                      background: i === activeIndex ? "#F27121" : "rgba(255,255,255,0.2)",
                    }}
                  />
                  <span
                    className="text-[10px] font-bold tracking-widest transition-colors duration-300"
                    style={{ color: i === activeIndex ? "#F27121" : "rgba(255,255,255,0.3)" }}
                  >
                    {features[i].index}
                  </span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="popLayout">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#F27121] block mb-3">
                  {f.index} — {f.category}
                </span>
                <h3 className="text-2xl md:text-3xl lg:text-[2rem] font-black text-white tracking-tight leading-tight mb-4">
                  {f.title}
                </h3>
                <p className="text-gray-300 leading-relaxed text-[15px] max-w-[44ch]">
                  {f.description}
                </p>
                <ul className="mt-5 space-y-0">
                  {f.list.map((item, j) => (
                    <motion.li
                      key={j}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: j * 0.04, duration: 0.18 }}
                      className="flex items-start gap-3 py-3 border-t border-white/[0.07] text-[14px] text-gray-300 first:border-0"
                    >
                      <span className="text-[#F27121] font-bold mt-0.5 shrink-0">✓</span>
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* RIGHT — mockup */}
          <div className="relative h-full flex items-center">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, x: 18, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -12, scale: 0.98 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="w-full"
              >
                {f.mockup}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    </div>
  );
}
