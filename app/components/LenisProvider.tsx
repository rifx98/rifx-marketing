"use client";

import { useEffect } from 'react';
import Lenis from 'lenis';

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // No activar Lenis en el panel — necesita scroll nativo
    if (window.location.pathname.startsWith('/panel')) return;

    const lenis = new Lenis({
      lerp: 0.06,
      wheelMultiplier: 0.9,
      smoothWheel: true,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}

