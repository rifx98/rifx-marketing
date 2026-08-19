"use client";

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const features = [
  {
    title: "El conocimiento unificado.",
    desc: "Todas tus campañas, métricas y chats convergen en un solo punto oscuro y central. Sin distracciones."
  },
  {
    title: "Respuestas instantáneas.",
    desc: "El sistema no duerme. Los leads son capturados, etiquetados y procesados en tiempo real contra el abismo digital."
  },
  {
    title: "Escala infinita.",
    desc: "Añade miles de contactos sin perder el rastro. La estructura fractal de la base de datos se adapta a ti."
  }
];

export default function CloneScrollShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <section ref={containerRef} className="relative w-full h-[400vh] bg-[var(--color-void)]">
      {/* Sticky Container */}
      <div className="sticky top-0 h-screen w-full flex items-center overflow-hidden">
        
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-[var(--section-gap)] items-center">
          
          {/* Left: Sticky Text Blocks that fade in/out based on scroll */}
          <div className="relative h-[400px] flex flex-col justify-center">
            {features.map((feature, i) => {
              const start = i * 0.33;
              const peak = start + 0.16;
              const end = start + 0.33;

              // eslint-disable-next-line react-hooks/rules-of-hooks
              const opacity = useTransform(
                scrollYProgress,
                [start, peak, end],
                [0.2, 1, 0.2]
              );

              // eslint-disable-next-line react-hooks/rules-of-hooks
              const y = useTransform(
                scrollYProgress,
                [start, peak, end],
                [40, 0, -40]
              );

              return (
                <motion.div
                  key={i}
                  style={{ opacity, y }}
                  className="absolute inset-0 flex flex-col justify-center"
                >
                  <h3 
                    className="text-[var(--color-bone)] font-normal mb-6"
                    style={{ 
                      fontSize: 'var(--text-heading-lg)', 
                      lineHeight: 'var(--leading-heading-lg)', 
                      letterSpacing: 'var(--tracking-heading-lg)' 
                    }}
                  >
                    {feature.title}
                  </h3>
                  <p 
                    className="text-[var(--color-ash)] font-normal max-w-md"
                    style={{ 
                      fontSize: 'var(--text-subheading)', 
                      lineHeight: 'var(--leading-subheading)', 
                      letterSpacing: 'var(--tracking-subheading)' 
                    }}
                  >
                    {feature.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Right: Mockup Graphic (Centered Outlined Icon Mark) */}
          <div className="relative h-[500px] w-full flex items-center justify-center">
            { }
            <motion.div 
              style={{
                scale: useTransform(scrollYProgress, [0, 1], [0.95, 1.05]),
                y: useTransform(scrollYProgress, [0, 1], [50, -50])
              }}
              className="w-full max-w-md flex items-center justify-center relative"
            >
              {/* Outlined Icon Mark (Lichen) */}
              <div className="w-[120px] h-[120px] rounded-full border-[1.5px] border-[var(--color-lichen)] flex items-center justify-center">
                <div className="w-[60px] h-[60px] rotate-45 border-[1.5px] border-[var(--color-lichen)]"></div>
              </div>

              {/* Scattered particles around the icon */}
              <div className="absolute top-10 right-20 w-1.5 h-1.5 bg-[var(--color-plum-voltage)] rotate-45"></div>
              <div className="absolute bottom-10 left-20 w-2 h-2 rounded-full bg-[var(--color-amber-spark)]"></div>
              <div className="absolute top-1/2 left-10 w-1 h-1 bg-[var(--color-bone)]"></div>
              
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
