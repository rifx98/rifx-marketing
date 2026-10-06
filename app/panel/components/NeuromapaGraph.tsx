'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import type {
  BrainEdge,
  BrainNode,
  BrainNodeType,
  CognitiveLearningState,
} from '@/lib/brain-graph';

export type NeuromapaGraphProps = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  language?: string;
  learningState?: CognitiveLearningState;
  onTriggerLearn?: () => void;
  onExecuteCopilotAction?: (action: string, node: BrainNode) => void;
};

// ─── NEUROMAPA COLOR PALETTE & METADATA ──────────────────────────
export const NEURO_NODE_THEMES: Record<
  BrainNodeType,
  {
    nameEs: string;
    nameEn: string;
    color: string;
    glow: string;
    bg: string;
    border: string;
    icon: string;
  }
> = {
  core: {
    nameEs: 'Núcleo Central IA',
    nameEn: 'Core Engine',
    color: '#a193ff',
    glow: 'rgba(161, 147, 255, 0.55)',
    bg: 'rgba(161, 147, 255, 0.12)',
    border: '#a193ff',
    icon: 'neurology',
  },
  customer: {
    nameEs: 'Cliente / Contacto',
    nameEn: 'Customer',
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.55)',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: '#10b981',
    icon: 'person',
  },
  conversation: {
    nameEs: 'Conversación WhatsApp',
    nameEn: 'WhatsApp Chat',
    color: '#06b6d4',
    glow: 'rgba(6, 182, 212, 0.55)',
    bg: 'rgba(6, 182, 212, 0.12)',
    border: '#06b6d4',
    icon: 'chat',
  },
  message_user: {
    nameEs: 'Mensaje de Cliente',
    nameEn: 'User Message',
    color: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.55)',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: '#f43f5e',
    icon: 'forum',
  },
  message_ai: {
    nameEs: 'Respuesta Asimilada IA',
    nameEn: 'AI Learned Response',
    color: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.55)',
    bg: 'rgba(139, 92, 246, 0.12)',
    border: '#8b5cf6',
    icon: 'smart_toy',
  },
  intent: {
    nameEs: 'Intención de Compra',
    nameEn: 'Buyer Intent',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.55)',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: '#f59e0b',
    icon: 'shopping_cart',
  },
  knowledge: {
    nameEs: 'Regla de Conocimiento',
    nameEn: 'Knowledge Rule',
    color: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.55)',
    bg: 'rgba(99, 102, 241, 0.12)',
    border: '#6366f1',
    icon: 'school',
  },
  appointment: {
    nameEs: 'Cita Agendada',
    nameEn: 'Appointment',
    color: '#fb923c',
    glow: 'rgba(251, 146, 60, 0.55)',
    bg: 'rgba(251, 146, 60, 0.12)',
    border: '#fb923c',
    icon: 'calendar_month',
  },
  sale: {
    nameEs: 'Venta Cerrada',
    nameEn: 'Closed Sale',
    color: '#059669',
    glow: 'rgba(5, 150, 105, 0.55)',
    bg: 'rgba(5, 150, 105, 0.12)',
    border: '#059669',
    icon: 'payments',
  },
  voice: {
    nameEs: 'Llamada de Voz IA',
    nameEn: 'AI Voice Call',
    color: '#ec4899',
    glow: 'rgba(236, 72, 153, 0.55)',
    bg: 'rgba(236, 72, 153, 0.12)',
    border: '#ec4899',
    icon: 'phone_in_talk',
  },
  action: {
    nameEs: 'Acción Refleja CRM',
    nameEn: 'CRM Reflex Action',
    color: '#14b8a6',
    glow: 'rgba(20, 184, 166, 0.55)',
    bg: 'rgba(20, 184, 166, 0.12)',
    border: '#14b8a6',
    icon: 'bolt',
  },
  objection: {
    nameEs: 'Objeción Resuelta',
    nameEn: 'Resolved Objection',
    color: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.55)',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: '#ef4444',
    icon: 'shield',
  },
  campaign: {
    nameEs: 'Campaña de Marketing',
    nameEn: 'Marketing Campaign',
    color: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.55)',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: '#3b82f6',
    icon: 'campaign',
  },
};

type SimNode = BrainNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  degree: number;
  pulsePhase: number;
};

