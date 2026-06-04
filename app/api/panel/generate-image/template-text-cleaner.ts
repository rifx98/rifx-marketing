import sharp from 'sharp';

export interface TextSlotZone {
  id: string;
  x: number;       // center X (0-1 normalized)
  y: number;       // center Y (0-1 normalized)
  width: number;   // width as fraction of canvas (0-1)
  height: number;  // height as fraction of canvas (0-1)
  type?: string;
}

interface CleaningResult {
  cleanedBase64: string;        // data:image/png;base64,... cleaned image
  debugBase64: string;          // same image for visual debug
  slotsCleanedCount: number;
  cleaningLog: SlotCleaningLog[];
  riskLevel: 'low' | 'medium' | 'high';
}

interface SlotCleaningLog {
  slotId: string;
  type: string;
  pixelBounds: { x0: number; y0: number; x1: number; y1: number };
  avgColor: string;
  method: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Resolves an image input (base64 data URI or URL) to a Buffer.
 */
async function resolveImageToBuffer(input: string): Promise<Buffer> {
  if (input.startsWith('data:image')) {
    const base64Data = input.split(',')[1];
    return Buffer.from(base64Data, 'base64');
  } else if (input.startsWith('http')) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(input, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  throw new Error(`Invalid image input: must be base64 data URI or HTTP URL`);
}

/**
 * Convert normalized slot coordinates to pixel bounds.
 * Coordinates use center+size convention: (x,y) = center, (width,height) = size fraction.
 */
function slotToPixelBounds(
  slot: TextSlotZone,
  imgWidth: number,
  imgHeight: number,
  expandPx: number = 4
): { x0: number; y0: number; x1: number; y1: number; w: number; h: number } {
  const cx = clamp(slot.x, 0, 1) * imgWidth;
  const cy = clamp(slot.y, 0, 1) * imgHeight;
  const halfW = (clamp(slot.width, 0, 1) * imgWidth) / 2;
  const halfH = (clamp(slot.height, 0, 1) * imgHeight) / 2;

  const x0 = Math.max(0, Math.floor(cx - halfW) - expandPx);
  const y0 = Math.max(0, Math.floor(cy - halfH) - expandPx);
  const x1 = Math.min(imgWidth, Math.ceil(cx + halfW) + expandPx);
  const y1 = Math.min(imgHeight, Math.ceil(cy + halfH) + expandPx);

  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/**
 * Sample the average color from a border ring around a rectangular region.
 * Returns { r, g, b } average.
 */
async function sampleBorderColor(
  imgBuffer: Buffer,
  imgWidth: number,
  imgHeight: number,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  borderWidth: number = 6
): Promise<{ r: number; g: number; b: number }> {
  // Extract a slightly larger region that includes the border
  const bx0 = Math.max(0, bounds.x0 - borderWidth);
  const by0 = Math.max(0, bounds.y0 - borderWidth);
  const bx1 = Math.min(imgWidth, bounds.x1 + borderWidth);
  const by1 = Math.min(imgHeight, bounds.y1 + borderWidth);
  const bw = bx1 - bx0;
  const bh = by1 - by0;

  if (bw <= 0 || bh <= 0) return { r: 0, g: 0, b: 0 };

  const regionRaw = await sharp(imgBuffer)
    .extract({ left: bx0, top: by0, width: bw, height: bh })
    .raw()
    .toBuffer();

  // Sample only the border pixels (not the interior)
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  const channels = 3;

  for (let row = 0; row < bh; row++) {
    for (let col = 0; col < bw; col++) {
      // Check if this pixel is in the border ring (outside the original bounds)
      const absX = bx0 + col;
      const absY = by0 + row;
      const isInOriginal = absX >= bounds.x0 && absX < bounds.x1 && absY >= bounds.y0 && absY < bounds.y1;

      if (!isInOriginal) {
        const idx = (row * bw + col) * channels;
        rSum += regionRaw[idx];
        gSum += regionRaw[idx + 1];
        bSum += regionRaw[idx + 2];
        count++;
      }
    }
  }

  if (count === 0) return { r: 0, g: 0, b: 0 };
  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count)
  };
}

/**
 * TEMPLATE TEXT ZONE CLEANER
 * 
 * Removes old text from template images before sending to gpt-image-1.
 * Uses a 3-layer cleaning strategy:
 * 
 * 1. HEAVY BLUR: Gaussian blur (sigma=25) destroys text structure
 * 2. COLOR OVERLAY: Semi-transparent fill with local average color (70% opacity)
 * 3. GRAIN TEXTURE: Subtle noise to maintain visual texture consistency
 * 
 * The result makes old text completely unreadable while preserving the
 * background color/gradient structure of the template.
 */
export async function cleanTemplateTextZones(
  imageInput: string,
  textSlots: TextSlotZone[]
): Promise<CleaningResult> {
  const startTime = Date.now();
  console.log(`\n🧹 [TEXT CLEANER] Iniciando limpieza de ${textSlots.length} text_slots...`);

  // 1. Resolve image to buffer and get metadata
  const originalBuffer = await resolveImageToBuffer(imageInput);
  const metadata = await sharp(originalBuffer).metadata();
  const imgWidth = metadata.width!;
  const imgHeight = metadata.height!;

  console.log(`  📐 Image dimensions: ${imgWidth}x${imgHeight}`);

  // Start with the original image
  let currentBuffer = originalBuffer;
  const cleaningLog: SlotCleaningLog[] = [];

  // 2. Process each text slot
  for (const slot of textSlots) {
    const bounds = slotToPixelBounds(slot, imgWidth, imgHeight, 6);

    // Skip zones that are too small
    if (bounds.w < 4 || bounds.h < 4) {
      console.log(`  ⏭️ Slot "${slot.id}" too small (${bounds.w}x${bounds.h}px), skipping`);
      continue;
    }

    console.log(`  🎯 Cleaning slot "${slot.id}" (${slot.type}) → ${bounds.w}x${bounds.h}px @ (${bounds.x0},${bounds.y0})`);

    // Sample border color for the fill overlay
    const avgColor = await sampleBorderColor(currentBuffer, imgWidth, imgHeight, bounds);
    const hexColor = `#${avgColor.r.toString(16).padStart(2, '0')}${avgColor.g.toString(16).padStart(2, '0')}${avgColor.b.toString(16).padStart(2, '0')}`;

    // --- LAYER 1: Extract zone and apply HEAVY blur ---
    const extractedZone = await sharp(currentBuffer)
      .extract({ left: bounds.x0, top: bounds.y0, width: bounds.w, height: bounds.h })
      .toBuffer();

    const blurredZone = await sharp(extractedZone)
      .blur(Math.max(25, Math.min(bounds.w, bounds.h) / 4)) // sigma = max(25, size/4) — very aggressive
      .toBuffer();

    // --- LAYER 2: Create solid color overlay at 70% opacity ---
    const colorOverlay = await sharp({
      create: {
        width: bounds.w,
        height: bounds.h,
        channels: 4,
        background: { r: avgColor.r, g: avgColor.g, b: avgColor.b, alpha: 180 } // ~70% opacity
      }
    }).png().toBuffer();

    // --- LAYER 3: Create subtle noise/grain texture ---
    // Generate a small noise pattern and tile it
    const noiseSize = Math.min(bounds.w, bounds.h, 64);
    const noisePixels = Buffer.alloc(noiseSize * noiseSize * 4);
    for (let i = 0; i < noiseSize * noiseSize; i++) {
      const offset = i * 4;
      const grain = Math.floor(Math.random() * 20) - 10; // ±10 brightness variation
      noisePixels[offset] = clamp(avgColor.r + grain, 0, 255);
      noisePixels[offset + 1] = clamp(avgColor.g + grain, 0, 255);
      noisePixels[offset + 2] = clamp(avgColor.b + grain, 0, 255);
      noisePixels[offset + 3] = 40; // ~15% opacity
    }
    const grainOverlay = await sharp(noisePixels, {
      raw: { width: noiseSize, height: noiseSize, channels: 4 }
    })
      .resize(bounds.w, bounds.h, { kernel: 'nearest' })
      .png()
      .toBuffer();

    // --- COMPOSITE: blur → color overlay → grain ---
    const cleanedZone = await sharp(blurredZone)
      .composite([
        { input: colorOverlay, blend: 'over' },
        { input: grainOverlay, blend: 'over' }
      ])
      .toBuffer();

    // --- Paste cleaned zone back onto the full image ---
    currentBuffer = await sharp(currentBuffer)
      .composite([{
        input: cleanedZone,
        left: bounds.x0,
        top: bounds.y0
      }])
      .toBuffer();

    cleaningLog.push({
      slotId: slot.id,
      type: slot.type || 'unknown',
      pixelBounds: bounds,
      avgColor: hexColor,
      method: 'blur_sigma25+color_overlay_70pct+grain_15pct'
    });

    console.log(`    ✅ Cleaned "${slot.id}" — avg color: ${hexColor}, method: blur+overlay+grain`);
  }

  // 3. Encode final cleaned image as PNG base64
  const cleanedPngBuffer = await sharp(currentBuffer).png().toBuffer();
  const cleanedBase64 = `data:image/png;base64,${cleanedPngBuffer.toString('base64')}`;

  const duration = Date.now() - startTime;
  const riskLevel = textSlots.length === 0 ? 'high' : (cleaningLog.length === textSlots.length ? 'low' : 'medium');

  console.log(`\n🧹 [TEXT CLEANER] Limpieza completada en ${duration}ms`);
  console.log(`  text_cleaner_enabled: true`);
  console.log(`  text_slots_cleaned_count: ${cleaningLog.length}/${textSlots.length}`);
  console.log(`  cleaned_template_used: true`);
  console.log(`  old_template_text_visible_risk: ${riskLevel}`);
  console.log(`  cleaned_image_size: ${cleanedPngBuffer.length} bytes`);

  return {
    cleanedBase64,
    debugBase64: cleanedBase64, // same image — can be used for visual debug
    slotsCleanedCount: cleaningLog.length,
    cleaningLog,
    riskLevel
  };
}
