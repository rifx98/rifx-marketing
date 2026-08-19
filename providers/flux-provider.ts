/**
 * FLUX Provider — PRODUCT-FIRST COMPOSITING with DEBUG DIAGNOSTICS
 * =================================================================
 *
 * Saves debug images at each step to: public/debug/
 * Accessible via browser at: http://localhost:3000/debug/
 *
 * Debug images:
 *   1. raw_template_debug.png      — original template
 *   2. cleaned_template_debug.png  — template with old text removed
 *   3. product_cutout_debug.png    — uploaded product (cutout)
 *   4. pre_composite_debug.png     — template + REAL product placed via Sharp
 *   5. mask_debug.png              — integration ring mask
 *   6. final_flux_debug.png        — FLUX result after all Sharp restorations
 *
 * MASK ARCHITECTURE — "INTEGRATION RING":
 *   Product interior → BLACK (frozen — FLUX cannot touch)
 *   Edge ring (15%)  → WHITE (FLUX adds shadows/glow/reflections)
 *   Template rest    → BLACK (frozen)
 */

import { createFalClient } from '@fal-ai/client';
import { getAiCredential } from '@/lib/ai-request-context';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

// ─── Debug helper ────────────────────────────────────────────────────────────

function getDebugDir(): string {
  const debugDir = path.join(process.cwd(), 'public', 'debug');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
    console.log(`[DEBUG] Created debug directory: ${debugDir}`);
  }
  return debugDir;
}

function saveDebug(name: string, buffer: Buffer): void {
  if (process.env.NODE_ENV === 'production' || process.env.AI_DEBUG_ARTIFACTS !== 'true') return;
  try {
    const filePath = path.join(getDebugDir(), name);
    fs.writeFileSync(filePath, buffer);
    console.log(`[DEBUG] 💾 Saved: /debug/${name} (${(buffer.length / 1024).toFixed(0)} KB)`);
  } catch (err: any) {
    console.warn(`[DEBUG] ⚠️ Failed to save ${name}: ${err.message}`);
  }
}

function saveDebugFromBase64(name: string, base64: string): void {
  try {
    const data = base64.replace(/^data:image\/[a-z]+;base64,/, '');
    saveDebug(name, Buffer.from(data, 'base64'));
  } catch (err: any) {
    console.warn(`[DEBUG] ⚠️ Failed to save ${name} from base64: ${err.message}`);
  }
}

// ─── Alpha Fix & Background Removal ─────────────────────────────────────────

interface AlphaDiagnostics {
  hasRealAlpha: boolean;
  transparentPct: string;
  borderDarkPct: string;
  borderLightPct: string;
  fixApplied: string;
  pixelsRemoved: number;
}

async function analyzeAndFixAlpha(
  productBuffer: Buffer
): Promise<{ buffer: Buffer; diag: AlphaDiagnostics }> {
  const { data, info } = await sharp(productBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const total = w * h;

  // ── Count alpha distribution ──
  let transparentPx = 0;
  for (let i = 0; i < total; i++) {
    if (data[i * 4 + 3] < 10) transparentPx++;
  }

  const tPct = transparentPx / total;
  const diag: AlphaDiagnostics = {
    hasRealAlpha: tPct > 0.03,
    transparentPct: (tPct * 100).toFixed(1),
    borderDarkPct: '0',
    borderLightPct: '0',
    fixApplied: 'none',
    pixelsRemoved: 0,
  };

  // ── CASE 1: Already has real alpha → just clean dark fringe ──
  if (diag.hasRealAlpha) {
    const cleaned = Buffer.from(data);
    let fringeCount = 0;
    for (let i = 0; i < total; i++) {
      const off = i * 4;
      const a = cleaned[off + 3];
      if (a > 0 && a < 50) {
        const lum = 0.299 * cleaned[off] + 0.587 * cleaned[off + 1] + 0.114 * cleaned[off + 2];
        if (lum < 15) { cleaned[off + 3] = 0; fringeCount++; }
      }
    }
    diag.fixApplied = `edge_cleanup (${fringeCount} dark fringe px)`;
    diag.pixelsRemoved = fringeCount;
    return {
      buffer: await sharp(cleaned, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer(),
      diag,
    };
  }

  // ── No real alpha → analyze border pixels for background detection ──
  let borderDark = 0, borderLight = 0, borderTotal = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x > 1 && x < w - 2 && y > 1 && y < h - 2) continue;
      borderTotal++;
      const off = (y * w + x) * 4;
      const lum = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
      if (lum < 30) borderDark++;
      // IMPROVED: lower threshold from 225 to 200 to catch off-white backgrounds
      else if (lum > 200) borderLight++;
    }
  }

  const dPct = borderDark / borderTotal;
  // IMPROVED: lower minimum from 0.35 to 0.20 to catch partial white borders
  const lPct = borderLight / borderTotal;
  diag.borderDarkPct = (dPct * 100).toFixed(1);
  diag.borderLightPct = (lPct * 100).toFixed(1);

  const isBlackBG = dPct > 0.35;
  const isWhiteBG = !isBlackBG && lPct > 0.20;

  if (!isBlackBG && !isWhiteBG) {
    diag.fixApplied = 'none (no clear bg pattern — manual cutout needed)';
    return { buffer: productBuffer, diag };
  }

  // ── BFS flood-fill from image border to remove background ──
  const bgLabel = isBlackBG ? 'black_matte' : 'white_bg';
  // IMPROVED: white BG threshold lowered from 225 to 200 for off-white
  const THRESH = isBlackBG ? 35 : 200;
  const isBG = (lum: number) => isBlackBG ? lum < THRESH : lum > THRESH;

  const fixed = Buffer.from(data);
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qH = 0, qT = 0;

  // Seed: all border pixels that match background color
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x !== 0 && x !== w - 1 && y !== 0 && y !== h - 1) continue;
      const idx = y * w + x;
      const off = idx * 4;
      const lum = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
      if (isBG(lum)) { visited[idx] = 1; queue[qT++] = idx; }
    }
  }

  // Expand: BFS to all connected background-colored pixels
  let removed = 0;
  while (qH < qT) {
    const idx = queue[qH++];
    fixed[idx * 4 + 3] = 0; // make transparent
    removed++;

    const x = idx % w, y = (idx - x) / w;
    const nb = [
      y > 0     ? idx - w : -1,
      y < h - 1 ? idx + w : -1,
      x > 0     ? idx - 1 : -1,
      x < w - 1 ? idx + 1 : -1,
    ];
    for (const n of nb) {
      if (n < 0 || visited[n]) continue;
      visited[n] = 1;
      const nOff = n * 4;
      const nLum = 0.299 * data[nOff] + 0.587 * data[nOff + 1] + 0.114 * data[nOff + 2];
      if (isBG(nLum)) queue[qT++] = n;
    }
  }

  // Safety: if BFS removed >90% of pixels, the product itself is probably white/light
  if (removed / total > 0.90) {
    diag.fixApplied = `${bgLabel}_bfs ABORTED (removed ${(removed / total * 100).toFixed(1)}% — too aggressive)`;
    return { buffer: productBuffer, diag };
  }

  // Edge feathering: soften the boundary between product and removed area
  const snapshot = Buffer.from(fixed);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (snapshot[idx * 4 + 3] === 0) continue; // already transparent
      let tCount = 0;
      if (snapshot[(idx - w) * 4 + 3] === 0) tCount++;
      if (snapshot[(idx + w) * 4 + 3] === 0) tCount++;
      if (snapshot[(idx - 1) * 4 + 3] === 0) tCount++;
      if (snapshot[(idx + 1) * 4 + 3] === 0) tCount++;
      if (tCount > 0) {
        fixed[idx * 4 + 3] = Math.round(fixed[idx * 4 + 3] * (1 - tCount * 0.2));
      }
    }
  }

  diag.fixApplied = `${bgLabel}_bfs_removal`;
  diag.pixelsRemoved = removed;

  return {
    buffer: await sharp(fixed, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer(),
    diag,
  };
}

