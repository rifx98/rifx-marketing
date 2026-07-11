"use client";

import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";

export function PanelAnimation() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
  }, []);

  return (
    <section className="relative py-20 lg:py-28 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full bg-[#F27121]/5 blur-[140px]" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[400px] rounded-full bg-[#8B5CF6]/6 blur-[120px]" />
      </div>

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-[#F27121] uppercase tracking-widest mb-4">
            Vista del Panel
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-4">
            Tu panel de{" "}
            <span className="bg-gradient-to-r from-[#F27121] to-[#8B5CF6] bg-clip-text text-transparent">
              marketing inteligente
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Publica, vende y automatiza todo desde un solo lugar — potenciado con IA.
          </p>
        </motion.div>

        {/* Video frame */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative"
        >
          {/* Browser chrome */}
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60">
            {/* Top bar */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#07111f] border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex-1 max-w-sm mx-auto">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span className="text-[11px] text-gray-500">app.rifx.ai/panel</span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play();
                  }
                }}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-105 active:scale-95"
                style={{ background: "linear-gradient(135deg,#F27121,#8B5CF6)", color: "white" }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                  <path d="M5 3l14 9-14 9V3z"/>
                </svg>
                Reiniciar
              </button>
            </div>

            {/* Video */}
            <div className="w-full bg-[#0B1D33]">
              <video
                ref={videoRef}
                src="/panel-demo.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-auto block"
                style={{ display: "block", maxHeight: "70vh", objectFit: "cover" }}
              />
            </div>
          </div>
        </motion.div>

        {/* CTA below */}
        <motion.div
          className="text-center mt-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <a
            href="/panel"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-white text-sm transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{ background: "linear-gradient(135deg,#F27121,#8B5CF6)" }}
          >
            Probar el panel gratis
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/>
              <path d="m12 5 7 7-7 7"/>
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
