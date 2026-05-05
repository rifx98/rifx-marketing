

export default function SobreNosotrosPage() {
  return (
    <main className="min-h-screen bg-[#0b1229] font-body pt-24 pb-20 overflow-hidden">

      {/* Hero Component: Nuestra Historia de Origen */}
      <section className="relative px-8 py-20 md:py-32 max-w-screen-2xl mx-auto flex flex-col md:flex-row items-center gap-16" id="sobre-nosotros" data-purpose="mission-section">
        <div className="w-full md:w-1/2 z-10">
          <header className="mb-6">
            <span className="font-label text-rocket-orange tracking-[0.2em] uppercase text-xs font-bold">Rifx Marketing / ARCHITECTS</span>
            <h1 className="text-5xl md:text-7xl text-white/90 font-title">
              Nuestra <span className="text-rocket-orange">Historia</span> de Origen
            </h1>
          </header>
          <p className="font-body text-gray-300 text-lg leading-relaxed max-w-xl mb-10">
            Nacidos en el vacío de la mediocridad digital, RIFX MARKETING fue concebido para elevar marcas más allá de la atmósfera convencional. No somos solo una agencia; somos ingenieros de trayectorias estelares, fusionando datos fríos con la calidez del impacto creativo.
          </p>
          <div className="flex items-center gap-4">
            <div className="h-px w-12 bg-rocket-orange"></div>
            <span className="font-label italic text-xs text-gray-400">Establecidos en el Cuadrante 2024</span>
          </div>
        </div>
        <div className="w-full md:w-1/2 relative">
          <div className="relative w-full aspect-square flex items-center justify-center">
            <div className="absolute inset-0 bg-rocket-orange/5 rounded-full blur-[100px] animate-pulse"></div>
            <div className="w-full h-full relative group flex items-center justify-center pointer-events-none">
              <img 
                alt="Nuestra Historia - Rocket Explorer" 
                className="w-full h-full object-contain transition-all duration-1000 animate-[float_6s_ease-in-out_infinite]" 
                style={{ filter: 'invert(1) hue-rotate(180deg)', mixBlendMode: 'screen' }}
                src="/images/sobre-nosotros/rocket-drawn-v2.jpg" 
              />
            </div>
            <div className="absolute top-4 right-4 bg-space-navy/40 backdrop-blur-xl border border-white/10 p-3 rounded-lg flex items-center gap-3 shadow-2xl">
              <svg className="lucide lucide-rocket" fill="none" height="16" stroke="#f27121" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"></path><path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"></path></svg>
              <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-rocket-orange">Orbiting Success</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Directrices Estelares */}
      <section className="bg-space-navy/50 py-32 relative">
        <div className="max-w-screen-2xl mx-auto px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl text-white font-title">Directrices Estelares</h2>
            <p className="font-body text-gray-400 max-w-2xl mx-auto">Nuestros valores fundamentales que mantienen a cada proyecto en su trayectoria correcta.</p>
          </div>
          <div className="flex flex-col md:flex-row justify-center items-center gap-12 md:gap-8 mt-12 md:px-12">
            
            {/* Card 1: Innovación */}
            <div className="group relative w-full md:w-[380px] min-h-[580px] bg-[#10172d] p-10 rounded-3xl border border-white/5 shadow-xl md:-rotate-6 md:translate-x-12 z-0 hover:z-20 hover:rotate-0 hover:translate-x-0 hover:scale-105 transition-all duration-500 overflow-hidden flex flex-col justify-between">
              {/* Background Figure: Tech Grid */}
              <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none group-hover:opacity-10 transition-opacity duration-500" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="tech-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="1" />
                    <circle cx="30" cy="30" r="1.5" fill="currentColor" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#tech-grid)" className="text-white" />
              </svg>
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10 flex-grow">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rocket-orange/20 to-transparent flex items-center justify-center border border-rocket-orange/20">
                    <svg className="lucide lucide-lightbulb" fill="none" height="20" stroke="#f27121" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>
                  </div>
                  <h3 className="font-headline text-2xl font-bold text-white tracking-wide">Innovación</h3>
                </div>
                
                <div className="space-y-6">
                  <p className="font-body text-gray-300 text-sm leading-relaxed italic">
                    "La innovación no es solo hacer cosas nuevas, es resolver los desafíos de crecimiento de forma inesperada y brillante."
                  </p>
                  <p className="font-body text-gray-400 text-sm leading-relaxed">
                    Exploramos las últimas tecnologías de IA y automatización para asegurarnos de que tu marca siempre esté un paso por delante de la competencia, marcando la pauta en lugar de seguirla.
                  </p>
                  <p className="font-body text-gray-400 text-sm leading-relaxed">
                    Buscamos constantemente la frontera tecnológica para que las misiones de marketing superen los límites de lo posible.
                  </p>
                </div>
              </div>

              {/* Avatar / Footer */}
              <div className="relative z-10 mt-8 flex items-center gap-4 pt-6 border-t border-white/5">
                <div className="w-10 h-10 rounded-full bg-space-navy border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  <span className="text-xs text-rocket-orange font-bold">R/M</span>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Equipo de Estrategia</p>
                  <p className="text-gray-500 text-xs">Desarrollo Tecnológico</p>
                </div>
              </div>
            </div>

            {/* Card 2: Precisión (Centro) */}
            <div className="group relative w-full md:w-[380px] min-h-[600px] bg-[#141b33] p-10 rounded-3xl border border-white/10 shadow-2xl z-10 md:scale-110 hover:scale-125 transition-all duration-500 overflow-hidden flex flex-col justify-between">
              {/* Background Figure: Radar/Target */}
              <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-opacity duration-500" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-rocket-orange" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-rocket-orange" />
                <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" strokeWidth="0.5" className="text-rocket-orange" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.5" className="text-rocket-orange" />
              </svg>
              <div className="absolute inset-0 bg-gradient-to-t from-rocket-orange/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10 flex-grow">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rocket-orange/20 to-transparent flex items-center justify-center border border-rocket-orange/20">
                    <svg className="lucide lucide-target" fill="none" height="20" stroke="#f27121" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                  </div>
                  <h3 className="font-headline text-2xl font-bold text-white tracking-wide">Precisión</h3>
                </div>
                
                <div className="space-y-6">
                  <p className="font-body text-gray-300 text-sm leading-relaxed italic">
                    "Cada decisión que tomamos está respaldada por datos absolutos. No lanzamos campañas al vacío, calculamos trayectorias exactas."
                  </p>
                  <p className="font-body text-gray-400 text-sm leading-relaxed">
                    Desde la segmentación de la audiencia hasta la optimización matemática del presupuesto publicitario, afinamos cada detalle milimétricamente.
                  </p>
                  <p className="font-body text-gray-400 text-sm leading-relaxed">
                    Nuestro compromiso es maximizar el retorno de inversión con riesgo minimizado, convirtiendo cada byte procesado en valor tangible para el negocio.
                  </p>
                </div>
              </div>

              {/* Avatar / Footer */}
              <div className="relative z-10 mt-8 flex items-center gap-4 pt-6 border-t border-white/5">
                <div className="w-10 h-10 rounded-full bg-space-navy border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  <span className="text-xs text-rocket-orange font-bold">R/M</span>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Equipo de Análisis</p>
                  <p className="text-gray-500 text-xs">División de Datos Masivos</p>
                </div>
              </div>
            </div>

            {/* Card 3: Impacto */}
            <div className="group relative w-full md:w-[380px] min-h-[580px] bg-[#10172d] p-10 rounded-3xl border border-white/5 shadow-xl md:rotate-6 md:-translate-x-12 z-0 hover:z-20 hover:rotate-0 hover:translate-x-0 hover:scale-105 transition-all duration-500 overflow-hidden flex flex-col justify-between">
              {/* Background Figure: Orbital Rings */}
              <svg className="absolute -bottom-16 -right-16 w-80 h-80 opacity-[0.06] pointer-events-none group-hover:opacity-10 transition-opacity duration-500" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-white" />
                <ellipse cx="50" cy="50" rx="45" ry="15" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-white" transform="rotate(30 50 50)" />
                <ellipse cx="50" cy="50" rx="45" ry="15" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-white" transform="rotate(120 50 50)" />
              </svg>
              <div className="absolute inset-0 bg-gradient-to-bl from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10 flex-grow">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rocket-orange/20 to-transparent flex items-center justify-center border border-rocket-orange/20">
                    <svg className="lucide lucide-sparkles" fill="none" height="20" stroke="#f27121" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg>
                  </div>
                  <h3 className="font-headline text-2xl font-bold text-white tracking-wide">Impacto</h3>
                </div>
                
                <div className="space-y-6">
                  <p className="font-body text-gray-300 text-sm leading-relaxed italic">
                    "Generamos ondas gravitacionales en tu industria. Si no resuena en todo el mercado, no hemos cumplido la meta."
                  </p>
                  <p className="font-body text-gray-400 text-sm leading-relaxed">
                    Medimos nuestro éxito por el crecimiento exponencial que experimenta tu empresa tras el despliegue de nuestras soluciones.
                  </p>
                  <p className="font-body text-gray-400 text-sm leading-relaxed">
                    Nos enfocamos en convertir tu marca en la fuerza central que atrae a todos los prospectos de forma magnética y continua.
                  </p>
                </div>
              </div>

              {/* Avatar / Footer */}
              <div className="relative z-10 mt-8 flex items-center gap-4 pt-6 border-t border-white/5">
                <div className="w-10 h-10 rounded-full bg-space-navy border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  <span className="text-xs text-rocket-orange font-bold">R/M</span>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Dirección Creativa</p>
                  <p className="text-gray-500 text-xs">Adquisición y Crecimiento</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Section: Expediciones de Equipo (Bento Grid) */}
      <section className="py-24 w-full px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Row 1: 4 Images */}
          <div className="col-span-1 h-48 md:h-64 rounded-2xl overflow-hidden">
            <img src="/images/sobre-nosotros/chef-camino.png" alt="Chef" className="w-full h-full object-cover" />
          </div>
          <div className="col-span-1 h-48 md:h-64 rounded-2xl overflow-hidden">
            <img src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80" alt="Team brainstorming" className="w-full h-full object-cover" />
          </div>
          <div className="col-span-1 h-48 md:h-64 rounded-2xl overflow-hidden">
            <img src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80" alt="Team gathering" className="w-full h-full object-cover" />
          </div>
          <div className="col-span-1 h-48 md:h-64 rounded-2xl overflow-hidden">
            <img src="/images/sobre-nosotros/republica-cacao.png" alt="República del Cacao" className="w-full h-full object-cover" />
          </div>
          
          {/* Row 2: 2 Images + 1 Text Block (col-span-2) */}
          <div className="col-span-1 h-48 md:h-72 rounded-2xl overflow-hidden">
            <img src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80" alt="Team activity" className="w-full h-full object-cover" />
          </div>
          <div className="col-span-1 h-48 md:h-72 rounded-2xl overflow-hidden">
            <img src="/images/sobre-nosotros/evento-camino.jpg" alt="Evento Rifx" className="w-full h-full object-cover" />
          </div>
          
          <div className="col-span-1 md:col-span-2 h-auto md:h-72 rounded-2xl overflow-hidden bg-[#1c223a] p-10 relative flex flex-col justify-center border border-white/5">
            {/* Topographic Background Pattern */}
            <svg className="absolute right-0 top-0 w-full h-full opacity-[0.05] pointer-events-none" viewBox="0 0 400 400" preserveAspectRatio="none">
              <path d="M-50,200 C100,100 300,300 450,200" fill="none" stroke="white" strokeWidth="1"/>
              <path d="M-50,220 C100,120 300,320 450,220" fill="none" stroke="white" strokeWidth="1"/>
              <path d="M-50,240 C100,140 300,340 450,240" fill="none" stroke="white" strokeWidth="1"/>
              <path d="M-50,260 C100,160 300,360 450,260" fill="none" stroke="white" strokeWidth="1"/>
              <path d="M-50,280 C100,180 300,380 450,280" fill="none" stroke="white" strokeWidth="1"/>
              <path d="M-50,300 C100,200 300,400 450,300" fill="none" stroke="white" strokeWidth="1"/>
              <path d="M-50,320 C100,220 300,420 450,320" fill="none" stroke="white" strokeWidth="1"/>
            </svg>
            
            <div className="relative z-10 max-w-lg">
              <h3 className="text-2xl font-bold text-white mb-4">Nuestro Camino</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Hemos ayudado a cientos de empresas a escalar y posicionarse con autoridad en su sector. En el panorama actual, la realidad es innegable: cuando un negocio no tiene una presencia digital bien plantada, simplemente se pierde. Se vuelve invisible para el mundo y cede terreno ante la competencia cada día. Nuestra labor es construir la infraestructura estratégica necesaria para que las marcas destaquen, dominen su entorno y lideren en la era digital.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section: La Tripulación */}
      <section className="py-32 max-w-screen-2xl mx-auto px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="max-w-xl">
            <h2 className="text-4xl md:text-5xl text-white font-title">La Tripulación</h2>
            <p className="font-body text-gray-400 mt-4 text-sm">Arquitectos de realidades digitales, expertos en navegación de algoritmos y pioneros de la estética orbital.</p>
          </div>
          <div className="hidden md:block h-px flex-1 bg-white/10 mx-12"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="group relative overflow-hidden rounded-xl bg-[#181e36]/40 border border-white/5">
            <div className="aspect-[4/5] w-full relative">
              <img alt="Bryan Arcos" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105" src="/images/team-bryan.jpg" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b1229] via-[#0b1229]/20 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-8 w-full z-10">
                <span className="font-label text-rocket-orange text-[10px] font-bold tracking-[0.2em] uppercase mb-1 block">COMMANDER</span>
                <h4 className="font-headline text-2xl font-bold text-white">Bryan Arcos</h4>
                <p className="font-body text-gray-400 text-xs mt-1">CEO & Visionario Principal</p>
              </div>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-xl bg-[#181e36]/40 border border-white/5">
            <div className="aspect-[4/5] w-full relative">
              <img alt="Elena Nova" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida/ADBb0ujfLxLlc3gyDX5RDbU8k1nLo-tQTsdcnY5FTJsFTbAJKTqEXpHjgIDls61CJ2bkPdHy4PGfub4ByPDQgjlaxeIiJFUYZw2ojKTgzzB3RVVZQzGDANpFiBJp2_p95QI7_T3tzKChcvEwZNHZDYalOXuCMBrY1x7ePczg368bleNw8ARtPfFMQfDN6okVZAuP7Cr8-MdF6zbRfAHh5iEdzzJPIbFBx43WV66CHRr3oxyiOkGnXNImp6jQkfMax38xrQ_TqUto6PtU" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b1229] via-[#0b1229]/20 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-8 w-full z-10">
                <span className="font-label text-rocket-orange text-[10px] font-bold tracking-[0.2em] uppercase mb-1 block">NAVIGATOR</span>
                <h4 className="font-headline text-2xl font-bold text-white">Elena Nova</h4>
                <p className="font-body text-gray-400 text-xs mt-1">Directora de Estrategia</p>
              </div>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-xl bg-[#181e36]/40 border border-white/5">
            <div className="aspect-[4/5] w-full relative">
              <img alt="Marcus Stellar" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC4VMXnZAKKt1y89WHQMSejrXvWfI0G9embN9zJ_81bQKLv2iaBu1ZV5pAWrwau6TBryvLVSELocMHJoIAR3GLr4sb3LG7E9RCT-K-ZELcA8WcBIwWSGQJzQ-peag__q1DaGDgHbz-FFr6-WqMgO80bxmLIsE310SuHGAI8MnJ-ytAWCSJdcshdob4aX94dIALUKUh5DyvCzN-FDMDVKJA763oR-bj1pK_3ASVv6LU8m6Q00kOO80BXdhVL4soq-5H5JBNncQ-QHKU" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b1229] via-[#0b1229]/20 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-8 w-full z-10">
                <span className="font-label text-rocket-orange text-[10px] font-bold tracking-[0.2em] uppercase mb-1 block">ENGINEER</span>
                <h4 className="font-headline text-2xl font-bold text-white">Marcus Stellar</h4>
                <p className="font-body text-gray-400 text-xs mt-1">Arquitecto de Sistemas</p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
