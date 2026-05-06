'use client';

import React, { useState } from 'react';
import ContactChannels from '../../components/ContactChannels';
import TrainCTA from '../../components/TrainCTA';

export default function WhatsAppAI() {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  return (
    <>
      <style jsx global>{`
        body { font-family: 'Montserrat', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .glass { background: rgba(24, 30, 54, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .glass-hover:hover { background: rgba(24, 30, 54, 0.6); border-color: rgba(37, 211, 102, 0.3); }
        .text-gradient-wa { background: linear-gradient(to right, #25d366, #128c7e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .text-gradient-orange { background: linear-gradient(to right, #ffb692, #f27121); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        @keyframes float-slow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float-slow 4s ease-in-out infinite; }
        @keyframes typing { 0%, 60%, 100% { opacity: 1; } 30% { opacity: 0; } }
        .typing-dot { animation: typing 1.4s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&display=swap" rel="stylesheet"/>

      <div className="bg-[#0b1229] text-[#dce1ff] antialiased overflow-x-hidden min-h-screen">
        <main className="pt-20">

          {/* ── HERO ── */}
          <section className="relative min-h-[90vh] flex items-center px-6 py-20 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-green-500/10 rounded-full blur-[100px]" />
              <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-[#f27121]/8 rounded-full blur-[80px]" />
            </div>

            <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center z-10">
              {/* Left: Copy */}
              <div>
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold tracking-widest uppercase mb-8">
                  <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
                  Automatización con Inteligencia Artificial
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl leading-[1.05] mb-6 text-white font-title">
                  Tu negocio vendiendo<br />
                  <span className="text-gradient-wa">las 24 horas</span>,<br />
                  sin que estés presente.
                </h1>
                <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-lg">
                  Instalamos un <strong className="text-white">asistente de IA en tu WhatsApp</strong> que responde clientes, califica prospectos y cierra ventas automáticamente — mientras tú duermes, trabajas o descansas.
                </p>

                <div className="flex flex-wrap gap-4 mb-10">
                  {[
                    { icon: '✅', text: 'Respuestas en segundos' },
                    { icon: '🤖', text: 'IA entrenada con tu negocio' },
                    { icon: '📲', text: 'WhatsApp + Instagram + Web' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm text-slate-300">
                      <span>{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => document.getElementById('train-cta')?.scrollIntoView({ behavior: 'smooth' })}
                    className="bg-[#25d366] text-white px-10 py-5 rounded-xl font-bold text-base hover:shadow-[0_0_40px_rgba(37,211,102,0.4)] transition-all duration-300 uppercase tracking-widest"
                  >
                    Quiero Automatizar mi WhatsApp 🤖
                  </button>
                  <a
                    href="#como-funciona"
                    className="bg-white/5 border border-white/10 px-10 py-5 rounded-xl font-bold text-base hover:bg-white/10 transition-all uppercase tracking-widest text-white"
                  >
                    Ver Cómo Funciona
                  </a>
                </div>
              </div>

              {/* Right: WhatsApp Chat mockup */}
              <div className="animate-float">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-tr from-green-500/15 to-transparent rounded-[3rem] blur-[40px]" />
                  <div className="relative bg-[#111b21] rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 max-w-sm mx-auto">
                    {/* Chat header */}
                    <div className="bg-[#202c33] px-5 py-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#25d366] rounded-full flex items-center justify-center text-white font-bold text-sm">IA</div>
                      <div>
                        <p className="text-white font-bold text-sm">Asistente RIFX</p>
                        <p className="text-green-400 text-xs flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
                          en línea • 24/7
                        </p>
                      </div>
                    </div>
                    {/* Messages */}
                    <div className="p-4 space-y-3 bg-[#0b141a] min-h-[300px]">
                      <div className="flex justify-start">
                        <div className="bg-[#202c33] text-white text-sm px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%] leading-relaxed">
                          Hola! 👋 Estoy interesado en sus servicios. ¿Cuánto cuesta?
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-[#005c4b] text-white text-sm px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] leading-relaxed">
                          ¡Hola! Con gusto te ayudo 😊 Para darte el mejor precio, ¿cuál es tu objetivo principal: más ventas, más clientes o automatizar tu atención?
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="bg-[#202c33] text-white text-sm px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%]">
                          Quiero más ventas y automatizar
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-[#005c4b] text-white text-sm px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] leading-relaxed">
                          Perfecto! Tenemos exactamente lo que necesitas. Te agendo una llamada de 20 min con un especialista para mostrarte cómo otros negocios duplicaron sus ventas 🚀
                          <br /><br />
                          ¿Cuándo prefieres: mañana por la mañana o por la tarde?
                        </div>
                      </div>
                      {/* Typing indicator */}
                      <div className="flex justify-start">
                        <div className="bg-[#202c33] px-4 py-3 rounded-2xl flex gap-1 items-center">
                          <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
                          <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
                          <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
                        </div>
                      </div>
                    </div>
                    {/* Badge */}
                    <div className="bg-[#202c33] px-5 py-3 flex items-center justify-between">
                      <span className="text-slate-500 text-xs">Respondido automáticamente por IA</span>
                      <span className="text-green-400 text-xs font-bold">✓ En 3 segundos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── ESTADÍSTICAS ── */}
          <section className="py-16 border-y border-white/5 bg-[#080f24]/50">
            <div className="max-w-6xl mx-auto px-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                {[
                  { value: '24/7', label: 'Disponibilidad', icon: '⏰' },
                  { value: '< 5 seg', label: 'Tiempo de respuesta', icon: '⚡' },
                  { value: '+300%', label: 'Más leads calificados', icon: '🎯' },
                  { value: '85%', label: 'Tiempo ahorrado en atención', icon: '⏱️' },
                ].map((s, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <span className="text-3xl">{s.icon}</span>
                    <p className="text-3xl font-black text-white">{s.value}</p>
                    <p className="text-slate-400 text-xs uppercase tracking-widest">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── QUÉ HACE LA IA ── */}
          <section className="py-24 px-6 max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-green-400 font-bold uppercase tracking-widest text-xs">CAPACIDADES</span>
              <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 mb-4 font-space tracking-tight">
                Tu asistente IA puede hacer <span className="text-gradient-wa">todo esto</span>
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto">Y aprende más de tu negocio con cada conversación.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: '💬', title: 'Atender Clientes', desc: 'Responde preguntas frecuentes, precios, horarios y disponibilidad de forma instantánea, sin que tú tengas que hacerlo.' },
                { icon: '🎯', title: 'Calificar Leads', desc: 'Detecta automáticamente si un contacto tiene intención de compra real. Solo te pasa los prospectos listos para cerrar.' },
                { icon: '📅', title: 'Agendar Citas', desc: 'Coordina reuniones, consultas o visitas directamente en tu calendario sin intervención humana.' },
                { icon: '🛒', title: 'Cerrar Ventas', desc: 'Presenta tu catálogo, envía cotizaciones personalizadas y guía al cliente hasta el pago de forma automática.' },
                { icon: '🔔', title: 'Recordatorios', desc: 'Envía seguimientos automáticos a prospectos que no han respondido. Recupera ventas que parecían perdidas.' },
                { icon: '🌐', title: 'Multi-plataforma', desc: 'Funciona en WhatsApp, Instagram Direct, Messenger y el chat de tu página web, todo desde un solo sistema.' },
              ].map((item, i) => (
                <div key={i} className="glass glass-hover p-8 rounded-3xl transition-all duration-300 group flex flex-col">
                  <div className="text-4xl mb-5">{item.icon}</div>
                  <h3 className="text-white font-bold text-lg mb-3">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── CÓMO FUNCIONA ── */}
          <section id="como-funciona" className="py-24 bg-[#080f24]/50">
            <div className="max-w-6xl mx-auto px-6">
              <div className="text-center mb-16">
                <span className="text-green-400 font-bold uppercase tracking-widest text-xs">PROCESO</span>
                <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 font-space tracking-tight">
                  Listo en <span className="text-gradient-orange">menos de 1 semana</span>
                </h2>
                <p className="text-slate-400 mt-3 max-w-xl mx-auto">Nos encargamos de toda la configuración. Tú solo apruebas y empiezas a vender.</p>
              </div>
              <div className="grid md:grid-cols-4 gap-6">
                {[
                  { step: '01', icon: '🤝', title: 'Consulta Inicial', desc: 'Entendemos tu negocio, tus productos, tu proceso de ventas y los mensajes más frecuentes que recibes.' },
                  { step: '02', icon: '🧠', title: 'Entrenamiento de la IA', desc: 'Configuramos y entrenamos el asistente con el conocimiento de tu empresa, tono de comunicación y flujos de venta.' },
                  { step: '03', icon: '🔗', title: 'Conexión y Pruebas', desc: 'Conectamos la IA a tus canales (WhatsApp, Instagram, etc.), hacemos pruebas exhaustivas y ajustes finales.' },
                  { step: '04', icon: '🚀', title: 'Lanzamiento y Monitoreo', desc: 'Activamos el sistema y monitoreamos el rendimiento las primeras semanas para optimizar las respuestas.' },
                ].map((item, i) => (
                  <div key={i} className="glass glass-hover p-8 rounded-3xl transition-all duration-300 flex flex-col group relative overflow-hidden">
                    <div className="absolute top-4 right-4 text-5xl font-black text-white/5 font-space">{item.step}</div>
                    <div className="text-4xl mb-5">{item.icon}</div>
                    <h3 className="text-white font-bold text-lg mb-3">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── MANUAL vs IA ── */}
          <section className="py-24 px-6 max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-green-400 font-bold uppercase tracking-widest text-xs">COMPARATIVA</span>
              <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 font-space tracking-tight">
                Atención Manual vs. <span className="text-gradient-wa">IA Automatizada</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Manual */}
              <div className="glass p-10 rounded-3xl border-red-500/20 opacity-80">
                <div className="flex items-center gap-3 mb-8">
                  <span className="text-2xl">😓</span>
                  <h3 className="text-xl font-bold text-slate-400">Sin Automatización</h3>
                </div>
                <ul className="space-y-5">
                  {[
                    ['Horario de atención', 'Solo cuando estás disponible'],
                    ['Tiempo de respuesta', '30 min a varias horas'],
                    ['Capacidad', 'Máx. 20-30 chats/día'],
                    ['Leads perdidos', 'Muchos por respuesta tardía'],
                    ['Costo operativo', 'Alto (personal dedicado)'],
                  ].map(([label, val], i) => (
                    <li key={i} className="flex justify-between border-b border-white/5 pb-4">
                      <span className="text-slate-500 text-sm font-bold">{label}</span>
                      <span className="text-red-400 font-bold text-sm">{val}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* IA */}
              <div className="glass p-10 rounded-3xl border-green-500/30 bg-[#0d1f16]/60 shadow-[0_0_60px_rgba(37,211,102,0.1)] relative">
                <div className="absolute -top-4 right-8 bg-[#25d366] text-white text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-[0.2em]">⭐ Recomendado</div>
                <div className="flex items-center gap-3 mb-8">
                  <span className="text-2xl">🤖</span>
                  <h3 className="text-xl font-bold text-white">Con IA de RIFX</h3>
                </div>
                <ul className="space-y-5">
                  {[
                    ['Horario de atención', '24 horas, 7 días ✅'],
                    ['Tiempo de respuesta', 'Menos de 5 segundos ✅'],
                    ['Capacidad', 'Ilimitada simultánea ✅'],
                    ['Leads perdidos', 'Casi cero con seguimiento ✅'],
                    ['Costo operativo', 'Fijo y predecible ✅'],
                  ].map(([label, val], i) => (
                    <li key={i} className="flex justify-between border-b border-green-500/10 pb-4">
                      <span className="text-green-300/70 text-sm font-bold">{label}</span>
                      <span className="text-white font-bold text-sm">{val}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ── CASOS DE USO ── */}
          <section className="py-24 bg-[#080f24]/40">
            <div className="max-w-6xl mx-auto px-6">
              <div className="text-center mb-16">
                <span className="text-green-400 font-bold uppercase tracking-widest text-xs">IDEAL PARA</span>
                <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 font-space tracking-tight">
                  ¿Para qué tipo de negocio <span className="text-gradient-wa">funciona?</span>
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { icon: '🏥', name: 'Clínicas y Médicos', desc: 'Agendamiento de citas 24/7' },
                  { icon: '🏠', name: 'Inmobiliarias', desc: 'Calificación de compradores' },
                  { icon: '🛍️', name: 'Tiendas Online', desc: 'Atención y cierre de ventas' },
                  { icon: '💆', name: 'Salones y Spas', desc: 'Reservas automáticas' },
                  { icon: '🏋️', name: 'Gimnasios', desc: 'Captación de membresías' },
                  { icon: '🍕', name: 'Restaurantes', desc: 'Pedidos y reservaciones' },
                  { icon: '🎓', name: 'Academias', desc: 'Inscripciones y consultas' },
                  { icon: '🔧', name: 'Servicios técnicos', desc: 'Cotizaciones automáticas' },
                  { icon: '🚗', name: 'Concesionarias', desc: 'Pre-calificación de clientes' },
                ].map((item, i) => (
                  <div key={i} className="glass glass-hover p-6 rounded-2xl flex items-center gap-4 transition-all duration-300 group">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <p className="text-white font-bold text-sm">{item.name}</p>
                      <p className="text-slate-400 text-xs">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section className="py-24">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-12">
                <span className="text-green-400 font-bold uppercase tracking-widest text-xs">PREGUNTAS FRECUENTES</span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mt-2 font-space tracking-tight">¿Tienes Dudas?</h2>
              </div>
              <div className="space-y-4">
                {[
                  {
                    q: '¿Necesito saber de tecnología para usar esto?',
                    a: 'No. Nosotros nos encargamos de toda la configuración técnica. Tú solo nos das información sobre tu negocio y apruebas las respuestas. El día a día es tan simple como usar WhatsApp normalmente.'
                  },
                  {
                    q: '¿La IA suena robótica o natural?',
                    a: 'La entrenamos con el tono y estilo de comunicación de tu marca. Puede sonar formal, amigable o como prefieras. La mayoría de los clientes no saben que están hablando con un sistema automático.'
                  },
                  {
                    q: '¿Qué pasa si el cliente hace una pregunta que la IA no sabe?',
                    a: 'En ese caso, el sistema te notifica y transfiere la conversación a un agente humano automáticamente. Tú siempre tienes el control final cuando se necesita.'
                  },
                  {
                    q: '¿Cuánto tiempo tarda la implementación?',
                    a: 'Entre 3 y 7 días hábiles dependiendo de la complejidad de tu negocio. Casos simples pueden estar listos en 48 horas. Incluye configuración, pruebas y capacitación.'
                  },
                  {
                    q: '¿Puedo ver las conversaciones que tiene la IA?',
                    a: 'Sí, tienes acceso total a un panel donde puedes ver todas las conversaciones en tiempo real, revisar el historial y hacer ajustes en las respuestas cuando lo necesites.'
                  },
                ].map((faq, i) => (
                  <div key={i} className={`glass rounded-2xl overflow-hidden transition-all duration-300 border ${activeFaq === i ? 'border-green-500/40 bg-white/5' : 'border-white/5 hover:border-white/20'}`}>
                    <button
                      onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                      className="w-full px-8 py-6 flex items-center justify-between text-left outline-none group"
                    >
                      <span className={`font-bold text-base font-space transition-colors ${activeFaq === i ? 'text-green-400' : 'text-white group-hover:text-green-300'}`}>
                        {faq.q}
                      </span>
                      <span className={`material-symbols-outlined transition-transform duration-300 ml-4 flex-shrink-0 ${activeFaq === i ? 'rotate-180 text-green-400' : 'text-slate-500'}`}>
                        expand_more
                      </span>
                    </button>
                    <div className={`transition-all duration-400 ease-in-out overflow-hidden ${activeFaq === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="px-8 pb-6 text-slate-400 leading-relaxed text-sm border-t border-white/5 pt-4">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <TrainCTA title={<>¿Listo para Vender<br />las 24 Horas del Día?</>} subtitle="Configura tu asistente de IA hoy — sin conocimientos técnicos" />
        </main>
        <ContactChannels onlyModal={true} />
      </div>
    </>
  );
}
