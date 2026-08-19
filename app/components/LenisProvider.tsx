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
      lerp: 0.12,
      wheelMultiplier: 1,
      smoothWheel: true,
      touchMultiplier: 2,
    });
    if (typeof window !== 'undefined') {
      (window as any).lenis = lenis;
    }

    let animationFrameId: number;
    function raf(time: number) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }

    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
      if (typeof window !== 'undefined' && (window as any).lenis === lenis) {
        delete (window as any).lenis;
      }
    };
  }, [pathname]);

  return <>{children}</>;
}

