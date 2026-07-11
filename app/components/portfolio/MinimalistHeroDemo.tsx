"use client";

import React, { useState, useEffect, useRef } from 'react';

const teamItems = [
  {
    id: 'bryan',
    role: 'CEO & VISIONARIO PRINCIPAL',
    name: 'Bryan\nArcos',
    image: '/images/team-bryan.jpg',
  },
  {
    id: 'elena',
    role: 'DIRECTORA DE ESTRATEGIA',
    name: 'Elena\nNova',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'marcus',
    role: 'ARQUITECTO DE SISTEMAS',
    name: 'Marcus\nStellar',
    image: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=800&auto=format&fit=crop',
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

const MinimalistHeroDemo = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const { top, height } = containerRef.current.getBoundingClientRect();
      const scrollableDistance = height - window.innerHeight;
      
      if (scrollableDistance <= 0) return;
      
      let progress = -top / scrollableDistance;
      progress = Math.max(0, Math.min(1, progress));
      
      const newIndex = Math.min(
        teamItems.length - 1,
        Math.floor(progress * teamItems.length)
      );
      
      setActiveIndex(newIndex);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Run once on mount to set initial state correctly if already scrolled
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getTransform = (diff: number) => {
    if (diff === 0) return 'translate(-50%, -50%)';
    if (diff < 0) return `translate(calc(-50% + var(--card-offset-left) * ${diff}), -50%)`;
    return `translate(calc(-50% + var(--active-shift) + var(--card-offset-right) * ${diff}), -50%)`;
  };

  return (
    <div ref={containerRef} className="w-full relative bg-[#0C0C0C]" style={{ height: '300vh' }}>
      <div className="sticky top-0 w-full h-screen overflow-hidden flex flex-col justify-center text-white">
        
        <style>{`
          .carousel-item {
            --card-offset-left: 200px;
            --card-offset-right: 200px;
            --active-shift: 0px;
          }
          @media (min-width: 768px) {
            .carousel-item {
              --card-offset-left: 450px;
              --card-offset-right: 350px;
              --active-shift: 350px;
            }
          }
        `}</style>



        {/* Static Left Info Block */}
        <div className="absolute top-12 left-4 right-4 md:left-[10%] md:top-1/2 md:-translate-y-1/2 z-30 md:w-[350px] pointer-events-none text-center md:text-left">
          <h2 className="text-[2.5rem] leading-[1] md:text-7xl font-normal mb-2 md:mb-8 tracking-tight text-white">Nuestro<br className="hidden md:block"/> equipo</h2>
          <h3 className="text-base md:text-2xl font-medium mb-2 md:mb-6 text-white">Construye con nosotros.</h3>
          <p className="text-gray-300/80 leading-relaxed mb-4 md:mb-6 text-xs md:text-base pointer-events-auto max-w-md mx-auto md:mx-0 hidden md:block">
            Buscamos personas intencionales, empáticas y curiosas que prosperen creando experiencias increíbles. Si deseas ser parte del viaje, escríbenos con tu CV o portafolio.
          </p>
          <p className="text-gray-300/80 leading-relaxed mb-3 md:mb-6 text-[13px] md:text-base pointer-events-auto max-w-[280px] mx-auto md:mx-0 md:hidden">
            Buscamos personas curiosas para crear experiencias increíbles.
          </p>
          <p className="text-gray-300/80 text-[13px] md:text-base pointer-events-auto">
            Envía tu CV a <a href="mailto:contacto@agencia.com" className="text-[#f27121] hover:underline font-medium">contacto@agencia.com</a>
          </p>
        </div>

        {/* Carousel Container */}
        <div className="absolute inset-0 z-10 top-[10%] md:top-0">
          {teamItems.map((item, index) => {
            const diff = index - activeIndex;
            const isActive = diff === 0;
            
            let opacityClass = "opacity-20";
            let scaleClass = "scale-75";
            let filterClass = "brightness-40 blur-[2px]";
            let zIndexClass = "z-10";
            
            if (isActive) {
              opacityClass = "opacity-100";
              scaleClass = "scale-100";
              filterClass = "brightness-100 blur-0 shadow-2xl";
              zIndexClass = "z-20";
            } else if (Math.abs(diff) === 1) {
              opacityClass = "opacity-50";
              scaleClass = "scale-[0.85]";
              filterClass = "brightness-50 blur-[1px]";
            }

            return (
              <div 
                key={item.id} 
                className={`carousel-item absolute top-1/2 left-1/2 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${zIndexClass}`}
                style={{ transform: getTransform(diff) }}
              >
                <div className="relative flex items-center justify-center">
                  
                  {/* Image Card */}
                  <div className={`w-[220px] h-[320px] md:w-[360px] md:h-[520px] rounded-3xl overflow-hidden relative border border-white/5 bg-gray-900 flex-shrink-0 transition-all duration-700 ${opacityClass} ${scaleClass} ${filterClass}`}>
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  </div>

                  {/* Text Info (Visible only when active) */}
                  <div className={`absolute top-full left-0 right-0 pt-5 flex flex-col items-center text-center md:top-auto md:left-full md:bottom-auto md:right-auto md:pt-0 md:ml-12 md:w-[300px] md:items-start md:text-left transition-all duration-700 delay-100 ${isActive ? 'opacity-100 translate-y-0 md:translate-x-0' : 'opacity-0 translate-y-4 md:translate-y-0 md:-translate-x-8 pointer-events-none'}`}>
                    <span className="text-[#9d4edd] text-[10px] md:text-xs font-bold tracking-widest uppercase mb-1 md:mb-4 block">{item.role}</span>
                    <h3 className="text-white text-[1.75rem] md:text-6xl font-medium leading-[1.1] tracking-tight mb-3 md:mb-6 whitespace-pre-line">
                      {item.name}
                    </h3>
                    <div className="flex gap-4">
                      <a href="#" className="text-white hover:text-[#f27121] transition-colors"><TwitterIcon /></a>
                      <a href="#" className="text-white hover:text-[#f27121] transition-colors"><LinkedinIcon /></a>
                    </div>
                  </div>
                  
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MinimalistHeroDemo;
