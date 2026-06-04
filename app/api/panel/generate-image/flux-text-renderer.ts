/**
 * FLUX Text Renderer
 * ==================
 * Renders exact Spanish ad copy onto an image buffer using Sharp + SVG compositing.
 *
 * ARCHITECTURE PRINCIPLE:
 *   FLUX  = visual render (product, lighting, shadows, background in editable zones)
 *   Sharp = text render  (exact, readable, pixel-perfect Spanish copy)
 *
 * Why SVG + Sharp instead of canvas?
 *   - No native dependency needed (sharp is already in the project)
 *   - Sharp supports SVG compositing via librsvg
 *   - SVG natively supports text, fonts, drop-shadows, rounded rects
 *
 * Text slot positions: center-based normalized (x, y from 0.0 to 1.0)
 */

import sharp from 'sharp';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Escape XML/SVG special characters in text content */
function escapeXml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wrap text into lines that fit within maxChars.
 * Respects word boundaries; truncates with ellipsis if needed.
 */
function wrapText(text: string, maxChars: number, maxLines = 4): string[] {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (lines.length >= maxLines) break;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // If a single word is longer than maxChars, hard-truncate it
      current = word.length > maxChars
        ? word.substring(0, maxChars - 1) + '…'
        : word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.length > 0 ? lines : [text.substring(0, maxChars)];
}

// ─── Slot Style Config ────────────────────────────────────────────────────────

interface SlotStyle {
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  fill: string;
  textAnchor: 'start' | 'middle' | 'end';
  letterSpacing: number;
  hasBg: boolean;
  bgFill: string;
  bgRx: number;
  bgPadX: number;
  bgPadY: number;
  shadow: boolean;
  shadowColor: string;
  maxCharsPerLine: number;
  maxLines: number;
  lineHeight: number;
}

/**
 * Returns slot-type-specific style config.
 * Font sizes are calculated from slot pixel dimensions so they scale
 * correctly to any canvas size.
 */
