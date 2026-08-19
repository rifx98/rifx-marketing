"use client";

import React from "react";
import Link from "next/link";
import FadeIn from "./FadeIn";
import Magnet from "./Magnet";
import { ContactButton } from "./Buttons";
import LiquidEther from "./LiquidEther";
import UiverseContactButton from "./UiverseContactButton";
import BubbleMenu from "./BubbleMenu";

const bubbleMenuItems = [
  {
    label: 'Nosotros',
    href: '#nosotros',
    ariaLabel: 'Nosotros',
    rotation: -8,
    hoverStyles: { bgColor: '#3b82f6', textColor: '#ffffff' }
  },
  {
    label: 'Servicios',
    href: '#servicios',
    ariaLabel: 'Servicios',
    rotation: 8,
    hoverStyles: { bgColor: '#10b981', textColor: '#ffffff' }
  },
  {
    label: 'CRM',
    href: '#crm',
    ariaLabel: 'CRM',
    rotation: 8,
    hoverStyles: { bgColor: '#f59e0b', textColor: '#ffffff' }
  },
  {
    label: 'Contacto',
    href: '#contacto',
    ariaLabel: 'Contacto',
    rotation: -8,
    hoverStyles: { bgColor: '#8b5cf6', textColor: '#ffffff' }
  }
];

export default function HeroSection() {
  return (
    <section className="relative w-full h-[88svh] md:h-screen flex flex-col justify-between overflow-x-clip px-6 md:px-10">
      
      {/* Mobile-only LiquidEther Background */}
      <div className="absolute inset-0 z-0 pointer-events-none md:hidden">
        <LiquidEther
          colors={[ '#5227FF', '#fe8e8e', '#EF4444' ]}
          mouseForce={20}
          cursorSize={100}
          isViscous={false}
          viscous={30}
          iterationsViscous={32}
          iterationsPoisson={32}
          resolution={0.5}
          isBounce={false}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
          takeoverDuration={0.25}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
        />
      </div>

      {/* Desktop Navbar */}
      <FadeIn delay={0} y={-20} as="nav" className="hidden md:flex w-full justify-between items-center pt-6 md:pt-8 z-30 relative">
        {["Nosotros", "Servicios", "CRM", "Contacto"].map((item) => {
          const href = `#${item.toLowerCase()}`;
          return (
            <Link
              key={item}
              href={href}
              onClick={(e) => {
                if (href === '#contacto') {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('openConsultationModal'));
                } else {
                  e.preventDefault();
                  const target = document.querySelector(href);
                  if (target) {
                    const lenis = (window as any).lenis;
                    if (lenis) {
                      lenis.scrollTo(target);
                    } else {
                      target.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                }
              }}
              className="text-[#D7E2EA] font-medium uppercase tracking-wider text-sm md:text-lg lg:text-[1.4rem] hover:opacity-70 transition-opacity duration-200"
            >
              {item}
            </Link>
          );
        })}
      </FadeIn>

      {/* Mobile BubbleMenu */}
      <div className="md:hidden w-full relative z-[100]">
        <BubbleMenu
          items={bubbleMenuItems}
          menuAriaLabel="Toggle navigation"
          menuBg="#ffffff"
          menuContentColor="#111111"
          useFixedPosition={true}
          animationEase="back.out(1.5)"
          animationDuration={0.5}
          staggerDelay={0.12}
        />
      </div>

      <div className="w-full overflow-hidden mt-6 sm:mt-4 md:-mt-5 z-20 relative flex-1 flex flex-col justify-center">
        <FadeIn delay={0.15} y={40} className="w-full">
          <h1 className="hero-heading font-black uppercase tracking-tight leading-[0.85] w-full flex flex-col md:flex-row md:justify-center md:items-center">
            <span className="text-[22vw] sm:text-[18vw] md:text-[13.5vw] lg:text-[11.8vw] text-left md:text-center">
              rifx
            </span>
            <span className="text-[13.5vw] sm:text-[11.5vw] md:text-[13.5vw] lg:text-[11.8vw] text-right md:text-center md:ml-[3vw]">
              marketing
            </span>
          </h1>
        </FadeIn>
      </div>

      {/* Bottom Bar */}
      <div className="w-full flex justify-between items-end pb-7 sm:pb-8 md:pb-10 z-20 relative">
        <FadeIn delay={0.35} y={20}>
          <p 
            className="text-[#D7E2EA] font-light uppercase tracking-wide leading-snug max-w-[160px] sm:max-w-[220px] md:max-w-[260px]"
            style={{ fontSize: "clamp(0.75rem, 1.4vw, 1.5rem)" }}
          >
            agencia de marketing espacial enfocada en escalar ventas con IA
          </p>
        </FadeIn>
        
        <FadeIn delay={0.5} y={20}>
          <div className="transform scale-75 sm:scale-90 origin-bottom-right md:scale-100">
            <UiverseContactButton href="/panel" />
          </div>
        </FadeIn>
      </div>

      {/* Portrait */}
      <FadeIn 
        delay={0.6} 
        y={30} 
        className="absolute left-1/2 -translate-x-1/2 z-10 top-1/2 -translate-y-1/2 sm:top-auto sm:translate-y-0 sm:bottom-0 pointer-events-none"
      >
        <div className="pointer-events-auto">
          <Magnet padding={150} strength={3}>
            <img 
              src="/logo.svg" 
              alt="RIFX Marketing Logo" 
              className="w-[280px] sm:w-[360px] md:w-[440px] lg:w-[520px] h-[280px] sm:h-[360px] md:h-[440px] lg:h-[520px] object-contain drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]"
            />
          </Magnet>
        </div>
      </FadeIn>

    </section>
  );
}
