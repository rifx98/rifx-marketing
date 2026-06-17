"use client";

import React from 'react';
import { motion } from 'framer-motion';

export default function CloneHero() {
  return (
    <section className="relative w-full min-h-screen bg-[var(--color-void)] flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden">
      
      {/* Particle Constellation Visual (Simulated) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        {/* Simulating the Dala constellation with scattered shapes drawn from the palette */}
        <div className="absolute top-1/3 left-1/4 w-1.5 h-1.5 bg-[var(--color-amber-spark)] rotate-45 opacity-60"></div>
        <div className="absolute top-1/2 right-1/3 w-2 h-2 rounded-full bg-[var(--color-lichen)] opacity-80"></div>
        <div className="absolute bottom-1/3 left-1/2 w-1 h-1 bg-[var(--color-bone)] opacity-40"></div>
        <div className="absolute top-1/4 right-1/4 w-1.5 h-1.5 bg-[var(--color-plum-voltage)] opacity-70"></div>
        <div className="absolute bottom-1/4 right-1/5 w-2 h-2 border border-[var(--color-plum-voltage)] opacity-50"></div>
        <div className="absolute top-1/2 left-1/5 w-1 h-1 rounded-full bg-[var(--color-ash)] opacity-30"></div>
      </div>

      {/* 50/50 Layout Simulation (Centered for this clone, but constrained to max measure) */}
      <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center">
        
        {/* Eyebrow Kicker */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="text-[var(--color-bone)] uppercase font-semibold mb-8"
          style={{ fontSize: 'var(--text-caption)', letterSpacing: 'var(--tracking-caption)' }}
        >
          STOP MANAGING KNOWLEDGE. START USING IT.
        </motion.div>

        {/* Display Headline - Etched in light */}
        <motion.h1 
          initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="text-[var(--color-bone)] font-extralight max-w-[1200px] mx-auto mb-10 w-full"
          style={{ 
            fontSize: 'calc(var(--text-hero) * 0.5)', /* Responsive fallback */
            lineHeight: 'var(--leading-hero)', 
            letterSpacing: 'var(--tracking-hero)'
          }}
        >
          <span className="md:hidden">Tu sistema tiene la respuesta.</span>
          <span className="hidden md:inline" style={{ fontSize: 'var(--text-hero)' }}>
            Tu sistema tiene <br /> la respuesta.
          </span>
        </motion.h1>

        {/* Body Paragraph */}
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
          className="text-[var(--color-ash)] font-normal max-w-[60ch] mx-auto mb-12"
          style={{ 
            fontSize: 'var(--text-subheading)', 
            lineHeight: 'var(--leading-subheading)', 
            letterSpacing: 'var(--tracking-subheading)' 
          }}
        >
          Dala is a knowledge-management product rendered as a dark cosmic field. Solo pregúntale. Una plataforma de escalamiento impulsada por IA que extrae el valor real de tus campañas.
        </motion.p>

      </div>
    </section>
  );
}
