"use client";

import React from 'react';
import { motion } from 'framer-motion';

export default function CloneNavbar() {
  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 inset-x-0 z-50 h-[80px] flex items-center justify-between px-6 lg:px-12 bg-[var(--color-void)]/80 backdrop-blur-xl border-b border-[var(--color-bone)]/10"
    >
      {/* Logo Mark */}
      <div className="flex items-center gap-3">
        {/* Decorative icon accent - Lichen */}
        <div className="w-8 h-8 flex items-center justify-center">
          <svg className="w-5 h-5 text-[var(--color-lichen)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21l-8-4.5v-9L12 3l8 4.5v9L12 21z" />
          </svg>
        </div>
        <span className="text-[var(--color-bone)] font-semibold" style={{ fontSize: 'var(--text-subheading)', letterSpacing: 'var(--tracking-subheading)' }}>
          Rifx Marketing
        </span>
      </div>

      {/* Nav Text Links */}
      <nav className="hidden md:flex items-center gap-8 text-[var(--color-smoke)]">
        <a href="#" className="hover:text-[var(--color-bone)] transition-colors duration-300" style={{ fontSize: 'var(--text-body-sm)', letterSpacing: 'var(--tracking-body-sm)' }}>MANIFESTO</a>
        <a href="#" className="hover:text-[var(--color-bone)] transition-colors duration-300" style={{ fontSize: 'var(--text-body-sm)', letterSpacing: 'var(--tracking-body-sm)' }}>TEAM</a>
        <a href="#" className="hover:text-[var(--color-bone)] transition-colors duration-300" style={{ fontSize: 'var(--text-body-sm)', letterSpacing: 'var(--tracking-body-sm)' }}>BLOG</a>
      </nav>

      {/* Primary Action Button */}
      <div className="flex items-center">
        <button 
          className="bg-[var(--color-plum-voltage)] text-[var(--color-bone)] uppercase transition-opacity hover:opacity-90"
          style={{ 
            borderRadius: 'var(--radius-3xl)', 
            fontSize: 'var(--text-caption)', 
            letterSpacing: 'var(--tracking-caption)',
            padding: '14px 16px',
            fontWeight: 600
          }}
        >
          REQUEST ACCESS
        </button>
      </div>
    </motion.header>
  );
}
