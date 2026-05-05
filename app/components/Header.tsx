'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  if (pathname === '/panel') return null;

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

        {/* Navigation Links - Hidden on mobile */}
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
      </nav>
    </header>
  );
}