type SimEdge = BrainEdge & {
  sourceNode?: SimNode;
  targetNode?: SimNode;
};

type SynapticPulse = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  progress: number;
  speed: number;
  color: string;
  size: number;
};

type ShockwaveRing = {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  color: string;
};

export default function NeuromapaGraph({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  language = 'es',
  learningState,
  onTriggerLearn,
  onExecuteCopilotAction,
}: NeuromapaGraphProps) {
  const isEn = language === 'en';

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Transform (pan & zoom)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  transformRef.current = transform;

  // Hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  hoveredNodeIdRef.current = hoveredNodeId;

  // Selected node drawer modal
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Filter & Search inside Neuromapa
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  // Simulation nodes & edges refs
  const simNodesRef = useRef<SimNode[]>([]);
  const simEdgesRef = useRef<SimEdge[]>([]);
  const pulsesRef = useRef<SynapticPulse[]>([]);
  const shockwavesRef = useRef<ShockwaveRing[]>([]);
  const isDraggingNodeRef = useRef<SimNode | null>(null);
  const isPanningRef = useRef(false);
  const startPanRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize simulation graph data
  useEffect(() => {
    const width = containerRef.current?.clientWidth || 900;
    const height = containerRef.current?.clientHeight || 650;
    const centerX = width / 2;
    const centerY = height / 2;

    // Calculate node degree (number of connections)
    const degreeMap = new Map<string, number>();
    edges.forEach((e) => {
      degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
    });

    // Create or reuse simulation nodes
    const existingMap = new Map<string, SimNode>();
    simNodesRef.current.forEach((n) => existingMap.set(n.id, n));

    const totalNodes = nodes.length;
    const simNodes: SimNode[] = nodes.map((node, i) => {
      const existing = existingMap.get(node.id);
      const degree = degreeMap.get(node.id) || 1;
      const theme = NEURO_NODE_THEMES[node.type] || NEURO_NODE_THEMES.knowledge;

      // Base radius by type & connectivity
      let baseRadius = 8 + Math.min(18, Math.sqrt(degree) * 4);
      if (node.type === 'core') baseRadius = 24;
      else if (node.type === 'customer' || node.type === 'sale') baseRadius = Math.max(14, baseRadius);

      if (existing) {
        return {
          ...node,
          x: existing.x,
          y: existing.y,
          vx: existing.vx * 0.5,
          vy: existing.vy * 0.5,
          radius: baseRadius,
          color: theme.color,
          degree,
          pulsePhase: existing.pulsePhase,
        };
      }

      // Arrange initially in organic anatomical brain cluster
      const angle = (i / Math.max(1, totalNodes)) * Math.PI * 2;
      const radiusDist = node.type === 'core' ? 0 : 70 + (i % 5) * 45 + Math.random() * 30;
      return {
        ...node,
        x: centerX + Math.cos(angle) * radiusDist,
        y: centerY + Math.sin(angle) * (radiusDist * 0.82), // slight elliptical brain contour
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: baseRadius,
        color: theme.color,
        degree,
        pulsePhase: Math.random() * Math.PI * 2,
      };
    });

    const nodeById = new Map<string, SimNode>();
    simNodes.forEach((n) => nodeById.set(n.id, n));

    const simEdges: SimEdge[] = edges
      .map((edge) => ({
        ...edge,
        sourceNode: nodeById.get(edge.source),
        targetNode: nodeById.get(edge.target),
      }))
      .filter((edge) => Boolean(edge.sourceNode && edge.targetNode));

    simNodesRef.current = simNodes;
    simEdgesRef.current = simEdges;

    // Seed synaptic electrical pulses
    const initialPulses: SynapticPulse[] = [];
    simEdges.slice(0, 16).forEach((edge, idx) => {
      if (edge.sourceNode && edge.targetNode) {
        initialPulses.push({
          edgeId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          progress: (idx * 0.15) % 1.0,
          speed: 0.008 + Math.random() * 0.012,
          color: edge.sourceNode.color,
          size: 3 + Math.random() * 2,
        });
      }
    });
    pulsesRef.current = initialPulses;
  }, [nodes, edges]);

  // Connected nodes set for spotlighting
  const highlightedNodeIds = useMemo(() => {
    const targetId = hoveredNodeId || selectedNodeId;
    if (!targetId) return null;

    const set = new Set<string>();
    set.add(targetId);

    edges.forEach((edge) => {
      if (edge.source === targetId) set.add(edge.target);
      if (edge.target === targetId) set.add(edge.source);
    });

    return set;
  }, [hoveredNodeId, selectedNodeId, edges]);

  // Selected node detail object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Neighbors of selected node for the drawer
  const selectedNodeNeighbors = useMemo(() => {
    if (!selectedNodeId) return [];
    const neighbors: { edge: BrainEdge; node: BrainNode; direction: 'outgoing' | 'incoming' }[] = [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    edges.forEach((e) => {
      if (e.source === selectedNodeId) {
        const target = nodeMap.get(e.target);
        if (target) neighbors.push({ edge: e, node: target, direction: 'outgoing' });
      } else if (e.target === selectedNodeId) {
        const source = nodeMap.get(e.source);
        if (source) neighbors.push({ edge: e, node: source, direction: 'incoming' });
      }
    });
    return neighbors;
  }, [selectedNodeId, nodes, edges]);

  // Zoom / Pan handlers
  const handleZoom = useCallback((factor: number) => {
    setTransform((prev) => {
      const newK = Math.min(3.5, Math.max(0.35, prev.k * factor));
      const width = containerRef.current?.clientWidth || 900;
      const height = containerRef.current?.clientHeight || 650;
      const cx = width / 2;
      const cy = height / 2;
      return {
        x: cx - (cx - prev.x) * (newK / prev.k),
        y: cy - (cy - prev.y) * (newK / prev.k),
        k: newK,
      };
    });
  }, []);

  const handleResetView = useCallback(() => {
    setTransform({ x: 0, y: 0, k: 1 });
  }, []);

  const handleCenterOnNode = useCallback((nodeId: string) => {
    const target = simNodesRef.current.find((n) => n.id === nodeId);
    if (!target) return;
    const width = containerRef.current?.clientWidth || 900;
    const height = containerRef.current?.clientHeight || 650;
    setTransform({
      x: width / 2 - target.x * 1.2,
      y: height / 2 - target.y * 1.2,
      k: 1.2,
    });
  }, []);

  // Main Canvas Render & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;

    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container) return;
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Physics step
    const stepPhysics = () => {
      const simNodes = simNodesRef.current;
      const simEdges = simEdgesRef.current;
      const width = containerRef.current?.clientWidth || 900;
      const height = containerRef.current?.clientHeight || 650;
      const centerX = width / 2;
      const centerY = height / 2;

      // 1. Repulsion between nodes (Coulomb force)
      for (let i = 0; i < simNodes.length; i++) {
        const n1 = simNodes[i];
        for (let j = i + 1; j < simNodes.length; j++) {
          const n2 = simNodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy + 100;
          const dist = Math.sqrt(distSq);
          const minDist = n1.radius + n2.radius + 18;

          // Strong repulsion if overlapping
          let force = 900 / distSq;
          if (dist < minDist) {
            force += (minDist - dist) * 0.12;
          }

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (n1 !== isDraggingNodeRef.current) {
            n1.vx -= fx;
            n1.vy -= fy;
          }
          if (n2 !== isDraggingNodeRef.current) {
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }

      // 2. Spring attraction along edges (Hooke's law)
      for (const edge of simEdges) {
        const src = edge.sourceNode;
        const tgt = edge.targetNode;
        if (!src || !tgt) continue;

        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.hypot(dx, dy) || 1;
        const targetDist = 75 + (src.radius + tgt.radius);
        const springForce = (dist - targetDist) * 0.035;

        const fx = (dx / dist) * springForce;
        const fy = (dy / dist) * springForce;

        if (src !== isDraggingNodeRef.current) {
          src.vx += fx;
          src.vy += fy;
        }
        if (tgt !== isDraggingNodeRef.current) {
          tgt.vx -= fx;
          tgt.vy -= fy;
        }
      }

      // 3. Central gravity (keeps graph within bounds)
      for (const n of simNodes) {
        if (n === isDraggingNodeRef.current) continue;

        const dx = centerX - n.x;
        const dy = centerY - n.y;
        n.vx += dx * 0.0035;
        n.vy += dy * 0.0035;

        // Damping
        n.vx *= 0.86;
        n.vy *= 0.86;

        // Apply velocity
        n.x += n.vx;
        n.y += n.vy;

        // Pulse phase animation
        n.pulsePhase += 0.04;
      }

      // 4. Update Synaptic Action Potential Pulses
      const pulses = pulsesRef.current;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        pulse.progress += pulse.speed;

        if (pulse.progress >= 1.0) {
          // Trigger shockwave at target node
          const tgt = simNodes.find((n) => n.id === pulse.targetId);
          if (tgt) {
            shockwavesRef.current.push({
              x: tgt.x,
              y: tgt.y,
              radius: tgt.radius,
              maxRadius: tgt.radius * 2.8,
              opacity: 0.8,
              color: tgt.color,
            });
          }

          // Pick a new random edge to traverse
          const validEdges = simEdges.filter((e) => e.sourceNode && e.targetNode);
          if (validEdges.length > 0) {
            const nextEdge = validEdges[Math.floor(Math.random() * validEdges.length)];
            pulse.edgeId = nextEdge.id;
            pulse.sourceId = nextEdge.source;
            pulse.targetId = nextEdge.target;
            pulse.progress = 0;
            pulse.color = nextEdge.sourceNode?.color || '#a193ff';
          }
        }
      }

      // 5. Update Shockwave Rings
      const waves = shockwavesRef.current;
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        w.radius += 1.2;
        w.opacity -= 0.025;
        if (w.opacity <= 0 || w.radius >= w.maxRadius) {
          waves.splice(i, 1);
        }
      }
    };

    // Render loop
    const render = () => {
      stepPhysics();

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const t = transformRef.current;
      const currentHover = hoveredNodeIdRef.current;
      const currentSelected = selectedNodeId;

      ctx.save();
      ctx.scale(dpr, dpr);

      // ── 1. BACKGROUND: Deep obsidian neuromapa radial canvas ────
      ctx.fillStyle = '#0a0c10';
      ctx.fillRect(0, 0, width, height);

      // Core radial vignette glow
      const cx = width / 2;
      const cy = height / 2;
      const bgGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(width, height) * 0.7);
      bgGrad.addColorStop(0, '#151728');
      bgGrad.addColorStop(0.45, '#0e111a');
      bgGrad.addColorStop(1, '#07090e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle neural grid points
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      const gridSize = 40;
      const startX = ((t.x % (gridSize * t.k)) + (gridSize * t.k)) % (gridSize * t.k);
      const startY = ((t.y % (gridSize * t.k)) + (gridSize * t.k)) % (gridSize * t.k);
      for (let gx = startX; gx < width; gx += gridSize * t.k) {
        for (let gy = startY; gy < height; gy += gridSize * t.k) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Apply pan & zoom transform for world elements
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      const simNodes = simNodesRef.current;
      const simEdges = simEdgesRef.current;
      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

      // ── 2. EDGES / SYNAPSES ─────────────────────────────────────
      for (const edge of simEdges) {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) continue;

        const isEdgeConnected =
          highlightedNodeIds === null ||
          (highlightedNodeIds.has(src.id) && highlightedNodeIds.has(tgt.id));

        const isDirectToSelection =
          (src.id === currentSelected || tgt.id === currentSelected) ||
          (src.id === currentHover || tgt.id === currentHover);

        let alpha = 0.28;
        let lineWidth = 1.2;
        let strokeColor = '#4b5563'; // muted slate

        if (highlightedNodeIds !== null) {
          if (isDirectToSelection) {
            alpha = 0.9;
            lineWidth = 2.4;
            strokeColor = src.color;
          } else if (isEdgeConnected) {
            alpha = 0.55;
            lineWidth = 1.8;
            strokeColor = src.color;
          } else {
            alpha = 0.06; // Dim non-connected paths
            lineWidth = 0.8;
          }
        }

        ctx.strokeStyle = strokeColor;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = lineWidth;

        // Draw curved myelin synaptic tract
        const midX = (src.x + tgt.x) / 2;
        const midY = (src.y + tgt.y) / 2;
        const curveOffset = Math.sin((src.x + tgt.y) * 0.01) * 12;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(midX + curveOffset, midY - curveOffset, tgt.x, tgt.y);
        ctx.stroke();
      }

      // ── 3. SYNAPTIC ACTION POTENTIAL PULSES ──────────────────────
      for (const pulse of pulsesRef.current) {
        const src = nodeMap.get(pulse.sourceId);
        const tgt = nodeMap.get(pulse.targetId);
        if (!src || !tgt) continue;

        const isPulseVisible =
          highlightedNodeIds === null ||
          (highlightedNodeIds.has(src.id) || highlightedNodeIds.has(tgt.id));

        if (!isPulseVisible) continue;

        const p = pulse.progress;
        const midX = (src.x + tgt.x) / 2;
        const midY = (src.y + tgt.y) / 2;
        const curveOffset = Math.sin((src.x + tgt.y) * 0.01) * 12;

        // Quadratic Bezier interpolation
        const invP = 1 - p;
        const ctrlX = midX + curveOffset;
        const ctrlY = midY - curveOffset;
        const px = invP * invP * src.x + 2 * invP * p * ctrlX + p * p * tgt.x;
        const py = invP * invP * src.y + 2 * invP * p * ctrlY + p * p * tgt.y;

        // Pulse glow halo
        ctx.globalAlpha = 0.85;
        const pulseGrad = ctx.createRadialGradient(px, py, 1, px, py, pulse.size * 2.5);
        pulseGrad.addColorStop(0, '#ffffff');
        pulseGrad.addColorStop(0.4, pulse.color);
        pulseGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pulseGrad;
        ctx.beginPath();
        ctx.arc(px, py, pulse.size * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Bright white core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, pulse.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 4. SHOCKWAVE BEACON RINGS ───────────────────────────────
      for (const wave of shockwavesRef.current) {
        ctx.globalAlpha = wave.opacity;
        ctx.strokeStyle = wave.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── 5. NODES / SOMAS (Neuromapa concentric halos) ───────────
      for (const node of simNodes) {
        const isHovered = node.id === currentHover;
        const isSelected = node.id === currentSelected;
        const isHighlighted = highlightedNodeIds === null || highlightedNodeIds.has(node.id);

        let nodeAlpha = isHighlighted ? 1.0 : 0.12; // spotlight contrast
        if (isSelected) nodeAlpha = 1.0;

        ctx.globalAlpha = nodeAlpha;

        const r = node.radius;

        // A. Outer Radiant Halo (sprite-like glow)
        const haloRadius = isSelected ? r * 2.8 : isHovered ? r * 2.4 : r * 1.9;
        const haloGrad = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, haloRadius);
        haloGrad.addColorStop(0, node.color);
        haloGrad.addColorStop(0.5, `${node.color}55`);
        haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // B. Concentric Outer Beacon Ring
        if (isSelected || isHovered || node.type === 'core') {
          const pulseRing = isSelected ? 4 + Math.sin(node.pulsePhase * 2) * 2 : 2.5;
          ctx.strokeStyle = isSelected ? '#ffffff' : node.color;
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + pulseRing, 0, Math.PI * 2);
          ctx.stroke();
        }

        // C. Main Soma Body (Spherical gradient with specular highlight)
        const bodyGrad = ctx.createRadialGradient(
          node.x - r * 0.3,
          node.y - r * 0.3,
          0,
          node.x,
          node.y,
          r * 1.1
        );
        bodyGrad.addColorStop(0, '#ffffff');
        bodyGrad.addColorStop(0.35, node.color);
        bodyGrad.addColorStop(1, '#0f1118');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fill();

        // D. Border rim
        ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // E. Label under node (Neuromapa pill label)
        if (t.k >= 0.65 || isSelected || isHovered || node.type === 'core' || node.degree >= 3) {
          const labelText = node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label;
          ctx.font = isSelected || isHovered ? 'bold 11px system-ui, sans-serif' : '10px system-ui, sans-serif';
          const textMetrics = ctx.measureText(labelText);
          const textWidth = textMetrics.width;
          const labelY = node.y + r + 13;

          // Semi-transparent pill background
          ctx.fillStyle = isSelected
            ? 'rgba(161, 147, 255, 0.95)'
            : isHovered
            ? 'rgba(20, 24, 36, 0.92)'
            : 'rgba(10, 12, 18, 0.75)';
          const pillPaddingX = 6;
          const pillHeight = 16;
          const pillX = node.x - textWidth / 2 - pillPaddingX;
          const pillY = labelY - 11;
          const pillRadius = 4;

          ctx.beginPath();
          ctx.roundRect(pillX, pillY, textWidth + pillPaddingX * 2, pillHeight, pillRadius);
          ctx.fill();

          if (isSelected) {
            ctx.fillStyle = '#100f24'; // dark text on bright selected pill
          } else {
            ctx.fillStyle = isHovered ? '#ffffff' : '#d1d5db';
          }
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, node.x, labelY - 3);
        }
      }

      ctx.restore(); // Restore world transform
      ctx.restore(); // Restore DPR scale

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    animationFrameRef.current = animId;

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [highlightedNodeIds, selectedNodeId]);

  // Pointer / Drag / Zoom Interactions on Canvas
  const getNodeAtPoint = (clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const t = transformRef.current;

    // Convert screen coordinates to world coordinates
    const worldX = (screenX - t.x) / t.k;
    const worldY = (screenY - t.y) / t.k;

    // Check hit in reverse order (top nodes first)
    const simNodes = simNodesRef.current;
    for (let i = simNodes.length - 1; i >= 0; i--) {
      const n = simNodes[i];
      const dist = Math.hypot(worldX - n.x, worldY - n.y);
      if (dist <= n.radius + 6) {
        return n;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const hitNode = getNodeAtPoint(e.clientX, e.clientY);
    hasMovedRef.current = false;
    startPanRef.current = { x: e.clientX, y: e.clientY };

    if (hitNode) {
      isDraggingNodeRef.current = hitNode;
    } else {
      isPanningRef.current = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const dx = e.clientX - startPanRef.current.x;
    const dy = e.clientY - startPanRef.current.y;
    if (Math.hypot(dx, dy) > 4) {
      hasMovedRef.current = true;
    }

    if (isDraggingNodeRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const t = transformRef.current;
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      isDraggingNodeRef.current.x = (screenX - t.x) / t.k;
      isDraggingNodeRef.current.y = (screenY - t.y) / t.k;
      isDraggingNodeRef.current.vx = 0;
      isDraggingNodeRef.current.vy = 0;
      return;
    }

    if (isPanningRef.current) {
      setTransform((prev) => ({
        ...prev,
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
      return;
    }

    // Hover detection
    const hitNode = getNodeAtPoint(e.clientX, e.clientY);
    if (hitNode) {
      setHoveredNodeId(hitNode.id);
      if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
    } else {
      setHoveredNodeId(null);
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!hasMovedRef.current) {
      const hitNode = getNodeAtPoint(e.clientX, e.clientY);
      if (hitNode) {
        onSelectNode(hitNode.id);
        setDrawerOpen(true);
      } else {
        onSelectNode(null);
      }
    }

    isDraggingNodeRef.current = null;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform((prev) => {
      const newK = Math.min(3.5, Math.max(0.35, prev.k * factor));
      return {
        x: mouseX - (mouseX - prev.x) * (newK / prev.k),
        y: mouseY - (mouseY - prev.y) * (newK / prev.k),
        k: newK,
      };
    });
  };

  // Filtered search list
  const filteredSearchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return nodes
      .filter((n) => n.label.toLowerCase().includes(term) || n.summary.toLowerCase().includes(term))
      .slice(0, 6);
  }, [nodes, searchTerm]);

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[640px] w-full select-none overflow-hidden rounded-2xl bg-[#0a0c10] font-sans shadow-2xl"
    >
      {/* ── 1. NEUROMAPA TOP HUD BAR ───────────────────────────── */}
      <div className="absolute left-3 right-3 top-3 z-20 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-white/10 bg-[#14171f]/85 p-2 backdrop-blur-md shadow-lg">
        {/* Left: Brand & Counters */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#a193ff] to-[#6366f1] text-white shadow-md shadow-[#a193ff]/20">
            <span className="material-symbols-outlined text-base">neurology</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-tight text-white">Neuromapa CRM</span>
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              {nodes.length} neuronas · {edges.length} sinapsis activas
            </p>
          </div>
        </div>

        {/* Center: Search input */}
        <div className="relative min-w-[180px] sm:min-w-[240px]">
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-xs text-slate-400">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isEn ? 'Search brain nodes...' : 'Buscar en el cerebro...'}
            className="w-full rounded-lg border border-white/10 bg-[#1b1f29] py-1.5 pl-8 pr-7 text-xs text-slate-200 placeholder-slate-500 focus:border-[#a193ff] focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-white"
            >
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          )}

          {/* Autocomplete dropdown */}
          {filteredSearchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-10 z-30 overflow-hidden rounded-xl border border-white/15 bg-[#14171f] shadow-2xl backdrop-blur-xl">
              {filteredSearchResults.map((n) => {
                const theme = NEURO_NODE_THEMES[n.type] || NEURO_NODE_THEMES.knowledge;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onSelectNode(n.id);
                      handleCenterOnNode(n.id);
                      setSearchTerm('');
                    }}
                    className="flex w-full items-center gap-2 border-b border-white/5 px-3 py-2 text-left text-xs transition-colors hover:bg-white/10 last:border-0"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: theme.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-200">{n.label}</p>
                      <p className="truncate text-[10px] text-slate-400">{n.summary}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Quick action pills */}
        <div className="flex items-center gap-1.5">
          {onTriggerLearn && (
            <button
              type="button"
              onClick={onTriggerLearn}
              className="flex items-center gap-1 rounded-lg border border-[#a193ff]/30 bg-[#a193ff]/15 px-2.5 py-1.5 text-[11px] font-semibold text-[#a193ff] hover:bg-[#a193ff]/25 transition-colors"
              title="Estimular descarga sináptica"
            >
              <span className="material-symbols-outlined text-xs">electric_bolt</span>
              <span>{isEn ? 'Synaptic Surge' : 'Descarga Sináptica'}</span>
            </button>
          )}
          <div className="rounded-lg border border-white/10 bg-[#1b1f29] px-2 py-1 text-[11px] font-mono text-slate-300">
            {Math.round(transform.k * 100)}%
          </div>
        </div>
      </div>

      {/* ── 2. CATEGORY FILTER PILLS (Floating below top bar) ───── */}
      <div className="absolute left-3 top-[68px] z-20 flex max-w-[85%] flex-wrap items-center gap-1.5">
        {[
          { key: 'all', label: 'Todos', icon: 'hub' },
          { key: 'customer', label: 'Clientes', icon: 'person' },
          { key: 'conversation', label: 'WhatsApp', icon: 'chat' },
          { key: 'sale', label: 'Ventas', icon: 'payments' },
          { key: 'objection', label: 'Objeciones', icon: 'shield' },
          { key: 'knowledge', label: 'Reglas', icon: 'school' },
        ].map((cat) => {
          const isActive = activeCategoryFilter === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategoryFilter(cat.key)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
                isActive
                  ? 'border-[#a193ff] bg-[#a193ff] text-[#120f24] shadow-sm shadow-[#a193ff]/40'
                  : 'border-white/10 bg-[#14171f]/80 text-slate-400 hover:border-white/20 hover:text-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 3. MAIN INTERACTIVE CANVAS ──────────────────────────── */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="h-full w-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* ── 4. FLOATING VIEW CONTROLS (Bottom Right HUD) ─────────── */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-[#14171f]/85 p-1.5 backdrop-blur-md shadow-xl">
        <button
          type="button"
          onClick={() => handleZoom(1.25)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          title="Zoom In"
        >
          <span className="material-symbols-outlined text-sm">add</span>
        </button>
        <button
          type="button"
          onClick={() => handleZoom(0.8)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <span className="material-symbols-outlined text-sm">remove</span>
        </button>
        <button
          type="button"
          onClick={handleResetView}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          title="Centrar Vista"
        >
          <span className="material-symbols-outlined text-sm">center_focus_strong</span>
        </button>
      </div>

      {/* ── 5. NEUROMAPA SLIDING INSPECTION DRAWER ────────────────── */}
      {selectedNode && drawerOpen && (
        <div className="absolute bottom-3 right-3 top-20 z-30 w-80 sm:w-96 overflow-hidden rounded-2xl border border-white/15 bg-[#14171f]/95 shadow-2xl backdrop-blur-xl flex flex-col animate-in fade-in slide-in-from-right-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-3.5 bg-gradient-to-b from-white/5 to-transparent">
            <div className="flex items-center gap-2">
              {(() => {
                const theme = NEURO_NODE_THEMES[selectedNode.type] || NEURO_NODE_THEMES.knowledge;
                return (
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: theme.color }}
                  >
                    <span className="material-symbols-outlined text-sm">{theme.icon}</span>
                  </span>
                );
              })()}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {NEURO_NODE_THEMES[selectedNode.type]?.[isEn ? 'nameEn' : 'nameEs'] || selectedNode.type}
                </span>
                <p className="text-xs font-bold text-white truncate max-w-[210px]">
                  {selectedNode.label}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleCenterOnNode(selectedNode.id)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                title="Enfocar nodo en el centro"
              >
                <span className="material-symbols-outlined text-sm">filter_center_focus</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectNode(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                title="Cerrar panel"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-300">
            {/* Summary */}
            <div className="rounded-xl border border-white/10 bg-[#1b1f29] p-3 leading-relaxed">
              <p className="text-[11px] text-slate-200">{selectedNode.summary}</p>
            </div>

            {/* Quick Copilot Action */}
            <div className="rounded-xl border border-[#a193ff]/30 bg-[#a193ff]/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[#a193ff] font-bold text-[11px]">
                <span className="material-symbols-outlined text-sm">smart_toy</span>
                <span>Asistente Copiloto IA</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Usa el contexto de este nodo para redactar una propuesta, analizar objeciones o resolver una consulta.
              </p>
              {onExecuteCopilotAction && (
                <button
                  type="button"
                  onClick={() => onExecuteCopilotAction('inspect_node', selectedNode)}
                  className="w-full rounded-lg bg-[#a193ff] py-1.5 text-center text-xs font-bold text-[#120f24] hover:bg-[#b5a9ff] transition-colors shadow-sm"
                >
                  Comandar Asistente con este Nodo →
                </button>
              )}
            </div>

            {/* Connected Sinapses List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span>Sinapsis Conectadas</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-slate-300 font-mono">
                  {selectedNodeNeighbors.length} enlaces
                </span>
              </div>

              {selectedNodeNeighbors.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">No tiene conexiones directas registradas.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {selectedNodeNeighbors.map(({ edge, node, direction }) => {
                    const theme = NEURO_NODE_THEMES[node.type] || NEURO_NODE_THEMES.knowledge;
                    return (
                      <button
                        key={edge.id}
                        type="button"
                        onClick={() => {
                          onSelectNode(node.id);
                          handleCenterOnNode(node.id);
                        }}
                        className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-[#1b1f29] px-2.5 py-1.5 text-left transition-colors hover:border-white/20 hover:bg-white/10"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: theme.color }}
                          />
                          <span className="truncate text-slate-200 text-[11px] font-medium">
                            {node.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                          {direction === 'outgoing' ? '→' : '←'} {edge.relation}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Node Metadata Attributes */}
            {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Metadatos & Estado
                </span>
                <div className="space-y-1 rounded-xl border border-white/10 bg-[#1b1f29] p-2.5 text-[10px]">
                  {Object.entries(selectedNode.metadata).map(([k, v]) => {
                    if (v === null || v === undefined) return null;
                    return (
                      <div key={k} className="flex items-center justify-between py-0.5 border-b border-white/5 last:border-0">
                        <span className="text-slate-400 capitalize">{k}:</span>
                        <span className="font-semibold text-slate-200">{String(v)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 6. LOBES GUIDE FOOTER (Bottom Left inside canvas) ─────── */}
      <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-3 rounded-xl border border-white/10 bg-[#14171f]/80 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur-md">
        <span className="font-bold text-slate-300">Modo Neuromapa:</span>
        <span className="flex items-center gap-1 text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-[#a193ff]" /> Core IA
        </span>
        <span className="flex items-center gap-1 text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" /> Clientes
        </span>
        <span className="flex items-center gap-1 text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-[#06b6d4]" /> WhatsApp
        </span>
        <span className="flex items-center gap-1 text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" /> Ventas
        </span>
        <span className="flex items-center gap-1 text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" /> Objeciones
        </span>
      </div>
    </div>
  );
}
