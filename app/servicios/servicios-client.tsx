'use client';

import React from 'react';
import Link from 'next/link';
import ContactChannels from '../components/ContactChannels';
import TrainCTA from '../components/TrainCTA';

export default function ServiciosClient() {
  return (
    <div className="bg-[#0b1229] text-white font-sans selection:bg-[#F27121]/30">
      <main className="pt-24">
        {/* Hero Section */}
        <section className="relative min-h-[800px] flex items-center px-8 overflow-hidden">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-12 gap-8">
            <div className="col-span-12 md:col-span-7 z-10 flex flex-col justify-center">
              <span className="text-[#F27121] font-bold tracking-[0.2em] uppercase text-sm mb-4">Misión Intergaláctica</span>
              <h1 className="text-6xl md:text-8xl text-white mb-6 font-title">
                Gama de <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#F27121]">Servicios Estelares</span>
              </h1>
              <p className="text-xl text-white/70 max-w-lg mb-10 leading-relaxed">
                Desbloquea el potencial infinito de tu marca con soluciones digitales de alto impacto diseñadas para dominar el vacío competitivo.
              </p>
              <div className="flex gap-4">
                <Link href="#protocolos" className="bg-[#F27121] text-[#0b1229] px-8 py-4 rounded-xl font-bold text-lg hover:shadow-[0_0_30px_rgba(242,113,33,0.3)] transition-all">
                  Explorar Órbitas
                </Link>
              </div>
            </div>
            <div className="col-span-12 md:col-span-5 relative mt-12 md:mt-0">
              <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#F27121]/10 rounded-full blur-[120px]"></div>
              <div className="relative z-0">
                <img 
                  alt="Meteoritos en Llamas" 
                  className="w-full h-auto max-h-[600px] object-contain animate-float" 
                  src="https://lh3.googleusercontent.com/aida/ADBb0ugT1Ia2piBzmiJjUQoP20ahgKkFYxH0rxjtNnXtvBA11lqh-GzQ2hr9zmq77XWmCrwbpet4ATrJT15gwixOrhfpQUXzx4DlPMYCrmKjgBs6PqjWD0sqXheUkLtzjCC1zbiWyIYuzWJxkqU-4reZekUMK9rKSU25SwA-crJrplkP2DIyWe1v5F7vxkzNQqB9bMHKInEJpoIjJrWrFWrGs3JgbUjx7aazjB_H46778uV_j0d_9uSA-ynVScdFneTUAsc7ji5y_xMP" 
                />
                <div className="absolute -bottom-6 -left-6 bg-slate-800/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-xl">
                  <span className="material-symbols-outlined text-[#F27121] text-4xl mb-2">rocket_launch</span>
                  <div className="text-white font-bold">Status: Launch Ready</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Service Details Grid */}
        <section id="protocolos" className="py-28 bg-[#0b1229]/50 px-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-20">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Nuestros Protocolos</h2>
              <div className="h-1 w-24 bg-[#F27121]"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Ads Card */}
              <Link href="/servicios/anuncios-de-alta-velocidad" className="block outline-none">
                <div className="bg-slate-800/40 backdrop-blur-xl p-10 rounded-2xl border border-white/5 hover:translate-y-[-8px] transition-transform group shadow-xl h-full cursor-pointer hover:border-[#F27121]/50">
                  <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center mb-8 border border-[#F27121]/20 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[#F27121] text-2xl">bolt</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4 group-hover:text-[#F27121] transition-colors">Anuncios de Alta Velocidad</h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-6">Campañas PPC con escalado rápido. Trazamos trayectorias de alto ROI para propulsar tus conversiones al infinito.</p>
                  <ul className="space-y-3 text-xs text-white/50 mb-8">
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">01</span> Google Ads & Meta</li>
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">02</span> Retargeting Magnético</li>
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">03</span> Optimización de Conversión</li>
                  </ul>
                </div>
              </Link>

              {/* WhatsApp IA Card */}
              <Link href="/servicios/whatsapp-ai" className="block outline-none">
                <div className="bg-slate-800/40 backdrop-blur-xl p-10 rounded-2xl border border-white/5 hover:translate-y-[-8px] transition-transform group shadow-xl h-full cursor-pointer hover:border-[#F27121]/50">
                  <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center mb-8 border border-[#F27121]/20 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[#F27121] text-2xl">chat</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4 group-hover:text-[#F27121] transition-colors">WhatsApp con IA</h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-6">Automatización inteligente para atención al cliente. Chatbots avanzados que cierran ventas en piloto automático.</p>
                  <ul className="space-y-3 text-xs text-white/50 mb-8">
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">01</span> Flujos de Venta IA</li>
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">02</span> Atención 24/7</li>
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">03</span> Integración con CRM</li>
                  </ul>
                </div>
              </Link>

              {/* UX/UI Card */}
              <Link href="/servicios/diseno-web-inmersivo" className="block outline-none">
                <div className="bg-slate-800/40 backdrop-blur-xl p-10 rounded-2xl border border-white/5 hover:translate-y-[-8px] transition-transform group shadow-xl h-full cursor-pointer hover:border-[#F27121]/50">
                  <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center mb-8 border border-[#F27121]/20 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[#F27121] text-2xl">grid_view</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4 group-hover:text-[#F27121] transition-colors">Diseño UX/UI</h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-6">Arquitectura de experiencias centrada en el usuario. Optimizamos cada punto de contacto para maximizar la satisfacción y conversión.</p>
                  <ul className="space-y-3 text-xs text-white/50 mb-8">
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">01</span> User Research Profundo</li>
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">02</span> Wireframing Estructural</li>
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">03</span> Prototipado de Alta Fidelidad</li>
                  </ul>
                </div>
              </Link>

              {/* E-commerce Card */}
              <Link href="/servicios/ecommerce-interestelar" className="block outline-none">
                <div className="bg-slate-800/40 backdrop-blur-xl p-10 rounded-2xl border border-white/5 hover:translate-y-[-8px] transition-transform group shadow-xl h-full cursor-pointer hover:border-[#F27121]/50">
                  <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center mb-8 border border-[#F27121]/20 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[#F27121] text-2xl">shopping_cart</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4 group-hover:text-[#F27121] transition-colors">E-commerce Interestelar</h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-6">Plataformas de venta robustas y escalables. Soluciones integrales para dominar el comercio electrónico global.</p>
                  <ul className="space-y-3 text-xs text-white/50 mb-8">
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">01</span> Pasarelas de Pago Seguras</li>
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">02</span> Gestión de Inventario</li>
                    <li className="flex items-center gap-2"><span className="text-[#F27121]">03</span> Análisis de Conversión</li>
                  </ul>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Value Prop Section */}
        <section className="py-28 px-8 overflow-hidden relative">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
            <div className="w-full md:w-1/2">
              <img 
                alt="Ilustración de astronauta Rifx Marketing" 
                className="w-full h-auto object-contain animate-[float_6s_ease-in-out_infinite]" 
                src="/images/origenes-historia.png" 
              />
            </div>
            <div className="w-full md:w-1/2">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-12">Por qué elegir <span className="text-[#F27121]">Rifx Marketing</span></h2>
              <div className="space-y-12">
                <div className="flex gap-6">
                  <span className="material-symbols-outlined text-[#F27121] text-3xl">memory</span>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">Tecnología Avanzada</h4>
                    <p className="text-white/60 text-sm leading-relaxed">Utilizamos algoritmos de última generación para predecir tendencias antes de que alcancen la estratosfera.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <span className="material-symbols-outlined text-[#F27121] text-3xl">auto_awesome</span>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">Creatividad de Alcance Estelar</h4>
                    <p className="text-white/60 text-sm leading-relaxed">No solo diseñamos, creamos experiencias visuales que rompen la barrera de lo convencional.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <span className="material-symbols-outlined text-[#F27121] text-3xl">groups</span>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">Tripulación Experta</h4>
                    <p className="text-white/60 text-sm leading-relaxed">Estrategas y creativos con años de vuelo en el sector digital liderando tu expedición.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <TrainCTA title={<>Expande tu<br />flota comercial</>} subtitle="Descubre todos nuestros servicios" />
      </main>
      <ContactChannels onlyModal={true} />
    </div>
  );
}
