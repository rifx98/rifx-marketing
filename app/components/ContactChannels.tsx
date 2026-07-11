'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';

interface ContactChannelsProps {
  hideHeader?: boolean;
  onlyModal?: boolean;
}

const COUNTRIES = [
  { code: 'EC', name: 'Ecuador', dial: '+593' },
  { code: 'CO', name: 'Colombia', dial: '+57' },
  { code: 'AR', name: 'Argentina', dial: '+54' },
  { code: 'CL', name: 'Chile', dial: '+56' },
  { code: 'MX', name: 'México', dial: '+52' },
  { code: 'PE', name: 'Perú', dial: '+51' },
  { code: 'ES', name: 'España', dial: '+34' },
  { code: 'US', name: 'USA', dial: '+1' },
  { code: 'CR', name: 'Costa Rica', dial: '+506' },
  { code: 'CU', name: 'Cuba', dial: '+53' },
  { code: 'PA', name: 'Panamá', dial: '+507' },
  { code: 'UY', name: 'Uruguay', dial: '+598' },
  { code: 'VE', name: 'Venezuela', dial: '+58' },
];

const SERVICES = [
  { id: 'ads', label: 'Anuncios de Alta Velocidad', icon: 'rocket_launch' },
  { id: 'whatsapp', label: 'WhatsApp con IA', icon: 'smart_toy' },
  { id: 'uxui', label: 'Diseño UX/UI Inmersivo', icon: 'palette' },
  { id: 'ecommerce', label: 'E-commerce Interestelar', icon: 'shopping_cart' },
  { id: 'other', label: 'Otro proyecto', icon: 'lightbulb' },
];

