'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  BrainEdge,
  BrainNode,
  BrainNodeType,
  CognitiveLearningState,
} from '@/lib/brain-graph';

type Point3D = [number, number, number];

export type BrainGraph3DProps = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  language?: string;
  learningState?: CognitiveLearningState;
  onTriggerLearn?: () => void;
};

type PositionedNode = {
  node: BrainNode;
  position: Point3D;
  degree: number;
  lobeName: string;
  lobeKey: string;
};

// ─── REGION COLORS (8 functional CRM regions) ────────────────────
export const REGION_COLORS: Record<string, string> = {
  prefrontal:   '#f59e0b', // Gold – Strategy / Sales
  conversation: '#06b6d4', // Cyan – Conversations / Calls
  crm:          '#10b981', // Emerald/Turquoise – CRM / Clients
  memory:       '#ec4899', // Magenta/Pink – Memory
  audit:        '#f87171', // Coral – Audit / Reasoning
  tools:        '#60a5fa', // Electric Blue/White – Tools (Cerebellum)
  documents:    '#8b5cf6', // Blue-Violet – Documents / Knowledge
  workflows:    '#22d3ee', // Intense Cyan – Workflows / Automations
  stem:         '#6366f1', // Indigo – Brainstem
  callosum:     '#ffffff', // White – Internal tracts
};

export const NODE_TYPE_COLORS: Record<BrainNodeType, string> = {
  core:          '#ffffff',
  customer:      '#10b981',
  conversation:  '#06b6d4',
  message_user:  '#ec4899',
  message_ai:    '#c084fc',
  intent:        '#f59e0b',
  knowledge:     '#8b5cf6',
  appointment:   '#fb923c',
  sale:          '#10b981',
  voice:         '#f43f5e',
  action:        '#a855f7',
  objection:     '#f87171',
  campaign:      '#0284c7',
};

export const NODE_TYPE_NAMES: Record<BrainNodeType, { es: string; en: string }> = {
  core:          { es: 'Eje Inteligente CRM', en: 'Core Engine' },
  customer:      { es: 'Cliente', en: 'Customer' },
  conversation:  { es: 'Conversación', en: 'Conversation' },
  message_user:  { es: 'Mensaje Cliente (WhatsApp)', en: 'User Message' },
  message_ai:    { es: 'Respuesta Aprendida IA', en: 'AI Learned Response' },
  intent:        { es: 'Intención de Compra', en: 'Buyer Intent' },
  knowledge:     { es: 'Memoria Procedimental', en: 'Procedural Knowledge' },
  appointment:   { es: 'Cita Agendada', en: 'Appointment' },
  sale:          { es: 'Venta Cerrada', en: 'Closed Sale' },
  voice:         { es: 'Llamada Telefónica IA', en: 'AI Voice Call' },
  action:        { es: 'Acción Refleja CRM', en: 'CRM Action' },
  objection:     { es: 'Objeción Resuelta', en: 'Resolved Objection' },
  campaign:      { es: 'Campaña de Marketing', en: 'Marketing Campaign' },
};

// ─── MAP NODE TYPES TO CRM BRAIN REGIONS ─────────────────────────
const NODE_TYPE_TO_REGION: Record<BrainNodeType, string> = {
  core:          'callosum',
  customer:      'crm',
  conversation:  'conversation',
  message_user:  'memory',
  message_ai:    'memory',
  intent:        'prefrontal',
  knowledge:     'documents',
  appointment:   'tools',
  sale:          'prefrontal',
  voice:         'conversation',
  action:        'workflows',
  objection:     'audit',
  campaign:      'prefrontal',
};

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────
function stableHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededFloat(seed: number, salt: number): number {
  let v = seed + Math.imul(salt, 0x6d2b79f5);
  v = Math.imul(v ^ (v >>> 15), v | 1);
  v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
  return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
}

function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.4, 'rgba(120, 200, 255, 0.5)');
  gradient.addColorStop(0.7, 'rgba(80, 100, 200, 0.12)');
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// ANATOMICAL BRAIN GEOMETRY
// The key insight: define the brain shape FIRST via spline profiles,
// then sample points ON and INSIDE the geometry.
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// ANATOMICAL BRAIN GEOMETRY — Sphere-to-Brain Deformation
//
// Strategy: Start with uniform points on a SPHERE, then apply
// anatomical displacement functions that sculpt it into a brain.
//
// This produces a shape recognizable as a human brain from ANY angle:
// - SIDE: Classic brain profile with frontal bulge, dome, temporal lobe
// - FRONT: Two distinct hemispheres separated by deep fissure
// - TOP: Oval with visible interhemispheric groove
// ═══════════════════════════════════════════════════════════════════

// Determines which anatomical region a point belongs to based on position
function classifyRegion(x: number, y: number): string {
  if (x < -3.0 && y > 0.0) return 'prefrontal';
  if (x < -1.5 && y < 0.0) return 'conversation';
  if (x < -1.5 && y >= 0.0 && y < 2.0) return 'conversation';
  if (x >= -1.5 && x < 1.0 && y > 1.5) return 'crm';
  if (x >= -1.5 && x < 1.0 && y >= -0.5 && y <= 1.5) return 'memory';
  if (x >= -1.5 && x < 1.0 && y < -0.5) return 'audit';
  if (x >= 1.0 && x < 2.8 && y > 0.0) return 'documents';
  if (x >= 1.0 && x < 2.8 && y <= 0.0) return 'workflows';
  if (x >= 2.8) return 'tools';
  return 'memory';
}

type BrainPoint = {
  pos: Point3D;
  color: THREE.Color;
  region: string;
  depth: number;
  hemi: number; // -1 = left, +1 = right, 0 = midline
};

type TractCurve = {
  points: THREE.Vector3[];
  color: string;
};

