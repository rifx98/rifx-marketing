import React from 'react';

export default function FlowZapSettings() {
  return (
    <div className="h-full overflow-auto p-4 font-inter text-slate-800">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 items-start">
        <section className="bg-white border border-slate-200 p-4 rounded-2xl shadow-[0_4px_16px_rgba(31,41,55,0.035)]">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-[13px] font-bold m-0">Conexión WhatsApp</h3>
              <p className="text-[10px] text-slate-500 m-0 mt-1">Estado del backend</p>
            </div>
            <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full font-bold">
              ● Modo demo
            </span>
          </div>
          
          <div className="grid gap-2.5 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg grid place-items-center text-[11px] font-black bg-amber-50 text-amber-700">!</div>
              <div>
                <strong className="block text-[11px] text-slate-700 font-bold">Credenciales WhatsApp</strong>
                <small className="block text-[9px] text-slate-500 mt-0.5">Pendientes</small>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg grid place-items-center text-[11px] font-black bg-amber-50 text-amber-700">!</div>
              <div>
                <strong className="block text-[11px] text-slate-700 font-bold">WA_VERIFY_TOKEN</strong>
                <small className="block text-[9px] text-slate-500 mt-0.5">Pendiente</small>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg grid place-items-center text-[11px] font-black bg-amber-50 text-amber-700">!</div>
              <div>
                <strong className="block text-[11px] text-slate-700 font-bold">META_APP_SECRET</strong>
                <small className="block text-[9px] text-slate-500 mt-0.5">Pendiente</small>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg grid place-items-center text-[11px] font-black bg-amber-50 text-amber-700">!</div>
              <div>
                <strong className="block text-[11px] text-slate-700 font-bold">Versión Graph API</strong>
                <small className="block text-[9px] text-slate-500 mt-0.5">Pendiente</small>
              </div>
            </div>
          </div>
          
          <div className="text-[9px] leading-relaxed text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-2">
            El constructor, simulador, CRM y bandeja funcionan en modo demo sin Meta. Para recibir mensajes reales, debes exponer el servidor con HTTPS y configurar el webhook público en Meta.
          </div>
        </section>
        
        <section className="bg-white border border-slate-200 p-4 rounded-2xl shadow-[0_4px_16px_rgba(31,41,55,0.035)]">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-[13px] font-bold m-0">Archivo .env</h3>
              <p className="text-[10px] text-slate-500 m-0 mt-1">Configuración en servidor local</p>
            </div>
          </div>
          <pre className="whitespace-pre-wrap bg-slate-900 text-emerald-100 rounded-xl p-3 text-[10px] leading-relaxed overflow-auto">
{`PORT=3000
WA_VERIFY_TOKEN=tu_token_seguro
WA_ACCESS_TOKEN=tu_access_token
WA_PHONE_NUMBER_ID=tu_phone_number_id
WA_GRAPH_VERSION=vXX.X
META_APP_SECRET=tu_app_secret

# IA opcional
OPENAI_API_KEY=
GEMINI_API_KEY=`}
          </pre>
          <p className="text-[10px] text-slate-500 leading-relaxed mt-3">
            Después de editar las credenciales, debes reiniciar la instancia del webhook.
          </p>
        </section>

        <section className="bg-white border border-slate-200 p-4 rounded-2xl shadow-[0_4px_16px_rgba(31,41,55,0.035)] lg:col-span-2">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-[13px] font-bold m-0">Webhook</h3>
              <p className="text-[10px] text-slate-500 m-0 mt-1">Ruta que recibe eventos de Meta</p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-mono text-slate-800">
            <code>/api/webhook</code>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed mt-3">
            Recuerda que Meta enviará sus peticiones POST aquí, por lo tanto, esta ruta debe ser de acceso público.
          </p>
        </section>
      </div>
    </div>
  );
}
