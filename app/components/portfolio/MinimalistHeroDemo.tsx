"use client";

import React from 'react';
import { motion } from 'framer-motion';

const InstagramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const LinkedinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const XTwitterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const leader = {
  id: 'bryan',
  role: 'CEO & VISIONARIO PRINCIPAL',
  name: 'Bryan Arcos',
  image: '/images/team-bryan.jpg',
  description: 'Traza el rumbo de Rifx: define la visión, cierra las alianzas clave y se asegura de que cada campaña dispare a la órbita correcta.',
  socials: [
    {
      name: 'Instagram',
      href: 'https://www.instagram.com/rifxmarketing/',
      icon: InstagramIcon,
    },
    {
      name: 'LinkedIn',
      href: 'https://linkedin.com',
      icon: LinkedinIcon,
    },
    {
      name: 'X (Twitter)',
      href: 'https://x.com',
      icon: XTwitterIcon,
    },
  ],
};

const MinimalistHeroDemo = () => {
  return (
    <section id="equipo" className="w-full relative bg-[#0C0C0C] min-h-screen flex items-center justify-center py-20 px-6 sm:px-10 lg:px-16 overflow-hidden text-white">
      <div className="max-w-6xl w-full mx-auto flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 xl:gap-24">
        
        {/* Bloque Izquierdo: Foto de Bryan Arcos */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 z-20"
        >
          <div className="w-[260px] h-[370px] sm:w-[310px] sm:h-[440px] md:w-[360px] md:h-[510px] lg:w-[380px] lg:h-[540px] rounded-3xl overflow-hidden relative border border-white/10 bg-gray-900 shadow-2xl group">
            <img
              src={leader.image}
              alt={leader.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          </div>
        </motion.div>

        {/* Bloque Derecho: Nombre (Bryan Arcos), Rol, Descripción y Redes Sociales */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="w-full lg:max-w-xl text-center lg:text-left z-20 flex flex-col items-center lg:items-start"
        >
          <h2 className="text-[2.6rem] leading-[1.05] sm:text-5xl md:text-6xl lg:text-7xl font-normal mb-3 md:mb-5 tracking-tight text-white">
            Bryan<br className="hidden lg:block" /> Arcos
          </h2>

          <div className="text-sm sm:text-base lg:text-xl font-medium text-[#f27121] tracking-wide uppercase mb-4 md:mb-6">
            {leader.role}
          </div>

          <p className="text-gray-300/80 leading-relaxed text-sm sm:text-base md:text-lg mb-8 max-w-lg">
            {leader.description}
          </p>

          {/* Iconos de Redes Sociales */}
          <div className="flex items-center gap-3.5 pt-1">
            {leader.socials.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 hover:border-[#f27121] text-gray-300 hover:text-[#f27121] flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg"
                  aria-label={social.name}
                  title={social.name}
                >
                  <Icon />
                </a>
              );
            })}
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default MinimalistHeroDemo;
