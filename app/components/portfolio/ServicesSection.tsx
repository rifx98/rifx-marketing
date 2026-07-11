"use client";

import React from "react";
import FadeIn from "./FadeIn";

const services = [
  {
    num: "01",
    name: "Anuncios Ads",
    desc: "Campañas publicitarias optimizadas con inteligencia artificial para captar leads calificados en Meta y Google, escalando ventas de forma inmediata."
  },
  {
    num: "02",
    name: "WhatsApp IA",
    desc: "Automatización e Inteligencia Artificial en tus chats. Agentes IA conversacionales entrenados para responder preguntas, enviar catálogos y vender 24/7."
  },
  {
    num: "03",
    name: "Diseño UX/UI",
    desc: "Páginas web inmersivas y Landing Pages de alta conversión que guían al usuario de manera intuitiva y visualmente impactante."
  },
  {
    num: "04",
    name: "E-commerce",
    desc: "Pasarelas de pago integradas, logística automatizada y optimización de checkout estelar. Tu tienda en línea construida para vender a escala mundial."
  },
  {
    num: "05",
    name: "CRM & Sistemas",
    desc: "Sistemas robustos y eficientes que escalan los resultados. Automatizaciones de seguimiento y retención para no perder ni un solo cliente."
  }
];

export default function ServicesSection() {
  return (
    <section id="servicios" className="bg-white text-[#0C0C0C] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] px-5 sm:px-8 md:px-10 py-20 sm:py-24 md:py-32 relative z-10">
      
      <FadeIn delay={0}>
        <h2 className="font-black uppercase text-center mb-16 sm:mb-20 md:mb-28" style={{ fontSize: "clamp(3rem, 12vw, 160px)" }}>
          Servicios
        </h2>
      </FadeIn>

      <div className="max-w-5xl mx-auto flex flex-col">
        {services.map((service, i) => (
          <FadeIn key={i} delay={i * 0.1} y={30} className={`flex flex-col sm:flex-row gap-6 sm:gap-10 md:gap-16 py-8 sm:py-10 md:py-12 border-[rgba(12,12,12,0.15)] ${i !== 0 ? 'border-t' : ''}`}>
            
            {/* Number on left */}
            <div className="flex-shrink-0">
              <span className="font-black text-[#0C0C0C] leading-none block" style={{ fontSize: "clamp(3rem, 10vw, 140px)" }}>
                {service.num}
              </span>
            </div>
            
            {/* Name + Description on right */}
            <div className="flex flex-col justify-center pt-2 sm:pt-4 md:pt-6">
              <h3 className="font-medium uppercase mb-3 sm:mb-4" style={{ fontSize: "clamp(1rem, 2.2vw, 2.1rem)" }}>
                {service.name}
              </h3>
              <p className="font-light leading-relaxed max-w-2xl opacity-60" style={{ fontSize: "clamp(0.85rem, 1.6vw, 1.25rem)" }}>
                {service.desc}
              </p>
            </div>
            
          </FadeIn>
        ))}
      </div>
      
    </section>
  );
}
