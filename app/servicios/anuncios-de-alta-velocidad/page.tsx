'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import ContactChannels from '../../components/ContactChannels';
import TrainCTA from '../../components/TrainCTA';

export default function AnunciosAltaVelocidad() {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  return (
    <>
      <style jsx global>{`
        body { font-family: 'Montserrat', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .glass { background: rgba(24, 30, 54, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .glass-hover:hover { background: rgba(24, 30, 54, 0.6); border-color: rgba(242, 113, 33, 0.3); }
        .text-gradient-ads { background: linear-gradient(to right, #ffb692, #f27121); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        @keyframes float-slow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        .animate-float { animation: float-slow 4s ease-in-out infinite; }
        @keyframes count-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .stat-card { animation: count-up 0.6s ease-out forwards; }
      `}</style>

      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&display=swap" rel="stylesheet"/>

      <div className="bg-[#0b1229] text-[#dce1ff] antialiased overflow-x-hidden min-h-screen">
        <main className="pt-20">

          {/* ── HERO ── */}
          <section className="relative min-h-[90vh] flex items-center px-6 py-20 overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-[#f27121]/10 rounded-full blur-[120px]" />
              <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px]" />
            </div>

            <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center z-10">
              {/* Left: Copy */}
              <div>
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/30 text-[#ffb692] text-xs font-bold tracking-widest uppercase mb-8">
                  <span className="w-2 h-2 rounded-full bg-[#f27121] mr-2 animate-pulse" />
                  Publicidad Digital de Alto Rendimiento
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl leading-[1.05] mb-6 text-white font-title">
                  Anuncios que <br />
                  <span className="text-gradient-ads">Generan Ventas</span>,<br />
                  no solo clics.
                </h1>
                <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-lg">
                  Creamos y gestionamos campañas pagadas en <strong className="text-white">Meta, Google, TikTok y más</strong> con una estrategia basada en datos reales. Cada peso invertido trabaja para traerte clientes listos para comprar.
                </p>

                {/* Trust signals */}
                <div className="flex flex-wrap gap-4 mb-10">
                  {[
                    { icon: '✅', text: 'Sin contratos largos' },
                    { icon: '📊', text: 'Reportes semanales' },
                    { icon: '🎯', text: 'Resultados desde el día 1' },
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
                    className="bg-[#f27121] text-white px-10 py-5 rounded-xl font-bold text-base hover:shadow-[0_0_40px_rgba(242,113,33,0.4)] transition-all duration-300 uppercase tracking-widest"
                  >
                    Quiero Más Clientes 🚀
                  </button>
                  <a
                    href="#como-funciona"
                    className="bg-white/5 border border-white/10 px-10 py-5 rounded-xl font-bold text-base backdrop-blur-md hover:bg-white/10 transition-all uppercase tracking-widest text-white"
                  >
                    Ver Cómo Funciona
                  </a>
                </div>
              </div>

              {/* Right: Metrics card */}
              <div className="relative animate-float">
                <div className="absolute -inset-4 bg-gradient-to-tr from-[#f27121]/20 to-blue-500/10 rounded-[3rem] blur-[40px]" />
                <div className="relative glass rounded-[2.5rem] p-8 border border-white/10">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Panel de Resultados</p>
                      <p className="text-white font-bold">Campaña Activa — Mayo 2025</p>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-400 text-xs font-bold">Live</span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                      { label: 'Leads Generados', value: '1,248', delta: '+34%', color: 'text-emerald-400' },
                      { label: 'Costo por Lead', value: '$0.12', delta: '-62%', color: 'text-emerald-400' },
                      { label: 'ROAS', value: '8.4x', delta: '+210%', color: 'text-emerald-400' },
                      { label: 'Conversiones', value: '312', delta: '+89%', color: 'text-emerald-400' },
                    ].map((s, i) => (
                      <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">{s.label}</p>
                        <p className="text-white text-2xl font-black">{s.value}</p>
                        <p className={`text-xs font-bold ${s.color}`}>{s.delta} vs. antes</p>
                      </div>
                    ))}
                  </div>

                  {/* Platforms */}
                  <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                    <p className="text-slate-500 text-xs uppercase tracking-widest">Plataformas:</p>
                    {['Meta', 'Google', 'TikTok'].map((p, i) => (
                      <span key={i} className="bg-white/10 text-white text-xs font-bold px-3 py-1 rounded-full border border-white/10">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── PLATAFORMAS ── */}
          <section className="py-16 border-y border-white/5 bg-[#080f24]/50">
            <div className="max-w-6xl mx-auto px-6">
              <p className="text-center text-slate-500 text-xs uppercase tracking-[0.4em] font-bold mb-10">Gestionamos campañas en todas las plataformas líderes</p>
              <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12">
                {[
                  { name: 'Meta Ads', icon: '📘', sub: 'Facebook + Instagram' },
                  { name: 'Google Ads', icon: '🔍', sub: 'Search + Display' },
                  { name: 'TikTok Ads', icon: '🎵', sub: 'Video + Performance' },
                  { name: 'YouTube Ads', icon: '▶️', sub: 'Pre-Roll + Discovery' },
                  { name: 'LinkedIn Ads', icon: '💼', sub: 'B2B + Profesionales' },
                ].map((p, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 group cursor-default">
                    <div className="text-3xl group-hover:scale-110 transition-transform duration-300">{p.icon}</div>
                    <p className="text-white font-bold text-sm">{p.name}</p>
                    <p className="text-slate-500 text-[10px] uppercase tracking-widest">{p.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── CÓMO FUNCIONA ── */}
          <section id="como-funciona" className="py-24 px-6 max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-[#f27121] font-bold uppercase tracking-widest text-xs">NUESTRO PROCESO</span>
              <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 mb-4 font-space tracking-tight">
                Así Llevamos tu Negocio <span className="text-gradient-ads">al Siguiente Nivel</span>
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto">Un proceso claro, transparente y orientado 100% a resultados medibles.</p>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: '01', icon: '🔎', title: 'Auditoría Gratuita', desc: 'Analizamos tu negocio, competencia y mercado para identificar oportunidades reales de crecimiento.' },
                { step: '02', icon: '🎯', title: 'Estrategia a Medida', desc: 'Diseñamos una hoja de ruta con presupuesto, plataformas, audiencias y creatividades personalizadas.' },
                { step: '03', icon: '🚀', title: 'Lanzamiento', desc: 'Ponemos en marcha tus campañas con creatividades probadas y segmentación quirúrgica desde el día 1.' },
                { step: '04', icon: '📈', title: 'Optimización', desc: 'Monitoreamos, ajustamos y escalamos en tiempo real para maximizar tu retorno sobre inversión.' },
              ].map((item, i) => (
                <div key={i} className="glass glass-hover p-8 rounded-3xl transition-all duration-500 flex flex-col group relative overflow-hidden">
                  <div className="absolute top-4 right-4 text-5xl font-black text-white/5 font-space">{item.step}</div>
                  <div className="text-4xl mb-5">{item.icon}</div>
                  <h3 className="text-white font-bold text-lg mb-3">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── RIFX vs COMPETENCIA ── */}
          <section className="py-24 px-6 max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-[#f27121] font-bold uppercase tracking-widest text-xs">DIFERENCIADORES</span>
              <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 font-space tracking-tight">
                RIFX vs. <span className="text-slate-500">Agencias Comunes</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-stretch">
              {/* Competencia */}
              <div className="glass p-10 rounded-3xl border-white/5 opacity-70">
                <div className="flex items-center gap-3 mb-8">
                  <span className="text-2xl">😐</span>
                  <h3 className="text-xl font-bold text-slate-400 font-space">Agencias Tradicionales</h3>
                </div>
                <ul className="space-y-5">
                  {[
                    ['Costo por Lead', '$2.00 – $5.00'],
                    ['Reportes', 'Mensual (si acaso)'],
                    ['Segmentación', 'Genérica y amplia'],
                    ['Comunicación', 'Lenta y burocrática'],
                    ['Creatividades', 'Plantillas recicladas'],
                  ].map(([label, val], i) => (
                    <li key={i} className="flex justify-between border-b border-white/5 pb-4">
                      <span className="text-slate-500 text-sm font-bold">{label}</span>
                      <span className="text-slate-300 font-bold text-sm">{val}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* RIFX */}
              <div className="glass p-10 rounded-3xl border-[#f27121]/40 bg-[#181e36]/60 shadow-[0_0_60px_rgba(242,113,33,0.15)] relative">
                <div className="absolute -top-4 right-8 bg-[#f27121] text-white text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-[0.2em]">⭐ Recomendado</div>
                <div className="flex items-center gap-3 mb-8">
                  <span className="text-2xl">🚀</span>
                  <h3 className="text-xl font-bold text-white font-space">RIFX Marketing</h3>
                </div>
                <ul className="space-y-5">
                  {[
                    ['Costo por Lead', '$0.08 – $0.30 ✅'],
                    ['Reportes', 'Semanal + Dashboard Live'],
                    ['Segmentación', 'Hiper-precisa por IA'],
                    ['Comunicación', 'Respuesta en menos de 2h'],
                    ['Creatividades', 'Diseño exclusivo por marca'],
                  ].map(([label, val], i) => (
                    <li key={i} className="flex justify-between border-b border-[#f27121]/20 pb-4">
                      <span className="text-[#ffb692] text-sm font-bold">{label}</span>
                      <span className="text-white font-bold text-sm">{val}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ── RESULTADOS ── */}
          <section className="py-24 bg-[#080f24]/40">
            <div className="max-w-6xl mx-auto px-6">
              <div className="text-center mb-16">
                <span className="text-[#f27121] font-bold uppercase tracking-widest text-xs">RESULTADOS REALES</span>
                <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 font-space tracking-tight">
                  Números que <span className="text-gradient-ads">Hablan por Sí Solos</span>
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { value: '+340%', label: 'Aumento promedio de ROAS', icon: '📈' },
                  { value: '-62%', label: 'Reducción costo por lead', icon: '💰' },
                  { value: '48h', label: 'Tiempo de lanzamiento', icon: '⚡' },
                  { value: '100%', label: 'Clientes con reportes semanales', icon: '📊' },
                ].map((s, i) => (
                  <div key={i} className="glass p-8 rounded-3xl text-center group hover:border-[#f27121]/30 transition-all duration-300">
                    <div className="text-4xl mb-4">{s.icon}</div>
                    <p className="text-4xl font-black text-[#f27121] mb-2">{s.value}</p>
                    <p className="text-slate-400 text-xs uppercase tracking-widest font-bold leading-relaxed">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── BENEFICIOS ── */}
          <section className="py-24 px-6 max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-[#f27121] font-bold uppercase tracking-widest text-xs">BENEFICIOS</span>
              <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 font-space tracking-tight">
                Todo lo que Incluye <span className="text-gradient-ads">tu Campaña</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: '🎨', title: 'Creatividades Profesionales', desc: 'Diseñamos los artes, videos y copies de tus anuncios. Tú solo apruebas y nosotros ejecutamos.' },
                { icon: '🎯', title: 'Segmentación Avanzada', desc: 'Llegamos a tu cliente ideal por intereses, comportamientos, ubicación, edad y más. Sin desperdiciar presupuesto.' },
                { icon: '🔄', title: 'Pruebas A/B Continuas', desc: 'Probamos múltiples variaciones de anuncios para encontrar la combinación que más convierte para tu negocio.' },
                { icon: '📱', title: 'Remarketing Inteligente', desc: 'Volvemos a impactar a quienes visitaron tu web o interactuaron con tus redes. Cerramos ventas que quedaron abiertas.' },
                { icon: '📋', title: 'Dashboard en Tiempo Real', desc: 'Accede a tus métricas cuando quieras: impresiones, clics, conversiones y costo por resultado actualizado.' },
                { icon: '🤝', title: 'Gestor Dedicado', desc: 'Tendrás un experto asignado a tu cuenta disponible para consultas, ajustes y reportes durante toda la campaña.' },
              ].map((item, i) => (
                <div key={i} className="glass glass-hover p-8 rounded-3xl transition-all duration-500 group flex flex-col">
                  <div className="text-4xl mb-5">{item.icon}</div>
                  <h3 className="text-white font-bold text-lg mb-3">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── FAQ ── */}
          <section className="py-24 bg-[#080f24]/30">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-12">
                <span className="text-[#f27121] font-bold uppercase tracking-widest text-xs">PREGUNTAS FRECUENTES</span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mt-2 font-space tracking-tight">¿Tienes Dudas?</h2>
                <p className="text-slate-400 mt-3">Todo lo que necesitas saber antes de empezar.</p>
              </div>
              <div className="space-y-4">
                {[
                  {
                    q: '¿Cuánto presupuesto necesito para empezar?',
                    a: 'Puedes iniciar desde $200 USD/mes en pauta. Te recomendamos un presupuesto mínimo que permita obtener datos estadísticos confiables en las primeras semanas. Nosotros te asesoramos según tu industria y objetivos.'
                  },
                  {
                    q: '¿En cuánto tiempo veo resultados?',
                    a: 'En Meta Ads y TikTok puedes ver los primeros leads en 24–48 horas de lanzado. En Google Search normalmente hay resultados en la primera semana. El rendimiento óptimo se alcanza entre la semana 2 y 4 al completar la fase de aprendizaje del algoritmo.'
                  },
                  {
                    q: '¿Qué plataformas manejan?',
                    a: 'Gestionamos campañas en Meta Ads (Facebook + Instagram), Google Ads (Search, Display, Shopping, YouTube), TikTok Ads y LinkedIn Ads. Te recomendamos la mejor combinación según tu tipo de negocio y tu cliente ideal.'
                  },
                  {
                    q: '¿Cómo miden si la campaña funciona?',
                    a: 'Instalamos píxeles de seguimiento y APIs de conversión para rastrear cada acción importante: formularios, llamadas, compras y mensajes. Recibes reportes semanales con métricas claras: leads, costo por resultado, ROAS y alcance.'
                  },
                  {
                    q: '¿Necesito tener un sitio web?',
                    a: 'Idealmente sí, pero no siempre. Dependiendo de tu objetivo, podemos redirigir campañas a tu WhatsApp, Instagram o una landing page sencilla que nosotros mismos podemos construir.'
                  },
                ].map((faq, i) => (
                  <div key={i} className={`glass rounded-2xl overflow-hidden transition-all duration-300 border ${activeFaq === i ? 'border-[#f27121]/40 bg-white/5' : 'border-white/5 hover:border-white/20'}`}>
                    <button
                      onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                      className="w-full px-8 py-6 flex items-center justify-between text-left outline-none group"
                    >
                      <span className={`font-bold text-base font-space transition-colors ${activeFaq === i ? 'text-[#f27121]' : 'text-white group-hover:text-[#ffb692]'}`}>
                        {faq.q}
                      </span>
                      <span className={`material-symbols-outlined transition-transform duration-300 ml-4 flex-shrink-0 ${activeFaq === i ? 'rotate-180 text-[#f27121]' : 'text-slate-500'}`}>
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

          <TrainCTA title={<>¿Listo para Conseguir<br />Más Clientes?</>} subtitle="Habla con un especialista hoy — auditoría gratuita de tu cuenta" />
        </main>
        <ContactChannels onlyModal={true} />
      </div>
    </>
  );
}