// ─── Image helpers ───────────────────────────────────────────────────────────

function truncateBase64(base64: string): string {
  if (!base64) return 'EMPTY/UNDEFINED';
  if (base64.startsWith('data:image'))
    return `data:image/...base64 [${base64.length} chars]`;
  if (base64.startsWith('http'))
    return `URL: ${base64.substring(0, 80)}...`;
  return `unknown [${base64.length} chars]`;
}

async function resolveImageToBuffer(input: string): Promise<Buffer> {
  if (!input) throw new Error('resolveImageToBuffer: input is empty/undefined');
  if (input.startsWith('data:image')) {
    const b64 = input.split(',')[1];
    if (!b64) throw new Error('resolveImageToBuffer: malformed data URI (no comma)');
    return Buffer.from(b64, 'base64');
  }
  if (input.startsWith('http')) {
    const res = await fetch(input);
    if (!res.ok) throw new Error(`resolveImageToBuffer: HTTP ${res.status} for ${input.substring(0, 80)}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error(`resolveImageToBuffer: unrecognized format (starts with "${input.substring(0, 20)}")`);
}

// ─── Sharp-based Mask Generation (replaces buggy custom PNG builder) ─────────
// The old custom PNG builder used raw RGBA data with filter bytes in a format
// that Sharp couldn't correctly decode, resulting in all-white masks.
// Sharp SVG-based approach produces correct grayscale masks.

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Generates an integration ring mask using Sharp + SVG.
 * BLACK = frozen (FLUX cannot touch)
 * WHITE = editable ring around product zone
 */
async function generateIntegrationRingMaskSharp(
  productSlot: { x: number; y: number; width: number; height: number; shape?: string },
  canvasW: number, canvasH: number,
  ringPct: number = 0.15,
): Promise<Buffer> {
  const w = Math.max(1, Math.round(canvasW));
  const h = Math.max(1, Math.round(canvasH));

  // Outer ring rectangle (product slot expanded by ringPct)
  const outerHalfW = productSlot.width  * (1 + ringPct) / 2;
  const outerHalfH = productSlot.height * (1 + ringPct) / 2;
  const outerX = Math.max(0, Math.floor((productSlot.x - outerHalfW) * w));
  const outerY = Math.max(0, Math.floor((productSlot.y - outerHalfH) * h));
  const outerW = Math.min(w - outerX, Math.ceil(outerHalfW * 2 * w));
  const outerH = Math.min(h - outerY, Math.ceil(outerHalfH * 2 * h));

  // Inner rectangle (product interior — stays frozen/black)
  const innerHalfW = productSlot.width  * (1 - ringPct) / 2;
  const innerHalfH = productSlot.height * (1 - ringPct) / 2;
  const innerX = Math.floor((productSlot.x - innerHalfW) * w);
  const innerY = Math.floor((productSlot.y - innerHalfH) * h);
  const innerW = Math.ceil(innerHalfW * 2 * w);
  const innerH = Math.ceil(innerHalfH * 2 * h);

  // SVG: black background, white outer ring, black inner (frozen product interior)
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="black"/>
    <rect x="${outerX}" y="${outerY}" width="${outerW}" height="${outerH}" fill="white"/>
    <rect x="${innerX}" y="${innerY}" width="${innerW}" height="${innerH}" fill="black"/>
  </svg>`;

  return sharp(Buffer.from(svg))
    .grayscale()
    .png()
    .toBuffer();
}

/**
 * Generates a mask with white zones on black background.
 * Uses Sharp + SVG for reliable, correct PNG output.
 */
export async function generateWhiteOnBlackMaskSharp(zones: any[], canvasW: number, canvasH: number): Promise<Buffer> {
  const w = Math.max(1, Math.round(canvasW));
  const h = Math.max(1, Math.round(canvasH));

  let rects = '';
  for (const zone of zones) {
    const slotW = clamp(zone.width + (zone.padding || 0) * 2, 0, 1);
    const slotH = clamp(zone.height + (zone.padding || 0) * 2, 0, 1);
    const halfW = slotW / 2;
    const halfH = slotH / 2;
    const x0 = Math.max(0, Math.round((zone.x - halfW) * w));
    const y0 = Math.max(0, Math.round((zone.y - halfH) * h));
    const rw = Math.min(w - x0, Math.round(slotW * w));
    const rh = Math.min(h - y0, Math.round(slotH * h));
    rects += `<rect x="${x0}" y="${y0}" width="${rw}" height="${rh}" fill="white"/>`;
  }

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="black"/>
    ${rects}
  </svg>`;

  return sharp(Buffer.from(svg))
    .grayscale()
    .png()
    .toBuffer();
}

// Legacy sync exports (kept for mask-generator.ts compatibility)
export function generateWhiteOnBlackMask(zones: any[], canvasW: number, canvasH: number): Buffer {
  // Fallback sync version — generates a simple grayscale PNG using pure raw data
  const w = Math.max(1, Math.round(canvasW));
  const h = Math.max(1, Math.round(canvasH));
  // Use Uint8Array for grayscale (1 channel)
  const pixels = new Uint8Array(w * h);

  for (const zone of zones) {
    const slotW = clamp(zone.width + (zone.padding || 0) * 2, 0, 1);
    const slotH = clamp(zone.height + (zone.padding || 0) * 2, 0, 1);
    const halfW = slotW / 2;
    const halfH = slotH / 2;
    const x0 = Math.max(0, Math.round((zone.x - halfW) * w));
    const y0 = Math.max(0, Math.round((zone.y - halfH) * h));
    const x1 = Math.min(w, x0 + Math.round(slotW * w));
    const y1 = Math.min(h, y0 + Math.round(slotH * h));
    for (let row = y0; row < y1; row++) {
      for (let col = x0; col < x1; col++) {
        pixels[row * w + col] = 255;
      }
    }
  }

  // Return a placeholder — callers should use generateWhiteOnBlackMaskSharp
  return Buffer.from(pixels);
}

// ─── Pure Sharp Compositing (No FLUX / No AI) ────────────────────────────────
//
// This function replicates exactly what ChatGPT does:
// 1. Takes the template image
// 2. Removes product background using BFS
// 3. Scales product to fit product_slot (respecting aspect ratio)
// 4. Places product at the EXACT pixel coordinates from the JSON
// 5. Returns the composited image — no AI, deterministic, fast, cheap
//
export async function compositePureSharp(
  imageSource: string,
  productRefImage: string,
  gptImageSize: string,
  productSlot: { x: number; y: number; width: number; height: number; shape?: string },
  cleanedTemplateBase64?: string,
): Promise<{ base64: string; provider: string }> {

  const [canvasW, canvasH] = (!gptImageSize || gptImageSize === 'auto')
    ? [1024, 1536]
    : gptImageSize.split('x').map(Number);

  const baseTemplateImage = cleanedTemplateBase64 || imageSource;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  PURE SHARP COMPOSITING MODE — No FLUX / No AI`);
  console.log(`  Replicating ChatGPT's deterministic product placement approach`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`  Canvas: ${canvasW}×${canvasH}`);
  console.log(`  product_slot: x=${productSlot.x}, y=${productSlot.y}, w=${productSlot.width}, h=${productSlot.height}`);
  console.log(`${'═'.repeat(70)}\n`);

  const templateBuf = await resolveImageToBuffer(baseTemplateImage);
  let productBuf = await resolveImageToBuffer(productRefImage);

  // ════════════════════════════════════════════════════════════════════
  // [SHARP COMPOSITE DEBUG] — Deep diagnostics
  // ════════════════════════════════════════════════════════════════════
  const templateMeta = await sharp(templateBuf).metadata();
  const productMetaRaw = await sharp(productBuf).metadata();
  console.log(`\n[SHARP COMPOSITE DEBUG] ═══════════════════════════════════════`);
  console.log(`  product_slot:`);
  console.log(`    x (center, normalized):      ${productSlot.x}`);
  console.log(`    y (center, normalized):      ${productSlot.y}`);
  console.log(`    width (normalized):           ${productSlot.width}`);
  console.log(`    height (normalized):          ${productSlot.height}`);
  console.log(`    shape:                        ${productSlot.shape || 'rectangle'}`);
  console.log(`  canvas_width:                   ${canvasW}`);
  console.log(`  canvas_height:                  ${canvasH}`);
  console.log(`  template_original_dimensions:   ${templateMeta.width}×${templateMeta.height}`);
  console.log(`  product_original_dimensions:    ${productMetaRaw.width}×${productMetaRaw.height}`);
  console.log(`  product_original_format:        ${productMetaRaw.format}`);
  console.log(`  product_original_channels:      ${productMetaRaw.channels}`);
  console.log(`  product_original_hasAlpha:      ${productMetaRaw.hasAlpha}`);
  console.log(`  product_buffer_loaded:          true`);
  console.log(`  product_buffer_size:            ${productBuf.length} bytes`);

  // Save debug: raw product
  saveDebug('product_cutout_debug.png', productBuf);

  // Remove product background
  console.log(`[SHARP] Analyzing product alpha channel...`);
  const { buffer: fixedBuf, diag } = await analyzeAndFixAlpha(productBuf);
  productBuf = fixedBuf;
  saveDebug('product_cutout_fixed_debug.png', fixedBuf);
  console.log(`[SHARP] Alpha fix: ${diag.fixApplied} | removed ${diag.pixelsRemoved}px | transparent=${diag.transparentPct}%`);

  // Scale product to fit the slot preserving aspect ratio
  const targetW = Math.round(productSlot.width  * canvasW);
  const targetH = Math.round(productSlot.height * canvasH);

  console.log(`  computed_slot_target_px:        ${targetW}×${targetH}`);

  // Guard: if target dimensions are zero or negative, something is wrong
  if (targetW <= 0 || targetH <= 0) {
    console.error(`[SHARP COMPOSITE DEBUG] ❌ FATAL: computed target dimensions are ${targetW}×${targetH} — cannot resize!`);
    console.error(`  This means product_slot.width (${productSlot.width}) or height (${productSlot.height}) is zero/negative`);
    throw new Error(`Invalid product_slot dimensions: width=${productSlot.width}, height=${productSlot.height} → ${targetW}×${targetH}px`);
  }

  const resized = await sharp(productBuf)
    .resize(targetW, targetH, {
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .toBuffer();

  const meta = await sharp(resized).metadata();
  const rW = meta.width  || targetW;
  const rH = meta.height || targetH;

  // Center-to-top-left conversion:
  // product_slot.x/y are CENTER coordinates (normalized 0-1)
  // Sharp.composite needs TOP-LEFT coordinates (pixels)
  const cx   = productSlot.x * canvasW;          // center X in pixels
  const cy   = productSlot.y * canvasH;          // center Y in pixels
  const left = Math.max(0, Math.round(cx - rW / 2));  // top-left X
  const top  = Math.max(0, Math.round(cy - rH / 2));  // top-left Y

  console.log(`  resized_product_dimensions:     ${rW}×${rH}`);
  console.log(`  resized_product_buffer_size:    ${resized.length} bytes`);
  console.log(`  computed_center_px:             (${cx.toFixed(1)}, ${cy.toFixed(1)})`);
  console.log(`  computed_product_left (top-left): ${left}`);
  console.log(`  computed_product_top (top-left):  ${top}`);
  console.log(`  computed_product_right:          ${left + rW}`);
  console.log(`  computed_product_bottom:         ${top + rH}`);
  console.log(`  product_within_canvas:           ${left >= 0 && top >= 0 && (left + rW) <= canvasW && (top + rH) <= canvasH}`);

  // ═══ RED RECTANGLE DIAGNOSTIC ═══
  // Draw a red rectangle at the computed coordinates to verify position math
  // independent of the product image
  try {
    const redRectSvg = `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${left}" y="${top}" width="${rW}" height="${rH}" fill="none" stroke="red" stroke-width="4"/>
      <line x1="${left}" y1="${top}" x2="${left + rW}" y2="${top + rH}" stroke="red" stroke-width="2"/>
      <line x1="${left + rW}" y1="${top}" x2="${left}" y2="${top + rH}" stroke="red" stroke-width="2"/>
      <circle cx="${Math.round(cx)}" cy="${Math.round(cy)}" r="8" fill="red"/>
      <text x="${left + 5}" y="${top - 8}" fill="red" font-size="16" font-family="monospace">
        slot:(${left},${top}) ${rW}x${rH}
      </text>
    </svg>`;
    const redOverlay = await sharp(Buffer.from(redRectSvg)).png().toBuffer();
    const templateResized = await sharp(templateBuf).resize(canvasW, canvasH).png().toBuffer();
    const redDebugBuf = await sharp(templateResized)
      .composite([{ input: redOverlay, left: 0, top: 0, blend: 'over' }])
      .png()
      .toBuffer();
    saveDebug('slot_position_diagnostic.png', redDebugBuf);
    console.log(`[SHARP COMPOSITE DEBUG] 🟥 Saved slot_position_diagnostic.png — red rectangle shows computed product area`);
  } catch (diagErr: any) {
    console.warn(`[SHARP COMPOSITE DEBUG] ⚠️ Could not save slot diagnostic: ${diagErr.message}`);
  }

  // Composite template + product
  let compositeSuccess = false;
  let finalBuf: Buffer;
  try {
    finalBuf = await sharp(templateBuf)
      .resize(canvasW, canvasH)
      .composite([{ input: resized, left, top, blend: 'over' }])
      .png()
      .toBuffer();
    compositeSuccess = true;
  } catch (compErr: any) {
    console.error(`[SHARP COMPOSITE DEBUG] ❌ composite_operation_success: false — ${compErr.message}`);
    throw compErr;
  }

  console.log(`  composite_operation_success:    ${compositeSuccess}`);
  console.log(`  final_buffer_size:              ${finalBuf.length} bytes`);
  console.log(`[SHARP COMPOSITE DEBUG] ═══════════════════════════════════════\n`);

  saveDebug('pre_composite_debug.png', finalBuf);
  saveDebug('final_flux_debug.png',   finalBuf); // also save as final for consistency

  console.log(`[SHARP] ✅ Product placed at (${left},${top}) — ${rW}×${rH}px`);
  console.log(`[SHARP] ✅ Pure Sharp composite complete — no AI calls made`);

  return {
    base64:   `data:image/png;base64,${finalBuf.toString('base64')}`,
    provider: 'sharp-pure-compositing',
  };
}

// ─── FLUX Provider ───────────────────────────────────────────────────────────

export const fluxProvider = {
  async renderVisual(
    promptText: string,
    imageSource: string,
    productRefImage: string,
    _maskFile: any,
    gptImageSize: string,
    useCompositingMode: boolean,
    extraOptions?: {
      productSlot?: any;
      editableZones?: any[];
      hasTextSlots?: boolean;
      cleanedTemplateBase64?: string;
      visualProvider?: 'openai' | 'flux' | 'sharp';
    }
  ): Promise<{ base64: string; provider: string }> {

    const falKey = getAiCredential('fal');
    if (!falKey) throw new Error('FAL_KEY no configurado en variables de entorno.');
    const falClient = createFalClient({ credentials: falKey });

    const [canvasW, canvasH] = (!gptImageSize || gptImageSize === 'auto')
      ? [1024, 1536]
      : gptImageSize.split('x').map(Number);

    const baseTemplateImage = extraOptions?.cleanedTemplateBase64 || imageSource;

    // ══════════════════════════════════════════════════════════════════════
    // DIAGNOSTIC HEADER
    // ══════════════════════════════════════════════════════════════════════
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  FLUX PRODUCT-FIRST COMPOSITING — DIAGNOSTIC MODE`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`  Canvas: ${canvasW}×${canvasH}`);
    console.log(`  product_slot_detected: ${!!extraOptions?.productSlot}`);
    if (extraOptions?.productSlot) {
      const ps = extraOptions.productSlot;
      console.log(`  product_slot_coordinates: x=${ps.x}, y=${ps.y}, w=${ps.width}, h=${ps.height}, shape=${ps.shape || 'rectangle'}`);
    }
    console.log(`  productRefImage received: ${!!productRefImage}`);
    console.log(`  productRefImage type: ${truncateBase64(productRefImage)}`);
    console.log(`  imageSource (template): ${truncateBase64(imageSource)}`);
    console.log(`  cleanedTemplateBase64: ${!!extraOptions?.cleanedTemplateBase64}`);
    console.log(`  baseTemplateImage: ${truncateBase64(baseTemplateImage)}`);
    console.log(`  useCompositingMode: ${useCompositingMode}`);
    console.log(`${'═'.repeat(70)}\n`);

    // ══════════════════════════════════════════════════════════════════════
    // DEBUG 1: Save raw template
    // ══════════════════════════════════════════════════════════════════════
    try {
      const rawTemplateBuf = await resolveImageToBuffer(imageSource);
      saveDebug('raw_template_debug.png', rawTemplateBuf);
    } catch (e: any) {
      console.warn(`[DEBUG] Could not save raw_template_debug: ${e.message}`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // DEBUG 2: Save cleaned template
    // ══════════════════════════════════════════════════════════════════════
    try {
      const cleanedBuf = await resolveImageToBuffer(baseTemplateImage);
      saveDebug('cleaned_template_debug.png', cleanedBuf);
    } catch (e: any) {
      console.warn(`[DEBUG] Could not save cleaned_template_debug: ${e.message}`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // DEBUG 3: Save product cutout
    // ══════════════════════════════════════════════════════════════════════
    if (productRefImage) {
      try {
        const productBuf = await resolveImageToBuffer(productRefImage);
        saveDebug('product_cutout_debug.png', productBuf);
        const meta = await sharp(productBuf).metadata();
        console.log(`[DEBUG] Product cutout: ${meta.width}×${meta.height}, ${meta.channels} channels, format=${meta.format}, hasAlpha=${meta.hasAlpha}`);
      } catch (e: any) {
        console.warn(`[DEBUG] Could not save product_cutout_debug: ${e.message}`);
      }
    } else {
      console.error(`[DEBUG] ❌ NO PRODUCT IMAGE RECEIVED — productRefImage is empty/undefined!`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // STEP 1 — PRODUCT PRE-COMPOSITE (Sharp)
    // ══════════════════════════════════════════════════════════════════════
    let preCompositeImage: string;
    let productLayerBuffer: Buffer | null = null;
    let productLeft = 0;
    let productTop  = 0;
    let productW    = 0;
    let productH    = 0;
    let productInsertedInPrecomposite = false;

    if (extraOptions?.productSlot && productRefImage) {
      try {
        console.log(`\n[STEP 1] Product pre-composite (Sharp)...`);

        const templateBuf = await resolveImageToBuffer(baseTemplateImage);
        let productBuf  = await resolveImageToBuffer(productRefImage);

        // ════════════════════════════════════════════════════════════════════
        // [SHARP COMPOSITE DEBUG] — STEP 1 Deep diagnostics
        // ════════════════════════════════════════════════════════════════════
        const templateMetaS1 = await sharp(templateBuf).metadata();
        const productMetaRawS1 = await sharp(productBuf).metadata();
        const slot = extraOptions.productSlot;

        console.log(`\n[SHARP COMPOSITE DEBUG — STEP 1] ═══════════════════════════`);
        console.log(`  product_slot:`);
        console.log(`    x (center, normalized):      ${slot.x}`);
        console.log(`    y (center, normalized):      ${slot.y}`);
        console.log(`    width (normalized):           ${slot.width}`);
        console.log(`    height (normalized):          ${slot.height}`);
        console.log(`    shape:                        ${slot.shape || 'rectangle'}`);
        console.log(`  canvas_width:                   ${canvasW}`);
        console.log(`  canvas_height:                  ${canvasH}`);
        console.log(`  template_original_dimensions:   ${templateMetaS1.width}×${templateMetaS1.height}`);
        console.log(`  product_original_dimensions:    ${productMetaRawS1.width}×${productMetaRawS1.height}`);
        console.log(`  product_original_format:        ${productMetaRawS1.format}`);
        console.log(`  product_original_channels:      ${productMetaRawS1.channels}`);
        console.log(`  product_original_hasAlpha:      ${productMetaRawS1.hasAlpha}`);
        console.log(`  product_buffer_loaded:          true`);
        console.log(`  product_buffer_size:            ${productBuf.length} bytes`);

        // ── Alpha analysis and automatic background removal ──
        console.log(`[STEP 1] 🔍 Analyzing product alpha channel...`);
        const { buffer: fixedProductBuf, diag: alphaDiag } = await analyzeAndFixAlpha(productBuf);
        productBuf = fixedProductBuf;
        console.log(`[STEP 1] Alpha diagnosis:`);
        console.log(`    has_real_alpha:   ${alphaDiag.hasRealAlpha}`);
        console.log(`    transparent_pct:  ${alphaDiag.transparentPct}%`);
        console.log(`    border_dark_pct:  ${alphaDiag.borderDarkPct}%`);
        console.log(`    border_light_pct: ${alphaDiag.borderLightPct}%`);
        console.log(`    fix_applied:      ${alphaDiag.fixApplied}`);
        console.log(`    pixels_removed:   ${alphaDiag.pixelsRemoved}`);
        saveDebug('product_cutout_fixed_debug.png', fixedProductBuf);

        // Check if alpha fix made the product entirely transparent
        const fixedMeta = await sharp(fixedProductBuf).metadata();
        const { data: fixedRaw, info: fixedInfo } = await sharp(fixedProductBuf)
          .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let opaquePixels = 0;
        const totalPixels = fixedInfo.width * fixedInfo.height;
        for (let i = 0; i < totalPixels; i++) {
          if (fixedRaw[i * 4 + 3] > 10) opaquePixels++;
        }
        const opaquePct = (opaquePixels / totalPixels * 100).toFixed(1);
        console.log(`  post_alpha_fix_opaque_pixels:   ${opaquePixels}/${totalPixels} (${opaquePct}%)`);
        if (opaquePixels === 0) {
          console.error(`[SHARP COMPOSITE DEBUG] ❌ FATAL: Product is 100% transparent after alpha fix!`);
          console.error(`  Alpha fix may have removed the entire product. Check product_cutout_fixed_debug.png`);
        }

        const targetW = Math.round(slot.width  * canvasW);
        const targetH = Math.round(slot.height * canvasH);

        console.log(`  computed_slot_target_px:        ${targetW}×${targetH}`);

        // Guard: if target dimensions are zero or negative
        if (targetW <= 0 || targetH <= 0) {
          console.error(`[SHARP COMPOSITE DEBUG] ❌ FATAL: computed target dimensions are ${targetW}×${targetH} — cannot resize!`);
          throw new Error(`Invalid product_slot dimensions: width=${slot.width}, height=${slot.height} → ${targetW}×${targetH}px`);
        }

        console.log(`[STEP 1] Slot target area: ${targetW}×${targetH}px`);

        // Resize product preserving aspect ratio
        const resized = await sharp(productBuf)
          .resize(targetW, targetH, {
            fit: 'inside',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .ensureAlpha()
          .toBuffer();

        const meta = await sharp(resized).metadata();
        productW = meta.width  || targetW;
        productH = meta.height || targetH;

        // Center-to-top-left conversion:
        // slot.x/y are CENTER coordinates (normalized 0-1)
        // Sharp.composite needs TOP-LEFT coordinates (pixels)
        const cx = slot.x * canvasW;                             // center X in pixels
        const cy = slot.y * canvasH;                             // center Y in pixels
        productLeft = Math.max(0, Math.round(cx - productW / 2)); // top-left X
        productTop  = Math.max(0, Math.round(cy - productH / 2)); // top-left Y

        console.log(`  resized_product_dimensions:     ${productW}×${productH}`);
        console.log(`  resized_product_buffer_size:    ${resized.length} bytes`);
        console.log(`  computed_center_px:             (${cx.toFixed(1)}, ${cy.toFixed(1)})`);
        console.log(`  computed_product_left (top-left): ${productLeft}`);
        console.log(`  computed_product_top (top-left):  ${productTop}`);
        console.log(`  computed_product_right:          ${productLeft + productW}`);
        console.log(`  computed_product_bottom:         ${productTop + productH}`);
        console.log(`  product_within_canvas:           ${productLeft >= 0 && productTop >= 0 && (productLeft + productW) <= canvasW && (productTop + productH) <= canvasH}`);

        productLayerBuffer = resized;

        // ═══ RED RECTANGLE DIAGNOSTIC ═══
        try {
          const redRectSvg = `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
            <rect x="${productLeft}" y="${productTop}" width="${productW}" height="${productH}" fill="rgba(255,0,0,0.3)" stroke="red" stroke-width="4"/>
            <line x1="${productLeft}" y1="${productTop}" x2="${productLeft + productW}" y2="${productTop + productH}" stroke="red" stroke-width="2"/>
            <line x1="${productLeft + productW}" y1="${productTop}" x2="${productLeft}" y2="${productTop + productH}" stroke="red" stroke-width="2"/>
            <circle cx="${Math.round(cx)}" cy="${Math.round(cy)}" r="8" fill="red"/>
            <text x="${productLeft + 5}" y="${productTop - 8}" fill="red" font-size="16" font-family="monospace">
              slot:(${productLeft},${productTop}) ${productW}x${productH}
            </text>
          </svg>`;
          const redOverlay = await sharp(Buffer.from(redRectSvg)).png().toBuffer();
          const templateResized = await sharp(templateBuf).resize(canvasW, canvasH).png().toBuffer();
          const redDebugBuf = await sharp(templateResized)
            .composite([{ input: redOverlay, left: 0, top: 0, blend: 'over' }])
            .png()
            .toBuffer();
          saveDebug('slot_position_diagnostic.png', redDebugBuf);
          console.log(`[SHARP COMPOSITE DEBUG] 🟥 Saved slot_position_diagnostic.png — red rectangle shows computed product area`);
        } catch (diagErr: any) {
          console.warn(`[SHARP COMPOSITE DEBUG] ⚠️ Could not save slot diagnostic: ${diagErr.message}`);
        }

        // Composite: resized template + product
        let compositeSuccess = false;
        const compositedBuf = await sharp(templateBuf)
          .resize(canvasW, canvasH)
          .composite([{ input: resized, left: productLeft, top: productTop, blend: 'over' }])
          .png()
          .toBuffer();
        compositeSuccess = true;

        console.log(`  composite_operation_success:    ${compositeSuccess}`);
        console.log(`  composited_buffer_size:         ${compositedBuf.length} bytes`);
        console.log(`[SHARP COMPOSITE DEBUG — STEP 1] ═══════════════════════════\n`);

        preCompositeImage = `data:image/png;base64,${compositedBuf.toString('base64')}`;
        productInsertedInPrecomposite = true;

        // DEBUG 4: Save pre-composite
        saveDebug('pre_composite_debug.png', compositedBuf);

        console.log(`[STEP 1] ✅ Product composited at (${productLeft}, ${productTop}) — ${productW}×${productH}px`);
        console.log(`[STEP 1]    product_inserted_in_precomposite: true`);
        console.log(`[STEP 1]    Slot center: (${cx.toFixed(0)}, ${cy.toFixed(0)})`);

      } catch (err: any) {
        console.error(`[STEP 1] ❌ Pre-composite FAILED: ${err.message}`);
        console.error(`[STEP 1]    Stack: ${err.stack}`);
        console.error(`[STEP 1]    product_inserted_in_precomposite: false`);
        console.error(`[STEP 1]    FLUX will see the TEMPLATE product, not the uploaded product!`);
        preCompositeImage = baseTemplateImage;
      }
    } else {
      console.warn(`[STEP 1] ⚠️ SKIPPED — missing productSlot (${!!extraOptions?.productSlot}) or productRefImage (${!!productRefImage})`);
      if (!extraOptions?.productSlot) {
        console.warn(`[STEP 1]    productSlot is: ${JSON.stringify(extraOptions?.productSlot)}`);
      }
      if (!productRefImage) {
        console.warn(`[STEP 1]    productRefImage is: ${productRefImage ? 'present (' + productRefImage.length + ' chars)' : 'EMPTY/UNDEFINED'}`);
      }
      preCompositeImage = baseTemplateImage;
    }

    // ══════════════════════════════════════════════════════════════════════
    // GATE: If product was not inserted, try pure Sharp compositing fallback
    // instead of throwing an error or sending the template to FLUX without product.
    // ══════════════════════════════════════════════════════════════════════
    if (extraOptions?.productSlot && productRefImage && !productInsertedInPrecomposite) {
      console.error(`\n${'❌'.repeat(35)}`);
      console.error(`  WARNING: pre-compositing failed — product was NOT inserted.`);
      console.error(`  FALLBACK: Attempting pure Sharp compositing without FLUX...`);
      console.error(`${'❌'.repeat(35)}\n`);

      // Try a simpler compositing: overlay product on template without alpha removal
      try {
        const templateBuf = await resolveImageToBuffer(baseTemplateImage);
        const productBuf  = await resolveImageToBuffer(productRefImage);
        const slot = extraOptions.productSlot;
        const targetW = Math.round(slot.width  * canvasW);
        const targetH = Math.round(slot.height * canvasH);

        // Resize product to fit slot, preserving aspect ratio
        const resized = await sharp(productBuf)
          .resize(targetW, targetH, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .ensureAlpha()
          .toBuffer();

        const meta = await sharp(resized).metadata();
        const rW = meta.width  || targetW;
        const rH = meta.height || targetH;
        const cx = slot.x * canvasW;
        const cy = slot.y * canvasH;
        const left = Math.max(0, Math.round(cx - rW / 2));
        const top  = Math.max(0, Math.round(cy - rH / 2));

        const finalBuf = await sharp(templateBuf)
          .resize(canvasW, canvasH)
          .composite([{ input: resized, left, top, blend: 'over' }])
          .png()
          .toBuffer();

        saveDebug('fallback_sharp_composite.png', finalBuf);
        console.log(`[GATE FALLBACK] ✅ Pure Sharp composite at (${left},${top}) — ${rW}×${rH}px`);

        return {
          base64:   `data:image/png;base64,${finalBuf.toString('base64')}`,
          provider: 'sharp-compositing-fallback',
        };
      } catch (fallbackErr: any) {
        console.error(`[GATE FALLBACK] ❌ Sharp fallback also failed: ${fallbackErr.message}`);
        // Last resort: return the template without the product
        const templateBuf = await resolveImageToBuffer(baseTemplateImage);
        const pngBuf = await sharp(templateBuf).resize(canvasW, canvasH).png().toBuffer();
        return {
          base64:   `data:image/png;base64,${pngBuf.toString('base64')}`,
          provider: 'template-only-fallback',
        };
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // STEP 2 — INTEGRATION RING MASK (Sharp/SVG-based — correct PNG output)
    // ══════════════════════════════════════════════════════════════════════
    let maskBase64: string;

    if (extraOptions?.productSlot) {
      console.log(`\n[STEP 2] Generating integration ring mask (Sharp/SVG)...`);

      // Use Sharp-based mask generation (replaces buggy raw PNG builder)
      const ringMaskBuf = await generateIntegrationRingMaskSharp(
        extraOptions.productSlot, canvasW, canvasH, 0.15
      );
      maskBase64 = `data:image/png;base64,${ringMaskBuf.toString('base64')}`;

      // DEBUG 5: Save mask
      saveDebug('mask_debug.png', ringMaskBuf);

      // Calculate area percentages
      const outerArea = extraOptions.productSlot.width * 1.15 * extraOptions.productSlot.height * 1.15;
      const innerArea = extraOptions.productSlot.width * 0.85 * extraOptions.productSlot.height * 0.85;
      const ringArea  = outerArea - innerArea;
      console.log(`[STEP 2] ✅ mask_area_percentage (editable ring): ${(ringArea * 100).toFixed(1)}%`);
      console.log(`[STEP 2]    Product interior (FROZEN): ${(innerArea * 100).toFixed(1)}%`);
      console.log(`[STEP 2]    Template background (FROZEN): ${((1 - outerArea) * 100).toFixed(1)}%`);
    } else {
      console.log(`[STEP 2] No productSlot — using minimal center mask (fallback)`);
      // Use a small center ring instead of full canvas to preserve template
      const centerSlot = { x: 0.5, y: 0.5, width: 0.5, height: 0.5 };
      const buf = await generateIntegrationRingMaskSharp(centerSlot, canvasW, canvasH, 0.2);
      maskBase64 = `data:image/png;base64,${buf.toString('base64')}`;
      saveDebug('mask_debug.png', buf);
    }

    // ══════════════════════════════════════════════════════════════════════
    // STEP 3 — FLUX INPAINTING (lighting integration only)
    // ══════════════════════════════════════════════════════════════════════
    // REDUCED strength from 0.68 to 0.30 — preserves more of original template.
    // At 0.68, FLUX was fully re-rendering the scene. At 0.30, it only adds
    // soft lighting/shadow integration in the ring without destroying the template.
    const fluxStrength = 0.30;
    const fluxSteps    = 28;
    const fluxGuidance = 7.5;
    const fluxModel    = 'fal-ai/flux-general/inpainting';

    console.log(`\n[STEP 3] FLUX inpainting`);
    console.log(`  flux_model: ${fluxModel}`);
    console.log(`  flux_strength: ${fluxStrength}`);
    console.log(`  flux_steps: ${fluxSteps}`);
    console.log(`  flux_guidance: ${fluxGuidance}`);
    console.log(`  pre_composite_used_as_flux_input: ${productInsertedInPrecomposite}`);
    console.log(`  raw_template_used_as_flux_input: ${!productInsertedInPrecomposite}`);
    console.log(`  prompt: "${promptText.substring(0, 120)}..."`);

    const t0 = Date.now();
    let fluxResult: any;

    try {
      fluxResult = await falClient.subscribe(fluxModel, {
        input: {
          prompt: promptText,
          image_url: preCompositeImage,
          mask_url:  maskBase64,
          strength:             fluxStrength,
          num_inference_steps:  fluxSteps,
          guidance_scale:       fluxGuidance,
          image_size: { width: canvasW, height: canvasH } as any,
        },
        logs: true,
      }) as any;

      console.log(`[STEP 3] ✅ FLUX completed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (err: any) {
      console.error(`[STEP 3] ❌ FLUX failed: ${err.message}`);
      throw err;
    }

    const imageUrl = fluxResult?.data?.images?.[0]?.url
      || fluxResult?.images?.[0]?.url
      || fluxResult?.image?.url
      || fluxResult?.data?.image?.url;

    if (!imageUrl) throw new Error('FLUX returned no image.');

    const dlRes = await fetch(imageUrl);
    if (!dlRes.ok) throw new Error(`CDN download failed: ${dlRes.status}`);
    const fluxRenderBuffer = Buffer.from(await dlRes.arrayBuffer());

    // ══════════════════════════════════════════════════════════════════════
    // STEP 4 — FROZEN ZONE RESTORATION (Sharp per-pixel blend)
    // ══════════════════════════════════════════════════════════════════════
    let composedBuffer: Buffer;

    try {
      console.log(`\n[STEP 4] Frozen zone restoration...`);

      const maskPngBuf = Buffer.from(maskBase64.split(',')[1], 'base64');
      const preCompBuf = Buffer.from(preCompositeImage.split(',')[1], 'base64');

      const [preCompRaw, fluxRaw, maskRaw] = await Promise.all([
        sharp(preCompBuf)       .resize(canvasW, canvasH).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
        sharp(fluxRenderBuffer) .resize(canvasW, canvasH).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
        sharp(maskPngBuf)       .resize(canvasW, canvasH).grayscale().raw().toBuffer({ resolveWithObject: true }),
      ]);

      const totalPx = canvasW * canvasH;
      const origPx  = preCompRaw.data;
      const fluxPx  = fluxRaw.data;
      const maskPx  = maskRaw.data;
      const outPx   = Buffer.alloc(totalPx * 4);

      for (let i = 0; i < totalPx; i++) {
        const m = maskPx[i] / 255;
        const b = i * 4;
        outPx[b]     = Math.round(origPx[b]     * (1 - m) + fluxPx[b]     * m);
        outPx[b + 1] = Math.round(origPx[b + 1] * (1 - m) + fluxPx[b + 1] * m);
        outPx[b + 2] = Math.round(origPx[b + 2] * (1 - m) + fluxPx[b + 2] * m);
        outPx[b + 3] = 255;
      }

      composedBuffer = await sharp(outPx, {
        raw: { width: canvasW, height: canvasH, channels: 4 },
      }).png().toBuffer();

      console.log(`[STEP 4] ✅ Frozen zones restored`);
    } catch (err: any) {
      console.warn(`[STEP 4] ⚠️ Failed: ${err.message} — using raw FLUX`);
      composedBuffer = fluxRenderBuffer;
    }

    // ══════════════════════════════════════════════════════════════════════
    // STEP 5 — PRODUCT IDENTITY RESTORATION (Sharp re-composite)
    // ══════════════════════════════════════════════════════════════════════
    if (productLayerBuffer) {
      try {
        console.log(`\n[STEP 5] Product identity restoration...`);

        composedBuffer = await sharp(composedBuffer)
          .composite([{
            input: productLayerBuffer,
            left:  productLeft,
            top:   productTop,
            blend: 'over',
          }])
          .png()
          .toBuffer();

        console.log(`[STEP 5] ✅ Product restored — ${productW}×${productH}px at (${productLeft}, ${productTop})`);
      } catch (err: any) {
        console.warn(`[STEP 5] ⚠️ Re-composite failed: ${err.message}`);
      }
    } else {
      console.log(`[STEP 5] No product layer — skipping`);
    }

    // DEBUG 6: Save final result
    saveDebug('final_flux_debug.png', composedBuffer);

    const finalBase64 = `data:image/png;base64,${composedBuffer.toString('base64')}`;

    // ══════════════════════════════════════════════════════════════════════
    // DIAGNOSTIC SUMMARY
    // ══════════════════════════════════════════════════════════════════════
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  FLUX PIPELINE DIAGNOSTIC SUMMARY`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`  product_slot_detected:            ${!!extraOptions?.productSlot}`);
    if (extraOptions?.productSlot) {
      const ps = extraOptions.productSlot;
      console.log(`  product_slot_coordinates:          x=${ps.x}, y=${ps.y}, w=${ps.width}, h=${ps.height}`);
    }
    console.log(`  product_inserted_in_precomposite:  ${productInsertedInPrecomposite}`);
    console.log(`  pre_composite_used_as_flux_input:  ${productInsertedInPrecomposite}`);
    console.log(`  raw_template_used_as_flux_input:   ${!productInsertedInPrecomposite}`);
    console.log(`  flux_strength:                     ${fluxStrength}`);
    console.log(`  flux_model:                        ${fluxModel}`);
    console.log(`  mask_type:                         integration_ring (15%)`);
    console.log(`  product_identity_restored_step5:   ${!!productLayerBuffer}`);
    console.log(`  `);
    console.log(`  Debug images saved to: /debug/`);
    console.log(`    1. raw_template_debug.png`);
    console.log(`    2. cleaned_template_debug.png`);
    console.log(`    3. product_cutout_debug.png      ← ORIGINAL (may have black matte)`);
    console.log(`    3b. product_cutout_fixed_debug.png ← ALPHA-FIXED (background removed)`);
    console.log(`    4. pre_composite_debug.png       ← VERIFY THIS CONTAINS YOUR PRODUCT`);
    console.log(`    5. mask_debug.png`);
    console.log(`    6. final_flux_debug.png`);
    console.log(`${'═'.repeat(70)}\n`);

    return {
      base64:   finalBase64,
      provider: fluxModel,
    };
  },
};
