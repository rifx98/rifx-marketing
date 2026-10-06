'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type {
  BrainEdge,
  BrainNode,
  CognitiveLearningState,
} from '@/lib/brain-graph';

export type NeuromapaGraphProps = {
  nodes?: BrainNode[];
  edges?: BrainEdge[];
  selectedNodeId?: string | null;
  onSelectNode: (nodeId: string | null) => void;
  language?: string;
  learningState?: CognitiveLearningState;
  onTriggerLearn?: () => void;
  onExecuteCopilotAction?: (action: string, node: BrainNode) => void;
};

export default function NeuromapaGraph({
  nodes = [],
  edges = [],
  selectedNodeId = null,
  onSelectNode,
  language = 'es',
  learningState,
  onTriggerLearn,
  onExecuteCopilotAction,
}: NeuromapaGraphProps) {
  const isEn = language === 'en';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Listen to postMessage events from the 3D Neuromapa application
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'NEUROMAPA_NODE_CLICK') {
        const payload = event.data.node;
        if (payload?.id) {
          onSelectNode(payload.id);
        }
        if (onExecuteCopilotAction && payload) {
          const matchedNode = nodes.find((n) => n.id === payload.id) || {
            id: payload.id,
            type: payload.type || 'knowledge',
            label: payload.label || payload.title || payload.id,
            summary: payload.summary || payload.text || '',
            timestamp: new Date().toISOString(),
            status: 'active',
            confidence: 0.95,
            source: 'confirmed',
            metadata: {},
          };
          onExecuteCopilotAction('inspect_node', matchedNode as BrainNode);
        }
      } else if (event.data.type === 'NEUROMAPA_NODE_DESELECT') {
        onSelectNode(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [nodes, onSelectNode, onExecuteCopilotAction]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-2xl bg-[#0a0c10] shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen rounded-none' : 'h-full min-h-[650px]'
      }`}
    >
      {/* ── TOP FLOATING CONTROL BAR OVERLAY ───────────────────── */}
      <div className="absolute right-4 top-3.5 z-20 flex items-center gap-2">
        <a
          href="/neuromapa/cerebro.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#14171f]/85 px-3 py-1.5 text-xs font-semibold text-slate-300 shadow-md backdrop-blur-md hover:bg-white/10 hover:text-white transition-all"
          title="Abrir Neuromapa en ventana completa independiente"
        >
          <span className="material-symbols-outlined text-sm">open_in_new</span>
          <span className="hidden sm:inline">{isEn ? 'Open Full Tab' : 'Pestaña Completa'}</span>
        </a>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center gap-1.5 rounded-xl border border-[#a193ff]/30 bg-[#a193ff]/20 px-3 py-1.5 text-xs font-bold text-[#a193ff] shadow-md backdrop-blur-md hover:bg-[#a193ff]/30 transition-all active:scale-95"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          <span className="material-symbols-outlined text-sm">
            {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
          </span>
          <span className="hidden sm:inline">
            {isFullscreen
              ? isEn
                ? 'Exit Fullscreen'
                : 'Salir de Pantalla Completa'
              : isEn
              ? 'Fullscreen'
              : 'Pantalla Completa'}
          </span>
        </button>
      </div>

      {/* ── LOADING SPINNER OVERLAY ────────────────────────────── */}
      {!iframeLoaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0c10] text-slate-400">
          <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-5xl text-[#a193ff]">
              progress_activity
            </span>
            <span className="material-symbols-outlined absolute text-2xl text-[#6366f1]">
              neurology
            </span>
          </div>
          <p className="text-sm font-bold text-white">Iniciando Red Neuronal Anatómica 3D...</p>
          <p className="mt-1 text-xs text-slate-500 font-mono">
            Compilando shaders WebGL de Neuromapa, tractos de fibra y lóbulos corticales
          </p>
        </div>
      )}

      {/* ── EMBEDDED NEUROMAPA 3D ANATOMICAL ENGINE ────────────── */}
      <iframe
        ref={iframeRef}
        src="/neuromapa/cerebro.html"
        title="Neuromapa Anatómico 3D CRM"
        onLoad={() => setIframeLoaded(true)}
        className="h-full w-full border-0 bg-[#0a0c10]"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      />
    </div>
  );
}
