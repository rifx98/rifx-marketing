"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ContactChannels from './components/ContactChannels';
import EntryAnimation from './components/EntryAnimation';
import FunnelSection from './components/FunnelSection';
import { motion, useScroll, useTransform } from 'framer-motion';

import TrainCTA from './components/TrainCTA';
import { ScrollyContainer } from "./components/ScrollyContainer";
import AnimatedText from './components/AnimatedText';
import ParticleCanvas from './components/ParticleCanvas';

export default function HomeClient() {
  const [showIntro, setShowIntro] = useState(true);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const tiltCardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hook para desvanecer y reducir escala del logo 2D en scroll para revelar la dispersión 3D
  const { scrollY } = useScroll();
  const logoOpacity = useTransform(scrollY, [0, 200], [1, 0]);
  const logoScale = useTransform(scrollY, [0, 200], [1, 0.8]);

  useEffect(() => {
    // Bloquear scroll mientras se muestra la animación
    document.body.style.overflow = 'hidden';
    
    // Sincronizado con la animación más sutil y detallada (3.5s)
    const timer = setTimeout(() => {
      setShowIntro(false);
      document.body.style.overflow = 'auto'; // Restaurar scroll
    }, 3500);

    // Mouse movement tracker for 3D parallax
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      const y = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
      mousePosRef.current = { x, y };

      if (tiltCardRef.current) {
        tiltCardRef.current.style.transform = `perspective(1000px) rotateY(${x * 30}deg) rotateX(${y * -30}deg) translateZ(30px)`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = 'auto';
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);





  // Scroll calculations removed (now using whileInView)
  return (
    <>
      {showIntro && <EntryAnimation />}
      {/* Fondo 3D de partículas — solo en home */}
      <ParticleCanvas />
      {/* Main Content */}


      <main className="pt-25">
        <style jsx global>{`
          /* Estilo para que el ícono del calendario se vea naranja y combine con el tema */
          input[type="date"]::-webkit-calendar-picker-indicator {
            cursor: pointer;
            filter: invert(53%) sepia(91%) saturate(2371%) hue-rotate(345deg) brightness(97%) contrast(93%);
            transition: transform 0.3s ease;
          }
          input[type="date"]:hover::-webkit-calendar-picker-indicator {
            transform: scale(1.2);
          }
        `}</style>

{/* Hero Section */}
        <section className="bg-transparent pt-28 pb-16 lg:pt-32 lg:pb-20 relative overflow-hidden curved-divider">

          <div className="container mx-auto px-6 flex flex-col lg:flex-row items-center relative z-10 min-h-[85vh]">
            {/* Left Content: Headline & Form */}
            <div className="w-full lg:w-7/12 z-10 text-center lg:text-left pt-6 lg:pt-0">
              <AnimatedText as="h1" className="text-white text-5xl md:text-7xl lg:text-[9rem] font-space-grotesk font-black tracking-tighter mb-4 lg:mb-2 leading-[0.95] lg:leading-[0.85] uppercase drop-shadow-2xl" stagger={30} delay={3600} mode="letter">
                TU MARCA EN ÓRBITA
              </AnimatedText>
              <p className="text-gray-300 text-base md:text-2xl mt-6 mb-8 lg:mt-8 lg:mb-10 max-w-2xl mx-auto lg:mx-0 font-inter font-light tracking-wide px-4 lg:px-0">
                Marketing digital inmersivo que domina el mercado. Diseñamos experiencias que no se ignoran.
              </p>

              {/* CTA Button */}
              <div className="max-w-md mx-auto lg:mx-0 mt-8 flex gap-4 justify-center lg:justify-start">
                <button
                  onClick={() => document.getElementById('train-cta')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-rocket-orange text-white font-black px-8 py-4 md:px-10 md:py-5 rounded-full hover-rocket-orange transition-all shadow-[0_0_30px_rgba(242,113,33,0.4)] hover:shadow-[0_0_60px_rgba(242,113,33,0.8)] flex items-center justify-center gap-2 md:gap-3 text-lg md:text-xl hover:scale-105 active:scale-95 border border-white/20 w-[90%] md:w-auto mx-auto lg:mx-0"
                >
                  INICIAR SECUENCIA <span className="material-symbols-outlined font-bold text-xl md:text-2xl">rocket_launch</span>
                </button>
              </div>
            </div>

            {/* Right Content: 3D Particle Canvas takes care of the illustration */}
            <div className="w-full lg:w-5/12 mt-16 lg:mt-0 relative flex justify-center items-center z-10 pointer-events-none">
              {/* Espacio reservado para que el layout se mantenga, el logo 3D est de fondo */}
              <div className="w-full max-w-[320px] md:max-w-xl aspect-square"></div>
            </div>
          </div>
        </section>

        <div className="relative z-10">
        {/* Mission Section */}
        <section className="py-16 lg:py-24 bg-transparent" data-purpose="mission-section">
          <div className="container mx-auto px-6 flex flex-col lg:flex-row-reverse items-center gap-10 lg:gap-12 text-center lg:text-left">
            {/* Left side text */}
            <div className="w-full lg:w-1/2">
              <span className="text-rocket-orange font-bold uppercase tracking-widest text-xs lg:text-sm">QUIÉNES SOMOS</span>
              <AnimatedText as="h2" className="text-3xl lg:text-4xl font-black text-white mt-2 mb-4 drop-shadow-lg" stagger={40} delay={100} mode="word">
                Impulsamos Marcas que Dominan su Mercado
              </AnimatedText>
              <p className="text-lg lg:text-xl text-rocket-orange font-semibold mb-6">Estrategia + Creatividad + Tecnología = <span className="text-white">Resultados Imparables.</span></p>
              <p className="text-gray-300 leading-relaxed mb-8 text-sm md:text-base">
                Somos una agencia de marketing digital especializada en escalar negocios a través de campañas de alto rendimiento, automatización con inteligencia artificial y experiencias digitales que convierten visitantes en clientes. No hacemos marketing genérico — diseñamos sistemas de crecimiento a medida para cada marca.
              </p>
              <Link className="inline-block bg-rocket-orange text-white px-8 py-3 rounded-full font-bold shadow-lg hover-rocket-orange transition text-base" href="/sobre-nosotros">
                Descubre Nuestra Historia 🚀
              </Link>
            </div>
            {/* Right side image (Control Room) */}
            <div className="w-full lg:w-1/2">
              <div className="">
                <img
                  alt="Alien and astronaut sitting together showing peace signs"
                  className="w-full max-w-md mx-auto h-auto object-contain opacity-0"
                  src="/images/alien-astronaut.png"
                />
              </div>
            </div>
          </div>
        </section>

        <FunnelSection />

        {/* Testimonials Section */}
        <section className="py-16 lg:py-24 bg-transparent overflow-hidden" data-purpose="testimonials">
          <div className="container mx-auto px-6 text-center mb-16">
            <span className="text-rocket-orange font-bold uppercase tracking-widest text-xs lg:text-sm">TESTIMONIOS</span>
            <AnimatedText as="h2" className="text-white text-3xl lg:text-4xl font-black px-4 mt-2 drop-shadow-lg" stagger={40} delay={100} mode="word">
              Lo que Dicen Nuestros Clientes
            </AnimatedText>
            <p className="text-gray-400 text-sm mt-3 max-w-xl mx-auto">Empresas reales que han escalado sus resultados con nuestras estrategias de marketing digital.</p>
          </div>
          
          <div className="relative group">
            {/* Gradient Masks for edges */}
            <div className="absolute inset-y-0 left-0 w-24 md:w-48 bg-gradient-to-r from-[#020510] to-transparent z-10 pointer-events-none"></div>
            <div className="absolute inset-y-0 right-0 w-24 md:w-48 bg-gradient-to-l from-[#020510] to-transparent z-10 pointer-events-none"></div>

            <div className="flex animate-infinite-scroll hover-pause whitespace-nowrap w-max gap-8 px-4">
              {/* Bloque 1 */}
              <div className="flex gap-8 items-center pr-8">
                {[
                  { name: "Andrés Mendoza", role: "CEO, TechVentures", text: "Desde que trabajamos con RIFX, nuestro costo por lead en Google Ads bajó un 62%. Su equipo entiende la conversión como nadie — cada dólar invertido genera retorno real.", img: "https://randomuser.me/api/portraits/men/32.jpg", stars: 5 },
                  { name: "Valentina Herrera", role: "Directora de Marketing, Bloom", text: "La automatización con IA de WhatsApp nos permitió atender 3x más clientes sin contratar personal adicional. Literalmente transforma tu operación comercial.", img: "https://randomuser.me/api/portraits/women/44.jpg", stars: 5 },
                  { name: "Ricardo Salazar", role: "Fundador, NovaTrade", text: "Nos diseñaron una página corporativa que transmite confianza desde el primer segundo. Los clientes ahora nos contactan directamente desde la web.", img: "https://randomuser.me/api/portraits/men/75.jpg", stars: 5 },
                  { name: "Camila Rivas", role: "E-commerce Manager, ModaEC", text: "Nuestra tienda en WooCommerce facturó un 140% más en el primer trimestre. Diseño impecable, pasarelas integradas y un soporte que siempre responde.", img: "https://randomuser.me/api/portraits/women/68.jpg", stars: 5 },
                  { name: "Diego Paredes", role: "COO, CloudServ Latam", text: "Probamos 3 agencias antes de RIFX. Son los únicos que nos mostraron un dashboard con métricas reales de nuestras campañas desde el día 1.", img: "https://randomuser.me/api/portraits/men/52.jpg", stars: 5 },
                  { name: "Mariana López", role: "Fundadora, Bella Estética", text: "Con sus campañas en Instagram y Facebook llenamos la agenda del salón en 2 semanas. Antes publicábamos sin estrategia, ahora cada anuncio convierte.", img: "https://randomuser.me/api/portraits/women/33.jpg", stars: 5 },
                  { name: "Sebastián Torres", role: "Gerente, ImportMax", text: "El chatbot de WhatsApp responde cotizaciones automáticamente las 24 horas. Nuestros clientes reciben precios al instante y cerramos ventas hasta de madrugada.", img: "https://randomuser.me/api/portraits/men/41.jpg", stars: 5 },
                  { name: "Patricia Mora", role: "Directora, Clínica Dental Sonríe", text: "Nos crearon una web profesional con sistema de citas integrado. Los pacientes agendan solos y reciben recordatorios por WhatsApp. ¡Genial!", img: "https://randomuser.me/api/portraits/women/57.jpg", stars: 5 },
                  { name: "Fernando Castillo", role: "CEO, GourmetBox", text: "Nuestra tienda WooCommerce ahora procesa 300+ pedidos al mes. La integración con envíos y pagos fue perfecta. RIFX entiende el e-commerce de verdad.", img: "https://randomuser.me/api/portraits/men/22.jpg", stars: 5 },
                  { name: "Laura Quintero", role: "CMO, Fintech Rapid", text: "Las campañas de TikTok Ads que diseñaron nos trajeron 4,500 descargas de la app en un solo mes. ROI que no habíamos visto con ninguna otra agencia.", img: "https://randomuser.me/api/portraits/women/26.jpg", stars: 5 },
                  { name: "Héctor Vargas", role: "Propietario, AutoTaller Express", text: "Nunca pensé que WhatsApp pudiera vender por mí. El bot agenda citas, envía presupuestos y hasta da seguimiento post-servicio. Mis clientes están encantados.", img: "https://randomuser.me/api/portraits/men/64.jpg", stars: 5 },
                  { name: "Sofía Delgado", role: "Fundadora, EcoModa Store", text: "Mi página web antes era un desastre. RIFX la rediseñó con WooCommerce, la conectó con Meta Ads y en 60 días triplicamos las ventas online.", img: "https://randomuser.me/api/portraits/women/85.jpg", stars: 5 }
                ].map((t, i) => (
                  <div key={i} className="inline-block w-[320px] md:w-[420px] whitespace-normal">
                    <div className="bg-[#181e36] text-white p-6 md:p-8 rounded-2xl h-full border border-white/5 shadow-2xl flex flex-col gap-5 hover:border-rocket-orange/30 transition-all duration-300">
                      {/* Stars */}
                      <div className="flex gap-1">
                        {[...Array(t.stars)].map((_, s) => (
                          <span key={s} className="text-yellow-400 text-sm">★</span>
                        ))}
                      </div>
                      {/* Text Content */}
                      <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                        &ldquo;{t.text}&rdquo;
                      </p>
                      {/* Header: Avatar, Name, Role */}
                      <div className="flex items-center gap-4 mt-auto pt-4 border-t border-white/5">
                        <img alt={t.name} className="w-12 h-12 rounded-full object-cover shadow-md ring-2 ring-rocket-orange/20" src={t.img} />
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm md:text-base">{t.name}</span>
                          <span className="text-gray-400 text-xs">{t.role}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Bloque 2 (Duplicado para loop infinito) */}
              <div className="flex gap-8 items-center pr-8">
                {[
                  { name: "Andrés Mendoza", role: "CEO, TechVentures", text: "Desde que trabajamos con RIFX, nuestro costo por lead en Google Ads bajó un 62%. Su equipo entiende la conversión como nadie — cada dólar invertido genera retorno real.", img: "https://randomuser.me/api/portraits/men/32.jpg", stars: 5 },
                  { name: "Valentina Herrera", role: "Directora de Marketing, Bloom", text: "La automatización con IA de WhatsApp nos permitió atender 3x más clientes sin contratar personal adicional. Literalmente transforma tu operación comercial.", img: "https://randomuser.me/api/portraits/women/44.jpg", stars: 5 },
                  { name: "Ricardo Salazar", role: "Fundador, NovaTrade", text: "Nos diseñaron una página corporativa que transmite confianza desde el primer segundo. Los clientes ahora nos contactan directamente desde la web.", img: "https://randomuser.me/api/portraits/men/75.jpg", stars: 5 },
                  { name: "Camila Rivas", role: "E-commerce Manager, ModaEC", text: "Nuestra tienda en WooCommerce facturó un 140% más en el primer trimestre. Diseño impecable, pasarelas integradas y un soporte que siempre responde.", img: "https://randomuser.me/api/portraits/women/68.jpg", stars: 5 },
                  { name: "Diego Paredes", role: "COO, CloudServ Latam", text: "Probamos 3 agencias antes de RIFX. Son los únicos que nos mostraron un dashboard con métricas reales de nuestras campañas desde el día 1.", img: "https://randomuser.me/api/portraits/men/52.jpg", stars: 5 },
                  { name: "Mariana López", role: "Fundadora, Bella Estética", text: "Con sus campañas en Instagram y Facebook llenamos la agenda del salón en 2 semanas. Antes publicábamos sin estrategia, ahora cada anuncio convierte.", img: "https://randomuser.me/api/portraits/women/33.jpg", stars: 5 },
                  { name: "Sebastián Torres", role: "Gerente, ImportMax", text: "El chatbot de WhatsApp responde cotizaciones automáticamente las 24 horas. Nuestros clientes reciben precios al instante y cerramos ventas hasta de madrugada.", img: "https://randomuser.me/api/portraits/men/41.jpg", stars: 5 },
                  { name: "Patricia Mora", role: "Directora, Clínica Dental Sonríe", text: "Nos crearon una web profesional con sistema de citas integrado. Los pacientes agendan solos y reciben recordatorios por WhatsApp. ¡Genial!", img: "https://randomuser.me/api/portraits/women/57.jpg", stars: 5 },
                  { name: "Fernando Castillo", role: "CEO, GourmetBox", text: "Nuestra tienda WooCommerce ahora procesa 300+ pedidos al mes. La integración con envíos y pagos fue perfecta. RIFX entiende el e-commerce de verdad.", img: "https://randomuser.me/api/portraits/men/22.jpg", stars: 5 },
                  { name: "Laura Quintero", role: "CMO, Fintech Rapid", text: "Las campañas de TikTok Ads que diseñaron nos trajeron 4,500 descargas de la app en un solo mes. ROI que no habíamos visto con ninguna otra agencia.", img: "https://randomuser.me/api/portraits/women/26.jpg", stars: 5 },
                  { name: "Héctor Vargas", role: "Propietario, AutoTaller Express", text: "Nunca pensé que WhatsApp pudiera vender por mí. El bot agenda citas, envía presupuestos y hasta da seguimiento post-servicio. Mis clientes están encantados.", img: "https://randomuser.me/api/portraits/men/64.jpg", stars: 5 },
                  { name: "Sofía Delgado", role: "Fundadora, EcoModa Store", text: "Mi página web antes era un desastre. RIFX la rediseñó con WooCommerce, la conectó con Meta Ads y en 60 días triplicamos las ventas online.", img: "https://randomuser.me/api/portraits/women/85.jpg", stars: 5 }
                ].map((t, i) => (
                  <div key={i} className="inline-block w-[320px] md:w-[420px] whitespace-normal">
                    <div className="bg-[#181e36] text-white p-6 md:p-8 rounded-2xl h-full border border-white/5 shadow-2xl flex flex-col gap-5 hover:border-rocket-orange/30 transition-all duration-300">
                      {/* Stars */}
                      <div className="flex gap-1">
                        {[...Array(t.stars)].map((_, s) => (
                          <span key={s} className="text-yellow-400 text-sm">★</span>
                        ))}
                      </div>
                      {/* Text Content */}
                      <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                        &ldquo;{t.text}&rdquo;
                      </p>
                      {/* Header: Avatar, Name, Role */}
                      <div className="flex items-center gap-4 mt-auto pt-4 border-t border-white/5">
                        <img alt={t.name} className="w-12 h-12 rounded-full object-cover shadow-md ring-2 ring-rocket-orange/20" src={t.img} />
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm md:text-base">{t.name}</span>
                          <span className="text-gray-400 text-xs">{t.role}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Partners / Brands Section (Carousel) */}
        <section className="bg-transparent py-16 overflow-hidden border-y border-white/10 relative" data-purpose="partners-section">
          <div className="absolute inset-0 bg-white/5 backdrop-blur-sm -z-10"></div>
          <div className="container mx-auto px-6 mb-12">
            <p className="text-center text-[10px] md:text-xs text-gray-500 uppercase tracking-[0.5em] font-black drop-shadow-md">Marcas que ya están en órbita con nosotros</p>
          </div>
          
          <div className="relative overflow-hidden group">
            {/* Gradient Masks for edges */}
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#020510] to-transparent z-10 pointer-events-none"></div>
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#020510] to-transparent z-10 pointer-events-none"></div>
            
            <div className="flex animate-infinite-scroll-reverse whitespace-nowrap items-center w-max">
              {/* Bloque 1 */}
              <div className="flex gap-16 md:gap-32 items-center pr-16 md:pr-32">
                {["Meta", "Google Ads", "TikTok Ads", "Shopify", "Amazon", "WooCommerce", "Hotmart", "Vtex"].map((brand, index) => (
                  <div key={`b1-${index}`} className="text-2xl md:text-5xl font-black text-gray-300/40 tracking-tighter hover:text-rocket-orange transition-all duration-500 cursor-default grayscale hover:grayscale-0 hover:opacity-100">
                    {brand}
                  </div>
                ))}
              </div>
              {/* Bloque 2 (Espejo exacto con el mismo padding final) */}
              <div className="flex gap-16 md:gap-32 items-center pr-16 md:pr-32">
                {["Meta", "Google Ads", "TikTok Ads", "Shopify", "Amazon", "WooCommerce", "Hotmart", "Vtex"].map((brand, index) => (
                  <div key={`b2-${index}`} className="text-2xl md:text-5xl font-black text-gray-300/40 tracking-tighter hover:text-rocket-orange transition-all duration-500 cursor-default grayscale hover:grayscale-0 hover:opacity-100">
                    {brand}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="py-16 lg:py-24 bg-transparent" data-purpose="process-section">
          <div className="container mx-auto px-6">
            <AnimatedText as="h2" className="text-center text-white text-2xl lg:text-3xl font-black mb-16 lg:mb-24 uppercase tracking-tight drop-shadow-lg" stagger={38} delay={100}>
              TU RUTA AL LANZAMIENTO EXITOSO
            </AnimatedText>
            
            <div className="flex flex-col gap-16 md:gap-24 relative w-full max-w-5xl mx-auto">
              {/* Connecting Line Background (Vertical line in the middle) */}
              <div className="hidden md:block absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/10 -z-10 transform -translate-x-1/2"></div>
              
              {/* Step 1 - Left */}
              <div className="w-full flex justify-start">
                <div className="w-full md:w-[45%] text-center md:text-right group">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl mx-auto md:ml-auto md:mr-0 flex items-center justify-center mb-4 lg:mb-6 group-hover:border-rocket-orange group-hover:shadow-[0_0_30px_rgba(242,113,33,0.3)] transition-all">
                    <span className="text-3xl md:text-4xl">🔭</span>
                  </div>
                  <h4 className="font-bold text-white text-xl mb-2">1. Análisis Cósmico</h4>
                  <p className="text-gray-400 text-base md:pl-8">Estudiamos tu situación actual y el mercado objetivo.</p>
                </div>
              </div>

              {/* Step 2 - Right */}
              <div className="w-full flex justify-end">
                <div className="w-full md:w-[45%] text-center md:text-left group">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl mx-auto md:mr-auto md:ml-0 flex items-center justify-center mb-4 lg:mb-6 group-hover:border-rocket-orange group-hover:shadow-[0_0_30px_rgba(242,113,33,0.3)] transition-all">
                    <span className="text-3xl md:text-4xl">🚀</span>
                  </div>
                  <h4 className="font-bold text-white text-xl mb-2">2. Estrategia Orbital</h4>
                  <p className="text-gray-400 text-base md:pr-8">Diseñamos el plan de ataque para el despegue.</p>
                </div>
              </div>

              {/* Step 3 - Left */}
              <div className="w-full flex justify-start">
                <div className="w-full md:w-[45%] text-center md:text-right group">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl mx-auto md:ml-auto md:mr-0 flex items-center justify-center mb-4 lg:mb-6 group-hover:border-rocket-orange group-hover:shadow-[0_0_30px_rgba(242,113,33,0.3)] transition-all">
                    <span className="text-3xl md:text-4xl">🔥</span>
                  </div>
                  <h4 className="font-bold text-white text-xl mb-2">3. Lanzamiento y Optimización</h4>
                  <p className="text-gray-400 text-base md:pl-8">Ejecutamos y ajustamos para resultados máximos.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <TrainCTA />
        </div>
      </main>
      <ContactChannels onlyModal={true} />
    </>
  );
}