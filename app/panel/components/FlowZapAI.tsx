import React, { useEffect, useState } from 'react';

export default function FlowZapAI() {
  const [stats, setStats] = useState({
    balance: 0,
    usedThisMonth: 0,
    aiQueries: 0,
    providerCost: '$0.0000',
    aiConfigured: false,
    activeProvider: 'none',
  });

  useEffect(() => {
    fetch('/api/panel/ai-ledger')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setStats({
            balance: data.balance ?? 0,
            usedThisMonth: data.stats?.used_this_month ?? 0,
            aiQueries: data.stats?.ai_queries ?? 0,
            providerCost: data.stats?.provider_cost ?? '$0.0000',
            aiConfigured: data.ai_configured ?? false,
            activeProvider: data.active_provider ?? 'none',
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="w-full text-left font-inter text-slate-800">
      {/* ─── BANNER FLOWZAP AI (ESTILO HERO CALENDARIO) ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1020] via-[#1a2342] to-[#0d1224] p-8 shadow-2xl shadow-indigo-900/10 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-gradient-to-br from-blue-500/15 to-indigo-500/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-20 w-96 h-96 bg-gradient-to-tr from-indigo-600/10 to-cyan-400/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest">
            <span className="material-symbols-outlined text-sm">smart_toy</span>
            <span>FlowZap AI</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-none">
            Asistente FlowZap AI
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            IA generativa integrada en tu flujo para responder consultas, guiar a tus clientes y coordinar citas de forma fluida sin menús rígidos.
          </p>
        </div>

        <div className="relative z-10 flex flex-col md:items-end shrink-0">
          <div className="flex items-baseline gap-2 md:justify-end">
            <strong className="text-4xl font-black text-white tracking-tight">{stats.balance.toLocaleString()}</strong>
            <span className="text-xs font-semibold text-slate-300">créditos</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mt-0.5">Créditos disponibles</span>
          <div className="mt-3">
            {stats.aiConfigured ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-200/90 rounded-full shadow-xs text-xs font-bold text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/60"></span>
                <span>IA Activada</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-200/90 rounded-full shadow-xs text-xs font-bold text-slate-600">
                <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/60"></span>
                <span>Sin IA configurada</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4 hover:border-slate-300 transition-all">
          <div className="w-12 h-12 bg-blue-50 text-[#000080] rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-2xl">trending_down</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-black tracking-widest">Utilizados este mes</span>
            <strong className="text-2xl font-black text-[#00003c] block font-headline mt-0.5">{stats.usedThisMonth.toLocaleString()}</strong>
            <span className="text-[10px] text-slate-400 font-medium">Consumo acumulado</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4 hover:border-slate-300 transition-all">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-2xl">psychology</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-black tracking-widest">Consultas IA</span>
            <strong className="text-2xl font-black text-[#00003c] block font-headline mt-0.5">{stats.aiQueries.toLocaleString()}</strong>
            <span className="text-[10px] text-slate-400 font-medium">Respuestas generadas</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4 hover:border-slate-300 transition-all">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-2xl">payments</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-black tracking-widest">Costo proveedor</span>
            <strong className="text-2xl font-black text-[#00003c] block font-headline mt-0.5">{stats.providerCost}</strong>
            <span className="text-[10px] text-slate-400 font-medium">Estimado según consumo</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6">
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-[0_4px_16px_rgba(31,41,55,0.035)]">
            <h3 className="text-sm font-bold text-slate-800 mb-5">Motor de Inteligencia Artificial</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Habilitar IA Premium</label>
                <label className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input type="checkbox" className="mt-1" />
                  <div>
                    <strong className="text-[11px] font-bold text-slate-700 block">Activar procesamiento de IA</strong>
                    <small className="text-[9px] text-slate-500">Permite usar el bloque de Inteligencia Artificial en el constructor.</small>
                  </div>
                </label>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Proveedor</label>
                  <select className="w-full border border-slate-200 rounded-xl p-2.5 text-[11px] bg-white outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all">
                    <option value="">-- Seleccionar --</option>
                    <option value="openai">OpenAI (GPT-4o / GPT-3.5)</option>
                    <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Modelo global</label>
                  <select className="w-full border border-slate-200 rounded-xl p-2.5 text-[11px] bg-white outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all">
                    <option value="gpt-4o">GPT-4o (Rápido y capaz)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (Económico)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Clave API Segura</label>
                <input type="password" placeholder="sk-..." className="w-full border border-slate-200 rounded-xl p-2.5 text-[11px] bg-white outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all" />
                <p className="text-[9px] text-slate-400 mt-1.5 leading-relaxed">Tu clave se guarda encriptada en la base de datos y nunca se expone al cliente.</p>
              </div>
              
              <div className="pt-2">
                <button className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold py-2.5 px-5 rounded-xl w-auto transition-colors shadow-sm">
                  Guardar Configuración IA
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-[0_4px_16px_rgba(31,41,55,0.035)]">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Prueba rápida</h3>
            <p className="text-[10px] text-slate-500 mb-5">Envía una consulta para validar la API Key actual</p>
            <div className="space-y-3">
              <input type="text" placeholder="Ej. ¿A qué hora abren?" className="w-full border border-slate-200 rounded-xl p-2.5 text-[11px] bg-white outline-none focus:border-purple-300 transition-colors" />
              <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-bold py-2.5 px-4 rounded-xl w-full transition-colors">
                Probar IA
              </button>
            </div>
            
            <div className="mt-4 border border-purple-200 bg-purple-50 rounded-xl p-3 text-[10px] leading-relaxed hidden">
              <strong className="block text-purple-800 font-bold mb-1">Resultado</strong>
              <p className="text-purple-900">Aquí aparecerá la respuesta de la IA.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
