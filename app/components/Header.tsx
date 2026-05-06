'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  if (pathname === '/panel') return null;

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setServicesOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <header className="fixed top-0 left-0 w-full z-[90] navbar-glass" data-purpose="main-header">
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo Section */}
        <div className="flex items-center space-x-2">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-10 h-10 bg-rocket-orange rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-white font-bold">RM</span>
            </div>
            <span className="text-white font-extrabold text-xl tracking-wider uppercase">Rifx Marketing</span>
          </Link>
        </div>

        {/* Navigation Links - Desktop */}
        <div className="hidden md:flex space-x-8 items-center">
          <Link className="text-slate-200 hover:text-rocket-orange transition font-medium text-sm uppercase tracking-wider" href="/">Inicio</Link>
          
          {/* Dropdown Servicios */}
          <div className="relative group">
            <Link 
              className="text-slate-200 hover:text-rocket-orange transition font-medium text-sm uppercase tracking-wider flex items-center gap-1 py-1" 
              href="/servicios"
            >
              Servicios
              <span className="material-symbols-outlined text-[18px] group-hover:rotate-180 transition-transform duration-300">expand_more</span>
            </Link>
            
            {/* Dropdown Menu */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 z-[60]">
              <div className="px-4 py-2 border-b border-white/5 mb-2">
                <span className="text-[10px] text-rocket-orange font-bold uppercase tracking-[0.2em]">Protocolos Estelares</span>
              </div>
              
              <Link href="/servicios/anuncios-de-alta-velocidad" className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group/item">
                <div className="w-8 h-8 bg-rocket-orange/10 rounded-lg flex items-center justify-center text-rocket-orange group-hover/item:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-lg">bolt</span>
                </div>
                <div>
                  <div className="text-white text-sm font-bold">Anuncios de Alta Velocidad</div>
                  <div className="text-white/40 text-[10px]">Escalado rápido con PPC</div>
                </div>
              </Link>
              
              <Link href="/servicios/whatsapp-ai" className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group/item">
                <div className="w-8 h-8 bg-rocket-orange/10 rounded-lg flex items-center justify-center text-rocket-orange group-hover/item:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-lg">chat</span>
                </div>
                <div>
                  <div className="text-white text-sm font-bold">WhatsApp con IA</div>
                  <div className="text-white/40 text-[10px]">Ventas en piloto automático</div>
                </div>
              </Link>
              
              <Link href="/servicios/diseno-web-inmersivo" className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group/item">
                <div className="w-8 h-8 bg-rocket-orange/10 rounded-lg flex items-center justify-center text-rocket-orange group-hover/item:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-lg">grid_view</span>
                </div>
                <div>
                  <div className="text-white text-sm font-bold">Diseño UX/UI</div>
                  <div className="text-white/40 text-[10px]">Arquitectura de experiencias</div>
                </div>
              </Link>
              
              <Link href="/servicios/ecommerce-interestelar" className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group/item">
                <div className="w-8 h-8 bg-rocket-orange/10 rounded-lg flex items-center justify-center text-rocket-orange group-hover/item:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-lg">shopping_cart</span>
                </div>
                <div>
                  <div className="text-white text-sm font-bold">E-commerce Interestelar</div>
                  <div className="text-white/40 text-[10px]">Tiendas de alto rendimiento</div>
                </div>
              </Link>
            </div>
          </div>

          <Link className="text-slate-200 hover:text-rocket-orange transition font-medium text-sm uppercase tracking-wider" href="/sobre-nosotros">Sobre Nosotros</Link>
          <Link className="text-slate-200 hover:text-rocket-orange transition font-medium text-sm uppercase tracking-wider" href="/contacto">Contacto</Link>
          
          <Link href="/contacto" className="bg-rocket-orange text-white px-6 py-2 rounded-lg font-bold hover:shadow-[0_0_20px_rgba(242,113,33,0.4)] transition-all text-sm uppercase">
            Empezar
          </Link>
        </div>

        {/* Hamburger Button - Mobile Only */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden relative w-10 h-10 flex flex-col items-center justify-center gap-[5px] z-[101]"
          aria-label="Abrir menú"
        >
          <span className={`block w-6 h-[2px] bg-white rounded-full transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
          <span className={`block w-6 h-[2px] bg-white rounded-full transition-all duration-300 ${mobileOpen ? 'opacity-0 scale-0' : ''}`} />
          <span className={`block w-6 h-[2px] bg-white rounded-full transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[95] md:hidden transition-opacity duration-300 ${mobileOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile Menu Panel */}
      <div className={`fixed top-0 right-0 h-full w-[85%] max-w-[320px] bg-[#0b1229]/98 backdrop-blur-xl z-[100] md:hidden transition-transform duration-400 ease-out flex flex-col ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Logo inside mobile menu */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5">
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center space-x-2">
            <div className="w-9 h-9 bg-rocket-orange rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">RM</span>
            </div>
            <span className="text-white font-extrabold text-lg tracking-wider uppercase">Rifx</span>
          </Link>
        </div>

        {/* Menu Links */}
        <div className="flex-1 overflow-y-auto py-4 px-2">
          <Link 
            href="/" 
            onClick={() => setMobileOpen(false)} 
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all ${pathname === '/' ? 'bg-rocket-orange/10 text-rocket-orange' : 'text-slate-200 hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-lg">home</span>
            Inicio
          </Link>

          {/* Servicios Accordion */}
          <button
            onClick={() => setServicesOpen(!servicesOpen)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all ${pathname?.startsWith('/servicios') ? 'bg-rocket-orange/10 text-rocket-orange' : 'text-slate-200 hover:bg-white/5'}`}
          >
            <span className="flex items-center gap-3">
              <span className="material-symbols-outlined text-lg">rocket_launch</span>
              Servicios
            </span>
            <span className={`material-symbols-outlined text-lg transition-transform duration-300 ${servicesOpen ? 'rotate-180' : ''}`}>expand_more</span>
          </button>

          {/* Services Sub-links */}
          <div className={`overflow-hidden transition-all duration-300 ${servicesOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="ml-4 pl-4 border-l border-rocket-orange/20 space-y-1 py-2">
              <Link href="/servicios/anuncios-de-alta-velocidad" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm">
                <span className="text-rocket-orange">🚀</span>
                Anuncios de Alta Velocidad
              </Link>
              <Link href="/servicios/whatsapp-ai" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm">
                <span className="text-rocket-orange">💬</span>
                WhatsApp con IA
              </Link>
              <Link href="/servicios/diseno-web-inmersivo" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm">
                <span className="text-rocket-orange">🎨</span>
                Diseño UX/UI
              </Link>
              <Link href="/servicios/ecommerce-interestelar" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm">
                <span className="text-rocket-orange">🛒</span>
                E-commerce Interestelar
              </Link>
            </div>
          </div>

          <Link 
            href="/sobre-nosotros" 
            onClick={() => setMobileOpen(false)} 
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all ${pathname === '/sobre-nosotros' ? 'bg-rocket-orange/10 text-rocket-orange' : 'text-slate-200 hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-lg">group</span>
            Sobre Nosotros
          </Link>

          <Link 
            href="/contacto" 
            onClick={() => setMobileOpen(false)} 
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all ${pathname === '/contacto' ? 'bg-rocket-orange/10 text-rocket-orange' : 'text-slate-200 hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-lg">mail</span>
            Contacto
          </Link>
        </div>

        {/* CTA Button at Bottom */}
        <div className="px-6 py-6 border-t border-white/5">
          <Link 
            href="/contacto" 
            onClick={() => setMobileOpen(false)} 
            className="block w-full bg-rocket-orange text-white text-center px-6 py-3.5 rounded-xl font-bold shadow-[0_0_20px_rgba(242,113,33,0.4)] hover:shadow-[0_0_30px_rgba(242,113,33,0.6)] transition-all text-sm uppercase tracking-wider"
          >
            🚀 ¡Empezar Ahora!
          </Link>
        </div>
      </div>
    </header>
  );
}
