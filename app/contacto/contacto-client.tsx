'use client';

import React from 'react';

import ContactChannels from '../components/ContactChannels';

export default function ContactoClient() {
  return (
    <>
      <style jsx global>{`
        body { font-family: 'Montserrat', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .selection-orange::selection { background-color: #f27121; color: white; }
        
        .glass { background: rgba(24, 30, 54, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .glass-hover:hover { background: rgba(24, 30, 54, 0.6); border-color: rgba(242, 113, 33, 0.3); }
        .text-gradient { background: linear-gradient(to right, #ffb692, #f27121); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      `}</style>

      {/* External Resources */}
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&display=swap" rel="stylesheet"/>

      <div className="bg-[#0b1229] text-[#dce1ff] selection-orange antialiased overflow-x-hidden min-h-screen">
        <main className="pt-24 pb-20">
          {/* Hero Section */}
          <section className="relative px-6 py-20 max-w-7xl mx-auto text-center">
             <div className="absolute inset-0 bg-gradient-to-b from-[#f27121]/5 to-transparent pointer-events-none"></div>
             <div className="relative z-10">
                <div className="inline-flex items-center px-6 py-2 rounded-full bg-[#f27121] text-white text-[10px] font-black uppercase tracking-[0.3em] mb-8 shadow-lg shadow-orange-900/20">
                   Múltiples Canales VIP
                </div>
                <h1 className="text-5xl md:text-8xl text-white mb-6 font-title">
                  ¿Cómo Prefieres <br /><span className="text-gradient">Contactarnos?</span>
                </h1>
                <p className="text-slate-400 text-lg md:text-xl uppercase tracking-widest font-bold max-w-2xl mx-auto leading-relaxed">
                  Elige el método que más te convenga para iniciar tu proyecto y llevar tu marca a la órbita del éxito.
                </p>
             </div>
          </section>

          <ContactChannels hideHeader />

          {/* Map Placeholder or Secondary Info */}
          <section className="px-6 max-w-7xl mx-auto pb-32">
            <div className="glass rounded-[3rem] p-8 md:p-16 relative overflow-hidden border-white/5">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#f27121] blur-[150px] opacity-10 rounded-full"></div>
               <div className="grid lg:grid-cols-2 gap-16 items-center">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-6 font-space uppercase">Nuestra Base de Órbita</h2>
                    <p className="text-slate-400 text-lg uppercase tracking-widest font-bold leading-relaxed mb-8">
                      Operamos desde el núcleo de la innovación digital, conectando marcas con el multiverso de oportunidades globales.
                    </p>
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <span className="material-symbols-outlined text-[#f27121]">location_on</span>
                        <span className="text-white font-bold uppercase tracking-widest text-sm">Celestial Sector 7G, Nebula District</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="material-symbols-outlined text-[#f27121]">support_agent</span>
                        <span className="text-white font-bold uppercase tracking-widest text-sm">Soporte Estelar 24/7 Disponible</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative aspect-video rounded-[2rem] overflow-hidden border border-white/10">
                    <img 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCXgWBZ0lMTLLugXf3MgbCnnZRkmeqON7buo5eF5dQPhvn5d0UzyOjKVk4eyjet0AUPwfSQDW7lZvSib0diCwjLVmNwPGtTGgzYah51ZmzNOpvZzrrlyFzBVIoa5aJnkqH7IhKM5JC4Tqj2ywZgBpx2GUtuv9RnfzPBOXH-_8RFsp9mQu6opCdBCtiE_3Z5QL9bJ2GTfTq3EUk24uDcWE6rar9kihLsrXZ8ZdwBSW09MUk7ud2uOzENjD2hkHYOi0uSZlPQJfX22x0" 
                      className="w-full h-full object-cover grayscale contrast-125 opacity-50"
                      alt="Base de órbita"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b1229] to-transparent"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 bg-[#f27121] rounded-full animate-ping"></div>
                      <div className="w-3 h-3 bg-[#f27121] rounded-full absolute shadow-[0_0_20px_rgba(242,113,33,1)]"></div>
                    </div>
                  </div>
               </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
