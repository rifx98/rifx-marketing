"use client";

export default function HomeHTML() {
  const minDate = new Date().toISOString().split('T')[0];

  return (
    <>
      {/* Estilos CSS personalizados */}
      <style jsx global>{`
        .bg-space-navy { background-color: #0B1D33; }
        .text-space-navy { color: #0B1D33; }
        .bg-rocket-orange { background-color: #E67E22; }
        .hover-rocket-orange:hover { background-color: #D35400; }
        .border-rocket-orange { border-color: #E67E22; }
        .bg-card-dark { background-color: #0F2540; }
        
        .star-bg {
          background-image: radial-gradient(white, rgba(255,255,255,.2) 2px, transparent 40px);
          background-size: 550px 550px;
        }
        
        .hero-gradient {
          background: linear-gradient(135deg, #0B1D33 0%, #162C4E 100%);
        }
        
        .curved-divider {
          border-radius: 0 0 50px 50px;
        }
        
        @media (min-width: 1024px) {
          .curved-divider {
            border-radius: 0 0 50% 50% / 0 0 15% 15%;
          }
        }
        
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10%); }
        }
        
        .animate-bounce {
          animation: bounce 2s infinite;
        }
        
        /* Estilos para el ícono del calendario del input date */
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          filter: invert(53%) sepia(91%) saturate(2371%) hue-rotate(345deg) brightness(97%) contrast(93%);
          transition: transform 0.3s ease;
        }
        input[type="date"]:hover::-webkit-calendar-picker-indicator {
          transform: scale(1.2);
        }
      `}</style>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-rocket-orange rounded-full flex items-center justify-center">
              <span className="text-white font-bold">RM</span>
            </div>
            <span className="text-white font-extrabold text-xl tracking-wider">Rifx Marketing</span>
          </div>
          <div className="hidden md:flex space-x-8">
            <a className="text-white hover:text-rocket-orange transition font-medium" href="#">RIOG</a>
            <a className="text-white hover:text-rocket-orange transition font-medium" href="#">Servicios</a>
            <a className="text-white hover:text-rocket-orange transition font-medium" href="#">Sobre Nosotros</a>
            <a className="text-white hover:text-rocket-orange transition font-medium" href="#">Contacto</a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-gradient star-bg pt-28 pb-16 lg:pt-32 lg:pb-20 relative overflow-hidden curved-divider">
        <div className="container mx-auto px-6 flex flex-col lg:flex-row items-center">
          <div className="w-full lg:w-1/2 z-10 text-center lg:text-left">
            <h1 className="text-white text-3xl md:text-5xl lg:text-6xl font-black leading-tight mb-4 lg:mb-6">
              ¡TU MARCA NECESITA<br /> UN LANZAMIENTO<br /> ESPACIAL!
            </h1>
            <p className="text-gray-300 text-base md:text-lg mb-8 max-w-md mx-auto lg:mx-0">
              Marketing digital de vanguardia que te hace brillar. Es hora de despegar.
            </p>
            
            {/* Lead Capture Form */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl max-w-md mx-auto lg:mx-0">
              <h2 className="text-space-navy font-bold text-base md:text-lg mb-4">SOLICITA TU ESTRATEGIA ESTELAR GRATUITA.</h2>
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input className="w-full rounded-lg bg-gray-50 border border-gray-300 shadow-inner focus:bg-white focus:outline-none focus:ring-2 focus:ring-rocket-orange focus:border-rocket-orange focus:shadow-[0_0_15px_rgba(242,113,33,0.8)] text-sm p-3 text-black caret-black transition-all duration-300" placeholder="Nombre completo" type="text" />
                  <input className="w-full rounded-lg bg-gray-50 border border-gray-300 shadow-inner focus:bg-white focus:outline-none focus:ring-2 focus:ring-rocket-orange focus:border-rocket-orange focus:shadow-[0_0_15px_rgba(242,113,33,0.8)] text-sm p-3 text-black caret-black transition-all duration-300" placeholder="Correo electrónico" type="email" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input className="w-full rounded-lg bg-gray-50 border border-gray-300 shadow-inner focus:bg-white focus:outline-none focus:ring-2 focus:ring-rocket-orange focus:border-rocket-orange focus:shadow-[0_0_15px_rgba(242,113,33,0.8)] text-sm p-3 text-black caret-black transition-all duration-300" placeholder="Sitio Web (Opcional)" type="url" />
                  <input className="w-full rounded-lg bg-gray-50 border border-gray-300 shadow-inner focus:bg-white focus:outline-none focus:ring-2 focus:ring-rocket-orange focus:border-rocket-orange focus:shadow-[0_0_15px_rgba(242,113,33,0.8)] text-sm p-3 text-black caret-black transition-all duration-300 hover:shadow-[0_0_15px_rgba(242,113,33,0.5)] hover:-translate-y-1" title="Selecciona la fecha para tu estrategia" type="date" min={minDate} />
                </div>
                <textarea className="w-full rounded-lg bg-gray-50 border border-gray-300 shadow-inner focus:bg-white focus:outline-none focus:ring-2 focus:ring-rocket-orange focus:border-rocket-orange focus:shadow-[0_0_15px_rgba(242,113,33,0.8)] text-sm p-3 text-black caret-black transition-all duration-300" placeholder="Mensaje" rows={3}></textarea>
                <button className="w-full bg-rocket-orange text-white font-bold py-4 rounded-xl hover-rocket-orange transition-all shadow-lg flex items-center justify-center gap-2 text-base" type="submit">
                  ¡Lanza Mi Campaña! 🚀
                </button>
              </form>
            </div>
          </div>
          
          <div className="w-full lg:w-1/2 mt-12 lg:mt-0 relative flex justify-center items-center">
            <div className="relative w-full max-w-[280px] md:max-w-lg animate-bounce" style={{ animationDuration: '4s' }}>
              <img alt="Astronauta espacial" className="object-contain w-full h-auto rounded-3xl" src="/images/hero-astronaut.svg" />
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="container mx-auto px-6 flex flex-col lg:flex-row items-center gap-10 lg:gap-12 text-center lg:text-left">
          <div className="w-full lg:w-1/2">
            <span className="text-rocket-orange font-bold uppercase tracking-widest text-xs lg:text-sm">QUIÉNES SOMOS</span>
            <h2 className="text-3xl lg:text-4xl font-black text-space-navy mt-2 mb-4">Nuestra Misión Estelar</h2>
            <p className="text-lg lg:text-xl text-rocket-orange font-semibold mb-6">Misión: <span className="text-space-navy">Tu Éxito es Realeza.</span></p>
            <p className="text-gray-600 leading-relaxed mb-8 text-sm md:text-base">
              Usamos tecnología y creatividad avanzada para llevarte a nuevos órbitas. Comprometidos con el impacto visual y la conversión directa.
            </p>
            <button className="bg-rocket-orange text-white px-8 py-3 rounded-full font-bold shadow-lg hover-rocket-orange transition text-base">
              Conócenos 🚀
            </button>
          </div>
          
          <div className="w-full lg:w-1/2">
            <img alt="Astronauta en planeta" className="w-full h-auto object-cover" src="/images/astronaut-illustration.svg" />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="bg-space-navy py-16 lg:py-24">
        <div className="container mx-auto px-6 text-center mb-12 lg:mb-16">
          <h2 className="text-white text-3xl lg:text-4xl font-black mb-4">Gama de Servicios Estelares que Convierte.</h2>
          <p className="text-gray-300 text-base max-w-2xl mx-auto mb-12">
            Desde publicidad de alto impacto hasta automatización con inteligencia artificial, ofrecemos soluciones integrales para posicionar tu marca en la vanguardia digital.
          </p>
        </div>
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Card 1: Ads */}
          <div className="bg-card-dark p-6 lg:p-8 rounded-3xl border-b-4 border-rocket-orange hover:-translate-y-2 transition duration-300 text-center md:text-left">
            <div className="mb-4 lg:mb-6">
              <span className="text-4xl lg:text-5xl">🚀</span>
            </div>
            <h3 className="text-white text-xl lg:text-2xl font-bold mb-3 lg:mb-4">Anuncios de Alta Velocidad</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Campañas de pago optimizadas para escalar rápido y alcanzar objetivos comerciales en tiempo récord.
            </p>
          </div>
          {/* Card 2: WhatsApp IA */}
          <div className="bg-card-dark p-6 lg:p-8 rounded-3xl border-b-4 border-rocket-orange hover:-translate-y-2 transition duration-300 text-center md:text-left">
            <div className="mb-4 lg:mb-6">
              <span className="text-4xl lg:text-5xl">💬</span>
            </div>
            <h3 className="text-white text-xl lg:text-2xl font-bold mb-3 lg:mb-4">WhatsApp con IA</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Automatización inteligente para atención al cliente. Chatbots avanzados que cierran ventas en piloto automático.
            </p>
          </div>
          {/* Card 3: Web Design */}
          <div className="bg-card-dark p-6 lg:p-8 rounded-3xl border-b-4 border-rocket-orange hover:-translate-y-2 transition duration-300 text-center md:text-left">
            <div className="mb-4 lg:mb-6">
              <span className="text-4xl lg:text-5xl">💻</span>
            </div>
            <h3 className="text-white text-xl lg:text-2xl font-bold mb-3 lg:mb-4">Diseño Web Inmersivo</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Sitios web de alto rendimiento con UX de otro mundo. Convertimos visitantes en tripulantes leales.
            </p>
          </div>
          {/* Card 4: E-commerce */}
          <div className="bg-card-dark p-6 lg:p-8 rounded-3xl border-b-4 border-rocket-orange hover:-translate-y-2 transition duration-300 text-center md:text-left">
            <div className="mb-4 lg:mb-6">
              <span className="text-4xl lg:text-5xl">🛒</span>
            </div>
            <h3 className="text-white text-xl lg:text-2xl font-bold mb-3 lg:mb-4">E-commerce Interestelar</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Plataformas de venta robustas y escalables para dominar el comercio electrónico global.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="container mx-auto px-6 text-center mb-16">
          <h2 className="text-space-navy text-3xl lg:text-4xl font-black px-4">Nuestros Clientes de Realeza:<br className="hidden md:block"/>Testimonios de Élite</h2>
        </div>
        
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 relative">
          <div className="bg-space-navy text-white p-8 rounded-2xl relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2">
              <img alt="Client" className="w-16 h-16 rounded-full border-4 border-white" src="/images/client-1.svg" />
            </div>
            <div className="mt-8 text-center">
              <h4 className="font-bold text-lg mb-2">Resultados de Realeza</h4>
              <p className="italic text-gray-300 text-sm mb-4">"Servicios de marketing digital que transformaron nuestra visión en resultados reales y medibles."</p>
              <p className="text-rocket-orange font-bold text-xs uppercase">Juan Pérez - CEO Tech</p>
            </div>
          </div>
          
          <div className="bg-space-navy text-white p-8 rounded-2xl relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2">
              <img alt="Client" className="w-16 h-16 rounded-full border-4 border-white" src="/images/client-2.svg" />
            </div>
            <div className="mt-8 text-center">
              <h4 className="font-bold text-lg mb-2">Excelente Servicio</h4>
              <p className="italic text-gray-300 text-sm mb-4">"El equipo de Rifx Marketing entendió perfectamente nuestras necesidades galácticas."</p>
              <p className="text-rocket-orange font-bold text-xs uppercase">Maria S. - Marketing Dir.</p>
            </div>
          </div>
          
          <div className="bg-space-navy text-white p-8 rounded-2xl relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2">
              <img alt="Client" className="w-16 h-16 rounded-full border-4 border-white" src="/images/client-3.svg" />
            </div>
            <div className="mt-8 text-center">
              <h4 className="font-bold text-lg mb-2">Crecimiento Exponencial</h4>
              <p className="italic text-gray-300 text-sm mb-4">"Una estrategia orbital que nos puso por delante de la competencia en meses."</p>
              <p className="text-rocket-orange font-bold text-xs uppercase">Carlos R. - Founder</p>
            </div>
          </div>
        </div>
        
        {/* Client Logos */}
        <div className="container mx-auto px-6 mt-16 lg:mt-20">
          <p className="text-center text-gray-400 font-bold mb-8 uppercase tracking-widest text-xs lg:text-sm">Marcas que ya están en órbita con nosotros</p>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 opacity-50 grayscale hover:grayscale-0 transition duration-300">
            <span className="text-lg md:text-2xl font-black text-gray-600">GEASSILA</span>
            <span className="text-lg md:text-2xl font-black text-gray-600">FACECOOOOK</span>
            <span className="text-lg md:text-2xl font-black text-gray-600">SPOTIFY</span>
            <span className="text-lg md:text-2xl font-black text-gray-600">BERION</span>
            <span className="text-lg md:text-2xl font-black text-gray-600">WANANA</span>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-center text-space-navy text-2xl lg:text-3xl font-black mb-12 lg:mb-16 uppercase tracking-tight">TU RUTA AL LANZAMIENTO EXITOSO</h2>
          
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-10 md:gap-8 relative">
            <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gray-200 -z-10"></div>
            
            <div className="w-full md:flex-1 text-center">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-50 border-2 border-gray-100 rounded-2xl mx-auto flex items-center justify-center mb-4 lg:mb-6 hover:border-rocket-orange transition">
                <span className="text-3xl md:text-4xl">🔭</span>
              </div>
              <h4 className="font-bold text-space-navy text-lg mb-2">1. Análisis Cósmico</h4>
              <p className="text-gray-500 text-sm px-4">Estudiamos tu situación actual y el mercado objetivo.</p>
            </div>
            
            <div className="w-full md:flex-1 text-center">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-50 border-2 border-gray-100 rounded-2xl mx-auto flex items-center justify-center mb-4 lg:mb-6 hover:border-rocket-orange transition">
                <span className="text-3xl md:text-4xl">🚀</span>
              </div>
              <h4 className="font-bold text-space-navy text-lg mb-2">2. Estrategia Orbital</h4>
              <p className="text-gray-500 text-sm px-4">Diseñamos el plan de ataque para el despegue.</p>
            </div>
            
            <div className="w-full md:flex-1 text-center">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-50 border-2 border-gray-100 rounded-2xl mx-auto flex items-center justify-center mb-4 lg:mb-6 hover:border-rocket-orange transition">
                <span className="text-3xl md:text-4xl">🔥</span>
              </div>
              <h4 className="font-bold text-space-navy text-lg mb-2">3. Lanzamiento y Optimización</h4>
              <p className="text-gray-500 text-sm px-4">Ejecutamos y ajustamos para resultados máximos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-space-navy py-16 lg:py-20 relative overflow-hidden">
        <div className="star-bg absolute inset-0 opacity-30"></div>
        <div className="container mx-auto px-6 relative z-10 text-center">
          <h2 className="text-white text-2xl md:text-3xl lg:text-5xl font-black mb-6 lg:mb-8 px-2">
            ¡NO TE QUEDES EN TIERRA! <br className="hidden md:block"/> ÚNETE A LA ÉLITE ESPACIAL.
          </h2>
          <p className="text-gray-300 text-lg md:text-xl mb-10 lg:mb-12 uppercase tracking-widest font-bold">SOLICITA TU ESTRATEGIA GRATUITA HOY</p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <button className="w-full md:w-auto bg-rocket-orange text-white px-6 lg:px-10 py-4 rounded-xl font-bold text-base lg:text-lg hover-rocket-orange transition shadow-2xl flex items-center justify-center gap-2">
              SOLICITA TU ESTRATEGIA GRATUITA <span className="text-xl lg:text-2xl">🚀</span>
            </button>
            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-md w-full md:w-auto justify-center md:justify-start">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-rocket-orange rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-white/70 text-xs font-bold">Contacto:</p>
                <p className="text-white font-bold text-base lg:text-lg">+37 (3) 431 7823</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-space-navy pt-16 pb-8 border-t border-white/10">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-rocket-orange rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">RM</span>
                </div>
                <span className="text-white font-extrabold text-xl tracking-wider">Rifx Marketing</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Llevando tu marca más allá de la estratosfera con estrategias de marketing digital de alto impacto.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-sm">Enlaces Rápidos</h4>
              <ul className="space-y-3">
                <li><a className="text-gray-400 hover:text-rocket-orange transition text-sm" href="#">Inicio</a></li>
                <li><a className="text-gray-400 hover:text-rocket-orange transition text-sm" href="#">Servicios</a></li>
                <li><a className="text-gray-400 hover:text-rocket-orange transition text-sm" href="#">Sobre Nosotros</a></li>
                <li><a className="text-gray-400 hover:text-rocket-orange transition text-sm" href="#">Contacto</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-sm">Contacto Estelar</h4>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-400">
                  <span className="material-symbols-outlined text-rocket-orange">mail</span>
                  <span className="text-sm">mision@rifxmarketing.com</span>
                </li>
                <li className="flex items-center gap-3 text-gray-400">
                  <span className="material-symbols-outlined text-rocket-orange">call</span>
                  <span className="text-sm">+37 (3) 431 7823</span>
                </li>
                <li className="flex items-center gap-3 text-gray-400">
                  <span className="material-symbols-outlined text-rocket-orange">location_on</span>
                  <span className="text-sm">Base de Operaciones, Órbita Terrestre</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-sm">Redes Galácticas</h4>
              <div className="flex space-x-4">
                <a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-rocket-orange text-white transition-all duration-300" href="#">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
                  </svg>
                </a>
                <a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-rocket-orange text-white transition-all duration-300" href="#">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0z"/>
                  </svg>
                </a>
                <a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-rocket-orange text-white transition-all duration-300" href="#">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500 gap-4">
            <p>© 2024 Rifx Marketing Agency. Todos los derechos reservados.</p>
            <div className="flex space-x-6">
              <a className="hover:text-white transition" href="#">Aviso Legal</a>
              <a className="hover:text-white transition" href="#">Privacidad</a>
              <a className="hover:text-white transition" href="#">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}