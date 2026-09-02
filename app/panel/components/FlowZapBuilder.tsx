import React from 'react';

export default function FlowZapBuilder() {
  return (
    <div className="h-[calc(100vh-140px)] grid grid-cols-[220px_minmax(500px,1fr)_320px] bg-white font-inter text-slate-800 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Barra Izquierda: Herramientas */}
      <div className="border-r border-slate-200 bg-white min-h-0 overflow-auto p-3.5 flex flex-col">
        <div className="mb-4">
          <label className="block text-[9px] text-slate-500 uppercase font-black mb-1.5 tracking-wider">Nombre del flujo</label>
          <input 
            type="text" 
            defaultValue="Mi chatbot" 
            className="w-full border border-slate-200 rounded-lg p-2 text-[11px] outline-none focus:border-green-500 transition-colors bg-white font-bold"
          />
        </div>
        
        <strong className="block text-[11px] font-black text-slate-800 mb-2 mt-2">Bloques</strong>
        <div className="grid gap-1.5">
          <button className="flex items-center gap-2.5 p-2.5 border border-slate-200 bg-white rounded-lg text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-7 h-7 grid place-items-center rounded-lg bg-blue-100 text-blue-600 text-[14px]">💬</div>
            <div>
              <strong className="block text-[10px] text-slate-800 font-bold">Mensaje</strong>
              <small className="block text-slate-500 text-[8px] mt-0.5">Texto, link, etc.</small>
            </div>
          </button>
          
          <button className="flex items-center gap-2.5 p-2.5 border border-slate-200 bg-white rounded-lg text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-7 h-7 grid place-items-center rounded-lg bg-violet-100 text-violet-600 text-[14px]">☰</div>
            <div>
              <strong className="block text-[10px] text-slate-800 font-bold">Botones / Menú</strong>
              <small className="block text-slate-500 text-[8px] mt-0.5">Opciones rápidas</small>
            </div>
          </button>

          <button className="flex items-center gap-2.5 p-2.5 border border-slate-200 bg-white rounded-lg text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-7 h-7 grid place-items-center rounded-lg bg-amber-100 text-amber-600 text-[14px]">❓</div>
            <div>
              <strong className="block text-[10px] text-slate-800 font-bold">Pregunta libre</strong>
              <small className="block text-slate-500 text-[8px] mt-0.5">Guardar respuesta</small>
            </div>
          </button>

          <button className="flex items-center gap-2.5 p-2.5 border border-slate-200 bg-white rounded-lg text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-7 h-7 grid place-items-center rounded-lg bg-red-100 text-red-600 text-[14px]">🔀</div>
            <div>
              <strong className="block text-[10px] text-slate-800 font-bold">Condición</strong>
              <small className="block text-slate-500 text-[8px] mt-0.5">Lógica SI / NO</small>
            </div>
          </button>

          <button className="flex items-center gap-2.5 p-2.5 border border-slate-200 bg-white rounded-lg text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-7 h-7 grid place-items-center rounded-lg bg-purple-100 text-purple-600 text-[14px]">🧠</div>
            <div>
              <strong className="block text-[10px] text-slate-800 font-bold">IA Premium</strong>
              <small className="block text-slate-500 text-[8px] mt-0.5">Asistente avanzado</small>
            </div>
          </button>
        </div>

        <div className="mt-auto pt-3.5 grid gap-1.5">
          <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg text-[11px] transition-colors shadow-sm">
            Guardar flujo
          </button>
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold py-2 px-3 rounded-lg text-[11px] transition-colors">
            Publicar
          </button>
        </div>
      </div>

      {/* Canvas Central */}
      <div className="flex flex-col min-w-0 bg-[#f6f8fb]">
        <div className="h-10 flex items-center justify-between px-3 border-b border-slate-200 bg-white/80 text-[9px] text-slate-500 backdrop-blur-sm">
          <div className="flex gap-1.5">
            <input 
              type="text" 
              placeholder="Buscar bloque..." 
              className="w-[220px] border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] outline-none"
            />
          </div>
          <div>
            <button className="text-slate-500 hover:text-slate-800 bg-transparent border-none px-2 cursor-pointer font-bold">Centrar</button>
          </div>
        </div>
        
        {/* Simulación visual del canvas de nodos */}
        <div 
          className="relative flex-1 overflow-auto"
          style={{
            backgroundImage: 'radial-gradient(#d8dde6 1px, transparent 1px)',
            backgroundSize: '22px 22px'
          }}
        >
          {/* Nodo Start simulado */}
          <div className="absolute top-[100px] left-[150px] w-[210px] bg-white border border-green-500 rounded-2xl shadow-[0_0_0_2px_rgba(23,166,115,0.13),0_7px_22px_rgba(31,41,55,0.07)] select-none">
            <div className="flex items-center gap-2 p-2.5 border-b border-[#eef0f3] cursor-grab">
              <div className="w-7 h-7 rounded-lg grid place-items-center text-[13px] bg-green-100">▶️</div>
              <div className="min-w-0">
                <strong className="block text-[10px] whitespace-nowrap overflow-hidden text-ellipsis text-slate-800">Inicio</strong>
                <small className="block text-[8px] text-slate-500 mt-0.5 uppercase tracking-wide">PUNTO DE ENTRADA</small>
              </div>
            </div>
            <div className="p-2.5 pb-3 text-slate-600 text-[9px] min-h-[36px]">
              El bot comienza aquí cuando un usuario escribe.
            </div>
            {/* Puerto de salida */}
            <div className="absolute top-1/2 right-[-6px] -mt-1.5 w-3 h-3 bg-white border-2 border-slate-400 rounded-full"></div>
          </div>
          
          {/* Nodo Mensaje simulado */}
          <div className="absolute top-[250px] left-[150px] w-[210px] bg-white border border-slate-200 rounded-2xl shadow-[0_7px_22px_rgba(31,41,55,0.07)] select-none">
            {/* Puerto de entrada */}
            <div className="absolute top-1/2 left-[-6px] -mt-1.5 w-3 h-3 bg-white border-2 border-slate-400 rounded-full"></div>
            
            <div className="flex items-center gap-2 p-2.5 border-b border-[#eef0f3] cursor-grab">
              <div className="w-7 h-7 rounded-lg grid place-items-center text-[13px] bg-blue-100">💬</div>
              <div className="min-w-0">
                <strong className="block text-[10px] whitespace-nowrap overflow-hidden text-ellipsis text-slate-800">Mensaje</strong>
                <small className="block text-[8px] text-slate-500 mt-0.5 uppercase tracking-wide">TEXTO</small>
              </div>
            </div>
            <div className="p-2.5 pb-3 text-slate-600 text-[9px] min-h-[36px]">
              ¡Hola! ¿En qué te puedo ayudar hoy?
            </div>
            {/* Puerto de salida */}
            <div className="absolute top-1/2 right-[-6px] -mt-1.5 w-3 h-3 bg-white border-2 border-slate-400 rounded-full"></div>
          </div>
          
          {/* SVG para la línea simulada */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <path d="M 360 145 C 410 145, 100 295, 150 295" fill="none" stroke="#aab4c2" strokeWidth="2" />
          </svg>
        </div>
      </div>

      {/* Barra Derecha: Inspector */}
      <div className="border-l border-slate-200 bg-white min-h-0 overflow-auto p-3.5 flex flex-col">
        <h3 className="m-0 mb-1 text-[13px] font-bold text-slate-800">Propiedades</h3>
        <div className="text-slate-500 text-[9px] mb-3">Bloque: Inicio</div>
        
        <div className="mb-3">
          <label className="block text-[8px] font-black text-slate-600 mb-1.5 uppercase tracking-wider">Título del bloque</label>
          <input 
            type="text" 
            defaultValue="Inicio" 
            className="w-full border border-slate-200 rounded-lg p-2 text-[10px] bg-white text-slate-800 outline-none focus:border-green-500 transition-colors"
          />
        </div>
        
        <div className="h-[1px] bg-slate-200 my-3"></div>
        
        <div className="mb-3">
          <label className="block text-[8px] font-black text-slate-600 mb-1.5 uppercase tracking-wider">Siguiente bloque</label>
          <select className="w-full border border-slate-200 rounded-lg p-2 text-[10px] bg-white text-slate-800 outline-none focus:border-green-500 transition-colors">
            <option>Mensaje · Texto</option>
            <option>— Sin conexión —</option>
          </select>
        </div>
        
        <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-4">
          <button className="bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-lg text-[10px] transition-colors">
            Duplicar
          </button>
          <button className="bg-red-50 border border-red-100 hover:bg-red-100 text-red-700 font-bold py-2 px-3 rounded-lg text-[10px] transition-colors">
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
