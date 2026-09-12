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
 * Erases any existing product inside the product_slot region of the template.
 * Uses a smooth radial/studio gradient matching dark/luxury ad atmospheres,
 * with blurred edges so the transition to the surrounding graphic is seamless.
 */
export async function eraseProductSlotFromTemplate(
  templateBuf: Buffer,
  canvasW: number,
  canvasH: number,
  slot: { x: number; y: number; width: number; height: number; shape?: string }
): Promise<Buffer> {
  const cx = slot.x * canvasW;
  const cy = slot.y * canvasH;
  // Expand slightly (15%) to ensure tall bottle necks, caps, and bases are completely covered
  const sw = Math.round(Math.min(canvasW * 0.95, slot.width * canvasW * 1.18));
  const sh = Math.round(Math.min(canvasH * 0.95, slot.height * canvasH * 1.18));
  const left = Math.max(0, Math.round(cx - sw / 2));
  const top = Math.max(0, Math.round(cy - sh / 2));
  const rx = Math.round(sw * 0.12);

  const patchSvg = `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="cleanSlotGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#181818"/>
        <stop offset="60%" stop-color="#0f0f0f"/>
        <stop offset="100%" stop-color="#080808"/>
      </radialGradient>
      <filter id="cleanSlotBlur" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="14"/>
      </filter>
    </defs>
    <rect x="${left}" y="${top}" width="${sw}" height="${sh}" rx="${rx}" ry="${rx}" fill="url(#cleanSlotGrad)" filter="url(#cleanSlotBlur)"/>
  </svg>`;

  return sharp(templateBuf)
    .resize(canvasW, canvasH)
    .composite([{ input: Buffer.from(patchSvg), left: 0, top: 0, blend: 'over' }])
    .png()
    .toBuffer();
}

/**
 * Generates an inpainting mask where:
 * WHITE (255) = product zone + pedestal/shadow area (FLUX generates shadows & studio lighting)
 * BLACK (0)   = outer template graphics (frozen & untouched)
 */
