"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BorderBeam } from "@/components/ui/border-beam";

const tabs = [
  {
    id: "bot",
    label: "Bot WhatsApp IA",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    color: "#25D366",
    preview: <BotPreview />,
  },
  {
    id: "crm",
    label: "Panel CRM",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    color: "#4a6cf7",
    preview: <CRMPreview />,
  },
  {
    id: "analytics",
    label: "Analytics IA",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    color: "#F27121",
    preview: <AnalyticsPreview />,
  },
];

function BotPreview() {
  const messages = [
    { from: "client", text: "Hola! ¿Cuánto cuesta el plan básico?", time: "10:42" },
    { from: "bot", text: "¡Hola! 👋 El plan básico empieza en $299/mes e incluye el bot 24/7 + CRM integrado. ¿Te gustaría ver una demo personalizada?", time: "10:42" },
    { from: "client", text: "Sí, me interesa mucho", time: "10:43" },
    { from: "bot", text: "Perfecto ✅ Te envío el link ahora mismo 👇\ncal.com/rifx/demo-gratuita", time: "10:43" },
    { from: "client", text: "Genial, ya lo agendé", time: "10:44" },
    { from: "bot", text: "Excelente 🎉 Recibirás un recordatorio 1 hora antes. ¡Nos vemos!", time: "10:44" },
  ];

  return (
    <div className="flex h-full min-h-[420px]">
      {/* Sidebar */}
      <div className="w-64 bg-[#0d1117] border-r border-white/5 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <div>
              <p className="text-white text-xs font-bold">WhatsApp Bots</p>
              <p className="text-green-400 text-[10px]">3 activos</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {["Asistente Ventas", "Soporte Técnico", "Bot Agenda"].map((name, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${i === 0 ? "bg-[#25D366]/15 border border-[#25D366]/20" : "hover:bg-white/5"}`}>
              <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-[#25D366]" : "bg-gray-600"}`} />
              <span className={`text-xs ${i === 0 ? "text-[#25D366] font-semibold" : "text-gray-400"}`}>{name}</span>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-white/5">
          <div className="text-[10px] text-gray-500 mb-1">Conversaciones hoy</div>
          <div className="text-2xl font-black text-white">247</div>
          <div className="text-[10px] text-green-400">↑ 32% vs ayer</div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col bg-[#0a0f1a]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Carlos Mendoza</p>
            <p className="text-gray-400 text-xs">+52 55 1234 5678 · WhatsApp</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-semibold">🔥 Hot Lead</span>
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400 text-[10px]">Score: 94</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.25 }}
              className={`flex ${msg.from === "bot" ? "justify-start" : "justify-end"}`}
            >
              {msg.from === "bot" && (
                <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center mr-2 mt-1 shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                </div>
              )}
              <div>
                <div
                  className="max-w-[280px] px-3 py-2 rounded-2xl text-xs text-white whitespace-pre-line"
                  style={{
                    background: msg.from === "bot" ? "rgba(255,255,255,0.07)" : "rgba(37,211,102,0.18)",
                    border: `1px solid ${msg.from === "bot" ? "rgba(255,255,255,0.08)" : "rgba(37,211,102,0.25)"}`,
                    borderRadius: msg.from === "bot" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                  }}
                >
                  {msg.text}
                </div>
                <p className="text-[10px] text-gray-600 mt-1 px-1">{msg.time}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CRMPreview() {
  const leads = [
    { name: "Carlos M.", company: "TechCorp SA", score: 94, status: "🔥 Hot", value: "$12,000", stage: "Propuesta", color: "#ef4444" },
    { name: "Laura P.", company: "Innovate MX", score: 71, status: "🌡️ Warm", value: "$8,500", stage: "Negociación", color: "#f59e0b" },
    { name: "José R.", company: "StartupXYZ", score: 52, status: "⚡ Medio", value: "$5,200", stage: "Contacto", color: "#4a6cf7" },
    { name: "Ana G.", company: "DigitalHub", score: 38, status: "❄️ Cold", value: "$3,800", stage: "Prospecto", color: "#6b7280" },
    { name: "Miguel F.", company: "Empresas DF", score: 88, status: "🔥 Hot", value: "$15,000", stage: "Cierre", color: "#ef4444" },
  ];

  const pipeline = [
    { stage: "Prospecto", count: 48, color: "#6b7280" },
    { stage: "Contacto", count: 31, color: "#4a6cf7" },
    { stage: "Negociación", count: 18, color: "#f59e0b" },
    { stage: "Cierre", count: 9, color: "#25D366" },
  ];

  return (
    <div className="flex h-full min-h-[420px]">
      {/* Sidebar nav */}
      <div className="w-52 bg-[#0d1117] border-r border-white/5 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4a6cf7] to-[#9333ea] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
            </div>
            <div>
              <p className="text-white text-xs font-bold">RIFX CRM</p>
              <p className="text-[10px] text-gray-500">Panel IA</p>
            </div>
          </div>
        </div>
        <nav className="p-2 space-y-0.5 flex-1">
          {[
            { label: "Dashboard", active: false },
            { label: "Leads", active: true },
            { label: "Pipeline", active: false },
            { label: "Tareas", active: false },
            { label: "Reportes", active: false },
          ].map((item) => (
            <div key={item.label} className={`px-3 py-2 rounded-lg text-xs cursor-pointer ${item.active ? "bg-[#4a6cf7]/20 text-[#4a6cf7] font-semibold" : "text-gray-400 hover:bg-white/5"}`}>
              {item.label}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Pipeline</div>
          {pipeline.map((p) => (
            <div key={p.stage} className="flex justify-between items-center">
              <span className="text-[10px] text-gray-400">{p.stage}</span>
              <span className="text-[10px] font-bold" style={{ color: p.color }}>{p.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 bg-[#0a0f1a] p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white text-sm font-bold">Leads Activos</h3>
            <p className="text-gray-500 text-xs">106 leads totales · IA scoring activo</p>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-[#4a6cf7]/20 text-[#4a6cf7] text-xs font-semibold">+ Nuevo lead</div>
          </div>
        </div>
        <div className="space-y-2">
          {leads.map((lead, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {lead.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white text-xs font-semibold">{lead.name}</p>
                  <span className="text-[10px] text-gray-500">{lead.company}</span>
                </div>
                <p className="text-gray-500 text-[10px]">{lead.stage}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white text-xs font-bold">{lead.value}</p>
                <p className="text-[10px]">{lead.status}</p>
              </div>
              <div className="shrink-0 text-right w-10">
                <p className="text-xs font-black" style={{ color: lead.color }}>{lead.score}</p>
                <div className="h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${lead.score}%`, background: lead.color }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyticsPreview() {
  const weekData = [42, 68, 55, 89, 73, 94, 82];
  const days = ["L", "M", "X", "J", "V", "S", "D"];
  const maxVal = Math.max(...weekData);

  return (
    <div className="flex h-full min-h-[420px]">
      {/* Sidebar */}
      <div className="w-52 bg-[#0d1117] border-r border-white/5 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F27121] to-[#ff0080] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div>
              <p className="text-white text-xs font-bold">Analytics IA</p>
              <p className="text-[10px] text-green-400">En tiempo real</p>
            </div>
          </div>
        </div>
        <div className="p-3 space-y-3 flex-1">
          {[
            { label: "Conversiones", value: "84%", color: "#F27121", delta: "+12%" },
            { label: "Engagement", value: "67%", color: "#4a6cf7", delta: "+8%" },
            { label: "Retención", value: "91%", color: "#25D366", delta: "+5%" },
            { label: "Churn", value: "4.2%", color: "#ef4444", delta: "-2%" },
          ].map((m) => (
            <div key={m.label} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-[10px] text-gray-400">{m.label}</span>
                <span className="text-[10px] text-green-400 font-semibold">{m.delta}</span>
              </div>
              <p className="text-lg font-black" style={{ color: m.color }}>{m.value}</p>
              <div className="h-1 rounded-full bg-white/10 mt-1.5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: m.color }}
                  initial={{ width: 0 }}
                  animate={{ width: m.value }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 bg-[#0a0f1a] p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white text-sm font-bold">Resumen de la semana</h3>
            <p className="text-gray-500 text-xs">Conversiones diarias · Actualizado hace 2 min</p>
          </div>
          <div className="flex gap-1.5">
            {["7D", "30D", "90D"].map((t, i) => (
              <div key={t} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer ${i === 0 ? "bg-[#F27121] text-white" : "bg-white/5 text-gray-400"}`}>{t}</div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex-1 flex items-end gap-2 pb-2 px-1">
          {weekData.map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                className="w-full rounded-t-lg relative overflow-hidden"
                style={{
                  height: `${(val / maxVal) * 160}px`,
                  background: i === 5 ? "linear-gradient(180deg, #F27121, #ff0080)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${i === 5 ? "rgba(242,113,33,0.4)" : "rgba(255,255,255,0.06)"}`,
                }}
                initial={{ scaleY: 0, originY: 1 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: i * 0.07, duration: 0.4, ease: "easeOut" }}
              >
                {i === 5 && (
                  <div className="absolute top-1 left-0 right-0 text-center text-[9px] font-black text-white">94</div>
                )}
              </motion.div>
              <span className="text-[10px] text-gray-500">{days[i]}</span>
            </div>
          ))}
        </div>

        {/* Bottom stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: "Leads esta semana", value: "247", color: "#F27121" },
            { label: "ROI promedio", value: "+82%", color: "#25D366" },
            { label: "Predicción próxima semana", value: "312", color: "#4a6cf7" },
          ].map((s) => (
            <div key={s.label} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Hero195() {
  const [activeTab, setActiveTab] = useState("bot");
  const activeFeature = tabs.find((t) => t.id === activeTab)!;

  return (
    <section className="relative py-24 lg:py-36 bg-transparent overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full bg-[#4a6cf7]/6 blur-[140px]" />
        <div className="absolute top-2/3 left-1/4 w-[400px] h-[400px] rounded-full bg-[#F27121]/4 blur-[100px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10 max-w-6xl">
        {/* Header - centered like the reference */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-[#F27121] uppercase tracking-widest mb-5">
            Tecnología IA
          </span>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.05] mb-5">
            Herramientas que{" "}
            <span className="bg-gradient-to-r from-[#F27121] via-[#ff0080] to-[#4a6cf7] bg-clip-text text-transparent">
              Escalan tu Negocio
            </span>
          </h2>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-8">
            Un ecosistema de IA diseñado para automatizar, convertir y crecer — sin necesidad de un equipo de 10 personas.
          </p>
          <a
            href="/panel"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-white text-sm transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{ background: "linear-gradient(135deg, #F27121, #ff0080)" }}
          >
            Probar gratis
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </a>
        </motion.div>

        {/* Tab navigation - centered */}
        <motion.div
          className="flex justify-center mb-6"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={
                  activeTab === tab.id
                    ? { background: `${tab.color}18`, color: tab.color, border: `1px solid ${tab.color}30` }
                    : { color: "#6b7280", border: "1px solid transparent" }
                }
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Large product mockup - like the reference screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative"
        >
          {/* Browser chrome */}
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
            <BorderBeam colorFrom={activeFeature.color} colorTo="#ff0080" size={400} duration={8} />

            {/* Browser top bar */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#0d1117] border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex-1 max-w-xs mx-auto">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/[0.05] border border-white/[0.06]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span className="text-[11px] text-gray-500 truncate">app.rifx.ai/{activeTab}</span>
                </div>
              </div>
              <div className="flex gap-2 ml-auto">
                <span className="text-[10px] text-gray-600">⌘K</span>
              </div>
            </div>

            {/* Content area */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {activeFeature.preview}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Reflection effect */}
          <div className="absolute -bottom-px left-0 right-0 h-32 bg-gradient-to-t from-[#060918] to-transparent pointer-events-none" />
        </motion.div>
      </div>
    </section>
  );
}
