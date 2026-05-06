"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import ContactChannels from './components/ContactChannels';
import EntryAnimation from './components/EntryAnimation';

import TrainCTA from './components/TrainCTA';

export default function HomeClient() {
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    // Sincronizado con la animación más sutil y detallada (3.5s)
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {showIntro && <EntryAnimation />}
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
        <section className="hero-gradient star-bg pt-28 pb-16 lg:pt-32 lg:pb-20 relative overflow-hidden curved-divider">
          <div className="container mx-auto px-6 flex flex-col lg:flex-row items-center">
            {/* Left Content: Headline & Form */}
            <div className="w-full lg:w-1/2 z-10 text-center lg:text-left">
              <h1 className="text-white text-3xl md:text-5xl lg:text-6xl font-title mb-4 lg:mb-6">
                ¡TU MARCA NECESITA<br /> UN LANZAMIENTO<br /> ESPACIAL!
              </h1>
              <p className="text-gray-300 text-base md:text-lg mb-8 max-w-md mx-auto lg:mx-0">
                Marketing digital de vanguardia que te hace brillar. Es hora de despegar.
              </p>

              {/* Lead Capture Form Card */}
              {/* CTA Button */}
              <div className="max-w-md mx-auto lg:mx-0 mt-8">
                <button
                  onClick={() => document.getElementById('train-cta')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full bg-rocket-orange text-white font-bold py-5 rounded-2xl hover-rocket-orange transition-all shadow-[0_0_20px_rgba(242,113,33,0.4)] hover:shadow-[0_0_30px_rgba(242,113,33,0.6)] flex items-center justify-center gap-3 text-lg hover:-translate-y-1"
                >
                  ¡Lanza Mi Campaña! 🚀
                </button>
              </div>
            </div>

            {/* Right Content: Illustration */}
            <div className="w-full lg:w-1/2 mt-12 lg:mt-0 relative flex justify-center items-center">
              <div className="relative w-full max-w-[280px] md:max-w-lg animate-bounce" style={{ animationDuration: '4s' }}>
                <img
                  alt="Logo RIFX Marketing"
                  className="object-contain w-full h-auto"
                  src="/images/rifx-logo-user.png"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-16 lg:py-24 bg-white" data-purpose="mission-section">
          <div className="container mx-auto px-6 flex flex-col lg:flex-row-reverse items-center gap-10 lg:gap-12 text-center lg:text-left">
            {/* Left side text */}
            <div className="w-full lg:w-1/2">
              <span className="text-rocket-orange font-bold uppercase tracking-widest text-xs lg:text-sm">QUIÉNES SOMOS</span>
              <h2 className="text-3xl lg:text-4xl font-black text-space-navy mt-2 mb-4">Impulsamos Marcas que Dominan su Mercado</h2>
              <p className="text-lg lg:text-xl text-rocket-orange font-semibold mb-6">Estrategia + Creatividad + Tecnología = <span className="text-space-navy">Resultados Imparables.</span></p>
              <p className="text-gray-600 leading-relaxed mb-8 text-sm md:text-base">
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
                  className="w-full max-w-md mx-auto h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                  src="/images/alien-astronaut.png"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="bg-space-navy py-16 lg:py-24" data-purpose="services-section">
          <div className="container mx-auto px-6 text-center mb-12 lg:mb-16">
            <h2 className="text-white text-3xl lg:text-4xl font-black mb-4">Gama de Servicios Estelares que Convierte.</h2>
            <p className="text-gray-300 text-base max-w-2xl mx-auto mb-12">
              Desde publicidad de alto impacto hasta automatización con inteligencia artificial, ofrecemos soluciones integrales para posicionar tu marca en la vanguardia digital.
            </p>
          </div>
          <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Card 1: Ads */}
            <Link href="/servicios/anuncios-de-alta-velocidad" className="block group outline-none">
              <div className="bg-card-dark p-6 lg:p-8 rounded-3xl border-b-4 border-rocket-orange hover:transform hover:-translate-y-2 transition duration-300 text-center md:text-left h-full">
                <div className="mb-4 lg:mb-6">
                  <span className="text-4xl lg:text-5xl">🚀</span>
                </div>
                <h3 className="text-white text-xl lg:text-2xl font-bold mb-3 lg:mb-4 group-hover:text-rocket-orange transition-colors">Anuncios de Alta Velocidad</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Campañas de pago optimizadas para escalar rápido y alcanzar objetivos comerciales en tiempo récord.
                </p>
              </div>
            </Link>

            {/* Card 2: WhatsApp IA */}
            <Link href="/servicios/whatsapp-ai" className="block group outline-none">
              <div className="bg-card-dark p-6 lg:p-8 rounded-3xl border-b-4 border-rocket-orange hover:transform hover:-translate-y-2 transition duration-300 text-center md:text-left h-full">
                <div className="mb-4 lg:mb-6">
                  <span className="text-4xl lg:text-5xl">💬</span>
                </div>
                <h3 className="text-white text-xl lg:text-2xl font-bold mb-3 lg:mb-4 group-hover:text-rocket-orange transition-colors">WhatsApp con IA</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Automatización inteligente para atención al cliente. Chatbots avanzados que cierran ventas en piloto automático.
                </p>
              </div>
            </Link>

            {/* Card 3: UX/UI Design */}
            <Link href="/servicios/diseno-web-inmersivo" className="block group outline-none">
              <div className="bg-card-dark p-6 lg:p-8 rounded-3xl border-b-4 border-rocket-orange hover:transform hover:-translate-y-2 transition duration-300 text-center md:text-left h-full">
                <div className="mb-4 lg:mb-6">
                  <span className="text-4xl lg:text-5xl">🎨</span>
                </div>
                <h3 className="text-white text-xl lg:text-2xl font-bold mb-3 lg:mb-4 group-hover:text-rocket-orange transition-colors">Diseño UX/UI</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Experiencias centradas en el humano que optimizan la conversión y el engagement emocional. Convertimos visitantes en tripulantes leales.
                </p>
              </div>
            </Link>

            {/* Card 4: E-commerce */}
            <Link href="/servicios/ecommerce-interestelar" className="block group outline-none">
              <div className="bg-card-dark p-6 lg:p-8 rounded-3xl border-b-4 border-rocket-orange hover:transform hover:-translate-y-2 transition duration-300 text-center md:text-left h-full">
                <div className="mb-4 lg:mb-6">
                  <span className="text-4xl lg:text-5xl">🛒</span>
                </div>
                <h3 className="text-white text-xl lg:text-2xl font-bold mb-3 lg:mb-4 group-hover:text-rocket-orange transition-colors">E-commerce Interestelar</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Plataformas de venta robustas y escalables para dominar el comercio electrónico global.
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-16 lg:py-24 bg-gray-50 overflow-hidden" data-purpose="testimonials">
          <div className="container mx-auto px-6 text-center mb-16">
            <span className="text-rocket-orange font-bold uppercase tracking-widest text-xs lg:text-sm">TESTIMONIOS</span>
            <h2 className="text-space-navy text-3xl lg:text-4xl font-black px-4 mt-2">Lo que Dicen Nuestros Clientes</h2>
            <p className="text-gray-500 text-sm mt-3 max-w-xl mx-auto">Empresas reales que han escalado sus resultados con nuestras estrategias de marketing digital.</p>
          </div>
          
          <div className="relative group">
            {/* Gradient Masks for edges */}
            <div className="absolute inset-y-0 left-0 w-24 md:w-48 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute inset-y-0 right-0 w-24 md:w-48 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none"></div>

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
        <section className="bg-gray-50 py-16 overflow-hidden border-y border-gray-100" data-purpose="partners-section">
          <div className="container mx-auto px-6 mb-12">
            <p className="text-center text-[10px] md:text-xs text-gray-400 uppercase tracking-[0.5em] font-black">Marcas que ya están en órbita con nosotros</p>
          </div>
          
          <div className="relative overflow-hidden group">
            {/* Gradient Masks for edges */}
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none"></div>
            
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
        <section className="py-16 lg:py-24 bg-white" data-purpose="process-section">
          <div className="container mx-auto px-6">
            <h2 className="text-center text-space-navy text-2xl lg:text-3xl font-black mb-12 lg:mb-16 uppercase tracking-tight">TU RUTA AL LANZAMIENTO EXITOSO</h2>
            <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-10 md:gap-8 relative">
              {/* Connecting Line Background (Hidden on small screens) */}
              <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gray-200 -z-10"></div>
              {/* Step 1 */}
              <div className="w-full md:flex-1 text-center group">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-50 border-2 border-gray-100 rounded-2xl mx-auto flex items-center justify-center mb-4 lg:mb-6 group-hover:border-rocket-orange transition">
                  <span className="text-3xl md:text-4xl">🔭</span>
                </div>
                <h4 className="font-bold text-space-navy text-lg mb-2">1. Análisis Cósmico</h4>
                <p className="text-gray-500 text-sm px-4">Estudiamos tu situación actual y el mercado objetivo.</p>
              </div>
              {/* Step 2 */}
              <div className="w-full md:flex-1 text-center group">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-50 border-2 border-gray-100 rounded-2xl mx-auto flex items-center justify-center mb-4 lg:mb-6 group-hover:border-rocket-orange transition">
                  <span className="text-3xl md:text-4xl">🚀</span>
                </div>
                <h4 className="font-bold text-space-navy text-lg mb-2">2. Estrategia Orbital</h4>
                <p className="text-gray-500 text-sm px-4">Diseñamos el plan de ataque para el despegue.</p>
              </div>
              {/* Step 3 */}
              <div className="w-full md:flex-1 text-center group">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-50 border-2 border-gray-100 rounded-2xl mx-auto flex items-center justify-center mb-4 lg:mb-6 group-hover:border-rocket-orange transition">
                  <span className="text-3xl md:text-4xl">🔥</span>
                </div>
                <h4 className="font-bold text-space-navy text-lg mb-2">3. Lanzamiento y Optimización</h4>
                <p className="text-gray-500 text-sm px-4">Ejecutamos y ajustamos para resultados máximos.</p>
              </div>
            </div>
          </div>
        </section>

        <TrainCTA />
      </main>
      <ContactChannels onlyModal={true} />
    </>
  );
}