'use client';

import React from 'react';

export default function EntryAnimation() {
  const [particles, setParticles] = React.useState<{ x: string, y: string, delay: number, duration: number }[]>([]);

  React.useEffect(() => {
    const newParticles = [...Array(20)].map(() => ({
      x: `${(Math.random() - 0.5) * 1000}px`,
      y: `${(Math.random() - 0.5) * 1000}px`,
      delay: Math.random(),
      duration: 2 + Math.random() * 2
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b1229] flex items-center justify-center overflow-hidden intro-overlay-fade pointer-events-none perspective-container">
      {/* Cinematic Particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full opacity-0"
          style={{
            '--tw-translate-x': p.x,
            '--tw-translate-y': p.y,
            animation: `particle-float ${p.duration}s ease-out ${p.delay}s forwards`,
            left: '50%',
            top: '50%',
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden'
          } as React.CSSProperties}
        />
      ))}

      {/* Erupting Custom Mars Planet */}
      <img 
        src="/images/mars-user.png"
        alt="Mars Planet"
        className="absolute w-48 h-48 md:w-80 md:h-80 object-contain animate-flare-erupt opacity-0 blur-[2px] z-10"
        style={{ backfaceVisibility: 'hidden', willChange: 'transform, opacity' }}
      />

      <div className="relative flex flex-col items-center z-20">
        {/* Flying Brand Reveal Assembled */}
        <div className="relative flex flex-col items-center px-4 w-64 h-64 md:w-[28rem] md:h-[28rem]">
          {/* Letra R */}
          <img src="/piezas-logo/letra-r.png" alt="R" className="absolute inset-0 w-full h-full object-contain opacity-0 animate-logo-fly" style={{ animationDelay: '0.2s', backfaceVisibility: 'hidden', willChange: 'transform, opacity' }} />
          {/* Letra I */}
          <img src="/piezas-logo/letra-i.png" alt="I" className="absolute inset-0 w-full h-full object-contain opacity-0 animate-logo-fly" style={{ animationDelay: '0.4s', backfaceVisibility: 'hidden', willChange: 'transform, opacity' }} />
          {/* Letra F */}
          <img src="/piezas-logo/letra-f.png" alt="F" className="absolute inset-0 w-full h-full object-contain opacity-0 animate-logo-fly" style={{ animationDelay: '0.6s', backfaceVisibility: 'hidden', willChange: 'transform, opacity' }} />
          {/* Letra X */}
          <img src="/piezas-logo/letra-x.png" alt="X" className="absolute inset-0 w-full h-full object-contain opacity-0 animate-logo-fly" style={{ animationDelay: '0.8s', backfaceVisibility: 'hidden', willChange: 'transform, opacity' }} />
          {/* Guion - */}
          <img src="/piezas-logo/letra-.png" alt="-" className="absolute inset-0 w-full h-full object-contain opacity-0 animate-logo-fly" style={{ animationDelay: '1.0s', backfaceVisibility: 'hidden', willChange: 'transform, opacity' }} />
          {/* Texto Marketing */}
          <img src="/piezas-logo/texto-marketing.png" alt="Marketing" className="absolute inset-0 w-full h-full object-contain opacity-0 animate-logo-fly" style={{ animationDelay: '1.2s', backfaceVisibility: 'hidden', willChange: 'transform, opacity' }} />
          {/* Astronauta y Corona aterrizando */}
          <img src="/piezas-logo/corona.png" alt="Corona" className="absolute inset-0 w-full h-full object-contain opacity-0 animate-logo-fly" style={{ animationDelay: '1.6s', backfaceVisibility: 'hidden', willChange: 'transform, opacity' }} />
          <img src="/piezas-logo/astronauta.png" alt="Astronauta" className="absolute inset-0 w-full h-full object-contain opacity-0 animate-logo-fly" style={{ animationDelay: '1.6s', backfaceVisibility: 'hidden', willChange: 'transform, opacity' }} />
        </div>

        {/* Ambient Residual Glow */}
        <div className="absolute inset-0 -z-10 blur-[150px] opacity-10">
          <div className="w-[500px] h-[500px] bg-rocket-orange rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