// ─── CORE BRAIN DEFORMATION FUNCTION ─────────────────────────────
// Takes a unit sphere point (nx, ny, nz) and radius, returns brain coordinates.
// This is the heart of the anatomical shape.
function deformSphereToBrain(
  nx: number, ny: number, nz: number, r: number,
): { x: number; y: number; z: number } {
  // ── BASE ELLIPSOID ──────────────────────────────────────────
  // Brain proportions: longest front-to-back (X), wide laterally (Z),
  // moderate height (Y)
  const baseRx = 5.0;  // anterior-posterior
  const baseRy = 3.5;  // superior-inferior
  const baseRz = 3.8;  // bilateral width

  let x = nx * baseRx * r;
  let y = ny * baseRy * r;
  let z = nz * baseRz * r;

  // Shift center up (brain's center of mass is above midline)
  const yCenter = 1.0;
  y += yCenter;

  // ── 1. INTERHEMISPHERIC FISSURE (the #1 brain feature) ──────
  // Deep groove running front-to-back along the top midline (z≈0).
  // This is what creates TWO VISIBLE HEMISPHERES.
  // MUST be very strong to be visible in the point cloud.
  {
    const yNorm = Math.max(0, (y - yCenter) / baseRy); // 0 at center, ~1 at top
    // Narrow Gaussian — sharp groove, not broad
    const midlineGauss = Math.exp(-(z * z) / (0.45 * 0.45));
    // Fissure is strong at top, fades at equator
    const topStrength = yNorm * yNorm;
    // Very deep indent to clearly split the top into two lobes
    const fissureAmount = 3.8 * midlineGauss * topStrength;
    y -= fissureAmount;

    // STRONGLY push hemispheres apart (widen Z near top midline)
    // This is critical for the two-hemisphere look
    if (Math.abs(z) < 2.0 && yNorm > 0.15) {
      const pushStrength = midlineGauss * topStrength;
      z += Math.sign(z || 0.001) * 0.8 * pushStrength;
    }
  }

  // ── 2. TEMPORAL LOBE PROTRUSION ─────────────────────────────
  // The temporal lobes are distinct bulges on each side that extend
  // downward and forward. They give the brain its characteristic
  // "wider at the bottom-sides" look.
  {
    const isLateral = Math.abs(nz) > 0.25;
    const isLower = ny < -0.1;
    if (isLateral && isLower) {
      const lateralAmount = Math.min(1, (Math.abs(nz) - 0.25) / 0.5);
      const lowerAmount = Math.min(1, (-ny - 0.1) / 0.6);
      const temporalStrength = lateralAmount * lowerAmount;
      // Push outward (Z)
      z += Math.sign(z) * temporalStrength * 1.0;
      // Push downward (Y)
      y -= temporalStrength * 0.6;
      // Push forward slightly (temporal pole is anterior)
      x -= temporalStrength * 0.5;
    }
  }

  // ── 3. FLAT BOTTOM ──────────────────────────────────────────
  // The base of the brain (where it rests on the skull base/tentorium)
  // is much flatter than the rounded top. Compress everything below
  // a certain Y level.
  {
    const flatLevel = -1.0;
    if (y < flatLevel) {
      y = flatLevel + (y - flatLevel) * 0.25; // aggressive flattening
    }
  }

  // ── 4. FRONTAL LOBE SHAPE ──────────────────────────────────
  // The frontal pole is more prominent and rounded/bulbous.
  // It extends further forward and is slightly wider.
  {
    if (nx < -0.4) {
      const frontalFactor = Math.min(1, (-nx - 0.4) / 0.6);
      x -= frontalFactor * 0.6 * r; // push forward
      // Frontal lobe is rounded — slightly increase Y and Z
      y += frontalFactor * 0.15 * Math.abs(ny) * r;
      z *= 1 + frontalFactor * 0.08;
    }
  }

  // ── 5. OCCIPITAL TAPER ──────────────────────────────────────
  // The back of the brain (occipital pole) narrows/tapers.
  {
    if (nx > 0.4) {
      const occFactor = Math.min(1, (nx - 0.4) / 0.6);
      const taper = 1.0 - occFactor * 0.2;
      y = yCenter + (y - yCenter) * taper;
      z *= taper;
    }
  }

  // ── 6. SYLVIAN FISSURE (lateral sulcus) ─────────────────────
  // A horizontal groove on each side separating frontal/parietal from
  // temporal lobe. Creates a visible indent on the lateral surface.
  {
    const sylvianY = 0.5; // Y level
    const nearSylvian = Math.exp(-((y - sylvianY) * (y - sylvianY)) / 0.4);
    const isLateral = Math.abs(z) > 1.5;
    if (isLateral && nearSylvian > 0.3) {
      // Indent inward along the Z axis
      const indent = 0.35 * nearSylvian * Math.min(1, (Math.abs(z) - 1.5) / 2.0);
      z -= Math.sign(z) * indent;
      y -= indent * 0.15;
    }
  }

  // ── 7. CENTRAL SULCUS HINT ──────────────────────────────────
  // A vertical groove on the dome running ear-to-ear, separating
  // frontal from parietal lobe.
  {
    const centralX = -0.5;
    const nearCentral = Math.exp(-((x - centralX) * (x - centralX)) / 0.3);
    const isUpper = y > 2.0;
    if (isUpper && nearCentral > 0.3) {
      y -= 0.2 * nearCentral;
    }
  }

  // ── 8. GYRI / CORTICAL FOLDING ──────────────────────────────
  // Small bumps on the surface that give the wrinkled brain texture.
  {
    const gyrus = 0.09 * Math.sin(x * 4.5 + z * 6.0)
                + 0.06 * Math.cos(y * 7.0 - x * 3.5)
                + 0.04 * Math.sin(z * 9.0 + y * 4.0)
                + 0.03 * Math.cos(x * 11.0 + z * 5.0 - y * 2.0);
    x += nx * gyrus * r;
    y += ny * gyrus * r;
    z += nz * gyrus * r;
  }

  return { x, y, z };
}

