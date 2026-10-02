'use client';

import React, { useState } from 'react';
import ContactChannels from '../../components/ContactChannels';
import TrainCTA from '../../components/TrainCTA';

export default function AgentesDeVozAI() {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [playingSample, setPlayingSample] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const voiceDemos = [
    {
      name: 'Voz Sofía (Atención & Citas)',
      role: 'Recepcionista y Agendadora Médica / Spa / Servicios',
      audio: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/650ff3be-a6b1-404a-874b-e85d43e5e40e.mp3',
      transcript: '«Hola, gracias por llamar a Clínica Dental San José. Mi nombre es Sofía. ¿Deseas agendar una cita o tienes alguna consulta sobre nuestros tratamientos?»'
    },
    {
      name: 'Voz Mateo (Cierre de Ventas)',
      role: 'Asesor Comercial Inmobiliario / Concesionarios',
      audio: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/67341770-5f25-455b-b9d6-527e025ec357.mp3',
      transcript: '«Hola Carlos, veo que solicitaste información sobre el proyecto residencial en la web. Te llamo rápido para contarte que solo quedan 2 unidades con precio de preventa. ¿Te gustaría coordinar una visita mañana?»'
    },
    {
      name: 'Voz Tuya Clonada (Marca Personal)',
      role: 'Tu propia voz replicada por IA con acento natural',
      audio: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e72e-07b9-4a00-9852-c6f379fb0a99.mp3',
      transcript: '«Hola, qué tal. Soy el asistente personal del Dr. Ramírez. Él me entrenó para responder dudas sobre sus programas de mentoría comercial. ¿Qué objetivo tienes para este trimestre?»'
    }
  ];

  const handlePlayAudio = (url: string) => {
    if (playingSample === url) {
      if (audioElement) {
        audioElement.pause();
      }
      setPlayingSample(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    const audio = new Audio(url);
    setAudioElement(audio);
    setPlayingSample(url);
    audio.play().catch(() => setPlayingSample(null));
    audio.onended = () => setPlayingSample(null);
  };

  const faqs = [
    {
      q: '¿La gente se da cuenta de que es una Inteligencia Artificial?',
      a: 'Prácticamente nadie lo nota. Utilizamos los modelos de voz más avanzados de ElevenLabs con entonación natural, pausas para respirar, calidez humana y una velocidad de respuesta de menos de 600 milisegundos. Incluso gestiona interrupciones: si el cliente habla, la IA se detiene a escuchar de inmediato.'
    },
    {
      q: '¿Puede responder llamadas entrantes y también hacer llamadas salientes?',
      a: 'Sí, ambas. Puede contestar llamadas de clientes que marcan a tu número de negocio 24/7, y también puede llamar automáticamente a leads en menos de 10 segundos desde que llenan un formulario en tu web, Facebook Ads o WhatsApp.'
    },
    {
      q: '¿Realmente puedo clonar mi propia voz?',
      a: 'Totalmente. Con solo grabarte leyendo un breve párrafo durante 30 a 60 segundos desde tu celular o computadora, nuestro sistema replica tu tono, timbre y acento para que tu agente hable exactamente como tú.'
    },
    {
      q: '¿Cómo se conecta con mis citas y mi sistema?',
      a: 'El agente de voz está conectado en tiempo real con Google Calendar y tu CRM. Puede consultar qué horarios tienes libres, ofrecer opciones y registrar la cita en tu calendario mientras habla con el cliente.'
    },
    {
      q: '¿Cuánto tiempo tarda la instalación y entrenamiento?',
      a: 'Configuramos tu número telefónico, redactamos el guion de ventas, entrenamos la base de conocimientos de tu empresa y calibramos la voz en un plazo de 3 a 5 días hábiles.'
    }
  ];

  return (
    <>
      <style jsx global>{`
        body { font-family: 'Montserrat', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .glass { background: rgba(24, 30, 54, 0.45); backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.08); }
        .glass-hover:hover { background: rgba(24, 30, 54, 0.7); border-color: rgba(96, 165, 250, 0.4); }
        .text-gradient-voice { background: linear-gradient(to right, #60a5fa, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .text-gradient-orange { background: linear-gradient(to right, #ffb692, #f27121); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        @keyframes pulse-ring { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.15); opacity: 0.3; } 100% { transform: scale(0.95); opacity: 0.8; } }
        .pulse-audio { animation: pulse-ring 2.5s ease-in-out infinite; }
      `}</style>

      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&display=swap" rel="stylesheet" />

      <div className="bg-[#070b1a] text-[#dce1ff] antialiased overflow-x-hidden min-h-screen">
        <main className="pt-20">

          {/* ── HERO SECTION ── */}
          <section className="relative min-h-[92vh] flex items-center px-6 py-20 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[120px]" />
              <div className="absolute bottom-1/4 left-1/5 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center z-10">
              {/* Left Column */}
              <div>
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold tracking-widest uppercase mb-8">
                  <span className="w-2 h-2 rounded-full bg-blue-400 mr-2 animate-pulse" />
                  ElevenLabs Conversational Telephony
                </div>

                <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] mb-6 text-white font-space">
                  Agentes de Voz IA que <span className="text-gradient-voice">atienden y venden</span> por teléfono.
                </h1>

                <p className="text-lg text-slate-300 leading-relaxed mb-10 max-w-xl">
                  Tu empresa ahora tiene un contestador y vendedor telefónico ultra-humano que atiende al instante,
                  responde preguntas complejas, agenda citas y contacta leads en segundos con <strong className="text-white">tu propia voz clonada</strong>.
                </p>

                <div className="flex flex-wrap gap-4 mb-10">
                  {[
                    { icon: '🎙️', text: 'Voz humana ultra-realista' },
                    { icon: '⚡', text: 'Respuesta en <600ms' },
                    { icon: '📅', text: 'Agenda citas en Calendly/Google' },
                    { icon: '📱', text: 'Llama automáticamente a leads' },
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-slate-300">
                      <span>{feat.icon}</span>
                      <span>{feat.text}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="#demos"
                    className="px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold text-base shadow-xl shadow-blue-500/25 transition-all text-center flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">play_circle</span>
                    Escuchar Demostraciones en Vivo
                  </a>
                  <a
                    href="#contacto"
                    className="px-8 py-4 rounded-2xl glass hover:bg-white/10 border border-white/10 text-white font-bold text-base transition-all text-center flex items-center justify-center gap-2"
                  >
                    Cotizar para mi Negocio
                  </a>
                </div>
              </div>

              {/* Right Column: Audio Call Simulator Mockup */}
              <div className="relative flex justify-center">
                <div className="w-full max-w-md glass rounded-3xl p-8 border border-white/10 shadow-2xl relative">
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Llamada en Vivo Activa</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">00:42</span>
                  </div>

                  <div className="flex flex-col items-center text-center my-6">
                    <div className="relative mb-6">
                      <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-xl pulse-audio">
                        <span className="material-symbols-outlined text-5xl">support_agent</span>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">Sofía — Asesora IA</h3>
                    <p className="text-xs text-slate-400">Atendiendo llamada entrante (+593 99...)</p>
                  </div>

                  {/* Onda de sonido animada */}
                  <div className="flex items-center justify-center gap-1.5 h-12 my-4">
                    {[40, 70, 30, 90, 60, 100, 45, 80, 50, 75, 35, 85].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-gradient-to-t from-blue-500 to-indigo-400 rounded-full transition-all duration-300"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>

                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5 text-xs text-slate-300 italic mb-6">
                    «Por supuesto, tengo disponible mañana a las 11:00 AM o a las 4:00 PM. ¿Cuál te resulta más cómodo para confirmar tu cita?»
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-slate-300">
                      <span className="material-symbols-outlined">mic</span>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
                      <span className="material-symbols-outlined">call_end</span>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-slate-300">
                      <span className="material-symbols-outlined">volume_up</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── ESTADÍSTICAS ── */}
          <section className="py-16 border-y border-white/5 bg-[#050814]/60">
            <div className="max-w-6xl mx-auto px-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                {[
                  { value: '< 600 ms', label: 'Latencia de Respuesta', icon: '⚡' },
                  { value: '100%', label: 'Llamadas Atendidas', icon: '📞' },
                  { value: '30 seg', label: 'Tiempo para Clonar tu Voz', icon: '🎙️' },
                  { value: '0 esperas', label: 'Clientes en Espera', icon: '🚀' },
                ].map((s, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <span className="text-3xl">{s.icon}</span>
                    <p className="text-3xl md:text-4xl font-extrabold text-white font-space">{s.value}</p>
                    <p className="text-slate-400 text-xs uppercase tracking-widest">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── AUDIO DEMOS SECTION ── */}
          <section id="demos" className="py-24 px-6 max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-blue-400 font-bold uppercase tracking-widest text-xs">MUESTRAS DE AUDIO</span>
              <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 mb-4 font-space">
                Escucha la calidad de <span className="text-gradient-voice">nuestras voces</span>
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                Sin robotizaciones ni acentos sintéticos. Entonación natural, pausas y modulación humana en español.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {voiceDemos.map((demo, idx) => {
                const isPlaying = playingSample === demo.audio;
                return (
                  <div key={idx} className="glass glass-hover p-8 rounded-3xl transition-all duration-300 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-[10px] font-bold uppercase">
                          Demo #{idx + 1}
                        </span>
                        <button
                          onClick={() => handlePlayAudio(demo.audio)}
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                            isPlaying
                              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                          }`}
                        >
                          <span className="material-symbols-outlined text-2xl">
                            {isPlaying ? 'pause' : 'play_arrow'}
                          </span>
                        </button>
                      </div>

                      <h3 className="text-white font-bold text-lg mb-1">{demo.name}</h3>
                      <p className="text-xs text-blue-300/80 mb-4">{demo.role}</p>
                      <p className="text-slate-400 text-xs leading-relaxed italic bg-black/20 p-3.5 rounded-2xl border border-white/5">
                        {demo.transcript}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{isPlaying ? 'Reproduciendo audio...' : 'Presiona play para escuchar'}</span>
                      <span className="material-symbols-outlined text-sm">{isPlaying ? 'graphic_eq' : 'volume_up'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── CÓMO FUNCIONA EL SISTEMA ── */}
          <section className="py-24 bg-[#050814]/70 border-y border-white/5">
            <div className="max-w-6xl mx-auto px-6">
              <div className="text-center mb-16">
                <span className="text-purple-400 font-bold uppercase tracking-widest text-xs">FLUJO AUTOMÁTICO</span>
                <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 font-space">
                  ¿Cómo funciona en tu negocio?
                </h2>
                <p className="text-slate-400 mt-2">Así es la experiencia de un cliente cuando te contacta.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    step: '01',
                    title: 'Entra o se dispara la llamada',
                    desc: 'El cliente marca a tu número de atención, o bien solicita una cotización en tu web/anuncios y la IA lo llama al teléfono en menos de 10 segundos.'
                  },
                  {
                    step: '02',
                    title: 'Conversación fluida y natural',
                    desc: 'La IA saluda con tu voz o la de un asesor profesional, comprende la intención, resuelve dudas sobre tus servicios y rebate objeciones frecuentes.'
                  },
                  {
                    step: '03',
                    title: 'Acción y registro en tu CRM',
                    desc: 'Agenda la cita en tu calendario, envía un WhatsApp de confirmación y registra el resumen completo de la llamada en tu panel comercial.'
                  }
                ].map((item, i) => (
                  <div key={i} className="glass p-8 rounded-3xl relative overflow-hidden group">
                    <span className="text-6xl font-black text-white/5 absolute -right-2 -top-2 select-none group-hover:text-blue-500/10 transition-colors">
                      {item.step}
                    </span>
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm mb-6">
                      {item.step}
                    </div>
                    <h3 className="text-white font-bold text-xl mb-3">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── PAQUETES Y PRECIOS ── */}
          <section className="py-24 px-6 max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-emerald-400 font-bold uppercase tracking-widest text-xs">PLANES DISPONIBLES</span>
              <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 font-space">
                Implementación e Inversión Mensual
              </h2>
              <p className="text-slate-400 mt-2 max-w-xl mx-auto">
                Elige el paquete que mejor se adapte al volumen de llamadas de tu empresa.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 items-stretch">
              {/* Plan Básico */}
              <div className="glass p-8 rounded-3xl flex flex-col justify-between border border-white/10">
                <div>
                  <h3 className="text-white font-bold text-xl mb-2">Recepción IA</h3>
                  <p className="text-xs text-slate-400 mb-6">Ideal para consultorios, clínicas y despachos con llamadas frecuentes.</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold text-white font-space">$49</span>
                    <span className="text-slate-400 text-xs">/ mes</span>
                  </div>
                  <ul className="space-y-3 text-xs text-slate-300 mb-8">
                    <li className="flex items-center gap-2">✓ <strong>150 minutos</strong> de llamadas incluidos</li>
                    <li className="flex items-center gap-2">✓ Número telefónico dedicado</li>
                    <li className="flex items-center gap-2">✓ Respuestas a preguntas y horarios</li>
                    <li className="flex items-center gap-2">✓ Transcripción en el panel CRM</li>
                    <li className="flex items-center gap-2">✓ Voces curadas ElevenLabs HD</li>
                  </ul>
                </div>
                <a
                  href="#contacto"
                  className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs text-center transition-all"
                >
                  Solicitar Recepción IA
                </a>
              </div>

              {/* Plan Pro (Destacado) */}
              <div className="glass p-8 rounded-3xl flex flex-col justify-between border-2 border-blue-500 relative shadow-2xl shadow-blue-500/20 bg-gradient-to-b from-blue-950/40 to-slate-900/60">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider">
                  Más Popular para Ventas
                </div>
                <div>
                  <h3 className="text-white font-bold text-xl mb-2">Ventas & Cierre Pro</h3>
                  <p className="text-xs text-slate-300 mb-6">Para negocios que buscan contactar leads de inmediato y agendar citas.</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold text-white font-space">$99</span>
                    <span className="text-slate-400 text-xs">/ mes</span>
                  </div>
                  <ul className="space-y-3 text-xs text-slate-200 mb-8">
                    <li className="flex items-center gap-2">✓ <strong>400 minutos</strong> de llamadas incluidos</li>
                    <li className="flex items-center gap-2">✓ <strong>Clonación de tu propia voz</strong> incluida</li>
                    <li className="flex items-center gap-2">✓ Llamada saliente automática a leads (&lt;10s)</li>
                    <li className="flex items-center gap-2">✓ Integración con Google Calendar & Calendly</li>
                    <li className="flex items-center gap-2">✓ Seguimiento y confirmación por WhatsApp</li>
                    <li className="flex items-center gap-2">✓ Soporte prioritario y calibración</li>
                  </ul>
                </div>
                <a
                  href="#contacto"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs text-center shadow-lg transition-all"
                >
                  Contratar Plan Pro
                </a>
              </div>

              {/* Plan Enterprise */}
              <div className="glass p-8 rounded-3xl flex flex-col justify-between border border-white/10">
                <div>
                  <h3 className="text-white font-bold text-xl mb-2">High Volume Call Center</h3>
                  <p className="text-xs text-slate-400 mb-6">Para empresas con alto volumen de campañas y ventas a gran escala.</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold text-white font-space">$199</span>
                    <span className="text-slate-400 text-xs">/ mes</span>
                  </div>
                  <ul className="space-y-3 text-xs text-slate-300 mb-8">
                    <li className="flex items-center gap-2">✓ <strong>1,000 minutos</strong> de llamadas incluidos</li>
                    <li className="flex items-center gap-2">✓ Múltiples números telefónicos</li>
                    <li className="flex items-center gap-2">✓ Múltiples voces clonadas por asesor</li>
                    <li className="flex items-center gap-2">✓ Conexión con webhook personalizado / API</li>
                    <li className="flex items-center gap-2">✓ Entrenamiento a medida de base de conocimiento</li>
                  </ul>
                </div>
                <a
                  href="#contacto"
                  className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs text-center transition-all"
                >
                  Hablar con Asesor
                </a>
              </div>
            </div>
          </section>

          {/* ── PREGUNTAS FRECUENTES (FAQ) ── */}
          <section className="py-24 px-6 max-w-4xl mx-auto border-t border-white/5">
            <div className="text-center mb-16">
              <span className="text-blue-400 font-bold uppercase tracking-widest text-xs">RESOLVEMOS TUS DUDAS</span>
              <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 font-space">
                Preguntas Frecuentes
              </h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, idx) => {
                const isOpen = activeFaq === idx;
                return (
                  <div
                    key={idx}
                    className="glass rounded-2xl p-6 border border-white/10 transition-all cursor-pointer"
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white">{faq.q}</h3>
                      <span className="material-symbols-outlined text-slate-400 transition-transform duration-300">
                        {isOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                    {isOpen && (
                      <p className="mt-4 text-sm text-slate-300 leading-relaxed border-t border-white/10 pt-4">
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── CTA CONTACTO ── */}
          <div id="contacto">
            <TrainCTA />
            <ContactChannels />
          </div>

        </main>
      </div>
    </>
  );
}
