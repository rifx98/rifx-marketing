import { openaiProvider } from './openai-provider';
import { groqProvider } from './groq-provider';
import { fluxProvider, compositePureSharp } from './flux-provider';
import { ProductAnalysis, Copywriting, TemplateDNA, QAResults, ArtDirection, AdaptedColorsResult } from './provider-types';

export { compositePureSharp };

// Helper: decide which text/analysis provider to use
// Priority: FORCE_OPENAI=true → OpenAI | GROQ_API_KEY present → Groq | fallback → OpenAI
function shouldUseGroq(): boolean {
  if (process.env.FORCE_OPENAI === 'true') return false;
  if (process.env.GROQ_API_KEY) return true;
  if (process.env.USE_GROQ === 'true') return true;
  return false;
}

export const aiRouter = {
  async analyzeProduct(productImage: string): Promise<ProductAnalysis> {
    if (shouldUseGroq()) {
      return groqProvider.analyzeProduct(productImage);
    }
    return openaiProvider.analyzeProduct(productImage);
  },

  async generateCopy(
    productAnalysis: ProductAnalysis,
    campaignTitle: string,
    userInstructions: string,
    adTextsOverrides: any,
    templateBenefitsLength: number,
    templateHasTestimonial: boolean
  ): Promise<Copywriting> {
    if (shouldUseGroq()) {
      return groqProvider.generateCopy(
        productAnalysis,
        campaignTitle,
        userInstructions,
        adTextsOverrides,
        templateBenefitsLength,
        templateHasTestimonial
      );
    }
    return openaiProvider.generateCopy(
      productAnalysis,
      campaignTitle,
      userInstructions,
      adTextsOverrides,
      templateBenefitsLength,
      templateHasTestimonial
    );
  },

  async analyzeTemplateDNA(
    templatePreviewImage: string,
    colors: any
  ): Promise<TemplateDNA> {
    if (shouldUseGroq()) {
      return groqProvider.analyzeTemplateDNA(templatePreviewImage, colors);
    }
    return openaiProvider.analyzeTemplateDNA(templatePreviewImage, colors);
  },

  async generateArtDirection(
    strippedStyleIdentity: string,
    template_json: any,
    strippedAiDirectionRules: any,
    productAnalysis: ProductAnalysis
  ): Promise<ArtDirection> {
    if (shouldUseGroq()) {
      return groqProvider.generateArtDirection(
        strippedStyleIdentity,
        template_json,
        strippedAiDirectionRules,
        productAnalysis
      );
    }
    return openaiProvider.generateArtDirection(
      strippedStyleIdentity,
      template_json,
      strippedAiDirectionRules,
      productAnalysis
    );
  },

  async adaptColors(
    templateDNA: TemplateDNA,
    productAnalysis: ProductAnalysis,
    template_json: any,
    strippedStyleIdentity: string
  ): Promise<AdaptedColorsResult> {
    if (shouldUseGroq()) {
      return groqProvider.adaptColors(
        templateDNA,
        productAnalysis,
        template_json,
        strippedStyleIdentity
      );
    }
    return openaiProvider.adaptColors(
      templateDNA,
      productAnalysis,
      template_json,
      strippedStyleIdentity
    );
  },


  async renderVisual(
    promptText: string,
    imageSource: string,
    productRefImage: string,
    maskFile: any,
    gptImageSize: string,
    useCompositingMode: boolean,
    extraOptions?: {
      productSlot?: any;
      editableZones?: any[];
      hasTextSlots?: boolean;
      cleanedTemplateBase64?: string;
      visualProvider?: 'openai' | 'flux' | 'sharp';
      pureSharpMode?: boolean;
    }
  ): Promise<{ base64: string; provider: string }> {
    const usePureSharp =
      extraOptions?.pureSharpMode === true ||
      extraOptions?.visualProvider === 'sharp' ||
      process.env.PURE_SHARP_MODE === 'true';

    const useFlux =
      !usePureSharp &&
      (extraOptions?.visualProvider === 'flux' ||
      (!extraOptions?.visualProvider && process.env.USE_FLUX === 'true'));

    const providerName = usePureSharp
      ? 'Pure Sharp (Deterministic — No AI)'
      : useFlux ? 'FLUX (fal.ai)' : 'OpenAI gpt-image-1';
    
    // ═══ COST AUDIT: Provider Selection ═══
    console.log('\n' + '═'.repeat(60));
    console.log('  [AI COST AUDIT] — VISUAL RENDER');
    console.log('═'.repeat(60));
    console.log(`  provider_used: ${providerName}`);
    console.log(`  pure_sharp_mode: ${usePureSharp}`);
    console.log(`  flux_called: ${useFlux}`);
    console.log(`  openai_called: ${!useFlux && !usePureSharp}`);
    console.log('═'.repeat(60) + '\n');

    // ═══════════════════════════════════════════════════════════════
    // VISUAL RENDER ROUTING — NEVER call OpenAI unless explicitly requested
    // ═══════════════════════════════════════════════════════════════

    // CASE 1: PURE SHARP MODE — Deterministic compositing
    if (usePureSharp) {
      if (extraOptions?.productSlot) {
        console.log(`[AI-ROUTER] 📸 Visual provider: Pure Sharp — Deterministic product placement (no AI cost)`);
        try {
          const result = await compositePureSharp(
            imageSource,
            productRefImage,
            gptImageSize,
            extraOptions.productSlot,
            extraOptions.cleanedTemplateBase64,
          );
          console.log(`[AI COST AUDIT] ✅ Pure Sharp composite SUCCESS — $0 AI cost`);
          return result;
        } catch (err: any) {
          console.error(`[AI-ROUTER] ❌ Pure Sharp failed: ${err.message}`);
          // Fallback: try FLUX if FAL_KEY is available
          if (process.env.FAL_KEY) {
            console.log(`[AI-ROUTER] 🔄 Falling back to FLUX after Pure Sharp failure...`);
            try {
              const fluxResult = await fluxProvider.renderVisual(
                promptText, imageSource, productRefImage,
                maskFile, gptImageSize, useCompositingMode, extraOptions
              );
              console.log(`[AI COST AUDIT] ✅ FLUX fallback after Sharp SUCCESS`);
              return fluxResult;
            } catch (fluxErr: any) {
              console.error(`[AI-ROUTER] ❌ FLUX fallback also failed: ${fluxErr.message}`);
            }
          }
          throw new Error(`Banner generation failed: Sharp compositing error (${err.message}). Ensure product_slot is defined in template JSON.`);
        }
      } else {
        // No product_slot — Sharp can't composite. Try FLUX, then return template as-is.
        console.warn(`[AI-ROUTER] ⚠️ PURE_SHARP_MODE active but template has NO product_slot — cannot composite product`);
        if (process.env.FAL_KEY) {
          console.log(`[AI-ROUTER] 🔄 Falling back to FLUX (template has no product_slot for Sharp)...`);
          try {
            const fluxResult = await fluxProvider.renderVisual(
              promptText, imageSource, productRefImage,
              maskFile, gptImageSize, useCompositingMode, extraOptions
            );
            console.log(`[AI COST AUDIT] ✅ FLUX render SUCCESS (no product_slot)`);
            return fluxResult;
          } catch (fluxErr: any) {
            console.error(`[AI-ROUTER] ❌ FLUX also failed: ${fluxErr.message}`);
          }
        }
        // Last resort: return template image as-is (no product to insert)
        console.warn(`[AI-ROUTER] ⚠️ Returning template as-is — no product_slot defined and no FLUX available`);
        // Convert template to base64 and return
        try {
          const templateResponse = await fetch(imageSource);
          if (templateResponse.ok) {
            const buf = Buffer.from(await templateResponse.arrayBuffer());
            return { base64: buf.toString('base64'), provider: 'template-passthrough-no-slot' };
          }
        } catch {}
        throw new Error('Template has no product_slot. Define product_slot in the template JSON to enable Sharp compositing.');
      }
    }

    // CASE 2: FLUX MODE
    if (useFlux) {
      console.log(`[AI-ROUTER] 🎨 Visual provider: FLUX (fal.ai) — OpenAI fallback BLOCKED`);
      try {
        const result = await fluxProvider.renderVisual(
          promptText, imageSource, productRefImage,
          maskFile, gptImageSize, useCompositingMode, extraOptions
        );
        console.log(`[AI COST AUDIT] ✅ FLUX render SUCCESS — $0 OpenAI cost`);
        return result;
      } catch (err: any) {
        console.error(`[AI-ROUTER] ❌ FLUX FAILED: ${err.message} — OpenAI fallback BLOCKED`);
        throw new Error(`FLUX render failed: ${err.message}. OpenAI fallback is BLOCKED. Fix FLUX or switch provider in admin.`);
      }
    }

    // CASE 3: OpenAI — ONLY if explicitly selected AND key is valid
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey || !openaiKey.startsWith('sk-') || openaiKey.length < 20) {
      throw new Error('No visual provider available. Configure product_slot in template for Sharp mode, or set FAL_KEY for FLUX mode. OpenAI is not configured.');
    }
    console.log(`[AI-ROUTER] 🎨 Visual provider: OpenAI gpt-image-1 (explicitly selected)`);
    return openaiProvider.renderVisual(
      promptText, imageSource, productRefImage,
      maskFile, gptImageSize, useCompositingMode
    );
  },

  async runQA(
    templatePreviewUrl: string,
    product_image: string,
    base64Image: string,
    prompt: string,
    environmentPalette: any,
    adaptedColors: any,
    useCompositingMode: boolean,
    textSlotContent: any,
    productAnalysis: any
  ): Promise<QAResults> {
    if (shouldUseGroq()) {
      return groqProvider.runQA(
        templatePreviewUrl,
        product_image,
        base64Image,
        prompt,
        environmentPalette,
        adaptedColors,
        useCompositingMode,
        textSlotContent,
        productAnalysis
      );
    }
    return openaiProvider.runQA(
      templatePreviewUrl,
      product_image,
      base64Image,
      prompt,
      environmentPalette,
      adaptedColors,
      useCompositingMode,
      textSlotContent,
      productAnalysis
    );
  }
};
