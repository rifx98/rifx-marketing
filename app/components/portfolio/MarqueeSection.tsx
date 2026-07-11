"use client";

import React, { useEffect, useRef } from "react";

const images = [
  "https://motionsites.ai/assets/hero-space-voyage-preview-eECLH3Yc.gif",
  "https://motionsites.ai/assets/hero-codenest-preview-Cgppc2qV.gif",
  "https://motionsites.ai/assets/hero-vex-ventures-preview-BczMFIiw.gif",
  "https://motionsites.ai/assets/hero-stellar-ai-v2-preview-DjvxjG3C.gif",
  "https://motionsites.ai/assets/hero-asme-preview-B_nGDnTP.gif",
  "https://motionsites.ai/assets/hero-transform-data-preview-Cx5OU29N.gif",
  "https://motionsites.ai/assets/hero-vitara-preview-Cjz2QYyU.gif",
  "https://motionsites.ai/assets/hero-terra-preview-BFjrCr7T.gif",
  "https://motionsites.ai/assets/hero-skyelite-preview-DHaZIgUv.gif",
  "https://motionsites.ai/assets/hero-aethera-preview-DknSlcTa.gif",
  "https://motionsites.ai/assets/hero-designpro-preview-D8c5_een.gif",
  "https://motionsites.ai/assets/hero-stellar-ai-preview-D3HL6bw1.gif",
  "https://motionsites.ai/assets/hero-xportfolio-preview-D4A8maiC.gif",
  "https://motionsites.ai/assets/hero-orbit-web3-preview-BXt4OttD.gif",
  "https://motionsites.ai/assets/hero-nexora-preview-cx5HmUgo.gif",
  "https://motionsites.ai/assets/hero-evr-ventures-preview-DZxeVFEX.gif",
  "https://motionsites.ai/assets/hero-planet-orbit-preview-DWAP8Z1P.gif",
  "https://motionsites.ai/assets/hero-new-era-preview-CocuDUm9.gif",
  "https://motionsites.ai/assets/hero-wealth-preview-B70idl_u.gif",
  "https://motionsites.ai/assets/hero-luminex-preview-CxOP7ce6.gif",
  "https://motionsites.ai/assets/hero-celestia-preview-0yO3jXO8.gif"
];

const row1Base = images.slice(0, 11);
const row2Base = images.slice(11);

const row1 = [...row1Base, ...row1Base, ...row1Base];
const row2 = [...row2Base, ...row2Base, ...row2Base];

export default function MarqueeSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const row1Ref = useRef<HTMLDivElement>(null);
  const row2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current || !row1Ref.current || !row2Ref.current) return;
      
      const sectionTop = sectionRef.current.offsetTop;
      // Scroll offset calculated as: (window.scrollY - sectionTop + window.innerHeight) * 0.3
      const offset = (window.scrollY - sectionTop + window.innerHeight) * 0.3;
      
      // Row 1: Moves RIGHT on scroll (translateX(offset - 200))
      row1Ref.current.style.transform = `translate3d(${offset - 200}px, 0, 0)`;
      
      // Row 2: Moves LEFT on scroll (translateX(-(offset - 200)))
      row2Ref.current.style.transform = `translate3d(${-(offset - 200)}px, 0, 0)`;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial calculation
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section ref={sectionRef} className="relative z-10 pt-24 sm:pt-32 md:pt-40 pb-10 overflow-hidden">
      <div className="flex flex-col gap-3">
        {/* Row 1 */}
        <div 
          ref={row1Ref} 
          className="flex gap-3 w-max" 
          style={{ willChange: "transform" }}
        >
          {row1.map((src, i) => (
            <img 
              key={`r1-${i}`}
              src={src}
              alt="Project Showcase"
              loading="lazy"
              className="w-[420px] h-[270px] rounded-2xl object-cover shrink-0"
            />
          ))}
        </div>
        
        {/* Row 2 */}
        <div 
          ref={row2Ref} 
          className="flex gap-3 w-max" 
          style={{ willChange: "transform" }}
        >
          {row2.map((src, i) => (
            <img 
              key={`r2-${i}`}
              src={src}
              alt="Project Showcase"
              loading="lazy"
              className="w-[420px] h-[270px] rounded-2xl object-cover shrink-0"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