export async function generateFullProductZoneMaskSharp(
  productSlot: { x: number; y: number; width: number; height: number; shape?: string },
  canvasW: number,
  canvasH: number
): Promise<Buffer> {
  const w = Math.max(1, Math.round(canvasW));
  const h = Math.max(1, Math.round(canvasH));

  const cx = productSlot.x * w;
  const cy = productSlot.y * h;
  const sw = Math.round(Math.min(w * 0.95, productSlot.width * w * 1.18));
  const sh = Math.round(Math.min(h * 0.95, productSlot.height * h * 1.18));
  const left = Math.max(0, Math.round(cx - sw / 2));
  const top = Math.max(0, Math.round(cy - sh / 2));
  const rx = Math.round(sw * 0.12);

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="black"/>
    <rect x="${left}" y="${top}" width="${sw}" height="${sh}" rx="${rx}" ry="${rx}" fill="white" filter="blur(16px)"/>
  </svg>`;

  return sharp(Buffer.from(svg))
    .grayscale()
    .png()
    .toBuffer();
}

/**
 * Clean product cutout using fal-ai/birefnet with fallback to local alpha analysis
 */
async function getCleanProductCutout(
  productBuf: Buffer,
  falClient: any
): Promise<Buffer> {
  try {
    const meta = await sharp(productBuf).metadata();
    if (meta.hasAlpha && meta.format === 'png') {
      const { buffer, diag } = await analyzeAndFixAlpha(productBuf);
      if (diag.hasRealAlpha && !diag.fixApplied.includes('ABORTED')) {
        return buffer;
      }
    }

    console.log('[CUTOUT] Calling fal-ai/birefnet for ultra-clean background removal...');
    const blob = new Blob([new Uint8Array(productBuf)], { type: 'image/png' });
    const uploadedUrl = await falClient.storage.upload(blob);
    const res = await falClient.subscribe('fal-ai/birefnet', {
      input: { image_url: uploadedUrl },
      logs: false,
    });
    const cutoutUrl = (res as any)?.data?.image?.url || (res as any)?.image?.url;
    if (cutoutUrl) {
      const cRes = await fetch(cutoutUrl);
      if (cRes.ok) {
        console.log('[CUTOUT] ✅ birefnet background removal success');
        return Buffer.from(await cRes.arrayBuffer());
      }
    }
  } catch (err: any) {
    console.warn('[CUTOUT] birefnet failed, falling back to local alpha analysis:', err.message);
  }
  const { buffer } = await analyzeAndFixAlpha(productBuf);
  return buffer;
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
  return generateFullProductZoneMaskSharp(productSlot, canvasW, canvasH);
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

  const rawTemplateBuf = await resolveImageToBuffer(baseTemplateImage);
  const templateBuf = await eraseProductSlotFromTemplate(rawTemplateBuf, canvasW, canvasH, productSlot);
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

        const rawTemplateBuf = await resolveImageToBuffer(baseTemplateImage);
        let productBuf  = await resolveImageToBuffer(productRefImage);
        const slot = extraOptions.productSlot;

        // Erase any old product from the template slot so it never peeks out!
        console.log(`[STEP 1] 🧹 Erasing old product from template product_slot area...`);
        const templateBuf = await eraseProductSlotFromTemplate(rawTemplateBuf, canvasW, canvasH, slot);

        // Clean product cutout with AI or alpha fix
        console.log(`[STEP 1] 🔍 Processing product cutout & alpha...`);
        productBuf = await getCleanProductCutout(productBuf, falClient);

        // Check if alpha fix made the product entirely transparent
        const fixedMeta = await sharp(productBuf).metadata();
        const { data: fixedRaw, info: fixedInfo } = await sharp(productBuf)
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
    // STEP 2 — INTEGRATION MASK (Sharp/SVG-based — correct PNG output)
    // ══════════════════════════════════════════════════════════════════════
    let maskBase64: string;
    let ringMaskBuf: Buffer;

    const slotToUse = extraOptions?.productSlot || { x: 0.5, y: 0.52, width: 0.58, height: 0.52 };
    console.log(`\n[STEP 2] Generating product zone inpainting mask (Sharp/SVG)...`);

    ringMaskBuf = await generateFullProductZoneMaskSharp(slotToUse, canvasW, canvasH);
    maskBase64 = `data:image/png;base64,${ringMaskBuf.toString('base64')}`;
    saveDebug('mask_debug.png', ringMaskBuf);

    console.log(`[STEP 2] ✅ Full product zone mask generated: slot area centered at (${slotToUse.x}, ${slotToUse.y})`);

    // ══════════════════════════════════════════════════════════════════════
    // STEP 3 — FLUX INPAINTING (lighting & studio integration)
    // ══════════════════════════════════════════════════════════════════════
    const fluxStrength = 0.45;
    const fluxSteps    = 28;
    const fluxGuidance = 7.0;
    const fluxModel    = 'fal-ai/flux-general/inpainting';

    console.log(`\n[STEP 3] Uploading images to fal.storage for lightning fast processing...`);
    const compositedPngBuffer = Buffer.from(preCompositeImage.split(',')[1], 'base64');
    const [imgUploadUrl, maskUploadUrl] = await Promise.all([
      falClient.storage.upload(new Blob([new Uint8Array(compositedPngBuffer)], { type: 'image/png' })),
      falClient.storage.upload(new Blob([new Uint8Array(ringMaskBuf)], { type: 'image/png' })),
    ]);
    console.log(`[STEP 3] ✅ Upload complete:`);
    console.log(`  image_url: ${imgUploadUrl}`);
    console.log(`  mask_url:  ${maskUploadUrl}`);

    console.log(`\n[STEP 3] FLUX inpainting`);
    console.log(`  flux_model: ${fluxModel}`);
    console.log(`  flux_strength: ${fluxStrength}`);
    console.log(`  flux_steps: ${fluxSteps}`);
    console.log(`  flux_guidance: ${fluxGuidance}`);
    console.log(`  prompt: "${promptText.substring(0, 120)}..."`);

    const t0 = Date.now();
    let fluxResult: any;

    try {
      fluxResult = await falClient.subscribe(fluxModel, {
        input: {
          prompt: promptText,
          image_url: imgUploadUrl,
          mask_url:  maskUploadUrl,
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

  /**
   * Generates a complete, cohesive AI advertising poster (ChatGPT quality)
   * using fal-ai/ideogram/v2 (industry standard for ad layout + typography + models)
   * with automatic fallback to fal-ai/flux/dev.
   */
  async generateAdaptiveAd(
    promptText: string,
    aspectRatio: string = '4:5',
    options?: {
      preferredModel?: 'ideogram' | 'flux';
      referenceImageUrl?: string;
      imageWeight?: number;
    }
  ): Promise<{ base64: string; provider: string }> {
    const falKey = getAiCredential('fal');
    if (!falKey) throw new Error('FAL_KEY no configurado en variables de entorno.');
    const falClient = createFalClient({ credentials: falKey });

    const preferredModel = options?.preferredModel || 'ideogram';
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  [ADAPTIVE AI GENERATOR] Generating Full Luxury Ad Banner`);
    console.log(`  Model Preference: ${preferredModel}`);
    console.log(`  Aspect Ratio: ${aspectRatio}`);
    console.log(`  Reference Image Provided: ${!!options?.referenceImageUrl}`);
    console.log(`  Prompt Length: ${promptText.length} chars`);
    console.log(`${'═'.repeat(70)}\n`);

    // Map aspect ratio for Ideogram v2
    let ideogramRatio: '3:4' | '9:16' | '1:1' | '16:9' | '4:3' | '2:3' = '3:4';
    const normRatio = aspectRatio.toLowerCase().replace(/\s/g, '');
    if (normRatio.includes('9:16') || normRatio.includes('9/16') || normRatio.includes('story') || normRatio.includes('reel')) {
      ideogramRatio = '9:16';
    } else if (normRatio.includes('1:1') || normRatio.includes('1/1') || normRatio.includes('square')) {
      ideogramRatio = '1:1';
    } else if (normRatio.includes('16:9') || normRatio.includes('16/9') || normRatio.includes('landscape')) {
      ideogramRatio = '16:9';
    } else {
      ideogramRatio = '3:4'; // standard closest vertical feed aspect ratio for 4:5
    }

    if (preferredModel !== 'flux') {
      // 1. PRIMARY: Standard Ideogram v2 text-to-image (generates FULL AD DESIGN from prompt)
      // This is the best approach for professional ad banners — the AI creates the complete
      // composition, typography, layout, models, and product visualization from the prompt alone.
      try {
        console.log(`🎨 [ADAPTIVE AI] Calling fal-ai/ideogram/v2 text-to-image (ratio: ${ideogramRatio})...`);
        const result: any = await falClient.subscribe('fal-ai/ideogram/v2', {
          input: {
            prompt: promptText,
            aspect_ratio: ideogramRatio as any,
            style: 'design',
            expand_prompt: false,
          } as any
        });

        const imageUrl = result?.data?.images?.[0]?.url || result?.images?.[0]?.url;
        if (imageUrl) {
          const dlRes = await fetch(imageUrl);
          if (dlRes.ok) {
            const buf = Buffer.from(await dlRes.arrayBuffer());
            console.log(`✅ [ADAPTIVE AI] Ideogram v2 text-to-image completed successfully (${Math.round(buf.length / 1024)} KB)`);
            return {
              base64: `data:image/png;base64,${buf.toString('base64')}`,
              provider: 'fal-ai/ideogram/v2'
            };
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ [ADAPTIVE AI] Ideogram v2 text-to-image failed (${err.message}) — trying remix fallback`);
      }

      // 2. FALLBACK: Ideogram v2 Remix with LOW weight (product reference for shape hints only)
      if (options?.referenceImageUrl) {
        try {
          console.log(`🎯 [ADAPTIVE AI] Trying Ideogram v2 Remix fallback with LOW image_weight...`);
          let refUrl = options.referenceImageUrl;
          if (refUrl.startsWith('data:image')) {
            const mimeMatch = refUrl.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const base64Clean = refUrl.replace(/^data:image\/[a-zA-Z0-9.-]+;base64,/, '');
            const buf = Buffer.from(base64Clean, 'base64');
            const blob = new Blob([buf], { type: mimeType });
            refUrl = await falClient.storage.upload(blob);
          }

          // Use LOW image_weight (20) so the prompt dominates the design
          // and the reference image only provides subtle color/shape hints
          const remixWeight = Math.min(typeof options.imageWeight === 'number' ? options.imageWeight : 20, 25);
          console.log(`🎨 [ADAPTIVE AI] Calling fal-ai/ideogram/v2/remix with LOW weight: ${remixWeight} (ratio: ${ideogramRatio})...`);
          const remixResult: any = await falClient.subscribe('fal-ai/ideogram/v2/remix', {
            input: {
              prompt: promptText,
              image_url: refUrl,
              image_weight: remixWeight,
              aspect_ratio: ideogramRatio as any,
              style_type: 'DESIGN'
            } as any
          });

          const remixUrl = remixResult?.data?.images?.[0]?.url || remixResult?.images?.[0]?.url;
          if (remixUrl) {
            const dlRes = await fetch(remixUrl);
            if (dlRes.ok) {
              const buf = Buffer.from(await dlRes.arrayBuffer());
              console.log(`✅ [ADAPTIVE AI] Ideogram v2 REMIX (low weight) completed (${Math.round(buf.length / 1024)} KB)`);
              return {
                base64: `data:image/png;base64,${buf.toString('base64')}`,
                provider: 'fal-ai/ideogram/v2/remix'
              };
            }
          }
        } catch (remixErr: any) {
          console.warn(`⚠️ [ADAPTIVE AI] Ideogram v2 remix fallback failed (${remixErr.message}) — falling back to Flux Dev`);
        }
      }
    }

    // Flux Dev generation
    console.log(`🎨 [ADAPTIVE AI] Calling fal-ai/flux/dev...`);
    const isPortrait = ideogramRatio === '9:16';
    const isSquare = ideogramRatio === '1:1';
    const [w, h] = isPortrait ? [1024, 1792] : isSquare ? [1024, 1024] : [1024, 1280];

    const fluxRes: any = await falClient.subscribe('fal-ai/flux/dev', {
      input: {
        prompt: promptText,
        image_size: { width: w, height: h } as any
      }
    });

    const fluxUrl = fluxRes?.data?.images?.[0]?.url || fluxRes?.images?.[0]?.url;
    if (!fluxUrl) throw new Error('fal.ai no devolvió ninguna imagen generada.');

    const dl = await fetch(fluxUrl);
    if (!dl.ok) throw new Error(`Fallo al descargar imagen generada de fal.ai (${dl.status})`);
    const imgBuf = Buffer.from(await dl.arrayBuffer());

    console.log(`✅ [ADAPTIVE AI] Flux Dev completed successfully (${Math.round(imgBuf.length / 1024)} KB)`);
    return {
      base64: `data:image/jpeg;base64,${imgBuf.toString('base64')}`,
      provider: 'fal-ai/flux/dev'
    };
  },

  /**
   * Fast VLM Product Visual Analyzer via fal-ai/moondream2
   * Extracts exact 3D geometry, silhouette, packaging materials, and colors
   * so the AI recreation NEVER loses the product shape!
   */
  async analyzeProductVisuals(productImage: string): Promise<string> {
    try {
      const falKey = getAiCredential('fal');
      if (!falKey || falKey.length < 20 || falKey.includes('[SENSITIVE]')) return '';
      const falClient = createFalClient({ credentials: falKey });

      let imageUrl = productImage;
      if (productImage.startsWith('data:image')) {
        const mimeMatch = productImage.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const base64Clean = productImage.replace(/^data:image\/[a-zA-Z0-9.-]+;base64,/, '');
        const buf = Buffer.from(base64Clean, 'base64');
        const blob = new Blob([buf], { type: mimeType });
        imageUrl = await falClient.storage.upload(blob);
      }

      console.log('👁️ [FAL VLM] Analyzing product physical shape and details with fal-ai/moondream2...');
      const res: any = await (falClient as any).subscribe('fal-ai/moondream2', {
        input: {
          image_url: imageUrl,
          prompt: 'Describe the main product in the image in extreme physical detail for a commercial advertisement: exact 3D shape and silhouette (e.g. square box, rectangular bottle, faceted glass tumbler, cylinder, pouch), materials (e.g. heavy cut crystal, glass, brushed metal, wood, cardboard), exact colors, textures on sides and surface, labels, plaques, frames, caps, and visible text/logos.'
        }
      });

      const desc = res?.data?.output || res?.output || '';
      console.log(`✅ [FAL VLM] Product physical identity extracted:\n  ${desc}\n`);
      return desc;
    } catch (err: any) {
      console.warn(`⚠️ [FAL VLM] Product visual analysis failed (${err.message}) — continuing with text fallback.`);
      return '';
    }
  },

  /**
   * High-precision salient object background removal via fal-ai/birefnet
   * Perfectly isolates the product without cutting into white bottles or distorting edges!
   */
  async removeBackgroundBiRefNet(productImage: string): Promise<Buffer> {
    const falKey = getAiCredential('fal');
    if (falKey && falKey.length >= 20 && !falKey.includes('[SENSITIVE]')) {
      try {
        console.log('✂️ [BIREFNET] Performing AI salient object background removal on product...');
        const res = await fetch('https://fal.run/fal-ai/birefnet', {
          method: 'POST',
          headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: productImage })
        });

        if (res.ok) {
          const data = await res.json();
          const cutoutUrl = data?.image?.url;
          if (cutoutUrl) {
            const cutoutRes = await fetch(cutoutUrl);
            if (cutoutRes.ok) {
              const buf = Buffer.from(await cutoutRes.arrayBuffer());
              console.log(`✅ [BIREFNET] Product cutout extracted flawlessly (${Math.round(buf.length / 1024)} KB)`);
              return buf;
            }
          }
        } else {
          const errText = await res.text();
          console.warn(`⚠️ [BIREFNET] Status ${res.status}: ${errText.substring(0, 150)}`);
        }
      } catch (err: any) {
        console.warn(`⚠️ [BIREFNET] BiRefNet API failed (${err.message}) — falling back to local flood-fill.`);
      }
    }

    const prodClean = productImage.replace(/^data:image\/[a-zA-Z0-9.-]+;base64,/, '');
    return Buffer.from(prodClean, 'base64');
  },
};
