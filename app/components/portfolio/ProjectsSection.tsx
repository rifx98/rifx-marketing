"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import FadeIn from "./FadeIn";
import { LiveProjectButton } from "./Buttons";

const projects = [
  {
    num: "01",
    label: "Servicio",
    name: "Chat Bot",
    video: "/videos/chat_bot.mp4",
  },
  {
    num: "02",
    label: "Servicio",
    name: "Publica en todas las redes",
    video: "/videos/publica_en_todas_las_redes.mp4",
  },
  {
    num: "03",
    label: "Servicio",
    name: "Publicidad con IA",
    video: "/videos/publicidad_con_ia.mp4",
  }
];

export default function ProjectsSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <section id="crm" className="bg-[#0C0C0C] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] -mt-10 sm:-mt-12 md:-mt-14 relative z-20 pb-32">
      <div className="px-5 sm:px-8 md:px-10 pt-20 sm:pt-24 md:pt-32">
        <FadeIn delay={0}>
          <h2 className="hero-heading font-black uppercase text-center mb-16 sm:mb-20 md:mb-28 px-4" style={{ fontSize: "clamp(2rem, 5.5vw, 80px)", lineHeight: 1.1 }}>
            Prueba nuestro sistema de marketing automatizado
          </h2>
        </FadeIn>
      </div>

      <div ref={containerRef} className="relative w-full max-w-7xl mx-auto px-5 sm:px-8 md:px-10 pb-[10vh]">
        {projects.map((project, i) => {
          return (
            <ProjectCard 
              key={i}
              project={project}
              index={i}
              totalCards={projects.length}
              progress={scrollYProgress}
            />
          );
        })}
      </div>
    </section>
  );
}

function ProjectCard({ project, index, totalCards, progress }: { project: any, index: number, totalCards: number, progress: any }) {
  const targetScale = 1 - (totalCards - 1 - index) * 0.03;
  // Progress ranges for this specific card
  const rangeStart = index * (1 / totalCards);
  const rangeEnd = rangeStart + (1 / totalCards);
  
  // Transform scale based on the overall container progress
  const scale = useTransform(progress, [rangeStart, 1], [1, targetScale]);
  
  const topOffset = index * 28;

  return (
    <motion.div 
      className="sticky top-24 md:top-32 flex flex-col gap-6 w-full rounded-[40px] sm:rounded-[50px] md:rounded-[60px] border-2 border-[#D7E2EA] bg-[#0C0C0C] p-4 sm:p-6 md:p-8"
      style={{ 
        scale,
        top: `calc(6rem + ${topOffset}px)`, // top-24 (6rem) is base
        marginBottom: "2rem" 
      }}
    >
      {/* Top Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <span className="font-black text-white leading-none block" style={{ fontSize: "clamp(3rem, 10vw, 140px)" }}>
            {project.num}
          </span>
          <div className="flex flex-col">
            <span className="text-[#D7E2EA] opacity-60 uppercase tracking-widest text-sm font-light mb-1">
              {project.label}
            </span>
            <h3 className="text-white font-medium uppercase leading-tight" style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}>
              {project.name}
            </h3>
          </div>
        </div>
        
        <div className="shrink-0">
          <LiveProjectButton href="/panel" label="Probar Demo" />
        </div>
      </div>

      {/* Bottom Row - Video Grid */}
      <div className="w-full mt-4 h-full aspect-video rounded-[40px] sm:rounded-[50px] md:rounded-[60px] overflow-hidden bg-[#1A1A1A]">
        <video 
          src={project.video}
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="auto"
        />
      </div>
    </motion.div>
  );
}
