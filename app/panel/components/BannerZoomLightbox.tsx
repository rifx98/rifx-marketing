"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface BannerZoomLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
  subtitle?: string;
  downloadFilename?: string;
  onDownload?: () => void;
  onUseInCampaign?: (url: string) => void;
}

export default function BannerZoomLightbox({
  isOpen,
  onClose,
  imageUrl,
  title = 'Vista Previa Ampliada de la Pancarta',
  subtitle,
  downloadFilename = 'pancarta_ampliada.png',
  onDownload,
  onUseInCampaign,
}: BannerZoomLightboxProps) {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom & position when image changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen, imageUrl]);

  // Keyboard navigation: Escape to close, + / - to zoom, 0 to reset
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, scale]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(4, Math.round((prev + 0.3) * 10) / 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(1, Math.round((prev - 0.3) * 10) / 10);
      if (next === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleSetScale = useCallback((targetScale: number) => {
    setScale(targetScale);
    if (targetScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, []);

  // Wheel zoom with passive: false to prevent background scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.2 : -0.2;
      setScale((prev) => {
        const next = Math.min(4, Math.max(1, Math.round((prev + zoomFactor) * 10) / 10));
        if (next === 1) {
          setPosition({ x: 0, y: 0 });
        }
        return next;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double click toggles between 1x and 2x zoom
  const handleDoubleClick = () => {
    if (scale === 1) {
      setScale(2);
    } else {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  // Default download handler
  const handleDefaultDownload = () => {
    if (!imageUrl) return;
    if (onDownload) {
      onDownload();
      return;
    }
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = downloadFilename;
    a.target = '_blank';
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full border border-slate-200 flex flex-col max-h-[92vh] relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/90 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-[#0058bc] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">zoom_in</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-[#0b1c30] truncate leading-tight">
                  {title}
                </h3>
                {subtitle ? (
                  <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Inspección en alta fidelidad y detalles de la composición
                  </p>
                )}
              </div>
            </div>

            {/* Controles de Zoom en Header */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="hidden sm:flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs mr-2">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={scale <= 1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                  title="Alejar (-)"
                >
                  <span className="material-symbols-outlined text-sm">remove</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="px-2 h-7 text-[10px] font-black text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer min-w-[45px] text-center"
                  title="Restablecer zoom al 100% (0)"
                >
                  {Math.round(scale * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={scale >= 4}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                  title="Acercar (+)"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              </div>

              {/* Botón Descargar HD */}
              <button
                type="button"
                onClick={handleDefaultDownload}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Descargar imagen en alta definición"
              >
                <span className="material-symbols-outlined text-xs">download</span>
                <span className="hidden sm:inline">Descargar HD</span>
              </button>

              {/* Botón Cerrar */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer ml-1"
                title="Cerrar vista previa (Esc)"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>

          {/* Canvas de Zoom Interactivo */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            className={`relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden min-h-[350px] max-h-[68vh] select-none ${
              scale > 1
                ? isDragging
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
                : 'cursor-zoom-in'
            }`}
          >
            {/* Fondo con cuadrícula sutil de estudio */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

            <div
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                transformOrigin: 'center center',
              }}
              className="max-h-[64vh] max-w-[90%] flex items-center justify-center"
            >
              <img
                src={imageUrl}
                alt={title}
                draggable={false}
                className="w-full h-auto max-h-[64vh] object-contain rounded-xl shadow-2xl pointer-events-none"
              />
            </div>

            {/* Badge flotante de nivel de zoom */}
            {scale > 1 && (
              <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/10 shadow-lg pointer-events-none flex items-center gap-1.5 animate-in fade-in">
                <span className="material-symbols-outlined text-xs text-blue-400">zoom_in</span>
                <span>Zoom: {Math.round(scale * 100)}%</span>
                <span className="text-slate-400">• Arrastra para mover</span>
              </div>
            )}
          </div>

          {/* Footer con Presets de Zoom y Acciones */}
          <div className="px-5 py-3 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="material-symbols-outlined text-sm text-[#0058bc]">tips_and_updates</span>
              <span className="text-[11px]">
                {scale > 1
                  ? 'Arrastra la imagen para navegar por los detalles, o haz doble clic para restablecer.'
                  : 'Usa la rueda del mouse, botones o doble clic para hacer zoom a la pancarta.'}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {/* Presets rápidos de Zoom */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[1, 1.5, 2, 3].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSetScale(val)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      scale === val
                        ? 'bg-white text-[#0058bc] shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {val === 1 ? '100%' : `${val * 100}%`}
                  </button>
                ))}
              </div>

              {onUseInCampaign && (
                <button
                  type="button"
                  onClick={() => onUseInCampaign(imageUrl)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">campaign</span>
                  <span>Usar en Campaña</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#0058bc] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
