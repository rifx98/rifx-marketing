'use client';

import React from 'react';
import ContactChannels from '../../components/ContactChannels';
import TrainCTA from '../../components/TrainCTA';

export default function WhatsAppAI() {
  return (
    <>
      <style jsx global>{`
        body { font-family: 'Montserrat', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .selection-orange::selection { background-color: #f27121; color: white; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0b1229; }
        ::-webkit-scrollbar-thumb { background: #181e36; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #f27121; }
        
        .glass { background: rgba(24, 30, 54, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .glass-hover:hover { background: rgba(24, 30, 54, 0.6); border-color: rgba(242, 113, 33, 0.3); }
        .text-gradient { background: linear-gradient(to right, #ffb692, #f27121); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      `}</style>

      {/* External Resources */}
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&display=swap" rel="stylesheet"/>

      <div className="bg-[#0b1229] text-[#dce1ff] selection-orange antialiased overflow-x-hidden min-h-screen">

        <main className="pt-20">
          {/* Hero Section */}
          <section className="relative min-h-[85vh] flex items-center px-6 py-20 max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="z-10">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#ffb692] text-[10px] font-bold tracking-[0.3em] uppercase mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f27121] mr-2 animate-pulse"></span>
                  WhatsApp 2.0 Integration
                </div>
                <h1 className="text-5xl md:text-7xl leading-[1] mb-8 text-white font-title">
                  Vende en <span className="text-gradient">Piloto Automático</span> con IA
                </h1>
                <p className="text-lg text-slate-400 leading-relaxed mb-12 max-w-lg">
                  Filtre a los curiosos y concéntrese en los compradores. Nuestros agentes de IA califican leads en tiempo real, cerrando ventas y fidelizando clientes sin perder ni un segundo de su tiempo.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button onClick={() => document.getElementById('train-cta')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#f27121] text-white px-10 py-5 rounded-xl font-bold text-base hover:shadow-[0_0_40px_rgba(242,113,33,0.3)] transition-all duration-300">
                    Sincronizar IA
                  </button>
                  <button className="bg-white/5 border border-white/10 px-10 py-5 rounded-xl font-bold text-base backdrop-blur-md hover:bg-white/10 transition-all">
                    Ver Demo
                  </button>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#f27121]/30 via-transparent to-blue-500/20 blur-[120px]"></div>
                <div className="relative glass rounded-[2.5rem] p-4 border-white/10 overflow-hidden group">
                  <img 
                    alt="AI Interface" 
                    className="w-full h-auto rounded-[1.8rem] grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700 shadow-2xl" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAV9rgTrJwGGxUA576fPaedvkn1O4betvvfrU8MNoToz93WFzLz-0R5zy59YUlQkEt3X1m_fme0o0sf1V-N-B9rArfr9bQkb201B9CfUOecxRoPCEZlMHBv_Dv4sSn88mxO96DA6isYvmcm5ED9VsKPlw6MQIq3x3IW_Y_8PXJ72FCP2-Q5MwV2RMi1oeFAJncY5ivCXycBKLSYzFfCqtL7hCEUOVDplsi6cBFnY_LPinx3xUDoHXLsEHXg8R_9QUI4mcw_N8bSLoU" 
                  />
                  <div className="absolute bottom-10 left-10 right-10 p-6 glass rounded-2xl border-white/10 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-xs font-space font-bold uppercase tracking-widest">IA Operativa - 99.9% Uptime</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Por qué nos eligen */}
          <section className="py-32 px-6 max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 font-space tracking-tight">Efectividad Demostrada</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">Impulsamos el crecimiento mediante arquitectura de datos optimizada para conversión.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="glass glass-hover p-12 rounded-[2.5rem] transition-all duration-500 flex flex-col items-start group">
                <div className="bg-orange-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[#f27121] text-3xl">shopping_cart</span>
                </div>
                <div className="text-5xl font-bold text-white mb-3 font-space tracking-tighter">30%</div>
                <h3 className="text-lg font-bold text-[#ffb692] mb-6 font-space uppercase tracking-widest">Recuperación</h3>
                <p className="text-slate-400 leading-relaxed text-sm">Estrategias de retención automática que rescatan carritos abandonados en tiempo real.</p>
              </div>
              <div className="glass glass-hover p-12 rounded-[2.5rem] transition-all duration-500 flex flex-col items-start group">
                <div className="bg-blue-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-blue-400 text-3xl">trending_up</span>
                </div>
                <div className="text-5xl font-bold text-white mb-3 font-space tracking-tighter">+100%</div>
                <h3 className="text-lg font-bold text-blue-400 mb-6 font-space uppercase tracking-widest">Crecimiento</h3>
                <p className="text-slate-400 leading-relaxed text-sm">Escale su volumen operativo sin necesidad de ampliar su infraestructura humana.</p>
              </div>
              <div className="glass glass-hover p-12 rounded-[2.5rem] transition-all duration-500 flex flex-col items-start group">
                <div className="bg-emerald-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-emerald-400 text-3xl">bolt</span>
                </div>
                <div className="text-5xl font-bold text-white mb-3 font-space tracking-tighter">24/7</div>
                <h3 className="text-lg font-bold text-emerald-400 mb-6 font-space uppercase tracking-widest">Ubicuidad</h3>
                <p className="text-slate-400 leading-relaxed text-sm">Respuesta instantánea garantizada. La inmediatez es el factor decisivo en la venta moderna.</p>
              </div>
            </div>
          </section>

          {/* Filtro Anti-Curiosos Section */}
          <section className="py-32 px-6 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-500/5 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
              <div className="order-2 lg:order-1 relative">
                <div className="glass p-8 rounded-[2.5rem] border-white/10 relative z-10">
                  <div className="flex flex-col gap-6">
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-red-500 text-xl">person_off</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-1">El "Curioso" (Window Shopper)</h4>
                        <p className="text-xs text-slate-400">Pregunta precio y desaparece. Consume el 70% del tiempo de su equipo de ventas.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center py-2">
                      <div className="h-10 w-0.5 bg-gradient-to-b from-[#f27121] to-transparent"></div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#f27121]/10 border border-[#f27121]/30">
                      <div className="w-10 h-10 rounded-full bg-[#f27121] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(242,113,33,0.4)]">
                        <span className="material-symbols-outlined text-white text-xl">psychology</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-1">Filtro AstraCloud AI</h4>
                        <p className="text-xs text-slate-200 uppercase tracking-widest font-bold">Calificación en 3 segundos</p>
                        <p className="text-xs text-slate-300 mt-1 italic">"Detectamos intención de compra, presupuesto y urgencia automáticamente."</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center py-2">
                       <span className="material-symbols-outlined text-emerald-500 animate-bounce">keyboard_double_arrow_down</span>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white text-xl">payments</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-1">Comprador Calificado</h4>
                        <p className="text-xs text-slate-400">Lead listo para el cierre. El sistema solo le notifica cuando hay dinero sobre la mesa.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <span className="text-[#f27121] font-bold uppercase tracking-widest text-xs mb-4 block">Blindaje Comercial</span>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 font-space leading-tight">
                  Deje de perder el tiempo con <span className="text-gradient">quien no va a comprar</span>
                </h2>
                <p className="text-lg text-slate-400 leading-relaxed mb-8">
                  El mayor costo oculto de un negocio es el tiempo dedicado a personas que solo "están mirando". Nuestra IA implementa un sistema de <strong>Lead Scoring</strong> instantáneo que:
                </p>
                <ul className="space-y-6">
                  <li className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-[#f27121]">verified</span>
                    <p className="text-slate-300"><strong className="text-white">Identifica la intención:</strong> Separa las dudas generales de las consultas de compra directa en la primera interacción.</p>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-[#f27121]">timer_off</span>
                    <p className="text-slate-300"><strong className="text-white">Elimina el desgaste:</strong> Su equipo ya no tendrá que responder 100 veces al día "¿qué precio tiene?". La IA lo hace y solo le pasa los prospectos que aceptan el valor.</p>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-[#f27121]">rocket_launch</span>
                    <p className="text-slate-300"><strong className="text-white">Aumenta el ROI:</strong> Al enfocarse solo en leads calificados, su tasa de conversión se dispara sin aumentar su carga de trabajo.</p>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Cómo funciona */}
          <section className="py-32 bg-[#080f24]/50">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-24">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 font-space tracking-tight">Metodología Astra</h2>
                <p className="text-slate-400 text-lg">Tres fases críticas para la automatización total.</p>
              </div>
                <div className="grid md:grid-cols-3 gap-12">
                  <div className="relative flex flex-col items-start text-left glass p-8 rounded-3xl group hover:border-[#f27121]/50 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-xl font-bold text-[#f27121] mb-6 border border-orange-500/20 group-hover:scale-110 transition-transform">
                      01
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4 font-space">Sincronización</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">
                      Integración total con su CRM, inventario y base de conocimientos. No es un chatbot genérico; es una extensión de su cerebro comercial que conoce sus productos al detalle.
                    </p>
                  </div>
                  <div className="relative flex flex-col items-start text-left glass p-8 rounded-3xl group border-[#f27121]/40 bg-[#181e36]/60 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-[#f27121] flex items-center justify-center text-xl font-bold text-white mb-6 shadow-[0_0_20px_rgba(242,113,33,0.3)]">
                      02
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4 font-space">Entrenamiento Gen-AI</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">
                      Configuramos agentes con procesamiento de lenguaje natural (NLP) que imitan el tono de su marca. Detectan ironías, urgencias y objeciones de venta para rebatirlas con argumentos sólidos.
                    </p>
                  </div>
                  <div className="relative flex flex-col items-start text-left glass p-8 rounded-3xl group hover:border-[#f27121]/50 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-xl font-bold text-[#f27121] mb-6 border border-orange-500/20 group-hover:scale-110 transition-transform">
                      03
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4 font-space">Escalado Infinito</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">
                      Atienda a 10, 100 o 1,000 personas al mismo tiempo sin que la calidad disminuya. Analizamos cada dato para optimizar el flujo y maximizar el Ticket Promedio de sus ventas.
                    </p>
                  </div>
                </div>
            </div>
          </section>

          {/* Ahorro de Tiempo Section */}
          <section className="py-32 px-6">
            <div className="max-w-7xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-16 items-center">
                <div>
                  <h2 className="text-4xl font-bold text-white mb-8 font-space tracking-tight">Recupere el control de su <span className="text-[#f27121]">agenda</span></h2>
                  <p className="text-slate-400 text-lg mb-10 leading-relaxed">
                    Un lead "curioso" puede tomarle de 15 a 20 minutos de mensajes de ida y vuelta. Multiplique eso por 30 leads al día y habrá perdido toda su jornada sin cerrar una sola venta.
                  </p>
                  <div className="space-y-4">
                    <div className="glass p-6 rounded-2xl border-l-4 border-red-500/50">
                      <h4 className="text-white font-bold mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-red-500">error</span> Gestión Manual
                      </h4>
                      <p className="text-slate-400 text-sm">Respuesta lenta, pérdida de leads por falta de atención inmediata y agotamiento mental resolviendo dudas básicas repetitivas.</p>
                    </div>
                    <div className="glass p-6 rounded-2xl border-l-4 border-emerald-500/50">
                      <h4 className="text-white font-bold mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-500">auto_awesome</span> Automatización Astra
                      </h4>
                      <p className="text-slate-400 text-sm">Respuesta en milisegundos, calificación automática y redirección al equipo de ventas solo cuando el lead está listo para pagar.</p>
                    </div>
                  </div>
                </div>
                <div className="relative">
                   <div className="glass p-1 rounded-3xl overflow-hidden shadow-2xl">
                      <div className="bg-[#0b1229] p-8">
                        <div className="flex items-center justify-between mb-8">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Estadísticas de Eficiencia</span>
                           <span className="text-[#f27121] text-xs font-bold tracking-[0.2em]">LIVE DATA</span>
                        </div>
                        <div className="space-y-8">
                          <div>
                            <div className="flex justify-between mb-2">
                               <span className="text-sm text-white font-bold">Tiempo Ahorrado</span>
                               <span className="text-[#f27121] font-bold">85%</span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                               <div className="h-full bg-gradient-to-r from-[#f27121] to-orange-400 w-[85%] rounded-full shadow-[0_0_10px_rgba(242,113,33,0.5)]"></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between mb-2">
                               <span className="text-sm text-white font-bold">Velocidad de Respuesta</span>
                               <span className="text-blue-400 font-bold">120x más rápido</span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                               <div className="h-full bg-blue-500 w-[95%] rounded-full"></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between mb-2">
                               <span className="text-sm text-white font-bold">Leads Calificados</span>
                               <span className="text-emerald-400 font-bold">+40%</span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                               <div className="h-full bg-emerald-500 w-[40%] rounded-full"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </section>

          {/* Planes Estelares */}
          <section className="py-32 px-6 max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 font-space tracking-tight">Modelos de Inversión</h2>
              <p className="text-slate-400 text-lg">Soluciones escalables para cada etapa de su negocio.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-stretch">
              {/* Free */}
              <div className="glass p-10 rounded-[2rem] flex flex-col border-white/5 hover:border-white/20 transition-all">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-6 block">Sandbox</span>
                <div className="text-4xl font-bold text-white mb-10 font-space">$0<span className="text-sm font-normal text-slate-500 ml-1">/14d</span></div>
                <ul className="space-y-5 mb-12 flex-1">
                  <li className="flex items-center gap-3 text-sm text-slate-400"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 1 Agente IA</li>
                  <li className="flex items-center gap-3 text-sm text-slate-400"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 200 Sesiones</li>
                </ul>
                <button className="w-full py-4 glass border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">Empezar</button>
              </div>
              {/* Start */}
              <div className="glass p-10 rounded-[2rem] flex flex-col border-white/5 hover:border-white/20 transition-all">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-6 block">Starter</span>
                <div className="text-4xl font-bold text-white mb-10 font-space">$49<span className="text-sm font-normal text-slate-500 ml-1">/mes</span></div>
                <ul className="space-y-5 mb-12 flex-1">
                  <li className="flex items-center gap-3 text-sm text-slate-400"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 1 Agente IA</li>
                  <li className="flex items-center gap-3 text-sm text-slate-400"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 1k Sesiones</li>
                  <li className="flex items-center gap-3 text-sm text-slate-400"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 3 Miembros</li>
                </ul>
                <button className="w-full py-4 glass border-orange-500/20 text-[#ffb692] hover:bg-orange-500/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">Elegir</button>
              </div>
              {/* Advanced (Featured) */}
              <div className="glass p-10 rounded-[2rem] flex flex-col border-[#f27121] bg-[#181e36]/60 relative z-10 shadow-2xl shadow-orange-900/10 scale-[1.03]">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#f27121] text-white text-[9px] font-black px-5 py-1.5 rounded-full uppercase tracking-[0.2em]">Más Popular</div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#ffb692] mb-6 block">Professional</span>
                <div className="text-4xl font-bold text-white mb-10 font-space">$109<span className="text-sm font-normal text-slate-400 ml-1">/mes</span></div>
                <ul className="space-y-5 mb-12 flex-1">
                  <li className="flex items-center gap-3 text-sm text-white font-medium"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 1 Agente IA</li>
                  <li className="flex items-center gap-3 text-sm text-white font-medium"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 10k Sesiones</li>
                  <li className="flex items-center gap-3 text-sm text-white font-medium"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 5 Miembros</li>
                </ul>
                <button className="w-full py-4 bg-[#f27121] text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg hover:brightness-110 transition-all">Contratar</button>
              </div>
              {/* Plus */}
              <div className="glass p-10 rounded-[2rem] flex flex-col border-white/5 hover:border-white/20 transition-all">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-6 block">Advanced</span>
                <div className="text-4xl font-bold text-white mb-10 font-space">$189<span className="text-sm font-normal text-slate-500 ml-1">/mes</span></div>
                <ul className="space-y-5 mb-12 flex-1">
                  <li className="flex items-center gap-3 text-sm text-slate-400"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 1 Agente IA</li>
                  <li className="flex items-center gap-3 text-sm text-slate-400"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 20k Sesiones</li>
                  <li className="flex items-center gap-3 text-sm text-slate-400"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 5 Miembros</li>
                </ul>
                <button className="w-full py-4 glass border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">Elegir</button>
              </div>
              {/* Master */}
              <div className="glass p-10 rounded-[2rem] flex flex-col border-white/5 hover:border-white/20 transition-all">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-6 block">Enterprise</span>
                <div className="text-4xl font-bold text-white mb-10 font-space">$399<span className="text-sm font-normal text-slate-500 ml-1">/mes</span></div>
                <ul className="space-y-5 mb-12 flex-1">
                  <li className="flex items-center gap-3 text-sm text-slate-400"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 5 Agentes IA</li>
                  <li className="flex items-center gap-3 text-sm text-slate-400"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 50k Sesiones</li>
                  <li className="flex items-center gap-3 text-sm text-slate-400"><span className="material-symbols-outlined text-[#f27121] text-lg">check</span> 10 Miembros</li>
                </ul>
                <button className="w-full py-4 glass border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">Elegir</button>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-32 bg-[#080f24]/30">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 font-space tracking-tight">Resolución de Consultas</h2>
                <p className="text-slate-400">Detalles técnicos y operativos de nuestra arquitectura de IA.</p>
              </div>
              <div className="space-y-4">
                <div className="glass rounded-2xl overflow-hidden group border-white/5">
                  <button className="w-full px-8 py-6 flex items-center justify-between text-left transition-all hover:bg-white/5 focus:bg-white/5">
                    <span className="font-bold text-white text-lg font-space group-hover:text-[#f27121]">¿Cómo garantiza AstraCloud la precisión de las respuestas?</span>
                    <span className="material-symbols-outlined text-slate-500 transition-transform group-focus:rotate-180">expand_more</span>
                  </button>
                  <div className="max-h-0 group-focus-within:max-h-40 overflow-hidden transition-all duration-300">
                    <div className="px-8 pb-8 text-slate-400 leading-relaxed text-sm">
                      Utilizamos modelos de lenguaje de última generación entrenados específicamente con el contexto de su negocio, asegurando coherencia y precisión en cada interacción multicanal.
                    </div>
                  </div>
                </div>
                <div className="glass rounded-2xl overflow-hidden group border-white/5">
                  <button className="w-full px-8 py-6 flex items-center justify-between text-left transition-all hover:bg-white/5">
                    <span className="font-bold text-white text-lg font-space group-hover:text-[#f27121]">¿Es posible integrar con CRMs personalizados?</span>
                    <span className="material-symbols-outlined text-slate-500">expand_more</span>
                  </button>
                </div>
                <div className="glass rounded-2xl overflow-hidden group border-white/5">
                  <button className="w-full px-8 py-6 flex items-center justify-between text-left transition-all hover:bg-white/5">
                    <span className="font-bold text-white text-lg font-space group-hover:text-[#f27121]">¿Qué medidas de seguridad de datos aplican?</span>
                    <span className="material-symbols-outlined text-slate-500">expand_more</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <TrainCTA title={<>Automatiza tus<br />conversaciones</>} subtitle="Implementa IA en tu canal de WhatsApp" />
        </main>
        <ContactChannels onlyModal={true} />
      </div>
    </>
  );
}
