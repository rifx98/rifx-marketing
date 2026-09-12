import { openaiProvider } from './openai-provider';
import { groqProvider } from './groq-provider';
import { fluxProvider, compositePureSharp } from './flux-provider';
import { ProductAnalysis, Copywriting, TemplateDNA, QAResults, ArtDirection, AdaptedColorsResult } from './provider-types';
import { getAiCredential } from '@/lib/ai-request-context';

export { compositePureSharp };

// Helper: decide which text/analysis provider to use
// Priority: FORCE_OPENAI=true → OpenAI | GROQ_API_KEY present → Groq | fallback → OpenAI
function shouldUseGroq(): boolean {
  if (process.env.FORCE_OPENAI === 'true') return false;
  if (getAiCredential('groq')) return true;
  if (process.env.USE_GROQ === 'true') return true;
  return false;
}

export const aiRouter = {
  async analyzeProduct(productImage: string): Promise<ProductAnalysis> {
    if (shouldUseGroq()) {
      try {
        return await groqProvider.analyzeProduct(productImage);
      } catch (err: any) {
        console.warn(`[AI-ROUTER] ⚠️ Groq analyzeProduct failed (${err.message}) — falling back to OpenAI`);
        try {
          return await openaiProvider.analyzeProduct(productImage);
        } catch {
          throw err;
        }
      }
    }
    return openaiProvider.analyzeProduct(productImage);
  },

  async analyzeProductVisuals(productImage: string): Promise<string> {
    return fluxProvider.analyzeProductVisuals(productImage);
  },

  async generateCopy(
    productAnalysis: ProductAnalysis,
    campaignTitle: string,
    userInstructions: string,
    adTextsOverrides: any,
    templateBenefitsLength: number,
    templateHasTestimonial: boolean,
    textLanguage: 'es' | 'en' = 'es'
  ): Promise<Copywriting> {
    if (shouldUseGroq()) {
      return groqProvider.generateCopy(
        productAnalysis,
        campaignTitle,
        userInstructions,
        adTextsOverrides,
        templateBenefitsLength,
        templateHasTestimonial,
        textLanguage
      );
    }
    return openaiProvider.generateCopy(
      productAnalysis,
      campaignTitle,
      userInstructions,
      adTextsOverrides,
      templateBenefitsLength,
      templateHasTestimonial,
      textLanguage
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
    const falKey = getAiCredential('fal');
    const hasFalKey = !!(falKey && falKey.length >= 20 && !falKey.includes('[SENSITIVE]'));

    const usePureSharp =
      extraOptions?.pureSharpMode === true ||
      extraOptions?.visualProvider === 'sharp' ||
      (process.env.PURE_SHARP_MODE === 'true' && extraOptions?.visualProvider !== 'flux' && !hasFalKey);

    const useFlux =
      !usePureSharp &&
      (extraOptions?.visualProvider === 'flux' ||
      (hasFalKey && extraOptions?.visualProvider !== 'openai') ||
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
    // VISUAL RENDER ROUTING — Safe fallback to Pure Sharp
    // ═══════════════════════════════════════════════════════════════
    const effectiveSlot = (extraOptions?.productSlot && typeof extraOptions.productSlot.x === 'number')
      ? extraOptions.productSlot
      : { x: 0.5, y: 0.52, width: 0.58, height: 0.52, shape: 'rectangle' as const, padding: 0.05 };

    // CASE 1: PURE SHARP MODE — Deterministic compositing ($0 cost, fast, reliable)
    if (usePureSharp) {
      console.log(`[AI-ROUTER] 📸 Visual provider: Pure Sharp — Deterministic product placement ($0 costo)`);
      try {
        const result = await compositePureSharp(
          imageSource,
          productRefImage,
          gptImageSize,
          effectiveSlot,
          extraOptions?.cleanedTemplateBase64,
        );
        console.log(`[AI COST AUDIT] ✅ Pure Sharp composite SUCCESS — $0 AI cost`);
        return result;
      } catch (err: any) {
        console.error(`[AI-ROUTER] ❌ Pure Sharp failed: ${err.message}`);
        // Fallback: try FLUX if FAL_KEY is available
        const falKey = getAiCredential('fal');
        if (falKey && falKey.length >= 20 && !falKey.includes('[SENSITIVE]')) {
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
        throw new Error(`Banner generation failed: Sharp compositing error (${err.message}).`);
      }
    }

    // CASE 2: FLUX MODE
    if (useFlux) {
      const falKey = getAiCredential('fal');
      if (falKey && falKey.length >= 20 && !falKey.includes('[SENSITIVE]')) {
        console.log(`[AI-ROUTER] 🎨 Visual provider: FLUX (fal.ai)`);
        try {
          const result = await fluxProvider.renderVisual(
            promptText, imageSource, productRefImage,
            maskFile, gptImageSize, useCompositingMode, extraOptions
          );
          console.log(`[AI COST AUDIT] ✅ FLUX render SUCCESS`);
          return result;
        } catch (err: any) {
          console.warn(`[AI-ROUTER] ⚠️ FLUX falló (${err.message}) — fallback automático a Pure Sharp`);
        }
      } else {
        console.warn(`[AI-ROUTER] ⚠️ FLUX solicitado pero FAL_KEY no está configurado — fallback automático a Pure Sharp`);
      }

      return compositePureSharp(
        imageSource,
        productRefImage,
        gptImageSize,
        effectiveSlot,
        extraOptions?.cleanedTemplateBase64,
      );
    }

    // CASE 3: OpenAI — ONLY if key is valid, otherwise fallback to Pure Sharp
    const openaiKey = getAiCredential('openai');
    if (openaiKey && openaiKey.startsWith('sk-') && openaiKey.length > 20 && !openaiKey.includes('[SENSITIVE]')) {
      console.log(`[AI-ROUTER] 🎨 Visual provider: OpenAI gpt-image-1`);
      try {
        return await openaiProvider.renderVisual(
          promptText, imageSource, productRefImage,
          maskFile, gptImageSize, useCompositingMode
        );
      } catch (err: any) {
        console.warn(`[AI-ROUTER] ⚠️ OpenAI falló (${err.message}) — fallback automático a Pure Sharp`);
      }
    } else {
      console.warn(`[AI-ROUTER] ⚠️ OpenAI solicitado pero OPENAI_API_KEY no está configurada — fallback automático a Pure Sharp`);
    }

    // Ultimate fallback: Pure Sharp
    return compositePureSharp(
      imageSource,
      productRefImage,
      gptImageSize,
      effectiveSlot,
      extraOptions?.cleanedTemplateBase64,
    );
  },

  /**
   * Generates a complete creative ad with AI (matching ChatGPT quality)
   * Routing: fal-ai/ideogram/v2 or fal-ai/flux/dev or OpenAI DALL-E 3
   */
  async generateAdaptiveAd(
    promptText: string,
    aspectRatio: string = '4:5',
    options?: {
      visualProvider?: 'openai' | 'flux' | 'sharp';
      preferredModel?: 'ideogram' | 'flux';
      referenceImageUrl?: string;
      imageWeight?: number;
    }
  ): Promise<{ base64: string; provider: string }> {
    const falKey = getAiCredential('fal');
    const hasFalKey = !!(falKey && falKey.length >= 20 && !falKey.includes('[SENSITIVE]'));
    const openaiKey = getAiCredential('openai');
    const hasOpenaiKey = !!(openaiKey && openaiKey.startsWith('sk-') && openaiKey.length > 20 && !openaiKey.includes('[SENSITIVE]'));

    if (options?.visualProvider === 'openai' && hasOpenaiKey) {
      return openaiProvider.generateAdaptiveAd(promptText, aspectRatio);
    }

    if (hasFalKey && options?.visualProvider !== 'openai') {
      return fluxProvider.generateAdaptiveAd(promptText, aspectRatio, options);
    }

    if (hasOpenaiKey) {
      return openaiProvider.generateAdaptiveAd(promptText, aspectRatio);
    }

    if (hasFalKey) {
      return fluxProvider.generateAdaptiveAd(promptText, aspectRatio, options);
    }

    throw new Error('No hay claves API configuradas para generación con IA (fal.ai o OpenAI). Configura tu clave en el panel de configuración.');
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
  },

  async removeBackgroundBiRefNet(productImage: string): Promise<Buffer> {
    return fluxProvider.removeBackgroundBiRefNet(productImage);
  },
};
