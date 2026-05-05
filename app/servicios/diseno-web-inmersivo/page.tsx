'use client';

import React from 'react';
import ContactChannels from '../../components/ContactChannels';
import TrainCTA from '../../components/TrainCTA';

export default function DisenoUXUI() {

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
                  Architectural Experience 2024
                </div>
                <h1 className="text-6xl md:text-8xl leading-[0.9] mb-8 text-white font-title">
                  Diseño UX/UI de <br /><span className="text-gradient">Alta Gravedad</span>
                </h1>
                <p className="text-lg text-slate-400 leading-relaxed mb-12 max-w-xl uppercase tracking-tighter font-medium">
                  Creamos experiencias memorables que orbitan alrededor del usuario. No solo diseñamos interfaces; construimos <strong className="text-white underline decoration-[#f27121]">puentes cognitivos</strong> entre su marca y la mente de sus clientes.
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                  <button onClick={() => document.getElementById('train-cta')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#f27121] text-white px-10 py-5 rounded-xl font-bold text-base hover:shadow-[0_0_40px_rgba(242,113,33,0.3)] transition-all duration-300 uppercase tracking-widest">
                    Iniciar Misión 🚀
                  </button>
                  <div className="flex items-center gap-6 px-8 border-l border-white/10">
                    <div className="text-left">
                      <p className="text-[#f27121] font-black text-3xl leading-none font-space">UX</p>
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">OPTIMIZADO</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#f27121]/30 via-transparent to-blue-500/20 blur-[120px]"></div>
                <div className="relative glass rounded-[2.5rem] p-4 border-white/10 overflow-hidden group rotate-2">
                  <div className="absolute top-0 left-0 w-full h-10 bg-white/5 border-b border-white/10 flex items-center px-6 gap-2 z-20">
                     <div className="w-2.5 h-2.5 rounded-full bg-red-500/40"></div>
                     <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40"></div>
                     <div className="w-2.5 h-2.5 rounded-full bg-green-500/40"></div>
                  </div>
                  <img 
                    alt="Bandaid Medical UI Portfolio" 
                    className="w-full h-auto rounded-[1.8rem] grayscale-[0.4] group-hover:grayscale-0 transition-all duration-700 shadow-2xl pt-10" 
                    src="/images/portfolio/web3_medical.png" 
                  />
                  <div className="absolute bottom-10 left-10 right-10 p-6 glass rounded-2xl border-white/10 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#f27121] animate-pulse"></div>
                      <span className="text-xs font-space font-bold uppercase tracking-widest text-white">Latencia de diseño: 0.0ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Núcleos de Innovación */}
          <section className="py-32 px-6 max-w-7xl mx-auto">
            <div className="mb-24 max-w-2xl">
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 font-space tracking-tighter uppercase leading-none">Núcleos de <br/><span className="text-gradient">Innovación</span></h2>
              <p className="text-slate-400 text-lg uppercase tracking-widest font-bold leading-relaxed">Nuestra aproximación combina rigor técnico con empatía radical para forjar conexiones humanas duraderas.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: 'psychology', title: 'Investigación', desc: 'Excavamos profundamente en el comportamiento para descubrir insights en la superficie.' },
                { icon: 'account_tree', title: 'Arquitectura', desc: 'Organizamos el caos digital en estructuras lógicas y navegables.' },
                { icon: 'layers', title: 'Wireframing', desc: 'Planos detallados para validar flujos antes de la capa estética.' },
                { icon: 'palette', title: 'Diseño Visual', desc: 'Estética de alta costura digital. Interfaces que enamoran a primera vista.' }
              ].map((item, i) => (
                <div key={i} className="glass glass-hover p-12 rounded-[2.5rem] transition-all duration-500 flex flex-col items-start group">
                  <div className="bg-orange-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform border border-orange-500/20">
                    <span className="material-symbols-outlined text-[#f27121] text-3xl">{item.icon}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4 font-space uppercase tracking-tighter">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed text-sm uppercase tracking-widest font-bold">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Metodología Section */}
          <section className="py-32 bg-[#080f24]/50 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-24">
                <h2 className="text-3xl md:text-7xl font-bold text-white mb-6 font-space tracking-tight uppercase">Metodología <span className="text-gradient">Galáctica</span></h2>
                <p className="text-slate-400 text-lg uppercase tracking-[0.3em] font-black">De la idea al impacto orbital.</p>
              </div>
              <div className="relative grid grid-cols-1 md:grid-cols-4 gap-12">
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5 hidden md:block z-0"></div>
                {[
                  { step: '01', title: 'Investigación', desc: 'Inmersión profunda en el ecosistema.' },
                  { step: '02', title: 'Prototipado', desc: 'Materialización de soluciones tangibles.' },
                  { step: '03', title: 'Testeo', desc: 'Validación real en gravedad cero.' },
                  { step: '04', title: 'Lanzamiento', desc: 'Ignición y despliegue final.' }
                ].map((item, i) => (
                  <div key={i} className="relative z-10 flex flex-col items-center text-center group">
                    <div className="w-20 h-20 rounded-full bg-[#181e36] border-2 border-[#f27121]/20 flex items-center justify-center text-[#f27121] font-black text-3xl mb-8 group-hover:border-[#f27121] transition-all shadow-[0_0_30px_rgba(242,113,33,0.1)] group-hover:shadow-[0_0_50px_rgba(242,113,33,0.3)] font-space">
                      {item.step}
                    </div>
                    <h4 className="font-black text-2xl mb-3 uppercase tracking-tighter text-white font-space">{item.title}</h4>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed max-w-[150px]">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Portafolio Section */}
          <section className="py-32 px-6 max-w-7xl mx-auto">
            <div className="text-center mb-24">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#ffb692] text-[10px] font-bold tracking-[0.3em] uppercase mb-4">
                Portafolio Estelar
              </div>
              <h2 className="text-4xl md:text-7xl font-bold text-white mb-6 font-space tracking-tighter uppercase leading-none">Nuestras <br/><span className="text-gradient">Creaciones</span></h2>
              <p className="text-slate-400 text-lg uppercase tracking-widest font-bold leading-relaxed max-w-2xl mx-auto">Explora el arsenal de interfaces de alto rendimiento que hemos desplegado en el multiverso digital.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {[
                { img: '/images/portfolio/web1.jpg', title: 'Portal de Juegos Pro', category: 'Gaming UX' },
                { img: '/images/portfolio/web2.jpg', title: 'E-commerce de Tráfico', category: 'Fintech UI' },
                { img: '/images/portfolio/web3_medical.png', title: 'Bandaid Medical Kit', category: 'Health UI' },
                { img: '/images/portfolio/web4_fixed.png', title: 'Plataforma Biking Pro', category: 'Sport Tech' }
              ].map((item, i) => (
                <div key={i} className="group relative overflow-hidden rounded-[2.5rem] bg-[#181e36] border border-white/5 transition-all duration-700 hover:translate-y-[-10px] hover:border-[#f27121]/30">
                  <div className="aspect-[16/10] overflow-hidden relative">
                    <img 
                      src={item.img} 
                      alt={item.title}
                      className="w-full h-full object-cover object-top grayscale-[0.6] brightness-75 contrast-125 group-hover:grayscale-0 group-hover:brightness-100 group-hover:object-bottom transition-all duration-[5000ms] ease-in-out"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b1229] via-[#0b1229]/20 to-transparent opacity-80 group-hover:opacity-40 transition-opacity"></div>
                  <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end">
                    <div>
                      <p className="text-[#f27121] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{item.category}</p>
                      <h3 className="text-3xl font-black uppercase tracking-tighter text-white font-space">{item.title}</h3>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-[#f27121] flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform duration-500 shadow-xl shadow-orange-900/40">
                      <span className="material-symbols-outlined font-black">arrow_outward</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pricing Section */}
          <section className="py-32 px-6 max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-20">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#ffb692] text-[10px] font-bold tracking-[0.3em] uppercase mb-4">
                Planes de Inversión
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 font-space tracking-tighter uppercase leading-none">Tenemos el <span className="text-gradient">Sitio Web</span><br/>para tu negocio</h2>
              <p className="text-slate-400 text-sm md:text-base uppercase tracking-widest font-bold leading-relaxed max-w-2xl mx-auto">Selecciona la nave adecuada para la misión de tu empresa.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Tier 1: Una Página */}
              <div className="glass p-10 rounded-[2.5rem] border border-white/5 hover:border-[#f27121]/30 transition-all duration-500 hover:-translate-y-2 group">
                <h3 className="text-xl font-black text-white mb-4 font-space uppercase tracking-tighter">Sitio Web de <br/><span className="text-[#f27121]">Una Página</span></h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8 h-24">Ideal para lanzamientos de productos, seminarios web, talleres, clases magistrales, servicios de consultoría o promociones especiales.</p>
                <div className="mb-8">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Inversión Desde</p>
                  <p className="text-4xl font-black text-white font-space">$490 <span className="text-xl text-[#f27121]">USD</span></p>
                </div>
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8"></div>
                <p className="text-white font-bold text-sm uppercase tracking-widest mb-6">Incluye:</p>
                <ul className="space-y-4 mb-10">
                  {['Blog', 'Chat en línea', 'Calendario'].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[#f27121] text-lg">check_circle</span>
                      <span className="text-slate-300 text-sm font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => document.getElementById('train-cta')?.scrollIntoView({ behavior: 'smooth' })} className="w-full py-4 rounded-xl border border-white/10 text-white font-bold uppercase tracking-widest text-xs hover:bg-[#f27121] hover:border-[#f27121] transition-all duration-300">Solicitar Asesoría</button>
              </div>

              {/* Tier 2: Básico */}
              <div className="glass p-10 rounded-[2.5rem] border border-[#f27121]/50 bg-[#f27121]/5 hover:bg-[#f27121]/10 transition-all duration-500 transform lg:-translate-y-6 shadow-[0_0_50px_rgba(242,113,33,0.1)] group relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#f27121] text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg">Más Popular</div>
                <h3 className="text-xl font-black text-white mb-4 font-space uppercase tracking-tighter">Sitio Web <br/><span className="text-[#f27121]">Básico</span></h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-8 h-24">Ideal para compartir información, crear una marca institucional y empresas que ofrecen 2 o 3 líneas de servicio.</p>
                <div className="mb-8">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Inversión Desde</p>
                  <p className="text-4xl font-black text-white font-space">$990 <span className="text-xl text-[#f27121]">USD</span></p>
                </div>
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#f27121]/30 to-transparent mb-8"></div>
                <p className="text-white font-bold text-sm uppercase tracking-widest mb-6">Incluye:</p>
                <ul className="space-y-4 mb-10">
                  {['Blog', 'Chat en línea', 'Menús desplegables', 'Calendario de programación', 'Formulario de registro o contacto'].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[#f27121] text-lg">check_circle</span>
                      <span className="text-slate-200 text-sm font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => document.getElementById('train-cta')?.scrollIntoView({ behavior: 'smooth' })} className="w-full py-4 rounded-xl bg-[#f27121] text-white font-black uppercase tracking-widest text-xs hover:shadow-[0_0_20px_rgba(242,113,33,0.4)] transition-all duration-300">Iniciar Proyecto</button>
              </div>

              {/* Tier 3: E-commerce */}
              <div className="glass p-10 rounded-[2.5rem] border border-white/5 hover:border-[#f27121]/30 transition-all duration-500 hover:-translate-y-2 group">
                <h3 className="text-xl font-black text-white mb-4 font-space uppercase tracking-tighter">E-Commerce & <br/><span className="text-[#f27121]">Tienda en Línea</span></h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8 h-24">Es perfecto para empresas que desean vender directamente a sus clientes a través de su sitio web.</p>
                <div className="mb-8">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Inversión Desde</p>
                  <p className="text-4xl font-black text-white font-space">$1,490 <span className="text-xl text-[#f27121]">USD</span></p>
                </div>
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8"></div>
                <p className="text-white font-bold text-sm uppercase tracking-widest mb-6">Incluye:</p>
                <ul className="space-y-4 mb-10">
                  {['Precios variables', 'Posicionamiento SEO', 'Gestión de inventario', 'Filtros de categorías múltiples', 'Categorización de productos', 'Seguimiento de pedidos y pagos', 'Integración con PayPal y PayU', 'Cupones de descuento y promociones', 'Google Merchant Center Integration'].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[#f27121] text-lg">check_circle</span>
                      <span className="text-slate-300 text-sm font-medium leading-tight">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => document.getElementById('train-cta')?.scrollIntoView({ behavior: 'smooth' })} className="w-full py-4 rounded-xl border border-white/10 text-white font-bold uppercase tracking-widest text-xs hover:bg-[#f27121] hover:border-[#f27121] transition-all duration-300">Solicitar Asesoría</button>
              </div>

            </div>
          </section>

          <TrainCTA title={<>Diseñemos tu<br />Universo Digital</>} subtitle="Crea una experiencia web inmersiva" />
        </main>
        <ContactChannels onlyModal={true} />
      </div>
    </>
  );
}
