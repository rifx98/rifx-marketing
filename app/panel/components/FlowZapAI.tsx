import React from 'react';

export default function FlowZapAI() {
  return (
    <div className="w-full text-left font-inter text-slate-800">
      <div className="bg-gradient-to-br from-white to-purple-50 p-6 rounded-2xl border border-purple-200 mb-6 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-slate-800">FlowZap AI</h2>
            <span className="bg-purple-600 text-white text-[10px] uppercase font-black px-2 py-1 rounded-full tracking-wider">Premium</span>
          </div>
          <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
            IA generativa de alto rendimiento integrada en tu flujo. Puedes usar un bloque de Inteligencia Artificial para responder consultas complejas sin crear menús rígidos.
          </p>
        </div>
        <div className="text-right">
          <strong className="text-4xl font-bold text-purple-700 block">0</strong>
          <span className="text-xs text-slate-500">Créditos disponibles</span>
          <div className="mt-2 inline-block bg-amber-100 text-amber-800 text-[10px] px-2 py-1 rounded-full font-bold">Sin IA configurada</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-[0_4px_16px_rgba(31,41,55,0.035)] flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl">💸</div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">Utilizados este mes</span>
            <strong className="text-xl font-bold text-slate-800 block">0</strong>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-[0_4px_16px_rgba(31,41,55,0.035)] flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl">🧠</div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">Consultas IA</span>
            <strong className="text-xl font-bold text-slate-800 block">0</strong>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-[0_4px_16px_rgba(31,41,55,0.035)] flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl">📉</div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">Costo proveedor</span>
            <strong className="text-xl font-bold text-slate-800 block">$0.0000</strong>
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
