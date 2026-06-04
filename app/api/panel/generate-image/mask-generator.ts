import { deflateSync } from 'zlib';

export interface ProductSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: 'rectangle' | 'ellipse';
  padding: number;
}

export interface EditableZone {
  x: number;       // center X (0-1 normalized)
  y: number;       // center Y (0-1 normalized)
  width: number;   // width as fraction of canvas (0-1)
  height: number;  // height as fraction of canvas (0-1)
  shape: 'rectangle' | 'ellipse';
  padding: number; // extra padding (0.0-0.1)
  id?: string;     // optional label for debugging
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writePngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createIHDR(width: number, height: number): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.writeUInt8(8, 8);   // bit depth
  data.writeUInt8(6, 9);   // color type: RGBA
  data.writeUInt8(0, 10);  // compression
  data.writeUInt8(0, 11);  // filter
  data.writeUInt8(0, 12);  // interlace
  return writePngChunk('IHDR', data);
}

function createIDAT(rawData: Buffer): Buffer {
  const compressed = deflateSync(rawData);
  return writePngChunk('IDAT', compressed);
}

function createIEND(): Buffer {
  return writePngChunk('IEND', Buffer.alloc(0));
}

/**
 * Make a zone transparent (editable) in the rawData buffer.
 * Opaque (black) = PROTECTED, Transparent (alpha=0) = EDITABLE
 */
function markZoneTransparent(
  rawData: Buffer,
  zone: EditableZone,
  w: number,
  h: number,
  rowSize: number
): void {
  const pad = clamp(zone.padding, 0, 0.1);
  const slotX = clamp(zone.x, 0, 1);
  const slotY = clamp(zone.y, 0, 1);
  const slotW = clamp(zone.width + pad * 2, 0, 1);
  const slotH = clamp(zone.height + pad * 2, 0, 1);

  const cxPx = slotX * w;
  const cyPx = slotY * h;
  const halfW = (slotW * w) / 2;
  const halfH = (slotH * h) / 2;

  const x0 = Math.max(0, Math.floor(cxPx - halfW));
  const x1 = Math.min(w - 1, Math.ceil(cxPx + halfW));
  const y0 = Math.max(0, Math.floor(cyPx - halfH));
  const y1 = Math.min(h - 1, Math.ceil(cyPx + halfH));

  const isEllipse = zone.shape === 'ellipse';
  const rxSq = halfW * halfW;
  const rySq = halfH * halfH;

  for (let row = y0; row <= y1; row++) {
    const rowOffset = row * rowSize;
    for (let col = x0; col <= x1; col++) {
      let inSlot = true;

      if (isEllipse) {
        if (rxSq === 0 || rySq === 0) {
          inSlot = false;
        } else {
          const dx = (col + 0.5) - cxPx;
          const dy = (row + 0.5) - cyPx;
          inSlot = (dx * dx) / rxSq + (dy * dy) / rySq <= 1;
        }
      }

      if (inSlot) {
        const px = rowOffset + 1 + col * 4;
        rawData[px + 3] = 0; // A = 0 (transparent = editable)
      }
    }
  }
}

/**
 * Generate a mask with MULTIPLE editable zones (product + text slots).
 * Opaque (black) = PROTECTED, Transparent = EDITABLE
 */
export function generateMultiZoneMask(
  zones: EditableZone[],
  canvasWidth: number,
  canvasHeight: number
): Buffer {
  const w = Math.max(1, Math.round(canvasWidth));
  const h = Math.max(1, Math.round(canvasHeight));

  // Each row: 1 filter byte + width * 4 RGBA bytes
  const rowSize = 1 + w * 4;
  const rawData = Buffer.alloc(rowSize * h);

  // Fill everything opaque black (PROTECTED)
  for (let row = 0; row < h; row++) {
    const rowOffset = row * rowSize;
    rawData[rowOffset] = 0; // filter: None
    for (let col = 0; col < w; col++) {
      const px = rowOffset + 1 + col * 4;
      rawData[px] = 0;     // R
      rawData[px + 1] = 0; // G
      rawData[px + 2] = 0; // B
      rawData[px + 3] = 255; // A (opaque = protected)
    }
  }

  // Mark each zone as transparent (editable)
  for (const zone of zones) {
    markZoneTransparent(rawData, zone, w, h, rowSize);
  }

  // Assemble PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = createIHDR(w, h);
  const idat = createIDAT(rawData);
  const iend = createIEND();

  return Buffer.concat([signature, ihdr, idat, iend]);
}

export async function generateMultiZoneMaskAsFile(
  zones: EditableZone[],
  canvasWidth: number,
  canvasHeight: number
): Promise<any> {
  const maskBuffer = generateMultiZoneMask(zones, canvasWidth, canvasHeight);
  const { toFile } = await import('openai');
  const file = await toFile(maskBuffer, 'mask.png', { type: 'image/png' });
  return file;
}

// ============================================================
// LEGACY: Single-slot functions preserved for backward compatibility
// ============================================================

export function generateProductMask(
  slot: ProductSlot,
  canvasWidth: number,
  canvasHeight: number
): Buffer {
  const zone: EditableZone = { ...slot, id: 'product' };
  return generateMultiZoneMask([zone], canvasWidth, canvasHeight);
}

export function generateMaskAsBase64DataUrl(
  slot: ProductSlot,
  canvasWidth: number,
  canvasHeight: number
): string {
  const buffer = generateProductMask(slot, canvasWidth, canvasHeight);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

export async function generateMaskAsFile(
  slot: ProductSlot,
  canvasWidth: number,
  canvasHeight: number
): Promise<any> {
  const maskBuffer = generateProductMask(slot, canvasWidth, canvasHeight);
  const { toFile } = await import('openai');
  const file = await toFile(maskBuffer, 'mask.png', { type: 'image/png' });
  return file;
}
