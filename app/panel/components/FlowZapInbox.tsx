import React from 'react';

export default function FlowZapInbox() {
  return (
    <div className="h-[calc(100vh-140px)] grid grid-cols-[310px_minmax(430px,1fr)_270px] bg-white font-inter text-slate-800 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Columna Izquierda: Lista de Conversaciones */}
      <div className="border-r border-slate-200 flex flex-col min-h-0 bg-white">
        <div className="grid grid-cols-[1fr_92px] gap-2 p-2.5 border-b border-slate-200">
          <input 
            type="text" 
            placeholder="Buscar cliente o mensaje..." 
            className="min-w-0 border border-slate-200 rounded-lg p-2 text-[10px] outline-none focus:border-green-500 transition-colors"
          />
          <select className="min-w-0 border border-slate-200 rounded-lg p-2 text-[10px] outline-none bg-white focus:border-green-500 transition-colors">
            <option value="all">Todas</option>
            <option value="unread">No leídas</option>
          </select>
        </div>
        
        <div className="overflow-auto min-h-0 flex-1">
          {/* Fila de conversación simulada */}
          <button className="w-full border-none border-b border-slate-50 bg-[#f4fbf8] grid grid-cols-[36px_1fr_auto] gap-2.5 items-start p-3 text-left transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-full grid place-items-center bg-[#e6f7f0] text-[#0f7d57] text-[10px] font-black shrink-0">
              CD
            </div>
            <div className="min-w-0">
              <span className="flex justify-between gap-2">
                <strong className="text-[11px] whitespace-nowrap overflow-hidden text-ellipsis text-slate-800">Cliente Demo</strong>
                <time className="text-[8px] text-slate-400 whitespace-nowrap">Ahora</time>
              </span>
              <small className="block text-slate-500 text-[9px] mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                Hola, me gustaría más información.
              </small>
            </div>
            <div className="min-w-[20px] h-5 rounded-full bg-green-500 text-green-950 text-[9px] grid place-items-center font-bold px-1.5">
              1
            </div>
          </button>
          
          <button className="w-full border-none border-b border-slate-50 bg-white hover:bg-slate-50 grid grid-cols-[36px_1fr_auto] gap-2.5 items-start p-3 text-left transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-full grid place-items-center bg-slate-100 text-slate-600 text-[10px] font-black shrink-0">
              MD
            </div>
            <div className="min-w-0">
              <span className="flex justify-between gap-2">
                <strong className="text-[11px] whitespace-nowrap overflow-hidden text-ellipsis text-slate-800">Maria Demo</strong>
                <time className="text-[8px] text-slate-400 whitespace-nowrap">Ayer</time>
              </span>
              <small className="block text-slate-500 text-[9px] mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                Gracias, los reviso.
              </small>
            </div>
          </button>
        </div>
      </div>

      {/* Columna Central: Chat */}
      <div className="flex flex-col min-w-0 bg-[#eef2f5]">
        <div className="h-[62px] bg-white border-b border-slate-200 flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full grid place-items-center bg-[#e6f7f0] text-[#0f7d57] text-[10px] font-black shrink-0">
              CD
            </div>
            <div>
              <strong className="block text-[11px] font-bold text-slate-800">Cliente Demo</strong>
              <small className="block text-slate-500 text-[9px] mt-0.5">En línea</small>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button className="text-slate-400 hover:text-slate-600 bg-transparent border-none p-2 rounded-lg cursor-pointer transition-colors text-lg">
              ⋮
            </button>
          </div>
        </div>
        
        <div 
          className="flex-1 min-h-0 overflow-auto p-4 flex flex-col"
          style={{
            background: 'linear-gradient(rgba(245,246,247,0.9), rgba(245,246,247,0.9)), radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: 'auto, 18px 18px'
          }}
        >
          <div className="max-w-[80%] p-2.5 px-3 my-1.5 rounded-xl text-[11px] leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.06)] ml-auto bg-[#d9fdd3] rounded-tr-[3px] text-slate-800">
            Hola, me gustaría más información sobre sus planes.
            <small className="block text-right text-slate-500 text-[8px] mt-1 opacity-70">10:30</small>
          </div>
          <div className="max-w-[80%] p-2.5 px-3 my-1.5 rounded-xl text-[11px] leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.06)] mr-auto bg-white rounded-tl-[3px] text-slate-800">
            ¡Hola! Claro que sí, con gusto te ayudo. ¿Qué tamaño tiene tu equipo?
            <small className="block text-right text-slate-400 text-[8px] mt-1">10:31</small>
          </div>
        </div>
        
        <div className="grid grid-cols-[1fr_auto] gap-2 p-2.5 bg-white border-t border-slate-200">
          <input 
            type="text" 
            placeholder="Escribe un mensaje..." 
            className="border border-slate-200 rounded-full px-4 py-2 outline-none focus:border-green-500 transition-colors text-[11px]"
          />
          <button className="bg-green-600 hover:bg-green-700 text-white w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-sm">
            ➤
          </button>
        </div>
      </div>

      {/* Columna Derecha: Info del Contacto */}
      <div className="border-l border-slate-200 p-3.5 overflow-auto bg-white">
        <div className="text-center pb-4 border-b border-slate-200">
          <div className="w-14 h-14 rounded-full grid place-items-center bg-[#e6f7f0] text-[#0f7d57] text-[14px] font-black mx-auto mb-2">
            CD
          </div>
          <h3 className="text-[12px] font-bold text-slate-800 mt-2 mb-0.5">Cliente Demo</h3>
          <p className="text-[9px] text-slate-500 m-0">+52 1 555 123 4567</p>
        </div>
        
        <div className="py-3 border-b border-slate-50">
          <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-black mb-2">Asignado A</label>
          <select className="w-full border border-slate-200 rounded-lg p-2 text-[10px] bg-white outline-none">
            <option>Bot Principal</option>
            <option>Agente Humano 1</option>
          </select>
        </div>

        <div className="py-3 border-b border-slate-50">
          <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-black mb-2">Etiquetas</label>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[8px] text-[#0f6d5d] bg-[#e6f7f0] border border-[#caeadf] px-2 py-1 rounded-full font-semibold">VIP</span>
            <span className="text-[8px] text-[#0f6d5d] bg-[#e6f7f0] border border-[#caeadf] px-2 py-1 rounded-full font-semibold">NUEVO</span>
          </div>
        </div>

        <div className="py-3">
          <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-black mb-2">Campos</label>
          <div className="flex justify-between gap-2 text-[9px] my-1">
            <span className="text-slate-500">Email</span>
            <strong className="text-slate-800">cliente@demo.com</strong>
          </div>
          <div className="flex justify-between gap-2 text-[9px] my-1">
            <span className="text-slate-500">Empresa</span>
            <strong className="text-slate-800">Demo Corp</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
