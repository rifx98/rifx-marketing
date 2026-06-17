"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function AnimatedCursor() {
  const pathname = usePathname();
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [isPropulsing, setIsPropulsing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Solo mostrar en escritorio (no táctil y pantalla > 768px)
    const checkDesktop = () => {
      const hasPointer = window.matchMedia('(pointer: fine)').matches;
      const isWide = window.innerWidth >= 768;
      const result = hasPointer && isWide;
      setIsDesktop(result);
      return result;
    };

    if (!checkDesktop() || pathname?.startsWith('/panel')) return; // Si es móvil o panel, no hacer nada

    // Ocultar los cursores predeterminados
    const style = document.createElement('style');
    style.innerHTML = `@media (pointer: fine) and (min-width: 768px) { * { cursor: none !important; } }`;
    document.head.appendChild(style);

    const updateCursor = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
    };
    
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      setIsPropulsing(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsPropulsing(false);
      }, 150);
    };

    const handleResize = () => checkDesktop();

    window.addEventListener('mousemove', updateCursor, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('mousemove', updateCursor);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleScroll);
      window.removeEventListener('resize', handleResize);
      clearTimeout(scrollTimeout);
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, [pathname]);

  // No renderizar en móvil, ni en SSR, ni en el panel
  if (!isClient || !isDesktop || pathname?.startsWith('/panel')) return null;

  return (
    <div 
      ref={cursorRef}
      className="fixed top-0 left-0 pointer-events-none z-[10000] will-change-transform"
      style={{ 
        transform: 'translate3d(-100px, -100px, 0) translate(-50%, -50%)',
      }}
    >
      <div 
        className={`transition-all duration-150 ease-out ${
          isPropulsing ? 'scale-125 -rotate-12 -translate-y-2' : 'animate-bounce'
        }`} 
        style={{ animationDuration: isPropulsing ? '0s' : '2s' }}
      >
        <div className="relative flex flex-col items-center">
          <span className="text-3xl drop-shadow-[0_0_10px_rgba(242,113,33,0.5)] z-10">🚀</span>
          
          {/* Flame Propulsion Effect (CSS Colors) */}
          <div 
            className={`absolute top-1/2 left-1/2 w-4 h-12 origin-top flex flex-col items-center transition-all duration-150 z-20 ${
              isPropulsing ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
            }`}
            style={{ transform: 'translate(calc(-50% - 8px), 8px) rotate(30deg)' }}
          >
            {/* Core White Hot Flame */}
            <div className="w-1 h-3 bg-white rounded-full blur-[0.5px] absolute top-0 z-30 shadow-[0_0_8px_#ffffff]"></div>
            {/* Main Orange/Yellow Flame */}
            <div className="w-2.5 h-6 bg-gradient-to-b from-[#fff3cd] via-yellow-400 to-[#f27121] rounded-full blur-[1.5px] animate-pulse absolute top-0 z-20 shadow-[0_0_12px_#ffeb3b]"></div>
            {/* Outer Thruster Glow */}
            <div className="w-5 h-10 bg-gradient-to-b from-orange-500/90 to-transparent rounded-full blur-[5px] absolute top-0 z-10 animate-pulse" style={{ animationDuration: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