// ─── MAIN BRAIN GEOMETRY GENERATOR ───────────────────────────────
function generateAnatomicalBrain(): {
  points: BrainPoint[];
  surfaceLines: number[];
  tractCurves: TractCurve[];
} {
  const points: BrainPoint[] = [];

  // ── 1. CEREBRAL CORTEX ──────────────────────────────────────
  // Surface shell + sub-surface scatter
  const cortexCount = 3800;
  for (let i = 0; i < cortexCount; i++) {
    // Uniform random direction on unit sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const nx = sinPhi * Math.cos(theta); // → X (anterior-posterior)
    const ny = cosPhi;                    // → Y (superior-inferior)
    const nz = sinPhi * Math.sin(theta); // → Z (bilateral)

    // 75% on surface shell, 25% slightly inside for density
    const isSurface = Math.random() < 0.75;
    const r = isSurface
      ? 0.93 + Math.random() * 0.07
      : 0.55 + Math.random() * 0.38;

    const { x, y, z } = deformSphereToBrain(nx, ny, nz, r);

    const region = classifyRegion(x, y);
    const regionColor = REGION_COLORS[region] || REGION_COLORS.memory;
    const color = new THREE.Color(regionColor);
    color.offsetHSL(
      (Math.random() - 0.5) * 0.03,
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.08,
    );
    if (!isSurface) color.offsetHSL(0, -0.1, -0.06);

    const hemi = z > 0.3 ? 1 : z < -0.3 ? -1 : 0;

    points.push({
      pos: [x, y, z],
      color,
      region,
      depth: isSurface ? 0 : 1.0 - r,
      hemi,
    });
  }

  // ── 2. INTERIOR VOLUME ──────────────────────────────────────
  // Deep brain structures fill the interior
  const interiorCount = 600;
  for (let i = 0; i < interiorCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = Math.cbrt(Math.random()) * 0.5; // inner half

    const nx = Math.sin(phi) * Math.cos(theta);
    const ny = Math.cos(phi);
    const nz = Math.sin(phi) * Math.sin(theta);

    const { x, y, z } = deformSphereToBrain(nx, ny, nz, r);

    const region = classifyRegion(x, y);
    const regionColor = REGION_COLORS[region] || REGION_COLORS.memory;
    const color = new THREE.Color(regionColor);
    color.offsetHSL(0, -0.15, -0.1);

    points.push({
      pos: [x, y, z],
      color,
      region,
      depth: 0.5 + r * 0.5,
      hemi: z > 0.2 ? 1 : z < -0.2 ? -1 : 0,
    });
  }

  // ── 3. CEREBELLUM ───────────────────────────────────────────
  // Compact, dense structure at the back-bottom with horizontal folia
  const cerebellumCount = 600;
  const cbCenter = { x: 3.0, y: -2.2, z: 0 };
  const cbRx = 1.6, cbRy = 1.2, cbRz = 2.0;
  for (let i = 0; i < cerebellumCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = 0.4 + Math.random() * 0.6;

    const nx = Math.sin(phi) * Math.cos(theta);
    const ny = Math.cos(phi);
    const nz = Math.sin(phi) * Math.sin(theta);

    let cx = cbCenter.x + nx * cbRx * r;
    let cy = cbCenter.y + ny * cbRy * r;
    let cz = cbCenter.z + nz * cbRz * r;

    // Horizontal folia striations
    cy += 0.07 * Math.sin(cy * 20);
    // Cerebellar fissure (vermis indent on top)
    const vermisIndent = Math.exp(-(cz * cz) / 0.6) * Math.max(0, (cy - cbCenter.y) / cbRy);
    cy -= vermisIndent * 0.4;

    const color = new THREE.Color(REGION_COLORS.tools);
    color.offsetHSL(
      (Math.random() - 0.5) * 0.03,
      (Math.random() - 0.5) * 0.08,
      (Math.random() - 0.5) * 0.06,
    );

    points.push({
      pos: [cx, cy, cz],
      color,
      region: 'tools',
      depth: 1.0 - r,
      hemi: cz > 0.2 ? 1 : cz < -0.2 ? -1 : 0,
    });
  }

  // ── 4. BRAINSTEM ────────────────────────────────────────────
  const brainstemCount = 150;
  const stemPath = [
    { x: 1.2, y: -1.2 }, { x: 1.0, y: -2.0 },
    { x: 0.9, y: -3.0 }, { x: 0.8, y: -3.8 },
    { x: 0.7, y: -4.5 },
  ];
  for (let i = 0; i < brainstemCount; i++) {
    const t = Math.random();
    const idx = t * (stemPath.length - 1);
    const a = Math.floor(idx);
    const b = Math.min(a + 1, stemPath.length - 1);
    const frac = idx - a;

    const px = stemPath[a].x + (stemPath[b].x - stemPath[a].x) * frac;
    const py = stemPath[a].y + (stemPath[b].y - stemPath[a].y) * frac;
    const radius = 0.4 + 0.2 * Math.sin(t * Math.PI); // wider in middle
    const angle = Math.random() * Math.PI * 2;
    const rf = 0.3 + Math.random() * 0.7;

    const x = px + Math.cos(angle) * radius * rf;
    const y = py + (Math.random() - 0.5) * 0.15;
    const z = Math.sin(angle) * radius * rf;

    const color = new THREE.Color(REGION_COLORS.stem);
    color.offsetHSL(0, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05);

    points.push({
      pos: [x, y, z], color, region: 'stem', depth: 0.5,
      hemi: 0,
    });
  }

  // ── 5. SURFACE LATTICE LINES ────────────────────────────────
  // CRITICAL: Lines must NOT cross the interhemispheric fissure!
  // Only connect points on the same hemisphere or both near midline.
  const surfaceLines: number[] = [];
  const maxDistSq = 1.6;
  const maxEdges = 3;

  // Filter to surface-ish points for lattice
  const surfaceIdxs: number[] = [];
  points.forEach((p, i) => {
    if (p.depth < 0.3) surfaceIdxs.push(i);
  });

  for (let ii = 0; ii < surfaceIdxs.length; ii += 2) {
    const i = surfaceIdxs[ii];
    const p1 = points[i];
    let connected = 0;

    for (let jj = ii + 1; jj < surfaceIdxs.length && connected < maxEdges; jj++) {
      const j = surfaceIdxs[jj];
      const p2 = points[j];

      // *** HEMISPHERE RULE: Don't connect across the fissure ***
      // If both points are clearly on different hemispheres, skip
      if (p1.hemi !== 0 && p2.hemi !== 0 && p1.hemi !== p2.hemi) continue;

      const dx = p1.pos[0] - p2.pos[0];
      const dy = p1.pos[1] - p2.pos[1];
      const dz = p1.pos[2] - p2.pos[2];
      const distSq = dx * dx + dy * dy + dz * dz;

      const sameRegion = p1.region === p2.region;
      const threshold = sameRegion ? maxDistSq : maxDistSq * 0.5;

      if (distSq < threshold) {
        surfaceLines.push(
          p1.pos[0], p1.pos[1], p1.pos[2],
          p2.pos[0], p2.pos[1], p2.pos[2],
        );
        connected++;
      }
    }
  }

  // ── 6. TRACTOGRAPHY FIBER BUNDLES ───────────────────────────
  const tractCurves: TractCurve[] = [];
  const tractCount = 42;

  for (let t = 0; t < tractCount; t++) {
    const hemi = t % 2 === 0 ? 1 : -1;
    const spread = 0.3 + Math.random() * 0.4;
    const zOff = hemi * (1.0 + Math.random() * 1.6);

    // Arc through interior of one hemisphere
    const controlPoints = [
      new THREE.Vector3(0.8 + spread * 0.3, -1.8 + spread * 0.2, zOff * 0.3),
      new THREE.Vector3(-0.5 + spread * 0.2, 0.0 + spread * 0.3, zOff * 0.5),
      new THREE.Vector3(-3.0 + spread * 0.4, 1.5 + spread * 0.2, zOff * 0.6),
      new THREE.Vector3(-1.0 + spread * 0.2, 3.0 + spread * 0.2, zOff * 0.5),
      new THREE.Vector3(1.2 + spread * 0.3, 2.5 + spread * 0.2, zOff * 0.6),
      new THREE.Vector3(2.5 + spread * 0.2, 1.0 + spread * 0.3, zOff * 0.7),
      new THREE.Vector3(1.0 + spread * 0.3, -0.2 + spread * 0.2, zOff * 0.8),
    ];

    const curve = new THREE.CatmullRomCurve3(controlPoints);
    const sampledPoints = curve.getPoints(50);
    const tractColors = ['#00f0ff', '#38bdf8', '#818cf8', '#c084fc', '#ec4899', '#f59e0b'];
    tractCurves.push({ points: sampledPoints, color: tractColors[t % tractColors.length] });
  }

  // ── 7. CORPUS CALLOSUM FIBERS ───────────────────────────────
  // Cross-hemisphere tracts connecting left to right through the midline
  for (let t = 0; t < 12; t++) {
    const xPos = -3.5 + t * 0.6; // spread front to back
    const yLevel = 1.5 + Math.random() * 1.5;
    const arcHeight = 0.3 + Math.random() * 0.4;

    const controlPoints = [
      new THREE.Vector3(xPos + (Math.random() - 0.5) * 0.3, yLevel - 0.3, -2.8 - Math.random() * 0.5),
      new THREE.Vector3(xPos + (Math.random() - 0.5) * 0.2, yLevel + arcHeight, -0.8),
      new THREE.Vector3(xPos + (Math.random() - 0.5) * 0.1, yLevel + arcHeight * 1.2, 0),
      new THREE.Vector3(xPos + (Math.random() - 0.5) * 0.2, yLevel + arcHeight, 0.8),
      new THREE.Vector3(xPos + (Math.random() - 0.5) * 0.3, yLevel - 0.3, 2.8 + Math.random() * 0.5),
    ];

    const curve = new THREE.CatmullRomCurve3(controlPoints);
    tractCurves.push({ points: curve.getPoints(30), color: '#ffffff' });
  }

  return { points, surfaceLines, tractCurves };
}

