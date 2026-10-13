'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { BrainNode, BrainEdge, CognitiveLearningState } from '@/lib/brain-graph';

interface NeuromapaGraphProps {
  nodes?: BrainNode[];
  edges?: BrainEdge[];
  selectedNodeId?: string | null;
  onSelectNode: (id: string | null) => void;
  language?: 'es' | 'en';
  learningState?: CognitiveLearningState;
  onTriggerLearn?: () => void;
  onExecuteCopilotAction?: (action: string, node: BrainNode) => void;
}

export function crmGraphToNeuromapa(
  nodes: BrainNode[] = [],
  edges: BrainEdge[] = [],
  learningState?: CognitiveLearningState
) {
  const grupos = [
    { id: 'clientes', nombre: 'Clientes & Contactos CRM', color: '#10b981', lobulo: 'frontal' },
    { id: 'estrategia', nombre: 'Prefrontal · Estrategia & Ventas', color: '#f59e0b', lobulo: 'prefrontal' },
    { id: 'whatsapp', nombre: 'Memoria · WhatsApp & Chats', color: '#06b6d4', lobulo: 'temporal' },
    { id: 'llamadas', nombre: 'Voz · Llamadas & Coherencia', color: '#f43f5e', lobulo: 'temporal' },
    { id: 'documentos', nombre: 'Documentos & Base de Conocimiento', color: '#8b5cf6', lobulo: 'parietal' },
    { id: 'workflows', nombre: 'Workflows & Automatizaciones', color: '#22d3ee', lobulo: 'occipital' },
    { id: 'motor_ia', nombre: 'Núcleo Central IA & Auditoría', color: '#a193ff', lobulo: 'cerebelo' },
    { id: 'campanas', nombre: 'Campañas & Outreach', color: '#e11d48', lobulo: 'frontal' },
  ];

  const groupByType = (type: string) => {
    switch (type) {
      case 'customer':
        return 'clientes';
      case 'sale':
      case 'intent':
        return 'estrategia';
      case 'conversation':
      case 'message_user':
      case 'message_ai':
        return 'whatsapp';
      case 'voice':
      case 'appointment':
        return 'llamadas';
      case 'knowledge':
        return 'documentos';
      case 'action':
      case 'objection':
        return 'workflows';
      case 'campaign':
        return 'campanas';
      case 'core':
      default:
        return 'motor_ia';
    }
  };

  const neuromapaNodes = nodes.map((node) => {
    const grupo = groupByType(node.type);
    return {
      id: node.id,
      titulo: node.label || node.id,
      ruta: `crm/${node.type}/${node.id}`,
      grupo: grupo,
      tipo: node.type || 'knowledge',
      slug: (node.label || node.id).toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      descripcion: node.summary || node.label || '',
      modificado: node.timestamp || new Date().toISOString(),
      lineas: 12,
      bytes: 640,
      texto: `${node.label}\n\n${node.summary || 'Entidad viva en la red neuronal del CRM.'}\n\nTipo: ${node.type}\nEstado: ${node.status || 'activo'}\nConfianza sináptica: ${Math.round((node.confidence || 0.95) * 100)}%`,
    };
  });

  const neuromapaEdges = edges.map((edge) => ({
    de: edge.source,
    a: edge.target,
    clase: 'enlace',
    texto: edge.relation || 'conecta con',
  }));

  return {
    generado: new Date().toISOString().replace('T', ' ').slice(0, 16),
    usuario: 'RIFX CRM',
    carpeta: 'CRM Cognitive Memory',
    proyectos: [{ raiz: 'crm', alias: 'CRM' }],
    aliasRutas: [],
    lobulos: {
      prefrontal: 'PREFRONTAL · REGLAS & VENTAS',
      frontal: 'FRONTAL · CLIENTES & CONTACTOS',
      temporal: 'TEMPORAL · WHATSAPP & LLAMADAS',
      parietal: 'PARIETAL · DOCUMENTOS & BASE CONOCIMIENTO',
      occipital: 'OCCIPITAL · WORKFLOWS & AUTOMATIZACIONES',
      cerebelo: 'CEREBELO · MOTOR IA & AUDITORÍA',
      tronco: 'TRONCO · SINAPSIS & ACCIONES',
    },
    grupos: grupos.map((g) => ({
      ...g,
      cantidad: neuromapaNodes.filter((n) => n.grupo === g.id).length,
    })),
    nodos: neuromapaNodes,
    aristas: neuromapaEdges,
    salud: {
      rotos: [],
      huerfanos: [],
      sinIndice: [],
      indiceRoto: [],
      ambiguos: [],
      handoffsAbiertos: [],
      respuestasSinAcuse: [],
      medico: [],
      anclas: [],
      hechos: [],
      repiteClaude: [],
      memoriasParecidas: [],
    },
    podadas: [],
    entidades: {
      archivos: [],
      commits: [],
      tablas: [],
    },
    aprendido: null,
    aprender: true,
  };
}

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
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Compute Neuromapa payload from live CRM nodes & edges
  const neuromapaPayload = useMemo(() => {
    return crmGraphToNeuromapa(nodes, edges, learningState);
  }, [nodes, edges, learningState]);

  // Synchronize data to window and sessionStorage
  useEffect(() => {
    if (!neuromapaPayload.nodos.length) return;
    if (typeof window !== 'undefined') {
      (window as any).__CRM_NEUROMAPA_DATA__ = neuromapaPayload;
      try {
        sessionStorage.setItem('__CRM_NEUROMAPA_DATA__', JSON.stringify(neuromapaPayload));
      } catch (err) {}
    }

    if (iframeLoaded && iframeRef.current?.contentWindow) {
      try {
        (iframeRef.current.contentWindow as any).__CRM_NEUROMAPA_DATA__ = neuromapaPayload;
        iframeRef.current.contentWindow.postMessage(
          { type: 'SET_CRM_GRAPH_DATA', payload: neuromapaPayload },
          '*'
        );
      } catch (e) {}
    }
  }, [neuromapaPayload, iframeLoaded]);

  // Handle iframe initial load
  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    if (iframeRef.current?.contentWindow) {
      try {
        (iframeRef.current.contentWindow as any).__CRM_NEUROMAPA_DATA__ = neuromapaPayload;
        iframeRef.current.contentWindow.postMessage(
          { type: 'SET_CRM_GRAPH_DATA', payload: neuromapaPayload },
          '*'
        );
      } catch (e) {}
    }
  }, [neuromapaPayload]);

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
            type: (payload.type as any) || 'knowledge',
            label: payload.label || payload.title || payload.id,
            summary: payload.summary || payload.text || '',
            timestamp: new Date().toISOString(),
            status: 'active',
            confidence: 0.95,
            source: 'confirmed' as const,
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

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[650px] w-full overflow-hidden rounded-2xl bg-[#0a0c10] shadow-2xl"
    >
      {/* LOADING SPINNER OVERLAY */}
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
            Conectando entidades del CRM, llamadas y memoria de WhatsApp
          </p>
        </div>
      )}

      {/* EMBEDDED NEUROMAPA 3D ANATOMICAL ENGINE */}
      <iframe
        ref={iframeRef}
        src="/neuromapa/cerebro.html"
        title="Neuromapa Anatómico 3D CRM"
        onLoad={handleIframeLoad}
        className="h-full w-full border-0 bg-[#0a0c10]"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      />
    </div>
  );
}