export default function ContactChannels({ hideHeader = false, onlyModal = false }: ContactChannelsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const modalScrollRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    celular: '',
    country: COUNTRIES[0],
    necesidad: SERVICES[0],
    descripcion: '',
    privacy: false,
    tips: false
  });

  const filteredCountries = useMemo(() => {
    return COUNTRIES.filter(c => 
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) || 
      c.dial.includes(countrySearch) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
    );
  }, [countrySearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = formData.celular.replace(/\s/g, '');
    if (cleanPhone.length < 10) {
      alert('El número de celular debe tener exactamente 10 dígitos');
      return;
    }
    if (!formData.privacy) {
      alert('Debes aceptar la política de privacidad');
      return;
    }
    console.log('Form submitted:', {...formData, celular: cleanPhone});
    setIsModalOpen(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.custom-dropdown')) {
        setIsServiceOpen(false);
        setIsCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for custom event to open modal from other components
  useEffect(() => {
    const handleOpenModal = () => setIsModalOpen(true);
    window.addEventListener('openConsultationModal', handleOpenModal);
    return () => window.removeEventListener('openConsultationModal', handleOpenModal);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  return (
    <>
      {!onlyModal && (
        <section className={`${hideHeader ? 'py-10' : 'py-32'} px-6 bg-[#0b1229] relative overflow-hidden`} id="contacto">
          {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_rgba(242,113,33,0.05)_0%,_transparent_70%)] pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        {!hideHeader && (
          <div className="text-center mb-20">
            <div className="inline-flex items-center px-6 py-2 rounded-full bg-[#f27121] text-white text-[10px] font-black uppercase tracking-[0.3em] mb-8 shadow-lg shadow-orange-900/20">
              Múltiples Canales VIP
            </div>
            <h2 className="text-4xl md:text-7xl font-bold text-white mb-6 font-space tracking-tighter uppercase leading-tight">
              ¿Cómo Prefieres <br /><span className="text-gradient">Contactarnos?</span>
            </h2>
            <p className="text-slate-400 text-lg uppercase tracking-widest font-bold max-w-2xl mx-auto leading-relaxed">
              Elige el método que más te convenga para iniciar tu proyecto
            </p>
          </div>
        )}

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          
          {/* WhatsApp Card */}
          <div className="glass glass-hover rounded-[2.5rem] p-8 border-t-4 border-emerald-500/50 flex flex-col items-center text-center group transition-all duration-500 overflow-hidden">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-900/40 group-hover:scale-110 transition-transform duration-500 group-hover:mb-6">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 448 512">
                <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.2-8.5-44.2-27.3-16.4-14.6-27.4-32.7-30.7-38.2-3.2-5.6-.4-8.6 2.4-11.4 2.6-2.5 5.6-6.5 8.3-9.8 2.8-3.3 3.7-5.5 5.5-9.2 1.9-3.7.9-7-.5-9.8-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.2 5.8 23.5 9.2 31.6 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.5 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mt-6 group-hover:mt-0 font-space uppercase transition-all duration-500">WhatsApp</h3>
            
            <div className="max-h-0 opacity-0 group-hover:max-h-[500px] group-hover:opacity-100 group-hover:mt-6 transition-all duration-700 ease-in-out flex flex-col items-center w-full">
              <div className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                Más Popular
              </div>
              <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Respuesta Inmediata</p>
              <p className="text-white text-xl font-bold mb-4">+593 98 391 0712</p>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed mb-8">
                Ideal para consultas rápidas y seguimiento.
              </p>
              <div className="w-full pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                 <span className="text-slate-600 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 24/7
                 </span>
                 <a href="https://wa.me/593983910712" target="_blank" className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                   Abrir Chat
                 </a>
              </div>
            </div>
          </div>

          {/* Email Card */}
          <div className="glass glass-hover rounded-[2.5rem] p-8 border-t-4 border-blue-500/50 flex flex-col items-center text-center group transition-all duration-500 overflow-hidden">
            <div className="w-20 h-20 rounded-3xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-900/40 group-hover:scale-110 transition-transform duration-500 group-hover:mb-6">
              <span className="material-symbols-outlined text-white text-4xl">mail</span>
            </div>
            <h3 className="text-xl font-bold text-white mt-6 group-hover:mt-0 font-space uppercase transition-all duration-500">Email</h3>
            
            <div className="max-h-0 opacity-0 group-hover:max-h-[500px] group-hover:opacity-100 group-hover:mt-6 transition-all duration-700 ease-in-out flex flex-col items-center w-full">
              <div className="bg-blue-500/10 text-blue-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                Profesional
              </div>
              <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Respuesta &lt; 2H</p>
              <p className="text-white text-base font-bold mb-4 truncate w-full">ventas@franmotion.com</p>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed mb-8">
                Para propuestas detalladas y cotizaciones.
              </p>
              <div className="w-full pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                 <span className="text-slate-600">Lun-Vie</span>
                 <a href="mailto:ventas@franmotion.com" className="bg-blue-500 hover:bg-blue-400 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                   Enviar
                 </a>
              </div>
            </div>
          </div>

          {/* Phone Card */}
          <div className="glass glass-hover rounded-[2.5rem] p-8 border-t-4 border-[#f27121]/50 flex flex-col items-center text-center group transition-all duration-500 overflow-hidden">
            <div className="w-20 h-20 rounded-3xl bg-[#f27121] flex items-center justify-center shadow-lg shadow-orange-900/40 group-hover:scale-110 transition-transform duration-500 group-hover:mb-6">
              <span className="material-symbols-outlined text-white text-4xl">call</span>
            </div>
            <h3 className="text-xl font-bold text-white mt-6 group-hover:mt-0 font-space uppercase transition-all duration-500">Llamada</h3>
            
            <div className="max-h-0 opacity-0 group-hover:max-h-[500px] group-hover:opacity-100 group-hover:mt-6 transition-all duration-700 ease-in-out flex flex-col items-center w-full">
              <div className="bg-[#f27121]/10 text-[#f27121] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                VIP
              </div>
              <p className="text-[#f27121] text-[10px] font-black uppercase tracking-[0.2em] mb-4">Inmediata</p>
              <p className="text-white text-xl font-bold mb-4">+593 98 391 0712</p>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed mb-8">
                Emergencias y discusiones estratégicas urgentes.
              </p>
              <div className="w-full pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                 <span className="text-slate-600">9:00-19:00</span>
                 <a href="tel:+593983910712" className="bg-[#f27121] hover:bg-[#ff8c42] text-white px-5 py-2.5 rounded-xl shadow-lg shadow-[#f27121]/20 hover:shadow-[#f27121]/40 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                   Llamar
                 </a>
              </div>
            </div>
          </div>

          {/* Consultation Card */}
          <div className="glass glass-hover rounded-[2.5rem] p-8 border-t-4 border-red-500/50 flex flex-col items-center text-center group transition-all duration-500 overflow-hidden">
            <div className="w-20 h-20 rounded-3xl bg-red-500 flex items-center justify-center shadow-lg shadow-red-900/40 group-hover:scale-110 transition-transform duration-500 group-hover:mb-6">
              <span className="material-symbols-outlined text-white text-4xl">calendar_today</span>
            </div>
            <h3 className="text-xl font-bold text-white mt-6 group-hover:mt-0 font-space uppercase transition-all duration-500">Video Consulta</h3>
            
            <div className="max-h-0 opacity-0 group-hover:max-h-[500px] group-hover:opacity-100 group-hover:mt-6 transition-all duration-700 ease-in-out flex flex-col items-center w-full">
              <div className="bg-red-500/10 text-red-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                Gratis
              </div>
              <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Sesión de 30min</p>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed mb-4 flex-grow">
                Consultoría estelar para definir tu proyecto.
              </p>
              <div className="w-full pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest mt-auto">
                 <span className="text-slate-600">Por Cita</span>
                 <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-red-500 hover:bg-red-400 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2 outline-none"
                 >
                   Agendar
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>
        </section>
      )}

      {/* Popup Form Modal (Tailwind CSS Only) */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Overlay */}
          <div 
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer animate-in fade-in duration-300"
          />
          
          {/* Modal Content */}
          <div 
            className="relative w-full max-w-2xl bg-white rounded-[2.5rem] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-300"
          >
            {/* Close Button */}
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-[#f27121] transition-colors z-10"
            >
              <span className="material-symbols-outlined text-3xl">close</span>
            </button>

            <div ref={modalScrollRef} className="p-6 md:p-10 overflow-y-auto overscroll-contain flex-1">
              <div className="text-center mb-8">
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#f27121] text-white text-[9px] font-black uppercase tracking-widest mb-4">
                  🚀 Formulario Express
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2 font-space tracking-tighter">Cuéntanos Tu Proyecto</h2>
                <p className="text-slate-500 text-xs">Solo necesitamos algunos datos para crear tu propuesta personalizada</p>
              </div>

              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                <div className="text-center mb-8">
                  <p className="text-slate-700 font-bold text-sm mb-4">Cuéntanos qué necesitas y te contactamos</p>
                  <div className="flex flex-wrap justify-center gap-6 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[#f27121] text-sm">schedule</span> Respuesta en 24h</span>
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[#f27121] text-sm">verified_user</span> 100% seguro</span>
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[#f27121] text-sm">favorite</span> Sin compromiso</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">Tu nombre *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">person</span>
                      <input 
                        required
                        type="text"
                        placeholder="¿Cómo te llamas?"
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#f27121] focus:border-[#f27121] outline-none transition-all text-sm text-slate-900 font-medium placeholder-slate-400"
                        value={formData.nombre}
                        onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-900 ml-1">Email *</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">mail</span>
                        <input 
                          required
                          type="email"
                          placeholder="tu@email.com"
                          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#f27121] focus:border-[#f27121] outline-none transition-all text-sm text-slate-900 font-medium placeholder-slate-400"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-900 ml-1">Celular <span className="text-slate-400 font-normal">(min. 10 dígitos) *</span></label>
                      <div className="flex gap-2">
                        {/* Custom Country Dropdown */}
                        <div className="relative custom-dropdown">
                          <button 
                            type="button"
                            onClick={() => setIsCountryOpen(!isCountryOpen)}
                            className="flex items-center gap-2 px-3 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold text-sm shrink-0 hover:border-[#f27121] transition-all min-w-[100px]"
                          >
                            <span className="text-slate-500 text-xs">{formData.country.code}</span>
                            <span className="text-slate-900">{formData.country.dial}</span>
                            <span className="material-symbols-outlined text-sm text-slate-400">expand_more</span>
                          </button>

                          {isCountryOpen && (
                            <div className="absolute top-full left-0 mt-2 w-[240px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                              <div className="p-3 border-b border-slate-50">
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">search</span>
                                  <input 
                                    autoFocus
                                    type="text"
                                    placeholder="Buscar país..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-[#f27121] transition-all"
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="max-h-[220px] overflow-y-auto py-2">
                                {filteredCountries.map((c) => (
                                  <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => {
                                      setFormData({...formData, country: c});
                                      setIsCountryOpen(false);
                                      setCountrySearch('');
                                    }}
                                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${formData.country.code === c.code ? 'bg-orange-50/50' : ''}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-400 font-bold text-xs w-6">{c.code}</span>
                                      <span className="text-slate-700 font-medium text-sm">{c.name}</span>
                                    </div>
                                    <span className="text-[#f27121] font-bold text-xs">{c.dial}</span>
                                  </button>
                                ))}
                                {filteredCountries.length === 0 && (
                                  <div className="px-4 py-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                    No se encontraron resultados
                                  </div>
                                )}
                              </div>
                              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                 <div className="flex items-center gap-2">
                                   <span className="material-symbols-outlined text-sm">public</span> Otro país
                                 </div>
                                 <span className="text-slate-300">Escribir código</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <input 
                          required
                          type="tel"
                          placeholder="99 123 4567"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#f27121] focus:border-[#f27121] outline-none transition-all text-sm text-slate-900 font-medium placeholder-slate-400"
                          value={formData.celular}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            let formatted = val;
                            if (val.length > 2) formatted = val.slice(0, 2) + ' ' + val.slice(2);
                            if (val.length > 5) formatted = val.slice(0, 2) + ' ' + val.slice(2, 5) + ' ' + val.slice(5);
                            setFormData({...formData, celular: formatted});
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">¿Qué necesitas? *</label>
                    
                    {/* Custom Service Dropdown */}
                    <div className="relative custom-dropdown">
                      <button 
                        type="button"
                        onClick={() => setIsServiceOpen(!isServiceOpen)}
                        className="w-full flex items-center justify-between pl-4 pr-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-[#f27121] focus:ring-2 focus:ring-[#f27121] transition-all outline-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[#f27121] text-xl">{formData.necesidad.icon}</span>
                          <span className="text-sm text-slate-900 font-medium">{formData.necesidad.label}</span>
                        </div>
                        <span className={`material-symbols-outlined text-slate-400 text-lg transition-transform duration-300 ${isServiceOpen ? 'rotate-180' : ''}`}>expand_more</span>
                      </button>

                      {isServiceOpen && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="py-2">
                            {SERVICES.map((service) => (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => {
                                  setFormData({...formData, necesidad: service});
                                  setIsServiceOpen(false);
                                }}
                                className={`w-full px-6 py-4 flex items-center justify-between hover:bg-orange-50 transition-colors group ${formData.necesidad.id === service.id ? 'bg-orange-50/50' : ''}`}
                              >
                                <div className="flex items-center gap-4">
                                  <span className={`material-symbols-outlined text-2xl transition-colors ${formData.necesidad.id === service.id ? 'text-[#f27121]' : 'text-slate-400 group-hover:text-[#f27121]'}`}>
                                    {service.icon}
                                  </span>
                                  <span className={`font-medium transition-colors ${formData.necesidad.id === service.id ? 'text-[#f27121]' : 'text-slate-700'}`}>
                                    {service.label}
                                  </span>
                                </div>
                                {formData.necesidad.id === service.id && (
                                  <span className="material-symbols-outlined text-[#f27121] text-lg">check</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">Cuéntanos más <span className="text-slate-400 font-normal">(opcional)</span></label>
                    <textarea 
                      rows={3}
                      placeholder="Describe brevemente tu proyecto, objetivos o cualquier detalle que nos ayude a entenderte mejor..."
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#f27121] focus:border-[#f27121] outline-none transition-all text-sm text-slate-900 font-medium placeholder-slate-400 resize-none"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    />
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                      <span>Un mensaje detallado nos ayuda a preparar mejor tu propuesta</span>
                      <span>{formData.descripcion.length}/500</span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="mt-1 w-5 h-5 rounded border-slate-300 text-[#f27121] focus:ring-[#f27121]" 
                        checked={formData.privacy}
                        onChange={(e) => setFormData({...formData, privacy: e.target.checked})}
                      />
                      <span className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Acepto la <span className="text-[#f27121] underline">política de privacidad</span> *</span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="mt-1 w-5 h-5 rounded border-slate-300 text-[#f27121] focus:ring-[#f27121]" 
                        checked={formData.tips}
                        onChange={(e) => setFormData({...formData, tips: e.target.checked})}
                      />
                      <span className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Quiero recibir tips de diseño y novedades (máx. 2/mes, sin spam)</span>
                    </label>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-[#f27121] text-white font-bold py-4 rounded-xl shadow-xl shadow-orange-900/20 hover:scale-[1.02] hover:brightness-110 transition-all flex items-center justify-center gap-3 text-base"
                  >
                    Hablemos de tu proyecto <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>

                  <div className="text-center pt-4 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span className="material-symbols-outlined text-slate-900 text-sm">lock</span>
                      Tus datos están seguros. Respondemos en menos de 24h. Sin spam.
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

