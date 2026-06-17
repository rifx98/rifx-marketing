"use client";

import React from 'react';
import { motion } from 'framer-motion';

const cardData = [
  { title: "Flujos de Trabajo", desc: "Automatiza la prospección sin mover un dedo. Todo estructurado en secuencias exactas." },
  { title: "Base de Conocimiento", desc: "La IA analiza tus respuestas previas y clona tu tono para futuras conversaciones." },
  { title: "Arquitectura Segura", desc: "Datos encriptados y permisos por niveles. El control del abismo es tuyo." },
  { title: "Métricas del Vacío", desc: "Visualiza el rendimiento de tus campañas en un dashboard limpio, sin métricas vanidosas." }
];

export default function CloneCardsGrid() {
  return (
    <section className="w-full bg-[var(--color-void)] py-32 border-t border-[var(--color-bone)]/10">
      <div className="container mx-auto px-6 max-w-[var(--page-max-width)]">
        
        {/* Section Header */}
        <div className="mb-20 max-w-2xl">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-[var(--color-bone)] font-normal mb-6"
            style={{ 
              fontSize: 'var(--text-heading-lg)', 
              lineHeight: 'var(--leading-heading-lg)', 
              letterSpacing: 'var(--tracking-heading-lg)' 
            }}
          >
            Sistemas diseñados para la <span className="text-[var(--color-plum-voltage)]">velocidad</span>.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            className="text-[var(--color-ash)] font-normal"
            style={{ 
              fontSize: 'var(--text-subheading)', 
              lineHeight: 'var(--leading-subheading)', 
              letterSpacing: 'var(--tracking-subheading)' 
            }}
          >
            Sin sombras, sin gradientes innecesarios. Solo la información crítica presentada de la forma más eficiente posible.
          </motion.p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[var(--element-gap)]">
          {cardData.map((card, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: idx * 0.1, ease: "easeOut" }}
              className="group relative p-[var(--card-padding)] bg-transparent border border-[var(--color-bone)]/10 hover:border-[var(--color-bone)]/20 transition-colors duration-500 flex flex-col"
              style={{ borderRadius: 'var(--radius-3xl)' }}
            >
              <div className="w-10 h-10 mb-8 rounded-full border border-[var(--color-bone)]/10 flex items-center justify-center text-[var(--color-plum-voltage)] transition-colors duration-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              
              <h3 
                className="text-[var(--color-bone)] font-semibold mb-3"
                style={{ fontSize: 'var(--text-base-2)', lineHeight: 'var(--leading-base-2)' }}
              >{card.title}</h3>
              <p 
                className="text-[var(--color-smoke)] font-normal"
                style={{ fontSize: 'var(--text-body-sm)', lineHeight: 'var(--leading-body-sm)', letterSpacing: 'var(--tracking-body-sm)' }}
              >{card.desc}</p>
              
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
