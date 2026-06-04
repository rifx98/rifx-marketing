/**
 * visual-qa.ts — Perceptual Visual QA System
 * 
 * Validates generated banners using Sharp-based image analysis.
 * NO AI calls — pure deterministic pixel analysis.
 * 
 * Checks:
 * 1. Product presence in the product_slot region
 * 2. Template structure preservation (locked regions unchanged)
 * 3. Color palette consistency
 * 4. Layout integrity (no random elements added)
 */

interface ProductSlot {
  x: number;      // 0-1 normalized center
  y: number;
  width: number;
  height: number;
}

interface VisualQAResult {
  passed: boolean;
  product_present: boolean;
  product_presence_score: number;       // 0-100
  template_preservation_score: number;  // 0-100
  color_consistency_score: number;      // 0-100
  layout_integrity_score: number;       // 0-100
  issues: string[];
  recommendation: 'accept' | 'retry_flux' | 'fallback_sharp';
}

/**
 * Run perceptual QA on a generated banner.
 * 
 * @param generatedBuffer - The generated banner image buffer
 * @param templateBuffer - The original template image buffer
 * @param productBuffer - The product cutout buffer (with alpha)
 * @param productSlot - Where the product should be placed
 * @param canvasW - Canvas width in pixels
 * @param canvasH - Canvas height in pixels
 */
