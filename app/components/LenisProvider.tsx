"use client";

import { useEffect } from 'react';
import Lenis from 'lenis';
import { usePathname } from 'next/navigation';

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // No activar Lenis en el panel — necesita scroll nativo
    if (pathname.startsWith('/panel')) return;

    const lenis = new Lenis({
      lerp: 0.06,
      wheelMultiplier: 0.9,
      smoothWheel: true,
      touchMultiplier: 2,
    });
    if (typeof window !== 'undefined') {
      (window as any).lenis = lenis;
    }

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      if (typeof window !== 'undefined') {
        delete (window as any).lenis;
      }
    };
  }, [pathname]);

  return <>{children}</>;
}

