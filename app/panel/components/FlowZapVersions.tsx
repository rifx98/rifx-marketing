import React from 'react';

export default function FlowZapVersions({ dbFlows = [], onApplyTemplate }: { dbFlows?: any[], onApplyTemplate?: (id: string) => void }) {
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
            {dbFlows.map((flow: any) => (
              <tr key={flow.id} className="hover:bg-slate-50 transition-colors bg-emerald-50/20">
                <td className="p-3 border-b border-slate-100 text-[10px] text-slate-700">
                  {new Date(flow.created_at).toLocaleString()}
                </td>
                <td className="p-3 border-b border-slate-100">
                  <strong className="text-[11px] text-slate-800 block">{flow.flow_name}</strong>
                  <small className="text-[8px] text-slate-500 block mt-0.5">{flow.label || 'Guardado en la Nube'}</small>
                </td>
                <td className="p-3 border-b border-slate-100">
                  <span className="inline-block text-[8px] px-1.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold tracking-wide">
                    {flow.kind === 'published' ? 'publicado' : 'borrador'}
                  </span>
                </td>
                <td className="p-3 border-b border-slate-100 text-[10px] text-slate-700 font-bold">
                  v{flow.flow_version}
                </td>
                <td className="p-3 border-b border-slate-100 text-right">
                  <button 
                    onClick={() => onApplyTemplate?.(flow.id)}
                    className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="p-3 border-b border-slate-100 text-[10px] text-slate-700">01/09/2026, 14:00</td>
              <td className="p-3 border-b border-slate-100">
                <strong className="text-[11px] text-slate-800 block">Bot Captación VIP</strong>
                <small className="text-[8px] text-slate-500 block mt-0.5">Plantilla predeterminada</small>
              </td>
              <td className="p-3 border-b border-slate-100">
                <span className="inline-block text-[8px] px-1.5 py-1 rounded-full bg-blue-100 text-blue-700 font-bold tracking-wide">plantilla</span>
              </td>
              <td className="p-3 border-b border-slate-100 text-[10px] text-slate-700 font-bold">v3</td>
              <td className="p-3 border-b border-slate-100 text-right">
                <button 
                  onClick={() => onApplyTemplate?.('captacion_vip')}
                  className="bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors">
                  Aplicar
                </button>
              </td>
            </tr>
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="p-3 border-b border-slate-100 text-[10px] text-slate-700">28/08/2026, 09:15</td>
              <td className="p-3 border-b border-slate-100">
                <strong className="text-[11px] text-slate-800 block">Soporte Técnico</strong>
                <small className="text-[8px] text-slate-500 block mt-0.5">Plantilla predeterminada</small>
              </td>
              <td className="p-3 border-b border-slate-100">
                <span className="inline-block text-[8px] px-1.5 py-1 rounded-full bg-blue-100 text-blue-700 font-bold tracking-wide">plantilla</span>
              </td>
              <td className="p-3 border-b border-slate-100 text-[10px] text-slate-700 font-bold">v2</td>
              <td className="p-3 border-b border-slate-100 text-right">
                <button 
                  onClick={() => onApplyTemplate?.('soporte_tecnico')}
                  className="bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors">
                  Aplicar
                </button>
              </td>
            </tr>
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="p-3 border-b border-slate-100 text-[10px] text-slate-700">15/08/2026, 11:30</td>
              <td className="p-3 border-b border-slate-100">
                <strong className="text-[11px] text-slate-800 block">Bienvenida Inicial</strong>
                <small className="text-[8px] text-slate-500 block mt-0.5">Plantilla predeterminada</small>
              </td>
              <td className="p-3 border-b border-slate-100">
                <span className="inline-block text-[8px] px-1.5 py-1 rounded-full bg-blue-100 text-blue-700 font-bold tracking-wide">plantilla</span>
              </td>
              <td className="p-3 border-b border-slate-100 text-[10px] text-slate-700 font-bold">v1</td>
              <td className="p-3 border-b border-slate-100 text-right">
                <button 
                  onClick={() => onApplyTemplate?.('bienvenida_inicial')}
                  className="bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors">
                  Aplicar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