function getSlotStyle(
  type: string,
  slotW: number,  // pixel width of slot
  slotH: number,  // pixel height of slot
  adaptedColors: any
): SlotStyle {

  // avgCharWidth ≈ fontSize * 0.55 for Arial
  // maxCharsPerLine = slotW / (fontSize * 0.55)
  const calcMaxChars = (fs: number) => Math.max(6, Math.floor(slotW / (fs * 0.55)));

  switch (type) {

    case 'headline':
    case 'hook': {
      const fs = Math.max(20, Math.min(slotH * 0.45, slotW * 0.09, 72));
      return {
        fontSize: fs,
        fontWeight: '800',
        fontStyle: 'normal',
        fill: adaptedColors?.text || '#ffffff',
        textAnchor: 'middle',
        letterSpacing: -0.5,
        hasBg: false,
        bgFill: '',
        bgRx: 0,
        bgPadX: 0,
        bgPadY: 0,
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.9)',
        maxCharsPerLine: calcMaxChars(fs),
        maxLines: 3,
        lineHeight: 1.15,
      };
    }

    case 'badge': {
      const fs = Math.max(12, Math.min(slotH * 0.5, 26));
      return {
        fontSize: fs,
        fontWeight: '700',
        fontStyle: 'normal',
        fill: adaptedColors?.badgeText || '#ffffff',
        textAnchor: 'middle',
        letterSpacing: 1.5,
        hasBg: true,
        bgFill: adaptedColors?.badgeBg || '#10b981',
        bgRx: 999,   // pill shape
        bgPadX: 20,
        bgPadY: 9,
        shadow: false,
        shadowColor: '',
        maxCharsPerLine: 32,
        maxLines: 1,
        lineHeight: 1,
      };
    }

    case 'description':
    case 'desc': {
      const fs = Math.max(13, Math.min(slotH * 0.28, slotW * 0.055, 24));
      return {
        fontSize: fs,
        fontWeight: '400',
        fontStyle: 'normal',
        fill: 'rgba(255,255,255,0.92)',
        textAnchor: 'middle',
        letterSpacing: 0,
        hasBg: false,
        bgFill: '',
        bgRx: 0,
        bgPadX: 0,
        bgPadY: 0,
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.75)',
        maxCharsPerLine: calcMaxChars(Math.max(13, Math.min(slotH * 0.28, 24))),
        maxLines: 4,
        lineHeight: 1.4,
      };
    }

    case 'cta': {
      const fs = Math.max(14, Math.min(slotH * 0.42, slotW * 0.08, 36));
      return {
        fontSize: fs,
        fontWeight: '800',
        fontStyle: 'normal',
        fill: adaptedColors?.text || '#ffffff',
        textAnchor: 'middle',
        letterSpacing: 2,
        hasBg: false,
        bgFill: '',
        bgRx: 0,
        bgPadX: 0,
        bgPadY: 0,
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.85)',
        maxCharsPerLine: 22,
        maxLines: 1,
        lineHeight: 1,
      };
    }

    case 'benefit_title': {
      const fs = Math.max(11, Math.min(slotH * 0.42, 22));
      return {
        fontSize: fs,
        fontWeight: '600',
        fontStyle: 'normal',
        fill: '#ffffff',
        textAnchor: 'middle',
        letterSpacing: 0,
        hasBg: false,
        bgFill: '',
        bgRx: 0,
        bgPadX: 0,
        bgPadY: 0,
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.8)',
        maxCharsPerLine: calcMaxChars(Math.max(11, Math.min(slotH * 0.42, 22))),
        maxLines: 2,
        lineHeight: 1.2,
      };
    }

    case 'product_title': {
      const fs = Math.max(16, Math.min(slotH * 0.38, slotW * 0.07, 48));
      return {
        fontSize: fs,
        fontWeight: '700',
        fontStyle: 'normal',
        fill: adaptedColors?.text || '#ffffff',
        textAnchor: 'middle',
        letterSpacing: 0,
        hasBg: false,
        bgFill: '',
        bgRx: 0,
        bgPadX: 0,
        bgPadY: 0,
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.9)',
        maxCharsPerLine: calcMaxChars(Math.max(16, Math.min(slotH * 0.38, 48))),
        maxLines: 2,
        lineHeight: 1.2,
      };
    }

    case 'testimonial': {
      const fs = Math.max(11, Math.min(slotH * 0.25, 20));
      return {
        fontSize: fs,
        fontWeight: '400',
        fontStyle: 'italic',
        fill: 'rgba(255,255,255,0.82)',
        textAnchor: 'middle',
        letterSpacing: 0,
        hasBg: false,
        bgFill: '',
        bgRx: 0,
        bgPadX: 0,
        bgPadY: 0,
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.7)',
        maxCharsPerLine: calcMaxChars(Math.max(11, Math.min(slotH * 0.25, 20))),
        maxLines: 3,
        lineHeight: 1.35,
      };
    }

    default: {
      const fs = Math.max(14, Math.min(slotH * 0.35, slotW * 0.07, 40));
      return {
        fontSize: fs,
        fontWeight: '500',
        fontStyle: 'normal',
        fill: '#ffffff',
        textAnchor: 'middle',
        letterSpacing: 0,
        hasBg: false,
        bgFill: '',
        bgRx: 0,
        bgPadX: 0,
        bgPadY: 0,
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.8)',
        maxCharsPerLine: calcMaxChars(fs),
        maxLines: 3,
        lineHeight: 1.3,
      };
    }
  }
}

// ─── SVG Builder ──────────────────────────────────────────────────────────────

/**
 * Build an SVG element for a single text slot.
 * Returns empty string if no content or slot is invalid.
 */
