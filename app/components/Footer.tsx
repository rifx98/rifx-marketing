'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  if (pathname === '/panel') return null;

  return (
    <footer className="bg-[#0b1229] pt-20 pb-12 border-t border-white/5" data-purpose="main-footer">
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* Brand */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-[#F27121] rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">RM</span>
            </div>
            <span className="text-white font-extrabold text-xl tracking-wider uppercase">Rifx Marketing</span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Llevando tu marca más allá de la estratosfera con estrategias de marketing digital de alto impacto.
          </p>
        </div>
        {/* Quick Links */}
        <div>
          <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Enlaces rápidos</h4>
          <ul className="space-y-3">
            <li><Link className="text-slate-400 hover:text-[#F27121] transition-colors text-sm" href="/">Inicio</Link></li>
            <li><Link className="text-slate-400 hover:text-[#F27121] transition-colors text-sm" href="/servicios">Servicios</Link></li>
            <li><Link className="text-slate-400 hover:text-[#F27121] transition-colors text-sm" href="/sobre-nosotros">Sobre Nosotros</Link></li>
            <li><Link className="text-slate-400 hover:text-[#F27121] transition-colors text-sm" href="/contacto">Contacto</Link></li>
          </ul>
        </div>
        {/* Contact Info */}
        <div>
          <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Contactos</h4>
          <ul className="space-y-4">
            <li className="flex items-center gap-3 text-slate-400">
              <span className="material-symbols-outlined text-[#F27121] text-lg">mail</span>
              <span className="text-sm">ventas@franmotion.com</span>
            </li>
            <li className="flex items-center gap-3 text-slate-400">
              <span className="material-symbols-outlined text-[#F27121] text-lg">call</span>
              <span className="text-sm">+593 98 391 0712</span>
            </li>
            <li className="flex items-center gap-3 text-slate-400">
              <span className="material-symbols-outlined text-[#F27121] text-lg">location_on</span>
              <span className="text-sm">Base de Operaciones, Órbita</span>
            </li>
          </ul>
        </div>
        {/* Social */}
        <div>
          <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Redes Galácticas</h4>
          <div className="flex space-x-4">
            {/* TikTok */}
            <a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:text-[#F27121] text-white transition-colors" href="#" aria-label="TikTok">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 448 512"><path d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"/></svg>
            </a>
            {/* Facebook */}
            <a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:text-[#F27121] text-white transition-colors" href="#" aria-label="Facebook">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            {/* YouTube */}
            <a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:text-[#F27121] text-white transition-colors" href="#" aria-label="YouTube">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z"></path></svg>
            </a>
          </div>
        </div>
      </div>
      <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-4">
        <p className="max-w-7xl mx-auto px-8 w-full flex justify-between">
          <span>© 2024 Rifx Marketing Agency. All systems operational.</span>
          <span className="flex space-x-6">
            <Link className="hover:text-white transition-colors" href="#">Aviso Legal</Link>
            <Link className="hover:text-white transition-colors" href="#">Privacidad</Link>
            <Link className="hover:text-white transition-colors" href="#">Cookies</Link>
          </span>
        </p>
      </div>
    </footer>
  );
}
