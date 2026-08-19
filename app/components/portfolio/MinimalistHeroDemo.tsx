"use client";

import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useMotionTemplate, MotionValue } from 'framer-motion';

const teamItems = [
  {
    id: 'bryan',
    role: 'CEO & VISIONARIO PRINCIPAL',
    name: 'Bryan\nArcos',
    image: '/images/team-bryan.jpg',
    description: 'Traza el rumbo de Rifx: define la visión, cierra las alianzas clave y se asegura de que cada campaña dispare a la órbita correcta.',
  },
  {
    id: 'elena',
    role: 'DIRECTORA DE ESTRATEGIA',
    name: 'Elena\nNova',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop',
    description: 'Convierte datos fríos en estrategias de marketing con impacto real, diseñando el mapa de ruta que lleva a cada marca a su mercado ideal.',
  },
  {
    id: 'marcus',
    role: 'ARQUITECTO DE SISTEMAS',
    name: 'Marcus\nStellar',
    image: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=800&auto=format&fit=crop',
    description: 'Construye la infraestructura técnica detrás del bot de WhatsApp y las automatizaciones que mantienen el negocio funcionando 24/7.',
  }
];

const TwitterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const LinkedinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

// Sigue el mouse/scroll de forma continua (sin saltos de estado ni
// transiciones CSS "a destino") para que, si sueltas la rueda a medias, la
// tarjeta se quede congelada exactamente ahí — el mismo efecto que la
// sección de servicios (ProjectsSection).
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

