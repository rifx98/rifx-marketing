'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function TrainCTA({
  title = <>Tu próximo<br />proyecto empieza aquí</>,
  subtitle = "Hablemos de tu estrategia digital"
}: {
  title?: React.ReactNode,
  subtitle?: string
} = {}) {
  const [isMoving, setIsMoving] = useState(false);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [isClickable, setIsClickable] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    let doorTimer: ReturnType<typeof setTimeout>;
    let clickTimer: ReturnType<typeof setTimeout>;

    const obs = new IntersectionObserver(([e]) => {
      // Start animation when at least 30% visible
      if (e.intersectionRatio >= 0.3 && !hasTriggered.current) {
        hasTriggered.current = true;
        setIsMoving(true);
        doorTimer = setTimeout(() => {
          setDoorsOpen(true);
          // Wait for door sliding animation (1.5s) to finish before bringing cartel to front
          clickTimer = setTimeout(() => {
            setIsClickable(true);
          }, 1500);
        }, 3500);
      }
      // Reset only when completely out of view (0%)
      if (e.intersectionRatio === 0 && hasTriggered.current) {
        hasTriggered.current = false;
        clearTimeout(doorTimer);
        clearTimeout(clickTimer);
        setIsMoving(false);
        setDoorsOpen(false);
        setIsClickable(false);
      }
    }, { threshold: [0, 0.3] });

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const trainBg = '#0c101e';
  const trimColor = '#F27121';
  const doorW = 'clamp(380px, 42vw, 560px)';

  return (
    <section id="train-cta" ref={sectionRef} style={{
      padding: '100px 0', background: '#080b18', overflow: 'hidden',
      minHeight: '620px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
    }}>
      {/* Decoración estación */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: 'linear-gradient(90deg, transparent, #1a1f35, transparent)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 60%, rgba(124,58,237,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: '-10%', width: '120%', height: '100px',
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)',
        backgroundSize: '40px 40px', transform: 'perspective(400px) rotateX(55deg)', transformOrigin: 'bottom', opacity: 0.6, zIndex: 5,
      }} />
      <div style={{
        position: 'absolute', bottom: '60px', left: 0, width: '100%', height: '2px',
        background: 'linear-gradient(90deg, transparent 5%, #f2712123 30%, #F27121 70%, transparent 95%)',
        zIndex: 6, boxShadow: '0 0 15px #27180eff',
      }} />

      {/* Viewport */}
      <div style={{ position: 'relative', width: '100%', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* ══ CARTEL detrás de las puertas ══ */}
        <div style={{
          position: 'absolute', width: doorW, height: '100%', zIndex: isClickable ? 50 : 15,
          opacity: doorsOpen ? 1 : 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '24px',
          overflow: 'hidden',
          background: '#030610', // Fondo base oscuro
          transition: 'opacity 0.1s', // Rápido para que esté listo cuando se abran las puertas
        }}>

          {/* Fondo Circular Giratorio (Efecto Galáctico) */}
          <div style={{
            position: 'absolute',
            top: '-100%', left: '-100%', width: '300%', height: '300%', // Muy grande para que al girar no se vean los bordes
            background: 'conic-gradient(from 0deg, #0b1229 0%, #2e0854 20%, #f27121 40%, #8b3a0f 60%, #1c053a 80%, #0b1229 100%)',
            animation: 'spinGalactic 25s linear infinite',
            filter: 'blur(60px)',
            zIndex: 0,
            opacity: 0.8
          }} />

          {/* Sombra central para que las letras se lean perfecto */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at center, rgba(11,18,41,0.6) 0%, rgba(3,6,16,0.9) 100%)',
            zIndex: 1
          }} />

          {/* Glow abajo */}
          <div style={{ position: 'absolute', bottom: '-40px', left: '-20%', width: '140%', height: '80px', background: 'radial-gradient(ellipse at center, rgba(242,113,33,0.35) 0%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none', zIndex: 2 }} />

          <h2 style={{ fontSize: 'clamp(1.4rem, 3.2vw, 2.6rem)', fontWeight: 900, color: 'white', marginBottom: '14px', letterSpacing: '-0.04em', lineHeight: 1, textTransform: 'uppercase', fontFamily: "'Montserrat', sans-serif", position: 'relative', zIndex: 10 }}>
            {title}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'clamp(0.7rem, 1.3vw, 0.95rem)', marginBottom: '28px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', position: 'relative', zIndex: 10 }}>
            {subtitle}
          </p>

          <style>{`
            @keyframes floatBtn { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
            @keyframes spinGalactic { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
          `}</style>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openConsultationModal'))}
            style={{
              background: 'linear-gradient(135deg, #f27121, #e94d1a)', color: 'white',
              fontWeight: 900, padding: '14px 36px', borderRadius: '9999px',
              fontSize: 'clamp(0.85rem, 1.4vw, 1.05rem)',
              boxShadow: '0 12px 30px rgba(242,113,33,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.12em',
              border: '1px solid rgba(255,255,255,0.15)',
              position: 'relative', zIndex: 10, cursor: 'pointer',
              animation: 'floatBtn 3s ease-in-out infinite',
            }}
          >
            Contáctanos
          </button>
        </div>

        {/* ══ TREN ══ */}
        <div style={{
          position: 'absolute', height: '100%',
          display: 'flex', alignItems: 'stretch', zIndex: 30,
          transition: isMoving ? 'transform 3.2s cubic-bezier(0.15, 0.6, 0.2, 1)' : 'none',
          transform: isMoving ? 'translateX(0)' : 'translateX(80vw)',
          pointerEvents: doorsOpen ? 'none' : 'auto',
        }}>

          {/* Vagones 1-5 */}
          {[1, 2, 3, 4, 5].map(i => (
            <div key={`L${i}`} style={{
              width: '14vw', minWidth: '130px', height: '100%', background: trainBg,
              borderTop: '3px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, position: 'relative', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4)',
            }}>
              <div style={{ position: 'absolute', right: 0, top: '8%', height: '84%', width: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'absolute', top: '72%', left: 0, width: '100%', height: '2px', background: trimColor, opacity: 0.5, boxShadow: `0 0 10px ${trimColor}` }} />
              <div style={{ width: '70%', height: '42%', background: '#040710', border: '3px solid #1a1f35', borderRadius: '18px', boxShadow: 'inset 0 0 25px rgba(0,0,0,0.95)', position: 'relative', marginTop: '-15%' }}>
                <div style={{ position: 'absolute', top: '8%', left: '8%', width: '30%', height: '25%', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', filter: 'blur(3px)' }} />
              </div>
            </div>
          ))}

          {/* ══ PUERTA ASCENSOR ══ */}
          <div style={{
            width: doorW, height: '100%', flexShrink: 0, position: 'relative',
            background: 'transparent', borderTop: '3px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Trim line */}
            <div style={{ position: 'absolute', top: '72%', left: 0, width: '100%', height: '2px', background: trimColor, opacity: doorsOpen ? 0 : 0.5, boxShadow: `0 0 8px ${trimColor}`, zIndex: 36, pointerEvents: 'none', transition: 'opacity 0.5s' }} />

            {/* Marco */}
            <div style={{ width: '100%', height: '100%', position: 'relative', border: '3px solid #1a1f35', background: 'transparent', boxShadow: '0 0 0 2px #080b14, 0 0 0 5px #0e1225', overflow: 'hidden' }}>

              {/* LED */}
              <div style={{ position: 'absolute', top: '-26px', left: '50%', transform: 'translateX(-50%)', background: '#080b14', border: '2px solid #1a1f35', borderRadius: '6px', padding: '3px 12px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 60, whiteSpace: 'nowrap' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: doorsOpen ? '#22c55e' : trimColor, boxShadow: `0 0 8px ${doorsOpen ? '#22c55e' : trimColor}`, transition: 'all 0.5s' }} />
                <span style={{ fontSize: '7px', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'monospace', color: doorsOpen ? '#22c55e' : trimColor, transition: 'color 0.5s' }}>{doorsOpen ? 'Open' : 'Arriving'}</span>
              </div>

              {/* Puerta izquierda */}
              <div style={{
                position: 'absolute', left: 0, top: 0, width: '50%', height: '100%',
                transform: doorsOpen ? 'translateX(-100%)' : 'translateX(0)',
                transition: doorsOpen ? 'transform 1.5s ease-in-out' : 'none',
              }}>
                <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'linear-gradient(100deg, #0a0e1c, #0e1328 40%, #111730 80%, #141c38)', borderRight: '1px solid #1e2540' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(255,255,255,0.01) 4px, rgba(255,255,255,0.01) 5px)' }} />
                  <div style={{ position: 'absolute', top: '12%', right: '14%', width: '60%', height: '32%', background: '#030610', border: '3px solid #1a1f35', borderRadius: '14px', boxShadow: 'inset 0 0 25px rgba(0,0,0,0.95)' }}>
                    <div style={{ position: 'absolute', top: '8%', left: '8%', width: '30%', height: '25%', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', filter: 'blur(3px)' }} />
                  </div>
                  <div style={{ position: 'absolute', top: '56%', right: '10%', width: 6, height: 45, background: 'linear-gradient(to bottom, #252d50, #1a1f35)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)' }} />
                  <div style={{ position: 'absolute', right: 0, top: '4%', height: '92%', width: 2, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)' }} />
                </div>
              </div>

              {/* Puerta derecha */}
              <div style={{
                position: 'absolute', right: 0, top: 0, width: '50%', height: '100%',
                transform: doorsOpen ? 'translateX(100%)' : 'translateX(0)',
                transition: doorsOpen ? 'transform 1.5s ease-in-out' : 'none',
              }}>
                <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'linear-gradient(80deg, #141c38, #111730 20%, #0e1328 60%, #0a0e1c)', borderLeft: '1px solid #1e2540' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(255,255,255,0.01) 4px, rgba(255,255,255,0.01) 5px)' }} />
                  <div style={{ position: 'absolute', top: '12%', left: '14%', width: '60%', height: '32%', background: '#030610', border: '3px solid #1a1f35', borderRadius: '14px', boxShadow: 'inset 0 0 25px rgba(0,0,0,0.95)' }}>
                    <div style={{ position: 'absolute', top: '8%', left: '8%', width: '30%', height: '25%', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', filter: 'blur(3px)' }} />
                  </div>
                  <div style={{ position: 'absolute', top: '56%', left: '10%', width: 6, height: 45, background: 'linear-gradient(to bottom, #252d50, #1a1f35)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)' }} />
                  <div style={{ position: 'absolute', left: 0, top: '4%', height: '92%', width: 2, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Vagones 6-10 */}
          {[6, 7, 8, 9, 10].map(i => (
            <div key={`R${i}`} style={{
              width: '14vw', minWidth: '130px', height: '100%', background: trainBg,
              borderTop: '3px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, position: 'relative', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4)',
            }}>
              <div style={{ position: 'absolute', left: 0, top: '8%', height: '84%', width: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'absolute', top: '72%', left: 0, width: '100%', height: '2px', background: trimColor, opacity: 0.5, boxShadow: `0 0 10px ${trimColor}` }} />
              <div style={{ width: '70%', height: '42%', background: '#040710', border: '3px solid #1a1f35', borderRadius: '18px', boxShadow: 'inset 0 0 25px rgba(0,0,0,0.95)', position: 'relative', marginTop: '-15%' }}>
                <div style={{ position: 'absolute', top: '8%', left: '8%', width: '30%', height: '25%', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', filter: 'blur(3px)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Línea inferior */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, transparent, #1a1f35, transparent)' }} />
    </section>
  );
}