function buildSlotSvg(
  slot: any,
  content: string,
  canvasW: number,
  canvasH: number,
  adaptedColors: any,
  slotIndex: number
): string {
  if (!content || !slot) return '';

  // Normalize slot coordinates (center-based)
  const cx = slot.x * canvasW;
  const cy = slot.y * canvasH;
  const slotW = slot.width * canvasW;
  const slotH = slot.height * canvasH;

  const style = getSlotStyle(slot.type, slotW, slotH, adaptedColors);
  const lines = wrapText(content, style.maxCharsPerLine, style.maxLines);
  if (lines.length === 0) return '';

  const filterId = `txt_shadow_${slotIndex}`;
  const totalTextH = lines.length * style.fontSize * style.lineHeight;
  // Start Y so the block is vertically centered in the slot
  const startY = cy - totalTextH / 2 + style.fontSize * 0.82;

  const filterDef = style.shadow ? `
    <defs>
      <filter id="${filterId}" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="3"
          flood-color="${style.shadowColor}" flood-opacity="1"/>
      </filter>
    </defs>` : '';

  // ── Badge: single-line with pill background ───────────────────────────────
  if (style.hasBg) {
    const line = escapeXml(lines[0]);
    const estimatedW = lines[0].length * style.fontSize * 0.58;
    const bgW = estimatedW + style.bgPadX * 2;
    const bgH = style.fontSize + style.bgPadY * 2;
    const bgX = cx - bgW / 2;
    const bgY = cy - bgH / 2;

    return `
  ${filterDef}
  <rect
    x="${bgX.toFixed(1)}" y="${bgY.toFixed(1)}"
    width="${bgW.toFixed(1)}" height="${bgH.toFixed(1)}"
    rx="${style.bgRx}" ry="${style.bgRx}"
    fill="${escapeXml(style.bgFill)}"
  />
  <text
    x="${cx.toFixed(1)}" y="${(cy + style.fontSize * 0.36).toFixed(1)}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${style.fontSize}"
    font-weight="${style.fontWeight}"
    font-style="${style.fontStyle}"
    fill="${escapeXml(style.fill)}"
    text-anchor="${style.textAnchor}"
    letter-spacing="${style.letterSpacing}"
  >${line}</text>`;
  }

  // ── Regular multiline text ────────────────────────────────────────────────
  const tspans = lines.map((line, idx) => {
    const lineY = startY + idx * style.fontSize * style.lineHeight;
    return `<tspan x="${cx.toFixed(1)}" y="${lineY.toFixed(1)}">${escapeXml(line)}</tspan>`;
  }).join('\n    ');

  return `
  ${filterDef}
  <text
    font-family="Arial, Helvetica, sans-serif"
    font-size="${style.fontSize}"
    font-weight="${style.fontWeight}"
    font-style="${style.fontStyle}"
    fill="${escapeXml(style.fill)}"
    text-anchor="${style.textAnchor}"
    letter-spacing="${style.letterSpacing}"
    ${style.shadow ? `filter="url(#${filterId})"` : ''}
  >${tspans}</text>`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Renders text from `text_slots` onto `inputBuffer` using Sharp + SVG compositing.
 *
 * Called AFTER:
 *   1. FLUX visual render (product, shadows, lighting)
 *   2. Sharp post-compositing (template structure restoration)
 *
 * This is the FINAL step. The output is a complete ad image with:
 *   - FLUX visual quality in editable zones
 *   - Pixel-perfect original template outside editable zones
 *   - Exact, legible Spanish copy at exact slot positions
 *
 * @param inputBuffer     - PNG buffer from post-compositing step
 * @param textSlots       - Array of text slot definitions from template_json
 * @param textSlotContent - Map of slot.id → copy text (from GPT-4o copywriter)
 * @param canvasW         - Canvas width in pixels
 * @param canvasH         - Canvas height in pixels
 * @param adaptedColors   - UI color palette (text, badgeBg, badgeText, accent...)
 * @returns               - Final PNG buffer with text rendered
 */
export async function renderTextLayersOntoImage(
  inputBuffer: Buffer,
  textSlots: any[],
  textSlotContent: Record<string, string>,
  canvasW: number,
  canvasH: number,
  adaptedColors: any
): Promise<Buffer> {

  if (!textSlots || textSlots.length === 0) {
    console.log('[TEXT RENDERER] No text_slots defined — skipping text rendering');
    return inputBuffer;
  }

  console.log(`\n🖊️ [TEXT RENDERER] Renderizando ${textSlots.length} text_slots con Sharp+SVG...`);

  const svgElements: string[] = [];
  let renderedCount = 0;

  for (let i = 0; i < textSlots.length; i++) {
    const slot = textSlots[i];
    // Try both slot.id and slot.type as keys
    const content = textSlotContent[slot.id] || textSlotContent[slot.type] || '';

    if (!content) {
      console.log(`  ⚠️ [TEXT RENDERER] slot "${slot.id}" (${slot.type}): sin contenido, omitido`);
      continue;
    }

    const svgPart = buildSlotSvg(slot, content, canvasW, canvasH, adaptedColors, i);
    if (svgPart) {
      svgElements.push(svgPart);
      renderedCount++;
      const preview = content.length > 40 ? content.substring(0, 37) + '...' : content;
      console.log(`  ✅ [TEXT RENDERER] slot "${slot.id}" (${slot.type}): "${preview}"`);
    }
  }

  if (svgElements.length === 0) {
    console.log('[TEXT RENDERER] No slots rendered — returning input buffer unchanged');
    return inputBuffer;
  }

  // Build full-canvas SVG overlay with all text elements
  const svgOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">
${svgElements.join('\n')}
</svg>`;

  try {
    const svgBuffer = Buffer.from(svgOverlay, 'utf-8');

    const result = await sharp(inputBuffer)
      .composite([{ input: svgBuffer, top: 0, left: 0 }])
      .png()
      .toBuffer();

    console.log(`✅ [TEXT RENDERER] ${renderedCount}/${textSlots.length} slots renderizados con Sharp+SVG`);
    return result;

  } catch (err: any) {
    console.error(`❌ [TEXT RENDERER] Error en SVG compositing: ${err.message}`);
    console.warn('[TEXT RENDERER] Retornando imagen sin texto como fallback');
    return inputBuffer;
  }
}
