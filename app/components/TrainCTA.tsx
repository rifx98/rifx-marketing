'use client';

import React, { useState, useRef, useEffect } from 'react';
import Hyperspeed from './Hyperspeed';

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

  const trainBg = '#111111';
  const trimColor = '#F27121';
  const wagonWidth = 'clamp(320px, 26vw, 450px)';
  const cartelWidth = 'clamp(480px, 42vw, 700px)';

  return (
    <section id="train-cta" ref={sectionRef} style={{
      padding: '100px 0', background: '#0C0C0C', overflow: 'hidden',
      minHeight: '620px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
    }}>
      {/* Decoración estación */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 60%, rgba(255,255,255,0.03) 0%, transparent 60%)', pointerEvents: 'none' }} />
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
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          width: cartelWidth, height: '100%', zIndex: isClickable ? 50 : 15,
          opacity: doorsOpen ? 1 : 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '24px',
          overflow: 'hidden',
          background: '#050505', // Fondo base oscuro
          transition: 'opacity 0.1s', // Rápido para que esté listo cuando se abran las puertas
        }}>

          {/* Hyperspeed Background Effect */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <Hyperspeed
              effectOptions={{
                distortion: 'turbulentDistortion',
                length: 400,
                roadWidth: 10,
                islandWidth: 2,
                lanesPerRoad: 4,
                fov: 90,
                fovSpeedUp: 150,
                speedUp: 2,
                carLightsFade: 0.4,
                totalSideLightSticks: 20,
                lightPairsPerRoadWay: 40,
                shoulderLinesWidthPercentage: 0.05,
                brokenLinesWidthPercentage: 0.1,
                brokenLinesLengthPercentage: 0.5,
                lightStickWidth: [0.12, 0.5],
                lightStickHeight: [1.3, 1.7],
                movingAwaySpeed: [60, 80],
                movingCloserSpeed: [-120, -160],
                carLightsLength: [400 * 0.03, 400 * 0.2],
                carLightsRadius: [0.05, 0.14],
                carWidthPercentage: [0.3, 0.5],
                carShiftX: [-0.8, 0.8],
                carFloorSeparation: [0, 5],
                colors: {
                  roadColor: 0x080808,
                  islandColor: 0x0a0a0a,
                  background: 0x000000,
                  shoulderLines: 0xffffff,
                  brokenLines: 0xffffff,
                  leftCars: [0xd856bf, 0x6750a2, 0xc247ac],
                  rightCars: [0x03b3c3, 0x0e5ea5, 0x324555],
                  sticks: 0x03b3c3,
                }
              }}
            />
          </div>

          {/* Sombra central para que las letras se lean perfecto */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at center, rgba(17,17,17,0.6) 0%, rgba(5,5,5,0.9) 100%)',
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
          position: 'absolute', left: '50%', height: '100%',
          display: 'flex', alignItems: 'stretch', zIndex: 30,
          transition: isMoving ? 'transform 3.2s cubic-bezier(0.15, 0.6, 0.2, 1)' : 'none',
          transform: isMoving ? 'translateX(-50%)' : 'translateX(calc(-50% + 150vw))',
          pointerEvents: doorsOpen ? 'none' : 'auto',
        }}>

          {/* ══ FRENTE TREN BALA ══ */}
          <div style={{
            width: 'clamp(220px, 28vw, 380px)', height: '100%', flexShrink: 0,
            position: 'relative',
          }}>
            {/* Cuerpo principal con punta aerodinámica */}
            <div style={{
              width: '100%', height: '100%', position: 'absolute', top: 0, left: 0,
              background: `linear-gradient(100deg, #181818 0%, #141414 30%, ${trainBg} 75%)`,
              clipPath: 'polygon(0% 50%, 18% 15%, 40% 3%, 100% 0%, 100% 100%, 5% 100%, 0% 80%)',
              boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)',
            }}>
              {/* Gradiente metálico sobre la superficie */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 15%, transparent 85%, rgba(255,255,255,0.03) 100%)',
                clipPath: 'inherit',
              }} />

              {/* Línea superior del techo */}
              <div style={{
                position: 'absolute', top: '3%', left: '38%', width: '62%', height: '2px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
              }} />

              {/* ── Parabrisas envolvente ── */}
              <div style={{
                position: 'absolute', top: '15%', left: '22%', width: '42%', height: '30%',
                background: 'linear-gradient(155deg, #0a0a18 0%, #060612 40%, #030308 100%)',
                border: '2px solid #252530',
                borderRadius: '4px 6px 6px 20px',
                boxShadow: 'inset 0 0 20px rgba(0,0,10,0.95), 0 0 12px rgba(0,0,0,0.6)',
                transform: 'perspective(300px) rotateY(4deg)',
                overflow: 'hidden',
              }}>
                {/* Reflejo diagonal */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '60%', height: '100%',
                  background: 'linear-gradient(130deg, rgba(255,255,255,0.07) 0%, transparent 50%)',
                }} />
                {/* Reflejo inferior */}
                <div style={{
                  position: 'absolute', bottom: '10%', right: '10%', width: '30%', height: '15%',
                  background: 'rgba(100,120,255,0.03)', borderRadius: '4px', filter: 'blur(3px)',
                }} />
              </div>

              {/* Ventanilla lateral pequeña */}
              <div style={{
                position: 'absolute', top: '18%', right: '12%', width: '20%', height: '22%',
                background: '#050508', border: '2px solid #1F1F1F', borderRadius: '10px',
                boxShadow: 'inset 0 0 15px rgba(0,0,0,0.9)',
              }}>
                <div style={{
                  position: 'absolute', top: '8%', left: '8%', width: '35%', height: '25%',
                  background: 'rgba(255,255,255,0.03)', borderRadius: '4px', filter: 'blur(2px)',
                }} />
              </div>

              {/* ── Franja naranja única (alineada con vagones al 72%) ── */}
              <div style={{
                position: 'absolute', top: '72%', left: '8%', width: '92%', height: '2px',
                background: `linear-gradient(90deg, transparent 0%, ${trimColor} 15%, ${trimColor} 100%)`,
                opacity: 0.5, boxShadow: `0 0 10px ${trimColor}`,
              }} />

              {/* ── Zona inferior (faldón) ── */}
              <div style={{
                position: 'absolute', bottom: 0, left: '10%', width: '90%', height: '20%',
                background: 'linear-gradient(180deg, rgba(15,15,15,0.9), rgba(8,8,8,0.95))',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                borderRadius: '0 0 0 12px',
              }}>
                {/* Grilla de ventilación */}
                <div style={{
                  position: 'absolute', top: '15%', left: '5%', width: '50%', height: '40%',
                  overflow: 'hidden', borderRadius: '3px',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{
                    width: '100%', height: '100%',
                    backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 4px)',
                    backgroundSize: '4px 100%',
                  }} />
                </div>
              </div>

              {/* ── Faros ── */}
              {/* Faro principal LED */}
              <div style={{
                position: 'absolute', top: '67%', left: '10%', width: '16px', height: '6px',
                borderRadius: '3px',
                background: 'linear-gradient(90deg, #FFFDE7, #FFF8E1 50%, #F27121)',
                boxShadow: '0 0 15px 5px rgba(255,253,231,0.3), 0 0 40px 10px rgba(242,113,33,0.15)',
              }} />
              {/* Faro inferior */}
              <div style={{
                position: 'absolute', top: '78%', left: '12%', width: '10px', height: '5px',
                borderRadius: '2px',
                background: 'radial-gradient(ellipse, #FFF8E1 20%, #F27121 70%, transparent 100%)',
                boxShadow: '0 0 8px 3px rgba(242,113,33,0.35)',
              }} />
              {/* Piloto rojo trasero (abajo) */}
              <div style={{
                position: 'absolute', bottom: '10%', left: '16%', width: '5px', height: '5px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #ff4444, #aa0000)',
                boxShadow: '0 0 6px 2px rgba(255,0,0,0.25)',
              }} />

              {/* ── Líneas aerodinámicas decorativas ── */}
              {/* Línea que sigue la curva superior */}
              <div style={{
                position: 'absolute', top: '12%', left: '15%', width: '85%', height: '1px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03) 60%, transparent)',
                transform: 'rotate(-2deg)', transformOrigin: 'right center',
              }} />
              {/* Línea media */}
              <div style={{
                position: 'absolute', top: '42%', left: '5%', width: '95%', height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.03))',
              }} />
              {/* Línea curva inferior */}
              <div style={{
                position: 'absolute', bottom: '12%', left: '18%', width: '82%', height: '1px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                transform: 'rotate(1deg)', transformOrigin: 'right center',
              }} />

              {/* Marca RFX sutil */}
              <div style={{
                position: 'absolute', top: '55%', right: '14%', fontSize: 'clamp(6px, 0.8vw, 10px)',
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900,
                color: 'rgba(255,255,255,0.08)', letterSpacing: '0.2em',
              }}>RFX</div>

              {/* Borde luminoso en el perfil izquierdo (nariz) */}
              <div style={{
                position: 'absolute', top: '20%', left: '1%', width: '2px', height: '60%',
                background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.08), rgba(255,255,255,0.1), rgba(255,255,255,0.08), transparent)',
                borderRadius: '1px', filter: 'blur(0.5px)',
              }} />
            </div>
          </div>

          {/* Vagones 1-5 */}
          {[1, 2, 3, 4, 5].map(i => (
            <div key={`L${i}`} style={{
              width: wagonWidth, height: '100%', background: trainBg,
              borderTop: '3px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, position: 'relative', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4)',
            }}>
              <div style={{ position: 'absolute', right: 0, top: '8%', height: '84%', width: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'absolute', top: '72%', left: 0, width: '100%', height: '2px', background: trimColor, opacity: 0.5, boxShadow: `0 0 10px ${trimColor}` }} />
              <div style={{ width: '70%', height: '42%', background: '#050505', border: '3px solid #1F1F1F', borderRadius: '18px', boxShadow: 'inset 0 0 25px rgba(0,0,0,0.95)', position: 'relative', marginTop: '-15%' }}>
                <div style={{ position: 'absolute', top: '8%', left: '8%', width: '30%', height: '25%', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', filter: 'blur(3px)' }} />
              </div>
            </div>
          ))}

          {/* ══ PUERTA ASCENSOR ══ */}
          <div style={{
            width: cartelWidth, height: '100%', flexShrink: 0, position: 'relative',
            background: 'transparent', borderTop: '3px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Trim line */}
            <div style={{ position: 'absolute', top: '72%', left: 0, width: '100%', height: '2px', background: trimColor, opacity: doorsOpen ? 0 : 0.5, boxShadow: `0 0 8px ${trimColor}`, zIndex: 36, pointerEvents: 'none', transition: 'opacity 0.5s' }} />


            {/* Marco */}
            <div style={{ width: '100%', height: '100%', position: 'relative', borderLeft: '3px solid #1F1F1F', borderRight: '3px solid #1F1F1F', boxSizing: 'border-box', background: 'transparent', overflow: 'hidden' }}>

              {/* Puerta izquierda */}
              <div style={{
                position: 'absolute', left: 0, top: 0, width: '50%', height: '100%',
                transform: doorsOpen ? 'translateX(-100%)' : 'translateX(0)',
                transition: doorsOpen ? 'transform 1.5s ease-in-out' : 'none',
              }}>
                <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'linear-gradient(100deg, #0A0A0A, #111111 40%, #181818 80%, #1C1C1C)', borderRight: '1px solid #2A2A2A' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(255,255,255,0.01) 4px, rgba(255,255,255,0.01) 5px)' }} />
                  <div style={{ position: 'absolute', top: '12%', right: '14%', width: '60%', height: '32%', background: '#050505', border: '3px solid #1F1F1F', borderRadius: '14px', boxShadow: 'inset 0 0 25px rgba(0,0,0,0.95)' }}>
                    <div style={{ position: 'absolute', top: '8%', left: '8%', width: '30%', height: '25%', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', filter: 'blur(3px)' }} />
                  </div>
                  <div style={{ position: 'absolute', top: '56%', right: '10%', width: 6, height: 45, background: 'linear-gradient(to bottom, #333333, #1F1F1F)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)' }} />
                  <div style={{ position: 'absolute', right: 0, top: '4%', height: '92%', width: 2, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)' }} />
                </div>
              </div>

              {/* Puerta derecha */}
              <div style={{
                position: 'absolute', right: 0, top: 0, width: '50%', height: '100%',
                transform: doorsOpen ? 'translateX(100%)' : 'translateX(0)',
                transition: doorsOpen ? 'transform 1.5s ease-in-out' : 'none',
              }}>
                <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'linear-gradient(80deg, #1C1C1C, #181818 20%, #111111 60%, #0A0A0A)', borderLeft: '1px solid #2A2A2A' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(255,255,255,0.01) 4px, rgba(255,255,255,0.01) 5px)' }} />
                  <div style={{ position: 'absolute', top: '12%', left: '14%', width: '60%', height: '32%', background: '#050505', border: '3px solid #1F1F1F', borderRadius: '14px', boxShadow: 'inset 0 0 25px rgba(0,0,0,0.95)' }}>
                    <div style={{ position: 'absolute', top: '8%', left: '8%', width: '30%', height: '25%', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', filter: 'blur(3px)' }} />
                  </div>
                  <div style={{ position: 'absolute', top: '56%', left: '10%', width: 6, height: 45, background: 'linear-gradient(to bottom, #333333, #1F1F1F)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)' }} />
                  <div style={{ position: 'absolute', left: 0, top: '4%', height: '92%', width: 2, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Vagones 6-10 */}
          {[6, 7, 8, 9, 10].map(i => (
            <div key={`R${i}`} style={{
              width: wagonWidth, height: '100%', background: trainBg,
              borderTop: '3px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, position: 'relative', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4)',
            }}>
              <div style={{ position: 'absolute', left: 0, top: '8%', height: '84%', width: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'absolute', top: '72%', left: 0, width: '100%', height: '2px', background: trimColor, opacity: 0.5, boxShadow: `0 0 10px ${trimColor}` }} />
              <div style={{ width: '70%', height: '42%', background: '#050505', border: '3px solid #1F1F1F', borderRadius: '18px', boxShadow: 'inset 0 0 25px rgba(0,0,0,0.95)', position: 'relative', marginTop: '-15%' }}>
                <div style={{ position: 'absolute', top: '8%', left: '8%', width: '30%', height: '25%', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', filter: 'blur(3px)' }} />
              </div>
            </div>
          ))}

          {/* Spacer to make the train symmetric so the doors are perfectly centered */}
          <div style={{ width: 'clamp(220px, 28vw, 380px)', flexShrink: 0 }} />
        </div>
      </div>

    </section>
  );
}
