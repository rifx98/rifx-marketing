"use client";

import React from 'react';

const phases = [
  { phase: "Fase 1: Atracción de Leads", title: "Anuncios de Alta Velocidad", desc: "Campañas publicitarias optimizadas con inteligencia artificial para captar leads calificados en Meta y Google, escalando tus ventas de forma inmediata y constante.", emoji: "🚀", align: "left" },
  { phase: "Fase 2: Interacción Inteligente", title: "WhatsApp con IA", desc: "Automatización e Inteligencia Artificial en tus chats. Agentes IA conversacionales entrenados para responder preguntas, enviar catálogos y concretar ventas 24/7.", emoji: "💬", align: "right" },
  { phase: "Fase 3: Conversión y Estructura", title: "Diseño UX/UI", desc: "Páginas web inmersivas y Landing Pages de alta conversión que guían al usuario de manera intuitiva y visualmente impactante, maximizando la retención y la conversión.", emoji: "🎨", align: "left" },
  { phase: "Fase 4: Conversión y Escalamiento", title: "E-commerce Interestelar", desc: "Pasarelas de pago integradas, logística automatizada y optimización de checkout estelar. Tu tienda en línea construida para vender a escala mundial sin fricción.", emoji: "🛒", align: "right" }
];

export default function FunnelSection() {
  return (
    <section className="bg-transparent relative py-16 lg:py-24" id="funnel-section">
      <div className="container mx-auto px-6 max-w-6xl relative z-10 w-full">
        <div className="text-center mb-16 lg:mb-24">
          <span className="text-rocket-orange font-mono text-[10px] md:text-xs uppercase tracking-[0.3em] block mb-2">
            Embudo de Ventas RIFX
          </span>
          <h2 className="text-white text-3xl md:text-5xl lg:text-6xl font-space-grotesk font-black leading-tight uppercase drop-shadow-lg">
            SISTEMA DE<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rocket-orange to-yellow-400">CRECIMIENTO</span>
          </h2>
        </div>

        {/* Timeline estático con scroll natural */}
        <div className="flex flex-col gap-20 md:gap-32 relative w-full mx-auto mt-10">
          
          {phases.map((s, idx) => (
            <div 
              key={idx}
              className={`w-full flex flex-col md:flex-row items-center justify-center gap-8 lg:gap-24 ${s.align === 'right' ? 'md:flex-row-reverse' : ''}`}
            >
              {/* Contenido de Texto */}
              <div className={`w-full md:w-1/2 flex flex-col ${s.align === 'left' ? 'md:items-end md:text-right' : 'md:items-start md:text-left'} text-center group`}>
                <span className="text-rocket-orange font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 block">
                  {s.phase}
                </span>
                <h3 className="text-white text-3xl md:text-4xl lg:text-5xl font-space-grotesk font-black mb-4 drop-shadow-md group-hover:text-rocket-orange transition-colors">
                  {s.title}
                </h3>
                <p className="text-gray-300 text-base md:text-lg font-light leading-relaxed max-w-md mx-auto md:mx-0">
                  {s.desc}
                </p>
              </div>
              
              {/* Emoji Gigante */}
              <div className={`w-full md:w-1/2 flex justify-center ${s.align === 'left' ? 'md:justify-start' : 'md:justify-end'}`}>
                <div className="text-8xl md:text-9xl lg:text-[11rem] filter drop-shadow-[0_0_40px_rgba(242,113,33,0.4)] hover:scale-110 transition-transform duration-500 cursor-default">
                  {s.emoji}
                </div>
              </div>
            </div>
          ))}

        </div>
      </div>
    </section>
  );
}
