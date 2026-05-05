'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import ContactChannels from '../../components/ContactChannels';
import TrainCTA from '../../components/TrainCTA';

export default function AnunciosAltaVelocidad() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', email: '', objetivo: '' });
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'submitting'>('idle');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus('submitting');
    setTimeout(() => {
      setSubmitStatus('success');
      setTimeout(() => {
        setIsModalOpen(false);
        setSubmitStatus('idle');
        setFormData({ nombre: '', email: '', objetivo: '' });
      }, 3000);
    }, 1500);
  };

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
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="z-10 animate-fade-in-up">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#ffb692] text-[10px] font-bold tracking-[0.3em] uppercase mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f27121] mr-2 animate-pulse"></span>
                  Ad-Velocity Protocol 2024
                </div>
                <h1 className="text-5xl md:text-7xl leading-[1] mb-8 text-white font-title">
                  Anuncios de <br /><span className="text-gradient">Alta Velocidad</span>
                </h1>
                <p className="text-lg text-slate-400 leading-relaxed mb-12 max-w-lg">
                  Logramos leads cualificados desde <strong className="text-white">$0.08</strong>. Impulsamos el crecimiento de su marca mediante ingeniería de pauta basada en datos y optimización quirúrgica.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button onClick={() => document.getElementById('train-cta')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#f27121] text-white px-10 py-5 rounded-xl font-bold text-base hover:shadow-[0_0_40px_rgba(242,113,33,0.3)] transition-all duration-300 uppercase tracking-widest">
                    Iniciar Misión
                  </button>
                  <Link href="/#proyectos" className="bg-white/5 border border-white/10 px-10 py-5 rounded-xl font-bold text-base backdrop-blur-md hover:bg-white/10 transition-all uppercase tracking-widest text-white flex items-center">
                    Ver Portafolio
                  </Link>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#f27121]/30 via-transparent to-blue-500/20 blur-[120px]"></div>
                <div className="relative glass rounded-[2.5rem] p-4 border-white/10 overflow-hidden group">
                  <img 
                    alt="High-speed digital advertising interface" 
                    className="w-full h-auto rounded-[1.8rem] grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700 shadow-2xl" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCW8TElpBdx8WjvX4JHJJ44KbkR-VCnAyfmD4hZbklxUjrXBxleGm7H9FNp4ynRleVe_54msvIrWML-75H6LWWHt4hZaJmOWtKZ4hZFO_XpsvH_3d-vlYC_bl3ODvHreeJr7DfWcQyKvzEtFNGQm4TolEif0RiwTC0sHowKSbjS2OdESlokR20TkspKkCA9DvWEaBbxuiHFVFqWmX_0ZTar-dx8pclp7YlJDoc4H9GwDHhou_nudJ9k2mZ3tKy9-KPD86dCiv9XoEU" 
                  />
                  <div className="absolute bottom-10 left-10 right-10 p-6 glass rounded-2xl border-white/10 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-xs font-space font-bold uppercase tracking-widest">Pauta Activa - Optimización 24/7</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Comparativa Section */}
          <section className="py-32 px-6 max-w-7xl mx-auto">
            <div className="text-center mb-24">
              <h2 className="text-3xl md:text-6xl font-bold text-white mb-6 font-space tracking-tight uppercase">Rifx vs. <span className="text-slate-500">Agencias Comunes</span></h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg uppercase tracking-widest font-bold">Ingeniería de pauta optimizada para el retorno estelar.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch">
              <div className="glass p-12 rounded-[2.5rem] border-white/5 opacity-60 grayscale group hover:grayscale-0 transition-all duration-700">
                 <div className="flex items-center gap-4 mb-10">
                   <span className="material-symbols-outlined text-slate-500 text-4xl">trending_down</span>
                   <h3 className="text-2xl font-bold text-slate-500 font-space uppercase">Tradicionales</h3>
                 </div>
                 <ul className="space-y-8">
                   <li className="flex justify-between border-b border-white/5 pb-4">
                     <span className="text-slate-500 uppercase text-xs font-bold">Costo x Lead</span>
                     <span className="text-white font-bold">$1.50 - $4.00</span>
                   </li>
                   <li className="flex justify-between border-b border-white/5 pb-4">
                     <span className="text-slate-500 uppercase text-xs font-bold">Respuesta</span>
                     <span className="text-white font-bold">24-48 Horas</span>
                   </li>
                   <li className="flex justify-between border-b border-white/5 pb-4">
                     <span className="text-slate-500 uppercase text-xs font-bold">Segmentación</span>
                     <span className="text-white font-bold italic">Genérica</span>
                   </li>
                 </ul>
              </div>
              <div className="glass p-12 rounded-[2.5rem] border-[#f27121]/40 bg-[#181e36]/60 shadow-[0_0_50px_rgba(242,113,33,0.15)] relative scale-[1.02]">
                 <div className="absolute -top-4 right-10 bg-[#f27121] text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-[0.2em]">High Performance</div>
                 <div className="flex items-center gap-4 mb-10">
                   <span className="material-symbols-outlined text-[#f27121] text-4xl">rocket_launch</span>
                   <h3 className="text-2xl font-bold text-white font-space uppercase">Rifx Marketing</h3>
                 </div>
                 <ul className="space-y-8">
                   <li className="flex justify-between border-b border-[#f27121]/20 pb-4">
                     <span className="text-[#ffb692] uppercase text-xs font-bold">Costo x Lead</span>
                     <span className="text-white font-black text-2xl tracking-tighter">$0.08 <span className="text-xs text-slate-500 line-through font-normal ml-2">$2.50</span></span>
                   </li>
                   <li className="flex justify-between border-b border-[#f27121]/20 pb-4">
                     <span className="text-[#ffb692] uppercase text-xs font-bold">Respuesta</span>
                     <span className="text-white font-black flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> INSTANTÁNEA (IA)
                     </span>
                   </li>
                   <li className="flex justify-between border-b border-[#f27121]/20 pb-4">
                     <span className="text-[#ffb692] uppercase text-xs font-bold">Segmentación</span>
                     <span className="text-white font-black uppercase tracking-widest text-xs">Quirúrgica x Datos</span>
                   </li>
                 </ul>
              </div>
            </div>
          </section>

          {/* Caso de Éxito / Proof Section */}
          <section className="py-24 px-6 max-w-7xl mx-auto relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[#f27121]/5 to-transparent blur-[100px] pointer-events-none"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1 relative group cursor-pointer" onClick={() => setLightboxImage('/images/results-proof.png')}>
                <div className="absolute -inset-1 bg-gradient-to-r from-[#f27121] to-[#ffb692] rounded-[3rem] blur opacity-20 group-hover:opacity-40 transition duration-700"></div>
                <div className="relative glass p-4 rounded-[3rem] border-white/10 transform group-hover:scale-[1.02] transition-transform duration-500 shadow-2xl">
                  <div className="relative rounded-[2.5rem] overflow-hidden">
                    <img 
                      src="/images/results-proof.png" 
                      alt="Prueba de resultados de campaña exitosa" 
                      className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-[#0b1229]/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-white text-4xl">zoom_in</span>
                        <span className="text-white font-space font-bold uppercase tracking-widest text-xs">Ampliar Datos</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-6 -right-6 bg-[#f27121] text-white p-6 rounded-3xl shadow-[0_10px_30px_rgba(242,113,33,0.4)] border border-white/20 z-20 transition-transform duration-500 group-hover:-translate-y-2">
                    <p className="text-sm font-space uppercase tracking-widest font-bold mb-1">Costo x Lead Bajó</p>
                    <p className="text-4xl font-black">-85%</p>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2 text-center lg:text-left">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-[0.3em] uppercase mb-8">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                  Evidencia en Tiempo Real
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 font-space tracking-tight">Datos que Respaldan <span className="text-gradient">la Velocidad</span></h2>
                <p className="text-slate-400 text-lg leading-relaxed mb-8">
                  No vendemos humo, vendemos combustible. Así se ve una campaña de <strong className="text-white">Alta Velocidad</strong> tras aplicar nuestra ingeniería de datos y optimización algorítmica constante.
                </p>
                <ul className="space-y-6">
                  <li className="flex items-center gap-4 justify-center lg:justify-start">
                    <span className="material-symbols-outlined text-[#f27121] text-3xl">rocket_launch</span>
                    <span className="text-white font-bold uppercase tracking-widest text-sm">Escalamiento Inmediato</span>
                  </li>
                  <li className="flex items-center gap-4 justify-center lg:justify-start">
                    <span className="material-symbols-outlined text-[#f27121] text-3xl">my_location</span>
                    <span className="text-white font-bold uppercase tracking-widest text-sm">Tráfico Ultra-Cualificado</span>
                  </li>
                  <li className="flex items-center gap-4 justify-center lg:justify-start">
                    <span className="material-symbols-outlined text-[#f27121] text-3xl">query_stats</span>
                    <span className="text-white font-bold uppercase tracking-widest text-sm">Multiplicador de ROAS</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Bento Grid Beneficios */}
          <section className="py-32 px-6 max-w-7xl mx-auto">
            <div className="text-center mb-24">
              <h2 className="text-3xl md:text-6xl font-bold text-white mb-6 font-space tracking-tight">Potencia su <span className="text-gradient">Flota Comercial</span></h2>
              <p className="text-slate-400 text-lg uppercase tracking-widest font-bold">Diseñamos embudos de alta fricción para curiosos y alta conversión para compradores.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: 'bolt', title: 'Impacto Veloz', desc: 'Tracción comercial en tiempo récord conectando su oferta con el cliente ideal hoy mismo.' },
                { icon: 'groups', title: 'Captación de Prospectos', desc: 'Incrementamos el volumen y calidad mediante campañas hiper-segmentadas.' },
                { icon: 'language', title: 'Alcance Global', desc: 'Dirigimos un flujo constante de usuarios altamente cualificados hacia su órbita digital.' },
                { icon: 'verified', title: 'Autoridad de Marca', desc: 'Posicionamos su identidad en el "Top of Mind" mediante impactos visuales estratégicos.' },
                { icon: 'monitoring', title: 'Inteligencia de Datos', desc: 'Transparencia total con reportes automáticos y analítica avanzada.' },
                { icon: 'sync', title: 'Reconexión Estelar', desc: 'Remarketing dinámico que persigue al cliente hasta el cierre final del contrato.' }
              ].map((item, i) => (
                <div key={i} className="glass glass-hover p-10 rounded-[2.5rem] transition-all duration-500 flex flex-col items-start group">
                  <div className="bg-orange-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform border border-orange-500/20">
                    <span className="material-symbols-outlined text-[#f27121] text-3xl">{item.icon}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4 font-space uppercase tracking-tight">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed text-sm uppercase tracking-widest font-bold">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-32 bg-[#080f24]/30">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-6xl font-bold text-white mb-6 font-space tracking-tight uppercase">Protocolos de Pauta</h2>
                <p className="text-slate-400 uppercase tracking-widest font-bold text-xs">Detalles técnicos sobre nuestra ingeniería de anuncios.</p>
              </div>
              <div className="space-y-4">
                {[
                  {
                    q: '¿Cómo logran costos de $0.08 por lead?',
                    a: 'Mediante una arquitectura de pauta optimizada por IA que detecta los clusters de audiencia más económicos y con mayor intención de compra en tiempo real.'
                  },
                  {
                    q: '¿En qué plataformas operan la flota?',
                    a: 'Dominamos el ecosistema completo: Meta Ads (Facebook/Instagram), Google Ads (Search, YouTube), TikTok Ads y LinkedIn Ads, desplegando su mensaje exactamente donde orbita su cliente ideal.'
                  },
                  {
                    q: '¿Cómo miden el retorno de inversión (ROI)?',
                    a: 'Implementamos píxeles de seguimiento avanzado y APIs de conversión para trazar cada centavo invertido. Recibirá reportes en tiempo real con métricas absolutas: Costo por Adquisición, ROAS y Volumen de Leads calificados.'
                  }
                ].map((faq, i) => (
                  <div key={i} className={`glass rounded-[2rem] overflow-hidden transition-all duration-300 border ${activeFaq === i ? 'border-[#f27121]/50 bg-white/5' : 'border-white/5 hover:border-white/20'}`}>
                    <button 
                      onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                      className="w-full px-8 py-8 flex items-center justify-between text-left outline-none group"
                    >
                      <span className={`font-bold text-lg font-space uppercase tracking-tighter transition-colors ${activeFaq === i ? 'text-[#f27121]' : 'text-white group-hover:text-[#ffb692]'}`}>
                        {faq.q}
                      </span>
                      <span className={`material-symbols-outlined transition-transform duration-300 ${activeFaq === i ? 'rotate-180 text-[#f27121]' : 'text-slate-500 group-hover:text-[#ffb692]'}`}>
                        expand_more
                      </span>
                    </button>
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${activeFaq === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="px-8 pb-8 text-slate-400 leading-relaxed text-sm uppercase tracking-widest font-bold border-t border-white/5 pt-6 mt-2">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <TrainCTA title={<>Acelera tu<br />Crecimiento Hoy</>} subtitle="Despliega campañas de alta velocidad" />
        </main>

        {/* Modal Logic */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0b1229]/90 backdrop-blur-md cursor-pointer" onClick={() => setIsModalOpen(false)}></div>
            <div className="relative glass p-10 rounded-[3rem] max-w-lg w-full border-white/10 shadow-2xl animate-in fade-in zoom-in duration-300">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-white/50 hover:text-[#f27121] transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
              <h3 className="text-3xl font-bold text-white mb-4 font-space uppercase tracking-tighter">Despega tu Marca</h3>
              <p className="text-slate-400 mb-8 text-sm uppercase tracking-widest font-bold">Inicia la secuencia de lanzamiento publicitario.</p>
              
              {submitStatus === 'success' ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-emerald-500 text-6xl mb-6">verified</span>
                  <h4 className="text-2xl font-bold text-white mb-2 font-space uppercase">Misión Iniciada</h4>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">Nos comunicaremos a la velocidad de la luz.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.3em] text-[#f27121] font-black mb-3">Comandante</label>
                    <input required name="nombre" value={formData.nombre} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white focus:ring-2 focus:ring-[#f27121] outline-none transition-all placeholder:text-slate-700 font-bold" placeholder="NOMBRE COMPLETO" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.3em] text-[#f27121] font-black mb-3">Frecuencia (Email)</label>
                    <input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white focus:ring-2 focus:ring-[#f27121] outline-none transition-all placeholder:text-slate-700 font-bold" placeholder="CORREO@EJEMPLO.COM" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.3em] text-[#f27121] font-black mb-3">Objetivo</label>
                    <textarea required name="objetivo" value={formData.objetivo} onChange={handleInputChange} rows={3} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white focus:ring-2 focus:ring-[#f27121] outline-none transition-all placeholder:text-slate-700 font-bold resize-none" placeholder="CUÉNTANOS TU VISIÓN"></textarea>
                  </div>
                  <button type="submit" disabled={submitStatus === 'submitting'} className="w-full bg-[#f27121] text-white font-black py-5 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-lg disabled:opacity-50">
                    {submitStatus === 'submitting' ? 'PROCESANDO...' : 'SOLICITAR AUDITORÍA'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Lightbox Modal */}
        {lightboxImage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0b1229]/95 backdrop-blur-xl cursor-pointer" onClick={() => setLightboxImage(null)}></div>
            <button onClick={() => setLightboxImage(null)} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors z-20 bg-white/5 p-3 rounded-full backdrop-blur-md border border-white/10 hover:bg-white/10">
              <span className="material-symbols-outlined">close</span>
            </button>
            <img 
              src={lightboxImage} 
              alt="Ampliación de datos" 
              className="relative z-10 max-w-full max-h-[90vh] rounded-2xl shadow-[0_0_50px_rgba(242,113,33,0.2)] animate-in fade-in zoom-in duration-300" 
            />
          </div>
        )}
        <ContactChannels onlyModal={true} />
      </div>
    </>
  );
}