// ─── ANATOMICAL REGION ANCHORS FOR CRM NODES ─────────────────────
// Each CRM node type is placed within its corresponding brain region
// Z values alternate between hemispheres to distribute nodes bilaterally
const REGION_ANCHORS: Record<string, { center: Point3D; spread: Point3D }> = {
  prefrontal:   { center: [-3.8, 2.2, 1.2],  spread: [1.2, 1.0, 1.8] },
  conversation: { center: [-2.5, -0.4, 1.8], spread: [1.0, 0.8, 1.6] },
  crm:          { center: [-0.2, 2.8, 1.4],  spread: [1.0, 0.7, 1.6] },
  memory:       { center: [-0.4, 0.6, 1.2],  spread: [1.0, 0.8, 1.4] },
  audit:        { center: [0.0, -0.8, 1.5],  spread: [0.8, 0.6, 1.2] },
  tools:        { center: [3.2, -2.0, 1.0],  spread: [0.8, 0.6, 1.2] },
  documents:    { center: [2.4, 1.4, 1.2],   spread: [0.9, 0.7, 1.4] },
  workflows:    { center: [1.8, -0.5, 1.4],  spread: [0.8, 0.6, 1.2] },
  callosum:     { center: [0.0, 1.2, 0.0],   spread: [0.3, 0.3, 0.3] },
  stem:         { center: [0.9, -3.2, 0.0],  spread: [0.3, 0.5, 0.3] },
};

// Layout CRM nodes onto anatomical brain regions
function layoutCRMNodes(nodes: BrainNode[], edges: BrainEdge[]): PositionedNode[] {
  const degrees = new Map<string, number>();
  for (const e of edges) {
    degrees.set(e.source, (degrees.get(e.source) || 0) + 1);
    degrees.set(e.target, (degrees.get(e.target) || 0) + 1);
  }

  const regionCounts = new Map<string, number>();

  return nodes.map((node) => {
    const regionKey = NODE_TYPE_TO_REGION[node.type] || 'memory';

    if (node.type === 'core') {
      return {
        node,
        position: [0.0, 1.2, 0.0] as Point3D,
        degree: degrees.get(node.id) || 0,
        lobeName: 'Eje Central CRM',
        lobeKey: 'callosum',
      };
    }

    const anchor = REGION_ANCHORS[regionKey] || REGION_ANCHORS.memory;
    const count = regionCounts.get(regionKey) || 0;
    regionCounts.set(regionKey, count + 1);

    const seed = stableHash(node.id);
    const angle = count * 2.39996 + seededFloat(seed, 1) * 0.8;
    const radiusNorm = Math.sqrt((count + 0.5) / 12);
    const r = Math.min(1.2, 0.25 + radiusNorm * 0.7);

    const hemisphere = count % 2 === 0 ? 1 : -1;
    const x = anchor.center[0] + Math.cos(angle) * r * anchor.spread[0] + (seededFloat(seed, 2) - 0.5) * 0.3;
    const y = anchor.center[1] + Math.sin(angle) * r * anchor.spread[1] + (seededFloat(seed, 3) - 0.5) * 0.3;
    const z = anchor.center[2] * hemisphere + (seededFloat(seed, 4) - 0.5) * anchor.spread[2];

    return {
      node,
      position: [x, y, z] as Point3D,
      degree: degrees.get(node.id) || 0,
      lobeName: regionKey,
      lobeKey: regionKey,
    };
  });
}