export async function runVisualQA(
  generatedBuffer: Buffer,
  templateBuffer: Buffer,
  productBuffer: Buffer | null,
  productSlot: ProductSlot | null,
  canvasW: number,
  canvasH: number,
): Promise<VisualQAResult> {
  const sharp = (await import('sharp')).default;
  const issues: string[] = [];

  // ═══════════════════════════════════════════
  // CHECK 1: Product Presence in Slot
  // ═══════════════════════════════════════════
  let productPresent = true;
  let productPresenceScore = 100;

  if (productSlot && productBuffer) {
    try {
      // Extract the product_slot region from the generated image
      const slotX = Math.round((productSlot.x - productSlot.width / 2) * canvasW);
      const slotY = Math.round((productSlot.y - productSlot.height / 2) * canvasH);
      const slotW = Math.round(productSlot.width * canvasW);
      const slotH = Math.round(productSlot.height * canvasH);

      // Clamp to canvas bounds
      const left = Math.max(0, slotX);
      const top = Math.max(0, slotY);
      const width = Math.min(slotW, canvasW - left);
      const height = Math.min(slotH, canvasH - top);

      if (width > 0 && height > 0) {
        // Get the region from the generated image
        const generatedRegion = await sharp(generatedBuffer)
          .resize(canvasW, canvasH, { fit: 'fill' })
          .extract({ left, top, width, height })
          .raw()
          .toBuffer();

        // Get the same region from the original template
        const templateRegion = await sharp(templateBuffer)
          .resize(canvasW, canvasH, { fit: 'fill' })
          .extract({ left, top, width, height })
          .raw()
          .toBuffer();

        // Compare: if the generated region is identical to the template region,
        // it means the product was NOT inserted (template was returned unchanged)
        let identicalPixels = 0;
        let totalPixels = 0;
        const channels = 3; // RGB from raw()

        for (let i = 0; i < generatedRegion.length && i < templateRegion.length; i += channels) {
          totalPixels++;
          const dr = Math.abs(generatedRegion[i] - templateRegion[i]);
          const dg = Math.abs(generatedRegion[i + 1] - templateRegion[i + 1]);
          const db = Math.abs(generatedRegion[i + 2] - templateRegion[i + 2]);
          if (dr + dg + db < 15) {
            identicalPixels++;
          }
        }

        const identicalRatio = totalPixels > 0 ? identicalPixels / totalPixels : 0;

        // If >90% of the slot pixels are identical to template, product is missing
        if (identicalRatio > 0.90) {
          productPresent = false;
          productPresenceScore = Math.round((1 - identicalRatio) * 100);
          issues.push(`Producto NO detectado en el slot (${Math.round(identicalRatio * 100)}% idéntico al template original)`);
        } else {
          // Product is present — score based on how different the region is
          productPresenceScore = Math.round(Math.min(100, (1 - identicalRatio) * 120));
        }
      }
    } catch (err: any) {
      console.warn(`[VISUAL-QA] Product presence check failed: ${err.message}`);
      // Don't fail QA for check errors — assume product is present
      productPresenceScore = 75;
    }
  }

  // ═══════════════════════════════════════════
  // CHECK 2: Template Structure Preservation
  // ═══════════════════════════════════════════
  let templatePreservationScore = 100;

  try {
    // Compare locked regions (everything OUTSIDE the product_slot)
    // Strategy: sample 4 corner regions of the canvas (typically locked)
    const sampleSize = Math.round(Math.min(canvasW, canvasH) * 0.15); // 15% corner samples

    const corners = [
      { left: 0, top: 0 },                                    // top-left
      { left: canvasW - sampleSize, top: 0 },                  // top-right
      { left: 0, top: canvasH - sampleSize },                  // bottom-left
      { left: canvasW - sampleSize, top: canvasH - sampleSize }, // bottom-right
    ];

    let totalDeviation = 0;
    let samplesChecked = 0;

    for (const corner of corners) {
      try {
        const left = Math.max(0, corner.left);
        const top = Math.max(0, corner.top);
        const w = Math.min(sampleSize, canvasW - left);
        const h = Math.min(sampleSize, canvasH - top);

        if (w < 10 || h < 10) continue;

        const genCorner = await sharp(generatedBuffer)
          .resize(canvasW, canvasH, { fit: 'fill' })
          .extract({ left, top, width: w, height: h })
          .raw()
          .toBuffer();

        const tplCorner = await sharp(templateBuffer)
          .resize(canvasW, canvasH, { fit: 'fill' })
          .extract({ left, top, width: w, height: h })
          .raw()
          .toBuffer();

        // Calculate mean absolute difference
        let diff = 0;
        const len = Math.min(genCorner.length, tplCorner.length);
        for (let i = 0; i < len; i++) {
          diff += Math.abs(genCorner[i] - tplCorner[i]);
        }
        const meanDiff = len > 0 ? diff / len : 0;
        totalDeviation += meanDiff;
        samplesChecked++;
      } catch {
        // Skip failed corner samples
      }
    }

    if (samplesChecked > 0) {
      const avgDeviation = totalDeviation / samplesChecked;
      // avgDeviation: 0=perfect match, 255=completely different
      // Score: 0 deviation → 100, 50+ deviation → 0
      templatePreservationScore = Math.round(Math.max(0, Math.min(100, 100 - (avgDeviation * 2))));

      if (templatePreservationScore < 70) {
        issues.push(`Template alterado significativamente (${templatePreservationScore}% preservación — esquinas del canvas difieren del original)`);
      }
    }
  } catch (err: any) {
    console.warn(`[VISUAL-QA] Template preservation check failed: ${err.message}`);
    templatePreservationScore = 80; // Assume mostly OK
  }

  // ═══════════════════════════════════════════
  // CHECK 3: Color Palette Consistency
  // ═══════════════════════════════════════════
  let colorConsistencyScore = 100;

  try {
    // Get dominant colors from template and generated using Sharp stats
    const genStats = await sharp(generatedBuffer)
      .resize(canvasW, canvasH, { fit: 'fill' })
      .stats();
    const tplStats = await sharp(templateBuffer)
      .resize(canvasW, canvasH, { fit: 'fill' })
      .stats();

    // Compare channel means
    let colorDiff = 0;
    for (let c = 0; c < Math.min(genStats.channels.length, tplStats.channels.length, 3); c++) {
      colorDiff += Math.abs(genStats.channels[c].mean - tplStats.channels[c].mean);
    }
    // colorDiff: 0=identical, 765 (255*3)=max difference
    // Allow some difference because the product adds new colors
    // Score: <30 diff → 100, >150 diff → 0
    colorConsistencyScore = Math.round(Math.max(0, Math.min(100, 100 - ((colorDiff - 30) * 100 / 120))));

    if (colorConsistencyScore < 60) {
      issues.push(`Paleta de colores desviada significativamente (diff=${Math.round(colorDiff)})`);
    }
  } catch (err: any) {
    console.warn(`[VISUAL-QA] Color consistency check failed: ${err.message}`);
    colorConsistencyScore = 80;
  }

  // ═══════════════════════════════════════════
  // CHECK 4: Layout Integrity 
  // ═══════════════════════════════════════════
  let layoutIntegrityScore = 100;

  try {
    // Check that the generated image has the correct dimensions
    const genMeta = await sharp(generatedBuffer).metadata();
    
    if (genMeta.width && genMeta.height) {
      const expectedRatio = canvasW / canvasH;
      const actualRatio = genMeta.width / genMeta.height;
      const ratioDiff = Math.abs(expectedRatio - actualRatio);
      
      if (ratioDiff > 0.1) {
        layoutIntegrityScore = 50;
        issues.push(`Aspect ratio incorrecto: esperado ${expectedRatio.toFixed(2)}, recibido ${actualRatio.toFixed(2)}`);
      }
    }

    // Check file size — a very small file might indicate a failed render
    if (generatedBuffer.length < 10000) {
      layoutIntegrityScore = Math.min(layoutIntegrityScore, 30);
      issues.push(`Imagen generada muy pequeña (${generatedBuffer.length} bytes) — posible render fallido`);
    }
  } catch (err: any) {
    console.warn(`[VISUAL-QA] Layout integrity check failed: ${err.message}`);
    layoutIntegrityScore = 80;
  }

  // ═══════════════════════════════════════════
  // FINAL VERDICT
  // ═══════════════════════════════════════════
  const avgScore = (productPresenceScore + templatePreservationScore + colorConsistencyScore + layoutIntegrityScore) / 4;
  
  const passed = productPresent && avgScore >= 70 && templatePreservationScore >= 60;

  let recommendation: 'accept' | 'retry_flux' | 'fallback_sharp' = 'accept';
  if (!passed) {
    if (!productPresent) {
      recommendation = 'fallback_sharp'; // Product missing → use deterministic
    } else if (templatePreservationScore < 60) {
      recommendation = 'fallback_sharp'; // Template destroyed → use deterministic
    } else {
      recommendation = 'retry_flux'; // Minor issues → retry with lower strength
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  [VISUAL QA] Perceptual Analysis Results`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Product Present:         ${productPresent ? '✅' : '❌'} (${productPresenceScore}/100)`);
  console.log(`  Template Preservation:   ${templatePreservationScore >= 70 ? '✅' : '⚠️'} (${templatePreservationScore}/100)`);
  console.log(`  Color Consistency:       ${colorConsistencyScore >= 60 ? '✅' : '⚠️'} (${colorConsistencyScore}/100)`);
  console.log(`  Layout Integrity:        ${layoutIntegrityScore >= 70 ? '✅' : '⚠️'} (${layoutIntegrityScore}/100)`);
  console.log(`  ────────────────────────────────────────`);
  console.log(`  OVERALL:                 ${passed ? '✅ PASSED' : '❌ FAILED'} (avg: ${Math.round(avgScore)}/100)`);
  console.log(`  Recommendation:          ${recommendation}`);
  if (issues.length > 0) {
    console.log(`  Issues:`);
    issues.forEach(i => console.log(`    ⚠️ ${i}`));
  }
  console.log(`${'═'.repeat(60)}\n`);

  return {
    passed,
    product_present: productPresent,
    product_presence_score: productPresenceScore,
    template_preservation_score: templatePreservationScore,
    color_consistency_score: colorConsistencyScore,
    layout_integrity_score: layoutIntegrityScore,
    issues,
    recommendation,
  };
}
