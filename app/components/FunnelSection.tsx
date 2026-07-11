"use client";

import React from 'react';
import { motion } from 'framer-motion';

const phases = [
  {
    title: "Anuncios de Alta Velocidad",
    desc: "Campañas publicitarias optimizadas con inteligencia artificial para captar leads calificados en Meta y Google, escalando tus ventas de forma inmediata y constante.",
    emoji: "🚀",
    tags: ["Meta Ads", "Google Ads", "IA Predictiva"],
    align: "left",
  },
  {
    title: "WhatsApp con IA",
    desc: "Automatización e Inteligencia Artificial en tus chats. Agentes IA conversacionales entrenados para responder preguntas, enviar catálogos y concretar ventas 24/7.",
    emoji: "💬",
    tags: ["Chatbot IA", "Automatización", "Ventas 24/7"],
    align: "right",
  },
  {
    title: "Diseño UX/UI",
    desc: "Páginas web inmersivas y Landing Pages de alta conversión que guían al usuario de manera intuitiva y visualmente impactante, maximizando la retención y la conversión.",
    emoji: "🎨",
    tags: ["Landing Pages", "UX/UI", "Alta Conversión"],
    align: "left",
  },
  {
    title: "E-commerce Interestelar",
    desc: "Pasarelas de pago integradas, logística automatizada y optimización de checkout estelar. Tu tienda en línea construida para vender a escala mundial sin fricción.",
    emoji: "🛒",
    tags: ["E-commerce", "Pagos Online", "Escala Global"],
    align: "right",
  },
] as const;

export default function FunnelSection() {
  return (
    <section className="bg-transparent relative py-16 lg:py-24" id="funnel-section">
      <div className="container mx-auto px-6 max-w-5xl relative z-10 w-full">

        {/* Header */}
        <div className="text-center mb-16 lg:mb-24">
          <motion.span
            className="text-rocket-orange font-mono text-[10px] md:text-xs uppercase tracking-[0.3em] block mb-3"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Embudo de Ventas RIFX
          </motion.span>
          <motion.h2
            className="text-white text-3xl md:text-5xl lg:text-6xl font-space-grotesk font-black leading-tight uppercase drop-shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            SISTEMA DE<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rocket-orange to-yellow-400">CRECIMIENTO</span>
          </motion.h2>
          <motion.p
            className="text-gray-400 mt-4 text-sm md:text-base max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Un proceso transparente y orientado a resultados. Cero sorpresas, máximo valor en cada etapa.
          </motion.p>
        </div>

        {/* Timeline wrapper */}
        <div className="relative">

          {/* Línea vertical mobile */}
          <div className="lg:hidden absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-rocket-orange/60 via-white/10 to-transparent pointer-events-none" />
          {/* Línea vertical desktop — centro del gap 45/10/45 */}
          <div className="hidden lg:block absolute left-[50%] top-0 bottom-0 w-px bg-gradient-to-b from-rocket-orange/60 via-white/10 to-transparent pointer-events-none" />

          <div className="flex flex-col gap-12 lg:gap-24">
            {phases.map((s, idx) => (
              <motion.div
                key={idx}
                className={`relative flex items-center ${
                  s.align === 'right' ? 'lg:flex-row-reverse' : 'lg:flex-row'
                }`}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
              >
                {/* Dot — mobile: sobre la línea izquierda | desktop: centro del gap */}
                <div className="absolute z-20
                  left-6 -translate-x-1/2 top-1/2 -translate-y-1/2
                  lg:left-[50%] lg:-translate-x-1/2 lg:top-1/2 lg:-translate-y-1/2">
                  <div className="w-5 h-5 rounded-full bg-rocket-orange shadow-[0_0_20px_rgba(242,113,33,0.8)] flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  </div>
                </div>

                {/* Emoji — solo desktop, 45% del ancho */}
                <div className={`hidden lg:flex w-[45%] items-center ${
                  s.align === 'left' ? 'justify-end' : 'justify-start'
                }`}>
                  <motion.div
                    className="text-8xl xl:text-[8rem] select-none filter drop-shadow-[0_0_30px_rgba(242,113,33,0.4)]"
                    whileInView={{ scale: [0.7, 1.05, 1] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  >
                    {s.emoji}
                  </motion.div>
                </div>

                {/* Card — 45% desktop (con 10% de gap al centro), full mobile */}
                <div className={`w-full pl-14 lg:pl-0 lg:w-[45%] ${
                  s.align === 'left' ? 'lg:ml-[10%]' : 'lg:mr-[10%]'
                }`}>
                  {/* Emoji mobile */}
                  <div className="lg:hidden text-3xl mb-3">{s.emoji}</div>

                  <div className="bg-[#0d1330]/70 backdrop-blur-sm border border-white/8 rounded-2xl p-5 md:p-7 hover:border-rocket-orange/40 transition-all duration-300 group">
                    <h3 className="text-white text-xl md:text-2xl lg:text-3xl font-space-grotesk font-black mb-3 group-hover:text-rocket-orange transition-colors duration-300 leading-tight">
                      {s.title}
                    </h3>
                    <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
                      {s.desc}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {s.tags.map((tag, ti) => (
                        <span
                          key={ti}
                          className="text-[9px] md:text-[10px] text-gray-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full tracking-wide"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