// ─── FLOATING ANATOMICAL LABELS ──────────────────────────────────
const ANATOMICAL_CALLOUTS = [
  {
    key: 'prefrontal',
    titleEs: 'PREFRONTAL · ESTRATEGIA',
    titleEn: 'PREFRONTAL · STRATEGY',
    descEs: 'Estrategia comercial, scoring de leads, cierre',
    descEn: 'Sales strategy, lead scoring, closing tactics',
    pos: [-4.2, 3.0, 0.5] as Point3D,
    color: '#f59e0b',
  },
  {
    key: 'conversation',
    titleEs: 'CONVERSACIÓN · LLAMADAS',
    titleEn: 'CONVERSATION · CALLS',
    descEs: 'Llamadas, transcripciones, análisis de sentimiento',
    descEn: 'Calls, transcriptions, sentiment analysis',
    pos: [-3.0, -1.0, 2.4] as Point3D,
    color: '#06b6d4',
  },
  {
    key: 'crm',
    titleEs: 'CRM · CLIENTES',
    titleEn: 'CRM · CLIENTS',
    descEs: 'Contactos, leads, pipeline, oportunidades',
    descEn: 'Contacts, leads, pipeline, opportunities',
    pos: [-0.4, 3.8, 1.2] as Point3D,
    color: '#10b981',
  },
  {
    key: 'memory',
    titleEs: 'MEMORIA',
    titleEn: 'MEMORY',
    descEs: 'Memoria de clientes, conversaciones, embeddings',
    descEn: 'Client memory, conversations, knowledge graph',
    pos: [-0.4, 0.6, -2.0] as Point3D,
    color: '#ec4899',
  },
  {
    key: 'audit',
    titleEs: 'AUDITORÍA',
    titleEn: 'AUDIT',
    descEs: 'Razonamiento, trazabilidad, control de calidad',
    descEn: 'Reasoning, traceability, quality control',
    pos: [0.0, -1.4, 2.0] as Point3D,
    color: '#f87171',
  },
  {
    key: 'tools',
    titleEs: 'HERRAMIENTAS',
    titleEn: 'TOOLS',
    descEs: 'Email, WhatsApp, telefonía, APIs, automatizaciones',
    descEn: 'Email, WhatsApp, telephony, APIs, automations',
    pos: [3.8, -2.4, 1.2] as Point3D,
    color: '#60a5fa',
  },
  {
    key: 'documents',
    titleEs: 'DOCUMENTOS',
    titleEn: 'DOCUMENTS',
    descEs: 'PDFs, manuales, catálogos, conocimiento indexado',
    descEn: 'PDFs, manuals, catalogs, indexed knowledge',
    pos: [3.0, 2.0, -1.2] as Point3D,
    color: '#8b5cf6',
  },
  {
    key: 'workflows',
    titleEs: 'WORKFLOWS',
    titleEn: 'WORKFLOWS',
    descEs: 'Automatizaciones, triggers, acciones del CRM',
    descEn: 'Automations, triggers, CRM actions',
    pos: [2.2, -0.6, -1.6] as Point3D,
    color: '#22d3ee',
  },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN 3D BRAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function BrainGraph3D({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  language = 'es',
  learningState,
  onTriggerLearn,
}: BrainGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);
  const [activeCameraView, setActiveCameraView] = useState<'profile' | 'orbit' | 'messages' | 'calls' | 'strategy'>('profile');
  const [showLabels, setShowLabels] = useState(true);
  const [isLearningSurgeActive, setIsLearningSurgeActive] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<{
    node: BrainNode;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [projectedLabels, setProjectedLabels] = useState<
    Array<{
      key: string;
      title: string;
      desc: string;
      color: string;
      x: number;
      y: number;
      visible: boolean;
    }>
  >([]);

  const isEn = language === 'en';

  useEffect(() => {
    setHasWebGL(supportsWebGL());
  }, []);

  const positionedNodes = useMemo(() => layoutCRMNodes(nodes, edges), [nodes, edges]);
  const nodePositionsMap = useMemo(
    () => new Map(positionedNodes.map((p) => [p.node.id, p.position])),
    [positionedNodes],
  );

  const selectedConnections = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const set = new Set<string>([selectedNodeId]);
    for (const e of edges) {
      if (e.source === selectedNodeId) set.add(e.target);
      if (e.target === selectedNodeId) set.add(e.source);
    }
    return set;
  }, [edges, selectedNodeId]);

  const onSelectNodeRef = useRef(onSelectNode);
  onSelectNodeRef.current = onSelectNode;
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  const selectedConnectionsRef = useRef(selectedConnections);
  selectedConnectionsRef.current = selectedConnections;

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const setCameraView = useCallback((view: 'profile' | 'orbit' | 'messages' | 'calls' | 'strategy') => {
    setActiveCameraView(view);
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (view === 'profile') {
      cam.position.set(4.0, 2.5, 14.0);
      ctrl.target.set(0, 0.8, 0);
      ctrl.autoRotate = false;
    } else if (view === 'orbit') {
      cam.position.set(5, 3, 14);
      ctrl.target.set(0, 0.8, 0);
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.3;
    } else if (view === 'messages') {
      cam.position.set(-1.0, -0.5, 8.0);
      ctrl.target.set(-0.4, 0.6, 1.0);
      ctrl.autoRotate = false;
    } else if (view === 'calls') {
      cam.position.set(-2.5, -0.4, -8.0);
      ctrl.target.set(-2.5, -0.4, 1.4);
      ctrl.autoRotate = false;
    } else if (view === 'strategy') {
      cam.position.set(-8.0, 3.5, 6.0);
      ctrl.target.set(-3.8, 2.2, 0.8);
      ctrl.autoRotate = false;
    }
    ctrl.update();
  }, []);

  const handleStimulateLearning = useCallback(() => {
    setIsLearningSurgeActive(true);
    onTriggerLearn?.();
    setTimeout(() => {
      setIsLearningSurgeActive(false);
    }, 2800);
  }, [onTriggerLearn]);

  // ─── THREE.JS RENDERING ENGINE ─────────────────────────────────
  useEffect(() => {
    if (!hasWebGL || !containerRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth || 960;
    const h = container.clientHeight || 580;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#010208');
    scene.fog = new THREE.FogExp2('#010208', 0.014);

    // Camera – 3/4 angle view showing both profile and bilateral depth
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 200);
    camera.position.set(4.0, 2.5, 14.0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 40;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.75;
    controls.target.set(0, 0.8, 0);
    controls.autoRotate = false;
    controlsRef.current = controls;

    // Lighting
    scene.add(new THREE.AmbientLight('#0a0e28', 1.8));

    const coreLight = new THREE.PointLight('#38bdf8', 15, 22);
    coreLight.position.set(0, 1.2, 0);
    scene.add(coreLight);

    const rimCyan = new THREE.PointLight('#00f0ff', 20, 30);
    rimCyan.position.set(-6, 5, 10);
    scene.add(rimCyan);

    const rimPurple = new THREE.PointLight('#ec4899', 16, 28);
    rimPurple.position.set(6, -4, -8);
    scene.add(rimPurple);

    const rimGold = new THREE.PointLight('#f59e0b', 10, 20);
    rimGold.position.set(-8, 4, -4);
    scene.add(rimGold);

    // Glow texture
    const glowTexture = createGlowTexture();

    // Starfield background
    const createStarField = (count: number, minR: number, maxR: number, size: number, color: string, opacity: number) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count * 3; i += 3) {
        const r = minR + Math.random() * (maxR - minR);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        pos[i]     = r * Math.sin(phi) * Math.cos(theta);
        pos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i + 2] = r * Math.cos(phi);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        map: glowTexture,
        color,
        size,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      return new THREE.Points(geo, mat);
    };

    const stars1 = createStarField(700, 22, 50, 0.18, '#bae6fd', 0.5);
    const stars2 = createStarField(350, 18, 35, 0.26, '#ddd6fe', 0.35);
    const stars3 = createStarField(180, 14, 28, 0.35, '#fbcfe8', 0.25);
    scene.add(stars1, stars2, stars3);

    // ── BRAIN ROOT GROUP ──────────────────────────────────────
    const brainRoot = new THREE.Group();
    brainRoot.position.set(0, 0, 0);
    scene.add(brainRoot);

    // Generate anatomical brain
    const { points: brainPoints, surfaceLines, tractCurves } = generateAnatomicalBrain();

    // ── CORTICAL POINTS ───────────────────────────────────────
    const cortexGeo = new THREE.BufferGeometry();
    const cortexPos = new Float32Array(brainPoints.length * 3);
    const cortexCol = new Float32Array(brainPoints.length * 3);

    brainPoints.forEach((pt, i) => {
      cortexPos[i * 3]     = pt.pos[0];
      cortexPos[i * 3 + 1] = pt.pos[1];
      cortexPos[i * 3 + 2] = pt.pos[2];
      cortexCol[i * 3]     = pt.color.r;
      cortexCol[i * 3 + 1] = pt.color.g;
      cortexCol[i * 3 + 2] = pt.color.b;
    });

    cortexGeo.setAttribute('position', new THREE.BufferAttribute(cortexPos, 3));
    cortexGeo.setAttribute('color', new THREE.BufferAttribute(cortexCol, 3));

    const cortexMat = new THREE.PointsMaterial({
      map: glowTexture,
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    brainRoot.add(new THREE.Points(cortexGeo, cortexMat));

    // ── SURFACE LATTICE LINES ─────────────────────────────────
    if (surfaceLines.length > 0) {
      const latticeGeo = new THREE.BufferGeometry();
      latticeGeo.setAttribute('position', new THREE.Float32BufferAttribute(surfaceLines, 3));
      const latticeMat = new THREE.LineBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      brainRoot.add(new THREE.LineSegments(latticeGeo, latticeMat));
    }

    // ── TRACTOGRAPHY FIBER BUNDLES ────────────────────────────
    const tractGroup = new THREE.Group();
    tractCurves.forEach((tc) => {
      const geo = new THREE.BufferGeometry().setFromPoints(tc.points);
      const mat = new THREE.LineBasicMaterial({
        color: tc.color,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      tractGroup.add(new THREE.Line(geo, mat));
    });
    brainRoot.add(tractGroup);

    // ── SYNAPTIC LIGHT RAYS ───────────────────────────────────
    const rayCount = 80;
    const rayHeadGeo = new THREE.BufferGeometry();
    const rayHeadPos = new Float32Array(rayCount * 3);
    const rayHeadCol = new Float32Array(rayCount * 3);
    const rayTailGeo = new THREE.BufferGeometry();
    const rayTailPos = new Float32Array(rayCount * 3 * 3);
    const rayTailCol = new Float32Array(rayCount * 3 * 3);

    const rayAgents = Array.from({ length: rayCount }, (_, i) => {
      const isTract = i < 40;
      const palette = [
        new THREE.Color('#ffffff'),
        new THREE.Color('#00f0ff'),
        new THREE.Color('#ec4899'),
        new THREE.Color('#f59e0b'),
        new THREE.Color('#38bdf8'),
        new THREE.Color('#8b5cf6'),
      ];
      return {
        isTract,
        tractIdx: i % tractCurves.length,
        progress: Math.random(),
        speed: 0.006 + Math.random() * 0.014,
        cortexA: Math.floor(Math.random() * brainPoints.length),
        cortexB: Math.floor(Math.random() * brainPoints.length),
        color: palette[i % palette.length],
        history: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
      };
    });

    rayHeadGeo.setAttribute('position', new THREE.BufferAttribute(rayHeadPos, 3));
    rayHeadGeo.setAttribute('color', new THREE.BufferAttribute(rayHeadCol, 3));
    const rayHeadMat = new THREE.PointsMaterial({
      map: glowTexture,
      size: 0.45,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    brainRoot.add(new THREE.Points(rayHeadGeo, rayHeadMat));

    rayTailGeo.setAttribute('position', new THREE.BufferAttribute(rayTailPos, 3));
    rayTailGeo.setAttribute('color', new THREE.BufferAttribute(rayTailCol, 3));
    const rayTailMat = new THREE.PointsMaterial({
      map: glowTexture,
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    brainRoot.add(new THREE.Points(rayTailGeo, rayTailMat));

    // ── SYNAPTIC FLASH RINGS ──────────────────────────────────
    const flashRingCount = 10;
    const ringGeo = new THREE.RingGeometry(0.08, 0.3, 24);
    const flashRings: Array<{ mesh: THREE.Mesh; scale: number; opacity: number; active: boolean }> = [];

    for (let r = 0; r < flashRingCount; r++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#00f0ff',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const rMesh = new THREE.Mesh(ringGeo, ringMat);
      rMesh.visible = false;
      brainRoot.add(rMesh);
      flashRings.push({ mesh: rMesh, scale: 1, opacity: 0, active: false });
    }

    let nextRingIdx = 0;
    const triggerFlash = (pos: Point3D, colorHex = '#00f0ff') => {
      const item = flashRings[nextRingIdx % flashRingCount];
      nextRingIdx++;
      item.mesh.position.set(...pos);
      (item.mesh.material as THREE.MeshBasicMaterial).color.set(colorHex);
      item.scale = 0.3;
      item.opacity = 0.85;
      item.active = true;
      item.mesh.visible = true;
    };

    // ── CRM NODE MESHES ───────────────────────────────────────
    const nodeMeshes: THREE.Mesh[] = [];
    const nodeAuraMeshes: THREE.Mesh[] = [];
    const sphereGeo = new THREE.SphereGeometry(1, 20, 16);
    const crmGroup = new THREE.Group();

    positionedNodes.forEach((item) => {
      const isCore = item.node.type === 'core';
      const isSelected = item.node.id === selectedNodeIdRef.current;
      const isConnected = selectedConnectionsRef.current.has(item.node.id);
      const dimmed = Boolean(selectedNodeIdRef.current && !isConnected);

      const colorHex = NODE_TYPE_COLORS[item.node.type] || '#ffffff';
      const baseR = isCore
        ? 0.32
        : Math.min(0.20, 0.09 + Math.log2(item.degree + 1) * 0.03);
      const scale = baseR * (isSelected ? 1.5 : 1.0);

      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: dimmed ? 0.15 : isSelected ? 3.5 : isCore ? 2.5 : 1.5,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: dimmed ? 0.2 : 0.9,
      });

      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.position.set(...item.position);
      mesh.scale.setScalar(scale);
      mesh.userData = { nodeId: item.node.id, node: item.node, baseScale: scale, pos: item.position };
      nodeMeshes.push(mesh);
      crmGroup.add(mesh);

      const auraMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: dimmed ? 0.015 : 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      });
      const aura = new THREE.Mesh(sphereGeo, auraMat);
      aura.position.set(...item.position);
      aura.scale.setScalar(scale * 1.5);
      aura.userData = { baseScale: scale };
      nodeAuraMeshes.push(aura);
      crmGroup.add(aura);
    });

    brainRoot.add(crmGroup);

    // ── CRM EDGE LINES (Curved connections) ───────────────────
    const edgeGroup = new THREE.Group();

    edges.forEach((edge) => {
      const sp = nodePositionsMap.get(edge.source);
      const tp = nodePositionsMap.get(edge.target);
      if (!sp || !tp) return;

      const isHighlighted = Boolean(
        selectedNodeIdRef.current &&
        (edge.source === selectedNodeIdRef.current || edge.target === selectedNodeIdRef.current),
      );

      // Create curved connection using quadratic Bezier
      const start = new THREE.Vector3(...sp);
      const end = new THREE.Vector3(...tp);
      const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
      // Curve toward the brain interior
      const normal = new THREE.Vector3().subVectors(end, start).cross(new THREE.Vector3(0, 0, 1)).normalize();
      mid.add(normal.multiplyScalar(0.3 + Math.random() * 0.4));

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const curvePoints = curve.getPoints(12);
      const geo = new THREE.BufferGeometry().setFromPoints(curvePoints);

      const mat = new THREE.LineBasicMaterial({
        color: isHighlighted ? '#ffffff' : '#60a5fa',
        transparent: true,
        opacity: isHighlighted ? 0.85 : selectedNodeIdRef.current ? 0.06 : 0.25,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      edgeGroup.add(new THREE.Line(geo, mat));
    });

    brainRoot.add(edgeGroup);

    // ── SELECTION PULSE RING ──────────────────────────────────
    let selRing: THREE.Mesh | null = null;
    const currentSelItem = selectedNodeIdRef.current
      ? positionedNodes.find((p) => p.node.id === selectedNodeIdRef.current)
      : null;
    if (currentSelItem) {
      const selGeo = new THREE.RingGeometry(0.5, 0.65, 32);
      const selMat = new THREE.MeshBasicMaterial({
        color: NODE_TYPE_COLORS[currentSelItem.node.type] || '#ffffff',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });
      selRing = new THREE.Mesh(selGeo, selMat);
      selRing.position.set(...currentSelItem.position);
      crmGroup.add(selRing);
    }

    // ── RAYCASTING & INTERACTION ──────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let isDragging = false;
    let downTime = 0;
    let downX = 0;
    let downY = 0;

    const updatePointer = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerDown = (e: MouseEvent) => {
      isDragging = false;
      downTime = performance.now();
      downX = e.clientX;
      downY = e.clientY;
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) isDragging = true;
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(nodeMeshes, false);
      if (hits.length > 0) {
        renderer.domElement.style.cursor = 'pointer';
        const hitNode = hits[0].object.userData.node as BrainNode;
        const rect = container.getBoundingClientRect();
        setHoveredNode({
          node: hitNode,
          screenX: e.clientX - rect.left,
          screenY: e.clientY - rect.top,
        });
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredNode(null);
      }
    };

    const handlePointerUp = (e: MouseEvent) => {
      const dur = performance.now() - downTime;
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (!isDragging && dur < 350 && dist < 6) {
        updatePointer(e);
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(nodeMeshes, false);
        onSelectNodeRef.current(hits.length > 0 ? hits[0].object.userData.nodeId : null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    // ── RESIZE OBSERVER ───────────────────────────────────────
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: rw, height: rh } = entry.contentRect;
        if (rw > 0 && rh > 0) {
          camera.aspect = rw / rh;
          camera.updateProjectionMatrix();
          renderer.setSize(rw, rh);
        }
      }
    });
    ro.observe(container);

    // ── ANIMATION LOOP ────────────────────────────────────────
    let animId: number;
    const clock = new THREE.Clock();
    const tempVec = new THREE.Vector3();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      controls.update();

      // Starfield drift
      stars1.rotation.y = t * 0.004;
      stars2.rotation.y = t * 0.003;
      stars3.rotation.y = t * 0.002;

      // Cognitive breathing lights
      const pulse = Math.sin(t * 2.0) * 0.5 + 0.5;
      coreLight.intensity = 12 + pulse * 8;
      rimCyan.intensity = 16 + Math.sin(t * 1.3 + 1) * 6;
      rimPurple.intensity = 14 + Math.sin(t * 1.6 + 2) * 5;
      rimGold.intensity = 8 + Math.sin(t * 1.1 + 3) * 4;

      // ── UPDATE SYNAPTIC LIGHT RAYS ──────────────────────
      const hPos = rayHeadGeo.attributes.position.array as Float32Array;
      const hCol = rayHeadGeo.attributes.color.array as Float32Array;
      const tPos = rayTailGeo.attributes.position.array as Float32Array;
      const tCol = rayTailGeo.attributes.color.array as Float32Array;

      rayAgents.forEach((ray, i) => {
        ray.progress += ray.speed;
        let currentPos = new THREE.Vector3();

        if (ray.isTract) {
          const tc = tractCurves[ray.tractIdx];
          const pts = tc.points;
          const totalPts = pts.length - 1;
          const floatIdx = (ray.progress % 1.0) * totalPts;
          const idxA = Math.floor(floatIdx);
          const idxB = Math.min(idxA + 1, totalPts);
          currentPos.lerpVectors(pts[idxA], pts[idxB], floatIdx - idxA);

          if (ray.progress >= 1.0) {
            ray.progress = 0;
            ray.tractIdx = (ray.tractIdx + 5) % tractCurves.length;
            triggerFlash([currentPos.x, currentPos.y, currentPos.z]);
          }
        } else {
          const pA = brainPoints[ray.cortexA].pos;
          const pB = brainPoints[ray.cortexB].pos;
          const alpha = ray.progress % 1.0;
          currentPos.set(
            pA[0] + (pB[0] - pA[0]) * alpha,
            pA[1] + (pB[1] - pA[1]) * alpha,
            pA[2] + (pB[2] - pA[2]) * alpha,
          );
          if (ray.progress >= 1.0) {
            ray.progress = 0;
            ray.cortexA = ray.cortexB;
            ray.cortexB = Math.floor(Math.random() * brainPoints.length);
            triggerFlash([currentPos.x, currentPos.y, currentPos.z]);
          }
        }

        ray.history.unshift(currentPos.clone());
        if (ray.history.length > 4) ray.history.pop();

        hPos[i * 3]     = currentPos.x;
        hPos[i * 3 + 1] = currentPos.y;
        hPos[i * 3 + 2] = currentPos.z;
        hCol[i * 3]     = ray.color.r;
        hCol[i * 3 + 1] = ray.color.g;
        hCol[i * 3 + 2] = ray.color.b;

        for (let seg = 0; seg < 3; seg++) {
          const segIdx = (i * 3 + seg) * 3;
          const histPt = ray.history[seg + 1] || currentPos;
          tPos[segIdx]     = histPt.x;
          tPos[segIdx + 1] = histPt.y;
          tPos[segIdx + 2] = histPt.z;
          const fade = (3 - seg) / 4;
          tCol[segIdx]     = ray.color.r * fade;
          tCol[segIdx + 1] = ray.color.g * fade;
          tCol[segIdx + 2] = ray.color.b * fade;
        }
      });

      rayHeadGeo.attributes.position.needsUpdate = true;
      rayHeadGeo.attributes.color.needsUpdate = true;
      rayTailGeo.attributes.position.needsUpdate = true;
      rayTailGeo.attributes.color.needsUpdate = true;

      // ── UPDATE FLASH RINGS ──────────────────────────────
      flashRings.forEach((item) => {
        if (!item.active) return;
        item.scale += 0.07;
        item.opacity -= 0.04;
        item.mesh.scale.setScalar(item.scale);
        (item.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, item.opacity);
        item.mesh.lookAt(camera.position);
        if (item.opacity <= 0) {
          item.active = false;
          item.mesh.visible = false;
        }
      });

      // ── AURA BREATHING ──────────────────────────────────
      nodeAuraMeshes.forEach((aura, i) => {
        const breathe = 1.0 + Math.sin(t * 2.5 + i * 0.4) * 0.07;
        const baseScale = (aura.userData.baseScale as number) || 0.2;
        aura.scale.setScalar(baseScale * 1.5 * breathe);
      });

      if (selRing) {
        selRing.lookAt(camera.position);
        selRing.scale.setScalar(1.0 + Math.sin(t * 3.5) * 0.12);
      }

      // ── PROJECT LABELS ──────────────────────────────────
      if (container) {
        const rect = container.getBoundingClientRect();
        const projected = ANATOMICAL_CALLOUTS.map((callout) => {
          tempVec.set(...callout.pos);
          brainRoot.localToWorld(tempVec);
          tempVec.project(camera);

          const isBehind = tempVec.z > 1.0;
          const x = ((tempVec.x + 1) * rect.width) / 2;
          const y = ((-tempVec.y + 1) * rect.height) / 2;

          return {
            key: callout.key,
            title: isEn ? callout.titleEn : callout.titleEs,
            desc: isEn ? callout.descEn : callout.descEs,
            color: callout.color,
            x,
            y,
            visible: !isBehind && x > -80 && x < rect.width + 80 && y > -40 && y < rect.height + 40,
          };
        });
        setProjectedLabels(projected);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      ro.disconnect();
      glowTexture.dispose();
      cortexGeo.dispose();
      cortexMat.dispose();
      sphereGeo.dispose();
      ringGeo.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [hasWebGL, positionedNodes, edges, nodePositionsMap, isEn]);

  if (hasWebGL === false) {
    return (
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center bg-[#010208] p-6 text-center text-slate-300">
        <span className="material-symbols-outlined mb-3 text-4xl text-cyan-400">neurology</span>
        <h4 className="text-base font-bold text-white">Visualizador 3D no soportado</h4>
        <p className="mt-1 text-xs text-slate-400">Tu navegador no tiene aceleración WebGL activa.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#010208]">
      {/* THREE.JS CANVAS */}
      <div ref={containerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* TOP HUD */}
      <div className="pointer-events-none absolute left-4 top-4 right-4 flex items-center justify-between gap-3 flex-wrap z-20">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#070b1e]/85 px-4 py-2 text-xs text-white backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
            </span>
            <span className="font-extrabold tracking-wide text-cyan-300 uppercase text-[10px]">
              {isEn ? 'AI Brain Active' : 'Cerebro IA Activo'}
            </span>
          </div>
          <div className="hidden sm:block h-3.5 w-px bg-white/20" />
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-300">
            <span>
              💬 {isEn ? 'Memory: ' : 'Memoria: '}
              <strong className="text-emerald-400 font-bold">100%</strong>
            </span>
            <span>
              📞 {isEn ? 'Calls: ' : 'Llamadas: '}
              <strong className="text-pink-400 font-bold">98.6%</strong>
            </span>
            <span>
              ⚡ {isEn ? 'Latency: ' : 'Latencia: '}
              <strong className="text-amber-400 font-bold">&lt;0.8s</strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStimulateLearning}
          disabled={isLearningSurgeActive}
          className="pointer-events-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/30 active:scale-95 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm animate-pulse">bolt</span>
          <span>
            {isLearningSurgeActive
              ? isEn ? '⚡ Assimilating...' : '⚡ Asimilando...'
              : isEn ? '⚡ Synaptic Surge' : '⚡ Aprender'}
          </span>
        </button>
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between flex-wrap gap-3 z-20">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-white/10 bg-[#070b1e]/85 p-1.5 backdrop-blur-md shadow-2xl">
          {([
            { key: 'profile' as const, icon: '👁️', labelEs: 'Perfil', labelEn: 'Profile', color: 'cyan' },
            { key: 'orbit' as const, icon: '🧠', labelEs: 'Giro 360°', labelEn: '360° Orbit', color: 'cyan' },
            { key: 'messages' as const, icon: '💬', labelEs: 'Memoria', labelEn: 'Memory', color: 'pink' },
            { key: 'calls' as const, icon: '📞', labelEs: 'Llamadas', labelEn: 'Calls', color: 'rose' },
            { key: 'strategy' as const, icon: '🎯', labelEs: 'Estrategia', labelEn: 'Strategy', color: 'amber' },
          ]).map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setCameraView(btn.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeCameraView === btn.key
                  ? `bg-${btn.color}-500 text-white shadow-md`
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{btn.icon}</span>
              <span>{isEn ? btn.labelEn : btn.labelEs}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowLabels((prev) => !prev)}
          className={`pointer-events-auto rounded-2xl border px-3.5 py-1.5 text-xs font-bold transition-all backdrop-blur-md flex items-center gap-1.5 ${
            showLabels
              ? 'border-cyan-400/40 bg-cyan-950/60 text-cyan-300 shadow-lg'
              : 'border-white/10 bg-[#070b1e]/85 text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">label</span>
          <span>{showLabels ? (isEn ? 'Hide Labels' : 'Ocultar') : (isEn ? 'Show Labels' : 'Etiquetas')}</span>
        </button>
      </div>

      {/* IA WORKING INDICATOR */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-[#070b1e]/80 px-3 py-1.5 backdrop-blur-md" style={{ bottom: '56px' }}>
        <div className="flex gap-0.5 items-end h-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-0.5 bg-cyan-400 rounded-full"
              style={{
                height: '100%',
                animation: `waveform 1.2s ease-in-out ${i * 0.15}s infinite alternate`,
              }}
            />
          ))}
        </div>
        <span className="text-[9px] font-bold text-cyan-300 uppercase tracking-wider">
          {isEn ? 'AI Working' : 'IA trabajando'}
        </span>
      </div>

      {/* FLOATING ANATOMICAL LABELS */}
      {showLabels && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {projectedLabels.map((lbl) => {
            if (!lbl.visible) return null;
            return (
              <div
                key={lbl.key}
                style={{
                  transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0)`,
                  borderColor: lbl.color,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-[#050816]/90 px-3 py-1.5 shadow-2xl backdrop-blur-md transition-transform duration-75 text-left max-w-[210px]"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full animate-pulse"
                    style={{ backgroundColor: lbl.color }}
                  />
                  <p className="text-[10px] font-black uppercase tracking-wider text-white">
                    {lbl.title}
                  </p>
                </div>
                <p className="text-[9px] text-slate-300 line-clamp-2 mt-0.5 leading-tight">
                  {lbl.desc}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* HOVER TOOLTIP */}
      {hoveredNode && (
        <div
          style={{
            left: `${Math.min(hoveredNode.screenX + 16, (containerRef.current?.clientWidth || 800) - 240)}px`,
            top: `${Math.min(hoveredNode.screenY + 16, (containerRef.current?.clientHeight || 600) - 140)}px`,
          }}
          className="pointer-events-none absolute z-30 w-56 rounded-2xl border border-cyan-400/30 bg-[#070b1e]/95 p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: NODE_TYPE_COLORS[hoveredNode.node.type] || '#ffffff' }}
            />
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
              {NODE_TYPE_NAMES[hoveredNode.node.type]?.[isEn ? 'en' : 'es'] || hoveredNode.node.type}
            </span>
          </div>
          <h5 className="text-xs font-bold text-white leading-tight">
            {hoveredNode.node.label}
          </h5>
          <p className="mt-1 text-[11px] text-slate-300 line-clamp-3 leading-relaxed">
            {hoveredNode.node.summary}
          </p>
          <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center text-[9px] text-slate-400">
            <span>{isEn ? 'Click to inspect' : 'Clic para inspeccionar'}</span>
            <span className="text-cyan-400 font-bold">
              {Math.round(hoveredNode.node.confidence * 100)}% {isEn ? 'conf.' : 'confianza'}
            </span>
          </div>
        </div>
      )}

      {/* WAVEFORM ANIMATION CSS */}
      <style>{`
        @keyframes waveform {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1.0); }
        }
      `}</style>
    </div>
  );
}
