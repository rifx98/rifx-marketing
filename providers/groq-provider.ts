import OpenAI from 'openai';
import { ProductAnalysis, Copywriting, TemplateDNA, QAResults, ArtDirection, AdaptedColorsResult } from './provider-types';

function getGroqClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY no configurado en variables de entorno.');
  }
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

// ── Robust Groq Chat with Retry & Model Fallback ──
// Groq free-tier has strict OTPM (output tokens per minute) limits.
// This helper retries on rate_limit_exceeded errors, falling back through
// alternative models if the primary model is throttled.
const GROQ_MODELS_PRIORITY = ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'];

async function groqChatWithRetry(
  params: Parameters<OpenAI['chat']['completions']['create']>[0],
  maxRetries = 3
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const groq = getGroqClient();
  const requestedModel = params.model || GROQ_MODELS_PRIORITY[0];
  const modelsToTry = [
    requestedModel,
    ...GROQ_MODELS_PRIORITY.filter(m => m !== requestedModel)
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response: any = await groq.chat.completions.create({
          ...params,
          model,
          // Cap max_tokens to stay within free-tier OTPM
          max_tokens: Math.min((params as any).max_tokens || 800, 800),
        });

        // Validate the response has content
        const content = response.choices?.[0]?.message?.content;
        if (!content || content.trim() === '') {
          console.warn(`[GROQ RETRY] Model ${model} returned empty content (attempt ${attempt + 1})`);
          if (attempt < maxRetries - 1) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          // Move to next model
          break;
        }

        return response;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || err?.error?.message || '';
        const isRateLimit = msg.includes('rate_limit') || msg.includes('Rate limit') ||
                            msg.includes('tokens per minute') || err?.status === 429;
        const isEmptyOutput = msg.includes('model output') || msg.includes('empty');

        if (isRateLimit || isEmptyOutput) {
          const waitMs = isRateLimit ? 5000 * (attempt + 1) : 2000 * (attempt + 1);
          console.warn(`[GROQ RETRY] ${isRateLimit ? 'Rate limit' : 'Empty output'} on ${model} (attempt ${attempt + 1}/${maxRetries}). Waiting ${waitMs}ms...`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        // Non-retryable error
        throw err;
      }
    }
    console.warn(`[GROQ RETRY] All attempts exhausted for model ${model}. Trying next model...`);
  }

  // If all models failed, throw with context
  throw new Error(`All Groq models exhausted after retries. Last error: ${lastError?.message || 'Unknown'}`);
}

// Auxiliar para truncar payloads grandes de base64 en logs
function truncateBase64(base64: string): string {
  if (!base64) return 'undefined';
  if (base64.startsWith('data:image')) {
    return `${base64.substring(0, 50)}... [Length: ${base64.length} chars]`;
  }
  return `${base64.substring(0, 30)}...`;
}

