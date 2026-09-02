import React from 'react';

export default function FlowZapVersions() {
  return (
    <div className="h-full overflow-auto p-4 font-inter">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_4px_16px_rgba(31,41,55,0.035)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="bg-slate-50 text-slate-500 text-[9px] uppercase tracking-wider p-3 border-b border-slate-200">Fecha</th>
              <th className="bg-slate-50 text-slate-500 text-[9px] uppercase tracking-wider p-3 border-b border-slate-200">Bot</th>
              <th className="bg-slate-50 text-slate-500 text-[9px] uppercase tracking-wider p-3 border-b border-slate-200">Tipo</th>
              <th className="bg-slate-50 text-slate-500 text-[9px] uppercase tracking-wider p-3 border-b border-slate-200">Versión</th>
              <th className="bg-slate-50 border-b border-slate-200"></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-12 text-center text-slate-500 border-b border-slate-100">
                <div className="flex flex-col items-center justify-center">
                  <span className="text-3xl mb-2">🗂️</span>
                  <strong className="text-slate-800 text-xs font-bold block mb-1">Aún no hay versiones</strong>
                  <p className="text-[10px] max-w-xs mx-auto leading-relaxed">
                    Se crea una versión de forma automática cada vez que guardas o publicas un flujo de conversación.
                  </p>
                </div>
              </td>
            </tr>
            {/* Example row (commented out or conditionally rendered later)
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="p-3 border-b border-slate-100 text-[10px] text-slate-700">02/09/2026, 10:30</td>
              <td className="p-3 border-b border-slate-100">
                <strong className="text-[11px] text-slate-800 block">Mi chatbot</strong>
                <small className="text-[8px] text-slate-500 block mt-0.5">Guardado manual</small>
              </td>
              <td className="p-3 border-b border-slate-100">
                <span className="inline-block text-[8px] px-1.5 py-1 rounded-full bg-green-100 text-green-700 font-bold tracking-wide">publicado</span>
              </td>
              <td className="p-3 border-b border-slate-100 text-[10px] text-slate-700 font-bold">v1</td>
              <td className="p-3 border-b border-slate-100 text-right">
                <button className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors">
                  Restaurar
                </button>
              </td>
            </tr> */}
          </tbody>
        </table>
      </div>
    </div>
  );
}
