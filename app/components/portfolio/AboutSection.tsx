"use client";

import React from "react";
import FadeIn from "./FadeIn";
import AnimatedText from "./AnimatedText";
import { ContactButton } from "./Buttons";
import MinimalistHeroDemo from "./MinimalistHeroDemo";

export default function AboutSection() {
  return (
    <>
      <section id="about" className="relative min-h-screen flex flex-col items-center justify-center px-5 sm:px-8 md:px-10 py-20 bg-[#0C0C0C] overflow-hidden">
      
      {/* Decorative Corners */}
      <FadeIn delay={0.1} duration={0.9} x={-80} y={0} className="absolute top-[4%] left-[1%] sm:left-[2%] md:left-[4%] pointer-events-none">
        <img src="https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/moon_icon.11395d36.png" alt="Moon" className="w-[120px] sm:w-[160px] md:w-[210px] object-contain" />
      </FadeIn>
      
      <FadeIn delay={0.15} duration={0.9} x={80} y={0} className="absolute top-[4%] right-[1%] sm:right-[2%] md:right-[4%] pointer-events-none">
        <img src="https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/lego_icon-1.703bb594.png" alt="Lego" className="w-[120px] sm:w-[160px] md:w-[210px] object-contain" />
      </FadeIn>

      <FadeIn delay={0.25} duration={0.9} x={-80} y={0} className="absolute bottom-[8%] left-[3%] sm:left-[6%] md:left-[10%] pointer-events-none">
        <img src="https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/p59_1.4659672e.png" alt="3D Object" className="w-[100px] sm:w-[140px] md:w-[180px] object-contain" />
      </FadeIn>

      <FadeIn delay={0.3} duration={0.9} x={80} y={0} className="absolute bottom-[8%] right-[3%] sm:right-[6%] md:right-[10%] pointer-events-none">
        <img src="https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/Group_134-1.2e04f3ce.png" alt="3D Group" className="w-[130px] sm:w-[170px] md:w-[220px] object-contain" />
      </FadeIn>

      {/* Main Content */}
      <div className="flex flex-col items-center z-10 w-full max-w-4xl">
        <FadeIn delay={0} y={40} className="w-full">
          <h2 id="nosotros" className="hero-heading font-black uppercase leading-none tracking-tight text-center" style={{ fontSize: "clamp(3rem, 12vw, 160px)" }}>
            Nosotros
          </h2>
        </FadeIn>
        
        <div className="flex flex-col items-center mt-10 sm:mt-14 md:mt-16 w-full">
          <AnimatedText 
            text="Lideramos la visión estratégica del ecosistema digital. Diseñamos rutas de crecimiento y construimos sistemas robustos que escalan los resultados. Convertimos audiencias frías en clientes leales mediante innovación, inteligencia artificial y automatización extrema."
            className="text-[#D7E2EA] font-medium text-center leading-relaxed max-w-[560px]"
          />
          <style dangerouslySetInnerHTML={{__html: `
            .text-\\[\\#D7E2EA\\] { font-size: clamp(1rem, 2vw, 1.35rem); }
          `}} />
          
          <div className="mt-16 sm:mt-20 md:mt-24">
            <ContactButton href="#contacto" label="Contactar" />
          </div>
        </div>
      </div>

      </section>

      {/* Insert the requested MinimalistHeroDemo component below the main content */}
      <div className="w-full relative z-20">
        <MinimalistHeroDemo />
      </div>
    </>
  );
}