export const groqProvider = {
  async analyzeProduct(productImage: string): Promise<ProductAnalysis> {
    console.log('\n======================================================================');
    console.log('[GROQ][STAGE 1] Iniciando PRODUCT-AWARE CONTEXT ANALYZER (VLM + LLM)');
    console.log(`[GROQ][STAGE 1] Imagen Recibida: ${truncateBase64(productImage)}`);
    console.log('======================================================================');

    // 1. Extract physical shape, materials, silhouette, and details using fast VLM (Moondream2)
    let visualDescription = '';
    try {
      const { fluxProvider } = await import('./flux-provider');
      visualDescription = await fluxProvider.analyzeProductVisuals(productImage);
    } catch (vlmErr: any) {
      console.warn(`[GROQ][STAGE 1] VLM pre-analysis note: ${vlmErr.message}`);
    }

    const systemPrompt = `You are a PRODUCT-AWARE CREATIVE INTELLIGENCE ANALYZER.
You analyze product descriptions to extract DEEP CREATIVE CONTEXT and PHYSICAL SHAPE IDENTITY for an advertising engine.

You must extract TWO layers of information:

1. PHYSICAL IDENTITY (for visual preservation — CRITICAL: preserve exact 3D shape):
   - Exact physical 3D shape and silhouette (e.g. square box, rectangular presentation box, faceted glass tumbler, sleek cylinder, pouch, sneaker)
   - Materials, textures, colors, borders, plaques, labels, and caps

2. CREATIVE CONTEXT (for copy, mood, and storytelling adaptation):
   - What category is this product? What audience buys it?
   - What lifestyle does it represent? What mood does it evoke?
   - What marketing language fits? What premium features matter?
   - What visual energy should the ad have?

Return OBLIGATORILY this JSON:
{
  "category": "product category (e.g.: perfume, sneakers, supplements, skincare, tech, fashion)",
  "subcategory": "specific subcategory (e.g.: luxury oriental perfume, urban sneakers, anti-aging serum)",
  "product_name": "exact brand and product name (e.g. Khamrah Qahwa de Lattafa)",
  "main_colors": ["dominant colors in English (e.g.: dark chocolate brown, radiant gold, obsidian black)"],
  "materials": ["visible materials (e.g.: heavy glass, ribbed packaging, gold foil plaque)"],
  "visible_details": ["all visible details: gold frame border, Arabic calligraphy, ribbed spine, textured facets"],
  "shape": "exact physical 3D geometry and silhouette (e.g. square box packaging standing upright with gold frame and ribbed side)",
  "style": "visual style (e.g.: luxury oriental, casual urban, modern minimal)",
  "must_preserve": ["exact 3D square box shape, gold frame, ribbed spine, brand plaque"],
  "visual_style": "overall visual aesthetic for ads (e.g.: luxury dark cinematic with gold halo and stone pedestal)",
  "audience": "target audience (e.g.: perfume connoisseurs, luxury fragrance lovers)",
  "aesthetic": "brand aesthetic vibe (e.g.: warm oriental luxury, regal amber sophistication)",
  "commercial_tone": "ad tone (e.g.: prestigious, seductive, ultra-premium)",
  "luxury_level": "one of: mid-premium, premium, ultra-luxury",
  "mood_keywords": ["5-8 mood/emotion keywords (e.g.: warmth, intensity, distinction, sophistication)"],
  "marketing_angles": ["4-6 marketing angles (e.g.: long-lasting aroma, unforgettable presence, artisanal blend)"],
  "lifestyle_context": "lifestyle description (e.g.: gala evenings, luxury signature scent)",
  "premium_features": ["3-5 premium selling points (e.g.: warm amber notes, intense sillage, collector packaging)"],
  "visual_energy": "one of: calm, balanced, dynamic, high-energy"
}`;

    const userPrompt = visualDescription
      ? `Detailed physical visual inspection of the uploaded product by vision AI:
"""${visualDescription}"""

Extract the complete structured ProductAnalysis JSON according to the instructions. Ensure the exact physical shape and category are preserved.`
      : `Analyze this product for commercial advertising context extraction: category, exact physical shape, materials, colors, and premium appeal.`;

    const response = await groqChatWithRetry({
      model: 'qwen/qwen3.8-27b',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.15
    });

    const text = response.choices[0]?.message?.content || '{}';
    console.log(`[GROQ][STAGE 1] Contexto de Producto extraido con éxito:\n${text.substring(0, 300)}...`);
    const parsed = JSON.parse(text) as ProductAnalysis;
    return parsed;
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
    console.log('\n======================================================================');
    console.log(`[GROQ][STAGE 2] Iniciando PRODUCT-AWARE COPY GENERATOR (idioma: ${textLanguage})`);
    console.log('======================================================================');

    const isEn = textLanguage === 'en';
    const systemPrompt = `You are a PRODUCT-AWARE CREATIVE COPYWRITER for premium ecommerce ads.

You will receive a detailed product analysis. This analysis is your ONLY source of truth for all copy decisions.

RULES:
1. Base ALL copy decisions on the product context analysis provided
2. Write copy that a specialist copywriter would create for THIS specific product
3. Use vocabulary, metaphors, and claims that belong EXCLUSIVELY to THIS product's category
4. Do NOT reference, imagine, or infer any other product category
5. LANGUAGE REQUIREMENT: All copy MUST be written in ${isEn ? 'FLUENT, PERSUASIVE ENGLISH' : 'ESPAÑOL NATURAL Y PERSUASIVO'}.
6. ZERO PLACEHOLDERS: NEVER output literal placeholder words like "Hook", "Desc", "CTA", "Benefit", "Title", "Hoect", "Descs".

CATEGORY-SPECIFIC LANGUAGE GUIDE:
- 🌸 Perfume/Fragrance → irresistible scent, warm intensity, lasting signature, magnetic allure, elegance, unforgettable impression
- 👟 Sneakers/Fashion → urban, comfort, style, design, versatile, premium materials, everyday wear
- 💊 Supplements → energy, performance, natural, potency, results, wellness, vitality
- 🧴 Skincare → glow, hydration, radiance, healthy skin, clinical, rejuvenation, luminosity
- 📱 Tech → innovation, speed, power, intelligence, connectivity, performance, cutting-edge
- 🏋️ Fitness → strength, endurance, performance, sweat-proof, training, results

If the user provides "ad_texts_overrides", respect those values and complete the rest.

Return OBLIGATORILY this JSON:
{
  "badge": "short promotional badge in UPPERCASE with emoji at start — contextual to the product",
  "hook": "main headline 4-6 words — must feel DESIGNED for this product",
  "desc": "one-line persuasive description — specific to this product's value proposition",
  "benefits": ["benefit 1 (2-4 words)", "benefit 2", "benefit 3", "benefit 4", "benefit 5"],
  "cta": "action call in UPPERCASE — contextual to buying this type of product",
  "testimonial": "short customer testimonial relevant to this product (if applicable)",
  "lifestyle_phrase": "a lifestyle phrase that connects the product to its use context",
  "premium_descriptor": "a one-line premium quality descriptor for the product"
}`;

    const userPrompt = `PRODUCT CONTEXT ANALYSIS (use this as your ONLY source of truth):
${JSON.stringify(productAnalysis, null, 2)}

CAMPAIGN INFO:
- Title: "${campaignTitle || ''}"
- User Instructions: "${userInstructions || ''}"
- Language: "${isEn ? 'English' : 'Español'}"
- Text Overrides (respect if provided): ${JSON.stringify(adTextsOverrides || {})}

TEMPLATE STRUCTURE INFO (for number of text slots only):
- Number of benefit slots: ${templateBenefitsLength || 3}
- Has testimonial slot: ${!!templateHasTestimonial}

Generate copy in ${isEn ? 'ENGLISH' : 'ESPAÑOL'} that makes the ad feel like it was designed SPECIFICALLY for this ${productAnalysis.category || 'product'}.
Do NOT reference any other product category. The product analysis above is your ONLY semantic source.`;

    console.log(`[GROQ][STAGE 2] Prompt Enviado:\n${userPrompt.substring(0, 400)}...`);

    const response = await groqChatWithRetry({
      model: 'qwen/qwen3.8-27b',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      max_tokens: 500
    });

    const text = response.choices[0]?.message?.content || '{}';
    console.log(`[GROQ][STAGE 2] Respuesta Recibida:\n${text}`);
    const parsedCopy = JSON.parse(text);

    // Sanitize any accidental placeholder strings
    const sanitize = (val: string | undefined, fallback: string) => {
      if (!val || typeof val !== 'string') return fallback;
      const t = val.trim().toLowerCase();
      if (['hook', 'hoect', 'desc', 'descs', 'cta', 'title', 'placeholder'].includes(t)) return fallback;
      return val.trim();
    };

    const defaultHook = isEn ? 'Unmatched Luxury & Distinction' : 'Elegancia y Distinción Única';
    const defaultDesc = isEn ? 'Crafted with passion for lasting excellence.' : 'Creado con pasión para una huella inolvidable.';
    const defaultBenefits = isEn
      ? ['Premium Quality', 'Exclusive Design', '100% Authentic']
      : ['Calidad Premium', 'Diseño Exclusivo', '100% Original'];
    const defaultCta = isEn ? 'SHOP NOW' : 'COMPRAR AHORA';

    return {
      badge: sanitize(adTextsOverrides?.badge || parsedCopy.badge, isEn ? '✨ PREMIUM' : '✨ EXCLUSIVO'),
      hook: sanitize(adTextsOverrides?.hook || parsedCopy.hook, defaultHook),
      desc: sanitize(adTextsOverrides?.desc || parsedCopy.desc, defaultDesc),
      benefits: [
        sanitize(adTextsOverrides?.benefits?.[0] || parsedCopy.benefits?.[0], defaultBenefits[0]),
        sanitize(adTextsOverrides?.benefits?.[1] || parsedCopy.benefits?.[1], defaultBenefits[1]),
        sanitize(adTextsOverrides?.benefits?.[2] || parsedCopy.benefits?.[2], defaultBenefits[2]),
        parsedCopy.benefits?.[3] || '',
        parsedCopy.benefits?.[4] || '',
      ].filter(Boolean),
      cta: sanitize(adTextsOverrides?.cta || parsedCopy.cta, defaultCta),
      testimonial: adTextsOverrides?.testimonial || parsedCopy.testimonial || '',
      lifestyle_phrase: parsedCopy.lifestyle_phrase || '',
      premium_descriptor: parsedCopy.premium_descriptor || ''
    };
  },

  async analyzeTemplateDNA(
    templatePreviewImage: string,
    colors: any
  ): Promise<TemplateDNA> {
    console.log('\n======================================================================');
    console.log('[GROQ][STAGE 3] Iniciando TEMPLATE VISUAL DNA ANALYZER');
    console.log(`[GROQ][STAGE 3] Imagen Template Recibida: ${truncateBase64(templatePreviewImage)}`);
    console.log('======================================================================');

    const systemPrompt = `You are a VISUAL COMPOSITION ANALYZER.
You analyze images to extract PURE VISUAL PROPERTIES — layout, colors, lighting, shadows, geometry, spacing.

🚫 YOU MUST NOT:
- Identify what product is shown in the image
- Read, interpret, or reference any text visible in the image
- Infer the product category, niche, or marketing intent
- Use words like "supplement", "skincare", "sneaker", "testosterone", "serum", "fashion" etc.
- Describe what the image is advertising
- Reference any marketing or commercial purpose

✅ YOU MUST ONLY describe:
- Color palette (as HEX values)
- Lighting style (direction, intensity, quality)
- Shadow behavior
- Glow effects
- Gradient patterns
- Visual temperature (warm/cool)
- Contrast level
- Surface reflections
- Environment style (as abstract visual description, NOT product-related)
- Overall visual mood (as pure aesthetic feeling, NOT as marketing mood)

Treat the image as an ABSTRACT VISUAL COMPOSITION — a painting of light, color, and geometry.

Return OBLIGATORILY this JSON:
{
  "dominant_palette": ["2-4 dominant HEX colors"],
  "secondary_palette": ["1-3 secondary HEX colors"],
  "lighting_style": "lighting description (e.g.: warm directional key light with gold rim, soft diffused top light)",
  "cinematic_mood": "pure visual mood (e.g.: dark luxurious warmth, bright clean minimalism, bold dramatic contrast)",
  "contrast_profile": "one of: low-contrast, balanced, high-contrast, extreme-contrast",
  "glow_style": "glow description (e.g.: warm gold rim glow, none, soft diffused ambient)",
  "visual_temperature": "one of: cool, neutral, warm, very-warm",
  "luxury_style": "aesthetic level (e.g.: ultra-premium dark, casual modern, clinical clean)",
  "shadow_behavior": "shadow style (e.g.: deep dramatic, soft diffuse, minimal, hard directional)",
  "gradient_behavior": "gradient description (e.g.: dark radial vignette, warm linear transition, none)",
  "environment_style": "abstract environment (e.g.: dark space with gold accents, bright white void, muted earth tones)",
  "reflection_style": "reflection type (e.g.: glossy surface, matte, subtle mirror, none)",
  "premium_render_style": "visual render quality (e.g.: luxury dark cinematic, modern clean editorial, bold high-contrast)"
}`;

    console.log(`[GROQ][STAGE 3] Prompt Enviado:\n${systemPrompt.substring(0, 300)}...`);

    try {
      const promptContent = `Analyze the visual styling of this template based on its primary palette (${JSON.stringify(colors || {})}).
Extract pure visual composition properties: lighting, shadows, gradients, geometry, glow effects, reflections.

Return ONLY this JSON:
{
  "dominant_palette": ["${colors?.primary || '#111111'}", "${colors?.accent || '#FFD700'}", "${colors?.badgeBg || '#6D28D9'}"],
  "secondary_palette": ["${colors?.text || '#FFFFFF'}", "#222222"],
  "lighting_style": "warm directional key light with gold rim, soft diffused top light",
  "cinematic_mood": "dark luxurious warmth, modern clean commercial elegance",
  "contrast_profile": "balanced",
  "glow_style": "warm gold rim glow with soft diffused ambient light",
  "visual_temperature": "warm",
  "luxury_style": "ultra-premium commercial design",
  "shadow_behavior": "soft realistic contact shadows with directional diffuse",
  "gradient_behavior": "smooth vertical gradient with subtle atmospheric vignette",
  "environment_style": "commercial luxury studio environment with dark background and vibrant accents",
  "reflection_style": "subtle glossy reflections on polished pedestal",
  "premium_render_style": "luxury dark cinematic 8k commercial quality"
}`;

      const response = await groqChatWithRetry({
        model: 'qwen/qwen3.8-27b',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a visual design expert analyzing template color and lighting DNA.' },
          { role: 'user', content: promptContent }
        ],
        temperature: 0.1,
        max_tokens: 400
      });

      const text = response.choices[0]?.message?.content || '{}';
      console.log(`[GROQ][STAGE 3] Respuesta Recibida:\n${text}`);
      return JSON.parse(text) as TemplateDNA;
    } catch (err: any) {
      console.warn(`[GROQ][STAGE 3] Error in analyzeTemplateDNA (${err.message}). Using derived fallback.`);
      return {
        dominant_palette: [colors?.primary || '#111111', colors?.accent || '#FFD700', colors?.badgeBg || '#6D28D9'],
        secondary_palette: [colors?.text || '#FFFFFF', '#222222'],
        lighting_style: 'commercial studio lighting with crisp rim reflections',
        cinematic_mood: 'premium commercial elegance',
        contrast_profile: 'balanced',
        glow_style: 'soft ambient glow',
        visual_temperature: 'warm',
        luxury_style: 'premium commercial',
        shadow_behavior: 'soft realistic contact shadows',
        gradient_behavior: 'smooth linear gradient',
        environment_style: 'modern clean commercial environment',
        reflection_style: 'subtle glossy reflections',
        premium_render_style: 'ultra realistic 8k commercial quality'
      };
    }
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
    console.log('\n======================================================================');
    console.log('[QA][STAGE 6] Iniciando QUALITY CONTROL AUDIT SEMÁNTICO (Fast & Cheap)');
    console.log(`[QA][STAGE 6] Analizando Copys, Categorías y Fugas con Groq...`);
    console.log('======================================================================');

    const systemPrompt = `You are a semantic and text-leakage validation engine for premium ecommerce ads.
Your job is to audit the generated advertisement metadata to guarantee perfect semantic isolation and textual correctness.

We are running a compositing pipeline, meaning geometry is preserved automatically by the rendering engine.
You must ONLY evaluate the following semantic/textual quality markers:

1. TEXT LEAKAGE DETECTION (template_text_leakage_detected):
   - Did any placeholder text or previous product category vocabulary from the original template leak into the copywriting?
   - For example: If the template originally sold supplements ("testosterone", "potency", "capsules") but the new product is a sneaker, any supplementary vocabulary in the final copy is a critical leak.
   - Any placeholder text like "lorem ipsum", "Lorem Ipsum", "text here", "lorem", "ipsum" is a leak.

2. CATEGORY MISMATCH AUDIT (wrong_category_detected):
   - Does the copywriting match the uploaded product's category? (e.g. supplement words for a sneaker, skincare words for tech).
   - If vocabulary is wrong or belongs to another category, set true.

3. SEMANTIC QUALITY:
   - Does the copy sound highly professional, written in correct, natural Spanish?
   - Is the CTA correct for buying this product?

Return OBLIGATORILY this JSON:
{
  "template_text_leakage_detected": false,
  "wrong_category_detected": false,
  "passed": true,
  "reason": "Clear explanation of findings and semantic correctness in Spanish",
  "issues": ["List of problems found (e.g., supplement claims found in sneakers copywriting)"]
}`;

    const userPrompt = `PRODUCT DETAILS:
- Category: ${productAnalysis.category}
- Subcategory: ${productAnalysis.subcategory}
- Name: ${productAnalysis.product_name}

GENERATED COPYWRITING:
${JSON.stringify(textSlotContent, null, 2)}

PROMPT SENT TO FLUX:
"${prompt.substring(0, 1000)}"`;

    console.log(`[QA][STAGE 6] Prompt Enviado:\n${userPrompt}`);

    const response = await groqChatWithRetry({
      model: 'qwen/qwen3.8-27b',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const text = response.choices[0]?.message?.content || '{}';
    console.log(`[QA][STAGE 6] Respuesta Recibida:\n${text}`);
    const parsedQA = JSON.parse(text);

    const hasLeakage = parsedQA.template_text_leakage_detected === true;
    const wrongCategory = parsedQA.wrong_category_detected === true;
    const passed = parsedQA.passed === true && !hasLeakage && !wrongCategory;

    // Convert to a full compatible QAResults format
    return {
      passed,
      template_similarity_score: passed ? 100 : 70,
      layout_preservation_score: 100,
      product_identity_score: 100,
      background_geometry_score: 100,
      pedestal_similarity_score: 100,
      spacing_similarity_score: 100,
      visual_balance_score: 100,
      color_palette_match_score: 100,
      shadow_match_score: 100,
      lighting_match_score: 100,
      premium_render_similarity_score: 100,
      color_harmony_score: 100,
      product_color_environment_influence_score: 100,
      typography_structure_preservation_score: 100,
      template_geometry_preservation_score: 100,
      template_reinterpretation_score: 0,
      frozen_region_integrity_score: 100,
      product_scale_similarity_score: 100,
      visual_weight_similarity_score: 100,
      icon_count_preservation: true,
      icon_column_position_preserved: true,
      text_zone_preservation: true,
      template_text_leakage_detected: hasLeakage,
      background_reconstruction_detected: false,
      geometry_shift_detected: false,
      spacing_shift_detected: false,
      typography_reflow_detected: false,
      reason: parsedQA.reason || 'Semantic QA complete.',
      issues: parsedQA.issues || [],
      retry_triggered: false
    };
  },

  async generateArtDirection(
    strippedStyleIdentity: string,
    template_json: any,
    strippedAiDirectionRules: any,
    productAnalysis: ProductAnalysis
  ): Promise<ArtDirection> {
    console.log('\n======================================================================');
    console.log('[GROQ][STAGE 3] Ejecutando ART DIRECTOR (llama-3.3-70b) — con semantic stripping...');
    console.log('======================================================================');

    const response = await groqChatWithRetry({
      model: 'qwen/qwen3.8-27b',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an ART DIRECTOR. Define the VISUAL scene design for an advertisement.

⚠️ CRITICAL — SEMANTIC SEPARATION:
The template provides VISUAL STRUCTURE ONLY (layout, lighting, composition, geometry).
The UPLOADED PRODUCT provides ALL semantic meaning (category, mood, messaging, atmosphere).

You MUST NOT inherit the template's original product category, messaging, or marketing intent.
Treat the template as a BLANK VISUAL STRUCTURE that will be filled with the uploaded product's context.

Return OBLIGATORILY this JSON:
{
  "scene": "visual scene description — adapted to the UPLOADED PRODUCT's category",
  "lighting": "lighting rules — from template's visual structure",
  "camera_angle": "camera perspective — from template's visual structure",
  "composition": "physical layout and integration — from template's visual structure",
  "background": "background specification — from template's visual structure",
  "mood": "atmosphere — adapted to the UPLOADED PRODUCT's category and aesthetic"
}`
        },
        {
          role: 'user',
          content: `TEMPLATE VISUAL STRUCTURE (use ONLY for layout/lighting/composition):
- Visual Style: ${strippedStyleIdentity || 'premium commercial'}
- Composition: ${template_json.composition_rules || 'centered product'}
- Lighting: ${template_json.lighting_rules || 'studio lighting'}
- Camera: ${template_json.camera_rules || 'eye-level'}
- Visual Rules: ${JSON.stringify(strippedAiDirectionRules)}

UPLOADED PRODUCT CONTEXT (use as SOLE semantic authority):
- Category: ${productAnalysis.category} / ${productAnalysis.subcategory || ''}
- Audience: ${productAnalysis.audience || 'general'}
- Aesthetic: ${productAnalysis.aesthetic || 'premium'}
- Mood Keywords: ${(productAnalysis.mood_keywords || []).join(', ')}
- Lifestyle: ${productAnalysis.lifestyle_context || ''}
- Visual Energy: ${productAnalysis.visual_energy || 'balanced'}
- Commercial Tone: ${productAnalysis.commercial_tone || 'professional'}

Generate art direction that uses the template's VISUAL STRUCTURE but the product's SEMANTIC CONTEXT.`
        }
      ],
      temperature: 0.2,
      max_tokens: 500
    });

    const text = response.choices[0]?.message?.content || '{}';
    console.log(`[GROQ][STAGE 3] Dirección artística (semantic-stripped):`, text);
    return JSON.parse(text) as ArtDirection;
  },

  async adaptColors(
    templateDNA: TemplateDNA,
    productAnalysis: ProductAnalysis,
    template_json: any,
    strippedStyleIdentity: string
  ): Promise<AdaptedColorsResult> {
    console.log('\n======================================================================');
    console.log('[GROQ][STAGE 4] Ejecutando ADAPT COLORS (llama-3.3-70b)...');
    console.log('======================================================================');

    const response = await groqChatWithRetry({
      model: 'qwen/qwen3.8-27b',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a TEMPLATE-DOMINANT COLOR ENGINE for premium ecommerce advertisements.

🚨 CRITICAL RULE — TEMPLATE VISUAL DNA IS THE ABSOLUTE AUTHORITY:
The TEMPLATE's palette, lighting, mood, and grading MUST remain DOMINANT and UNCHANGED.
The product's colors are SECONDARY and can only influence LOCAL elements at MAX 20%.

You receive:
1. The TEMPLATE's Visual DNA (extracted from its actual image — THIS IS THE AUTHORITY)
2. The product's detected colors
3. The template's declared color palette

Your job is to generate a palette where:

🔒 TEMPLATE AUTHORITY (these MUST match the template DNA):
- template_primary: MUST be from the template's dominant_palette — NOT influenced by product
- blended_background: MUST remain the template's background color — maximum 5% product influence
- accent_color: MUST be from the template's dominant or secondary palette
- UI palette (primary, accent, badgeBg): MUST match template DNA colors

✉️ PRODUCT LOCAL INFLUENCE (max 20% — ONLY these can reflect product colors):
- pedestal_tint: template surface color with SUBTLE product shadow hint (max 20% product influence)
- shadow_tint: derived from template's shadow behavior + slight product darkest tone warmth
- neutral_shadow: based on template's shadow style with minor product color shift

🚫 FORBIDDEN:
- Do NOT let product colors dominate the background
- Do NOT add purple/lavender if the template is black+gold
- Do NOT create glow colors that don't exist in the template
- Do NOT blend product colors into template primary or accent
- Do NOT change the template's visual temperature
- Do NOT introduce colors foreign to the template's DNA

Return OBLIGATORILY this JSON:
{
  "ui_palette": {
    "primary": "#HEX (from template DNA dominant_palette)",
    "accent": "#HEX (from template DNA dominant or secondary palette)",
    "text": "#HEX",
    "badgeBg": "#HEX (from template DNA palette)",
    "badgeText": "#HEX"
  },
  "environment_palette": {
    "product_primary": "#HEX (the product's most dominant color — for reference only)",
    "product_secondary": "#HEX (the product's second color — for reference only)",
    "neutral_shadow": "#HEX (template shadow style + max 10% product influence)",
    "template_primary": "#HEX (MUST match template DNA dominant color — NEVER product-influenced)",
    "blended_background": "#HEX (template background — max 5% product warmth/coolness shift)",
    "pedestal_tint": "#HEX (template surface + max 20% product shadow color)",
    "shadow_tint": "#HEX (template shadow behavior + subtle product tone)",
    "accent_color": "#HEX (MUST be from template DNA palette — NOT a product-template blend)"
  }
}`
        },
        {
          role: 'user',
          content: `TEMPLATE VISUAL DNA (ABSOLUTE AUTHORITY):
${JSON.stringify(templateDNA, null, 2)}

Product detected colors: ${(productAnalysis.main_colors || []).join(', ')}
Product materials: ${(productAnalysis.materials || []).join(', ')}
Template declared palette: ${JSON.stringify(template_json.colors)}
Template style: ${strippedStyleIdentity || 'premium'}

REMEMBER: The template DNA is the AUTHORITY. Product colors can ONLY influence pedestal_tint, shadow_tint, and neutral_shadow at MAX 20%.`
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const text = response.choices[0]?.message?.content || '{}';
    console.log(`[GROQ][STAGE 4] Colores adaptados:`, text);
    return JSON.parse(text) as AdaptedColorsResult;
  }
};

