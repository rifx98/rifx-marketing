'use client';

import React from 'react';
import Link from 'next/link';
import ContactChannels from '../../components/ContactChannels';
import TrainCTA from '../../components/TrainCTA';
import AnimatedText from '../../components/AnimatedText';

export default function EcommerceInterestelarPage() {
  return (
    <>
      <style jsx global>{`
        body { font-family: 'Montserrat', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .selection-orange::selection { background-color: #f27121; color: white; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0b1229; }
        ::-webkit-scrollbar-thumb { background: #181e36; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #f27121; }
        
        .glass { background: rgba(24, 30, 54, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .glass-hover:hover { background: rgba(24, 30, 54, 0.6); border-color: rgba(242, 113, 33, 0.3); }
        .text-gradient { background: linear-gradient(to right, #ffb692, #f27121); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      `}</style>

      {/* External Resources */}
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&display=swap" rel="stylesheet"/>

      <div className="bg-[#0b1229] text-[#dce1ff] selection-orange antialiased overflow-x-hidden min-h-screen">
        <main className="pt-20">
          {/* Hero Section */}
          <section className="relative min-h-[85vh] flex items-center px-6 py-20 max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="z-10 animate-fade-in-up">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#ffb692] text-[10px] font-bold tracking-[0.3em] uppercase mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f27121] mr-2 animate-pulse"></span>
                  E-commerce Engineering 2024
                </div>
                <AnimatedText as="h1" className="text-6xl md:text-8xl leading-[1] mb-8 text-white font-title" stagger={30} delay={150}>
                  Tu Tienda Interestelar
                </AnimatedText>
                <p className="text-lg text-slate-400 leading-relaxed mb-12 max-w-xl uppercase tracking-tighter font-medium">
                  Arquitectura de comercio electrónico de alto rendimiento para marcas que orbitan en el futuro. Tiendas ultra-rápidas construidas con <strong className="text-white underline decoration-[#f27121]">tecnología de vanguardia</strong>.
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                  <button onClick={() => document.getElementById('train-cta')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#f27121] text-white px-10 py-5 rounded-xl font-bold text-base hover:shadow-[0_0_40px_rgba(242,113,33,0.3)] transition-all duration-300 uppercase tracking-widest">
                    Iniciar Misión 🚀
                  </button>
                  <Link href="/#proyectos" className="bg-white/5 border border-white/10 px-10 py-5 rounded-xl font-bold text-base backdrop-blur-md hover:bg-white/10 transition-all uppercase tracking-widest text-white">
                    Ver Portafolio
                  </Link>
                </div>
              </div>
              {/* Right content: Animated Space Elements */}
              <div className="lg:w-1/2 mt-16 lg:mt-0 relative w-full h-[300px] sm:h-[400px] lg:h-[500px]">
                <div className="relative glass rounded-[2.5rem] p-4 border-white/10 overflow-hidden group rotate-2">
                  <img 
                    alt="High-tech e-commerce visualization" 
                    className="w-full h-auto rounded-[1.8rem] grayscale-[0.4] group-hover:grayscale-0 transition-all duration-700 shadow-2xl" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBDANC3O1BNH_WyEHTNAO4V8e-tQ-OWNraziKZvz1cZw08Fq-18Xk3Y9S7CG_LJL21x4fQobBxp4QpEA_MngvXYGbPCIRGe3o24qk8xetjeaa_rG7XM9sASepnAAOPOrNITqkZ1Z_5deu35ka5DK9Stk5TuGlXJaEcR9x1IBvVe_2xtdBTh-GCq5gcjNWyuDGWpCOQcVYD8_cCRii87rLJ2_Z2V31pHJCeLTrsDtZpW-9-1T3hWxJ0Lqns-4OpWjyxAzKRkxegs9Ds" 
                  />
                  <div className="absolute top-8 right-8 w-24 h-24 bg-[#f27121] rounded-full flex items-center justify-center border-4 border-[#0b1229] shadow-2xl animate-bounce" style={{ animationDuration: '3s' }}>
                    <span className="material-symbols-outlined text-4xl text-white">shopping_cart</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Tecnología Section */}
          <section className="py-32 px-6 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { icon: 'devices', title: 'Responsive 3.0', desc: 'Adaptabilidad total en cualquier dimensión de pantalla.' },
                { icon: 'search_insights', title: 'SEO Orbital', desc: 'Visibilidad estelar en los principales motores de búsqueda.' },
                { icon: 'bolt', title: 'Propulsión +90', desc: 'Velocidad de carga que rompe la barrera del sonido.' },
                { icon: 'shield_lock', title: 'Blindaje Total', desc: 'Encriptación y protocolos de seguridad digital de élite.' }
              ].map((item, i) => (
                <div key={i} className="glass glass-hover p-10 rounded-[2.5rem] transition-all duration-500 flex flex-col items-start group">
                  <div className="bg-orange-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform border border-orange-500/20">
                    <span className="material-symbols-outlined text-[#f27121] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4 font-space uppercase tracking-tighter">{item.title}</h3>
                  <p className="text-slate-500 leading-relaxed text-xs uppercase tracking-widest font-black">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Ecosistema Bento Grid */}
          <section className="py-32 px-6 max-w-7xl mx-auto">
            <div className="mb-24">
              <span className="text-[#f27121] font-black uppercase tracking-[0.3em] text-xs">Arsenal Tecnológico</span>
              <AnimatedText as="h2" className="text-4xl md:text-7xl font-bold text-white mt-4 uppercase tracking-tighter font-space" stagger={32} delay={100}>
                Arquitectura de Conversión
              </AnimatedText>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 glass glass-hover p-12 rounded-[2.5rem] flex flex-col justify-between group transition-all duration-500">
                <div>
                  <span className="material-symbols-outlined text-[#f27121] mb-8 block text-5xl">shopping_cart</span>
                  <h3 className="text-3xl font-bold text-white uppercase tracking-tighter mb-6 font-space">E-commerce de Alto Impacto</h3>
                  <p className="text-slate-400 text-lg uppercase tracking-widest font-bold leading-relaxed">Plataformas de venta escalables con pasarelas de pago globales y gestión de inventario automatizada en tiempo real.</p>
                </div>
                <div className="mt-10 flex flex-wrap gap-4">
                  <span className="px-4 py-2 rounded-lg bg-white/5 text-[10px] font-black border border-white/10 uppercase tracking-widest text-slate-300">Shopify Plus</span>
                  <span className="px-4 py-2 rounded-lg bg-white/5 text-[10px] font-black border border-white/10 uppercase tracking-widest text-slate-300">Next.js Commerce</span>
                  <span className="px-4 py-2 rounded-lg bg-white/5 text-[10px] font-black border border-white/10 uppercase tracking-widest text-slate-300">Stripe Global</span>
                </div>
              </div>
              <div className="bg-[#f27121] p-12 rounded-[2.5rem] flex flex-col justify-between text-[#0b1229] shadow-[0_0_50px_rgba(242,113,33,0.2)]">
                <div>
                  <span className="material-symbols-outlined mb-8 block text-5xl">corporate_fare</span>
                  <h3 className="text-3xl font-bold uppercase tracking-tighter mb-6 font-space">Universo Corporativo</h3>
                  <p className="font-bold uppercase tracking-widest leading-relaxed">Presencia institucional que proyecta autoridad y liderazgo tecnológico en el multiverso digital.</p>
                </div>
                <Link href="/#contacto" className="mt-10 w-fit bg-[#0b1229] text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-transform">
                  Explorar Órbita
                </Link>
              </div>
              <div className="glass glass-hover p-10 rounded-[2.5rem] transition-all duration-500 group">
                <span className="material-symbols-outlined text-[#f27121] mb-8 block text-5xl">terminal</span>
                <h3 className="text-2xl font-bold text-white uppercase tracking-tighter mb-4 font-space">Web Apps</h3>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest leading-relaxed">Aplicaciones web progresivas con funcionalidades complejas y lógica de negocio a medida.</p>
              </div>
              <div className="md:col-span-2 glass glass-hover p-12 rounded-[2.5rem] relative overflow-hidden group transition-all duration-500">
                <div className="relative z-10">
                  <span className="material-symbols-outlined text-[#f27121] mb-8 block text-5xl">auto_awesome</span>
                  <h3 className="text-3xl font-bold text-white uppercase tracking-tighter mb-6 font-space">Landing Pages Estelares</h3>
                  <p className="text-slate-400 text-lg uppercase tracking-widest font-bold leading-relaxed max-w-md">Diseñadas para la conversión máxima. Experiencias de aterrizaje que transforman visitantes en tripulantes leales.</p>
                </div>
                <div className="absolute -right-20 -bottom-20 opacity-10 group-hover:opacity-20 transition-opacity transform -rotate-12 group-hover:scale-110 duration-700">
                  <span className="material-symbols-outlined text-[250px]">rocket</span>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-32 bg-[#080f24]/30">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-24">
                <AnimatedText as="h2" className="text-3xl md:text-6xl font-bold text-white mb-6 font-space tracking-tight uppercase" stagger={35} delay={100}>
                  Protocolos de Información
                </AnimatedText>
                <p className="text-slate-400 uppercase tracking-widest font-bold text-xs">Resolución de dudas sobre nuestra arquitectura e-commerce.</p>
              </div>
              <div className="space-y-4">
                {[
                  { q: '¿Cuánto tiempo tarda el lanzamiento?', a: 'Depende del plan seleccionado. Una Landing Page puede estar lista en 7 días terrestres, mientras que una Web App compleja requiere entre 8 y 12 semanas de desarrollo intensivo e ignición.' },
                  { q: '¿Qué tecnologías utilizan en la base?', a: 'Nuestra base principal es Next.js, React y Tailwind CSS para el frontend, y Node.js para arquitecturas de backend escalables, garantizando el máximo rendimiento.' },
                  { q: '¿Soporte técnico post-lanzamiento?', a: 'Ofrecemos mantenimiento continuo para asegurar que su plataforma siga orbitando sin errores, optimizando la seguridad y el rendimiento periódicamente.' }
                ].map((item, i) => (
                  <div key={i} className="glass rounded-[2rem] overflow-hidden group border-white/5">
                    <button className="w-full px-8 py-8 flex items-center justify-between text-left transition-all hover:bg-white/5 focus:bg-white/5 outline-none">
                      <span className="font-bold text-white text-lg font-space group-hover:text-[#f27121] uppercase tracking-tighter">{item.q}</span>
                      <span className="material-symbols-outlined text-slate-500 transition-transform group-focus:rotate-180">expand_more</span>
                    </button>
                    <div className="max-h-0 group-focus-within:max-h-40 overflow-hidden transition-all duration-500">
                      <div className="px-8 pb-8 text-slate-400 leading-relaxed text-sm uppercase tracking-widest font-bold">
                        {item.a}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <TrainCTA title={<>Lanza tu tienda<br />a la estratosfera</>} subtitle="Multiplica tus ventas en piloto automático" />
        </main>
        <ContactChannels onlyModal={true} />
      </div>
    </>
  );
}