function TeamCard({
  item, index, continuousIndex, isDesktop,
}: {
  item: typeof teamItems[0]; index: number; continuousIndex: MotionValue<number>; isDesktop: boolean;
}) {
  const offsetLeft = isDesktop ? 450 : 200;
  const offsetRight = isDesktop ? 350 : 200;
  const activeShift = isDesktop ? 350 : 0;

  const offsetX = useTransform(continuousIndex, [index - 1, index, index + 1], [-offsetLeft, 0, activeShift + offsetRight]);
  const x = useMotionTemplate`calc(-50% + ${offsetX}px)`;
  const scale = useTransform(continuousIndex, [index - 1, index, index + 1], [0.85, 1, 0.85]);
  const opacity = useTransform(continuousIndex, [index - 2, index - 1, index, index + 1, index + 2], [0.15, 0.45, 1, 0.45, 0.15]);
  const brightness = useTransform(continuousIndex, [index - 1, index, index + 1], [0.4, 1, 0.4]);
  const blur = useTransform(continuousIndex, [index - 1, index, index + 1], [2, 0, 2]);
  const filter = useMotionTemplate`brightness(${brightness}) blur(${blur}px)`;
  const zIndex = useTransform(continuousIndex, (v) => Math.round(20 - Math.abs(v - index) * 10));

  // Mismo rango que la escala de la imagen (sin meseta en cero): la
  // descripción del trabajador siempre está apareciendo o desapareciendo en
  // crossfade continuo con la tarjeta vecina, nunca queda "en blanco" entre
  // un trabajador y el siguiente.
  const infoOpacity = useTransform(continuousIndex, [index - 1, index, index + 1], [0, 1, 0]);
  const infoPointerEvents = useTransform(infoOpacity, (v) => (v > 0.6 ? 'auto' : 'none'));

  return (
    <motion.div
      className="carousel-item absolute top-1/2 left-1/2"
      style={{ x, y: '-50%', scale, opacity, filter, zIndex }}
    >
      <div className="relative flex items-center justify-center">

        {/* Image Card */}
        <div className="w-[220px] h-[320px] md:w-[360px] md:h-[520px] rounded-3xl overflow-hidden relative border border-white/5 bg-gray-900 flex-shrink-0 shadow-2xl">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
        </div>

        {/* Text Info (Visible only when active) */}
        <motion.div
          style={{ opacity: infoOpacity, pointerEvents: infoPointerEvents as any }}
          className="absolute top-full left-0 right-0 pt-5 flex flex-col items-center text-center md:top-auto md:left-full md:bottom-auto md:right-auto md:pt-0 md:ml-12 md:w-[300px] md:items-start md:text-left"
        >
          <span className="text-[#9d4edd] text-[10px] md:text-xs font-bold tracking-widest uppercase mb-1 md:mb-4 block">{item.role}</span>
          <h3 className="text-white text-[1.75rem] md:text-6xl font-medium leading-[1.1] tracking-tight mb-3 md:mb-6 whitespace-pre-line">
            {item.name}
          </h3>
          <div className="flex gap-4">
            <a href="#" className="text-white hover:text-[#f27121] transition-colors"><TwitterIcon /></a>
            <a href="#" className="text-white hover:text-[#f27121] transition-colors"><LinkedinIcon /></a>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}

// Cada palabra entra desde su lado (las de la primera mitad de la frase
// desde la izquierda, las de la segunda mitad desde la derecha) y converge
// al centro donde se lee limpio. El texto en sí no se mueve ni gira — solo
// aparecen/desaparecen sus palabras — y como cada bloque ocupa su propia
// ventana de scroll sin superposición con la del vecino, nunca se
// transcriben dos descripciones a la vez.
function SlideInWord({ word, side, localProgress, isLast }: {
  word: string; side: 'left' | 'right'; localProgress: MotionValue<number>; isLast: boolean;
}) {
  const sign = side === 'left' ? -1 : 1;
  const x = useTransform(localProgress, (lp) => {
    const clamped = Math.max(-0.5, Math.min(0.5, lp));
    const arrival = 1 - Math.abs(clamped) * 2; // 0 en los bordes de su ventana, 1 centrado
    return sign * 36 * (1 - arrival);
  });
  const opacity = useTransform(localProgress, (lp) => {
    const clamped = Math.max(-0.5, Math.min(0.5, lp));
    return 1 - Math.abs(clamped) * 2;
  });
  return (
    <motion.span style={{ x, opacity, display: 'inline-block' }}>
      {word}{!isLast ? ' ' : ''}
    </motion.span>
  );
}

function SlideInText({ text, index, continuousIndex, className }: {
  text: string; index: number; continuousIndex: MotionValue<number>; className?: string;
}) {
  const localProgress = useTransform(continuousIndex, (v) => v - index);
  const words = text.split(' ');
  const mid = Math.ceil(words.length / 2);
  return (
    <div className={`absolute inset-0 ${className || ''}`}>
      {words.map((w, i) => (
        <SlideInWord key={i} word={w} side={i < mid ? 'left' : 'right'} localProgress={localProgress} isLast={i === words.length - 1} />
      ))}
    </div>
  );
}

const MinimalistHeroDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // 0 -> primer miembro, teamItems.length - 1 -> último. Continuo (no
  // redondeado), así el carrusel sigue el scroll en tiempo real.
  const continuousIndex = useTransform(scrollYProgress, [0, 1], [0, teamItems.length - 1]);

  return (
    <div ref={containerRef} className="w-full relative bg-[#0C0C0C]" style={{ height: '300vh' }}>
      <div className="sticky top-0 w-full h-screen overflow-hidden flex flex-col justify-center text-white">

        {/* Static Left Info Block */}
        <div className="absolute top-12 left-4 right-4 md:left-[10%] md:top-1/2 md:-translate-y-1/2 z-30 md:w-[350px] pointer-events-none text-center md:text-left">
          <h2 className="text-[2.5rem] leading-[1] md:text-7xl font-normal mb-2 md:mb-8 tracking-tight text-white">Nuestro<br className="hidden md:block"/> equipo</h2>

          {/* Rol del miembro activo — las palabras entran desde los lados */}
          <div className="relative h-7 md:h-8 mb-2 md:mb-6">
            {teamItems.map((item, index) => (
              <SlideInText
                key={item.id}
                text={item.role}
                index={index}
                continuousIndex={continuousIndex}
                className="text-base md:text-2xl font-medium text-[#f27121]"
              />
            ))}
          </div>

          {/* Descripción del miembro activo — las palabras entran desde los lados */}
          <div className="relative h-24 md:h-28 mb-4 md:mb-6">
            {teamItems.map((item, index) => (
              <SlideInText
                key={item.id}
                text={item.description}
                index={index}
                continuousIndex={continuousIndex}
                className="text-gray-300/80 leading-relaxed text-xs md:text-base pointer-events-auto max-w-md mx-auto md:mx-0"
              />
            ))}
          </div>

          <p className="text-gray-300/80 text-[13px] md:text-base pointer-events-auto">
            Envía tu CV a <a href="mailto:contacto@agencia.com" className="text-[#f27121] hover:underline font-medium">contacto@agencia.com</a>
          </p>
        </div>

        {/* Carousel Container */}
        <div className="absolute inset-0 z-10 top-[10%] md:top-0">
          {teamItems.map((item, index) => (
            <TeamCard
              key={item.id}
              item={item}
              index={index}
              continuousIndex={continuousIndex}
              isDesktop={isDesktop}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MinimalistHeroDemo;
