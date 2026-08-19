import OpenAI from 'openai';
import { ProductAnalysis, Copywriting, TemplateDNA, QAResults, ArtDirection, AdaptedColorsResult } from './provider-types';
import { getAiCredential } from '@/lib/ai-request-context';

function getOpenAIClient(): OpenAI {
  const apiKey = getAiCredential('openai');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no configurado en variables de entorno.');
  }
  return new OpenAI({ apiKey });
}

export const openaiProvider = {
  async analyzeProduct(productImage: string): Promise<ProductAnalysis> {
    console.log('[OPENAI][STAGE 1] Iniciando análisis de producto con GPT-4o Vision...');
    const openai = getOpenAIClient();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a PRODUCT-AWARE CREATIVE INTELLIGENCE ANALYZER.
You analyze product images to extract DEEP CREATIVE CONTEXT for an advertising engine.

You must extract TWO layers of information:

1. PHYSICAL IDENTITY (for visual preservation):
   - Exact colors, materials, textures, shapes, details, logos, stitching, etc.

2. CREATIVE CONTEXT (for copy, mood, and storytelling adaptation):
   - What category is this product? What audience buys it?
   - What lifestyle does it represent? What mood does it evoke?
   - What marketing language fits? What premium features matter?
   - What visual energy should the ad have?

Return OBLIGATORILY this JSON:
{
  "category": "product category (e.g.: sneakers, supplements, skincare, tech, fashion)",
  "subcategory": "specific subcategory (e.g.: urban sneakers, testosterone booster, anti-aging serum)",
  "product_name": "short descriptive name",
  "main_colors": ["dominant colors in English (e.g.: black, dark brown, white)"],
  "materials": ["visible materials (e.g.: leather, rubber, glass, matte plastic)"],
  "visible_details": ["all visible small details: logos, stitching, textures, patterns"],
  "shape": "silhouette and proportions description",
  "style": "visual style (e.g.: casual urban, luxury minimal, sporty, clinical)",
  "must_preserve": ["specific details the image engine MUST NOT change"],
  "visual_style": "overall visual aesthetic for ads (e.g.: modern premium streetwear, clean clinical, bold sporty)",
  "audience": "target audience (e.g.: young urban adults, health-conscious men, professional women)",
  "aesthetic": "brand aesthetic vibe (e.g.: luxury urban, natural wellness, tech minimal)",
  "commercial_tone": "ad tone (e.g.: premium masculine, elegant feminine, bold youthful, clinical trust)",
  "luxury_level": "one of: budget, mid-range, mid-premium, premium, ultra-luxury",
  "mood_keywords": ["5-8 mood/emotion keywords (e.g.: urban, confident, comfortable, bold, modern)"],
  "marketing_angles": ["4-6 marketing angles (e.g.: all-day comfort, urban style, durability, modern design)"],
  "lifestyle_context": "lifestyle description (e.g.: city streets, gym lifestyle, morning skincare routine)",
  "premium_features": ["3-5 premium selling points (e.g.: genuine leather, cushioned insole, waterproof)"],
  "visual_energy": "one of: calm, balanced, dynamic, high-energy, explosive"
}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this product image for deep creative context extraction:' },
            { type: 'image_url', image_url: { url: productImage } }
          ]
        }
      ],
      temperature: 0.15
    });

    const text = response.choices[0]?.message?.content || '{}';
    return JSON.parse(text) as ProductAnalysis;
  },

  async generateCopy(
    productAnalysis: ProductAnalysis,
    campaignTitle: string,
    userInstructions: string,
    adTextsOverrides: any,
    templateBenefitsLength: number,
    templateHasTestimonial: boolean
  ): Promise<Copywriting> {
    console.log('[OPENAI][STAGE 2] Generando copy con GPT-4o...');
    const openai = getOpenAIClient();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a PRODUCT-AWARE CREATIVE COPYWRITER for premium ecommerce ads.

You will receive a detailed product analysis. This analysis is your ONLY source of truth for all copy decisions.

RULES:
1. Base ALL copy decisions on the product context analysis provided
2. Write copy that a specialist copywriter would create for THIS specific product
3. Use vocabulary, metaphors, and claims that belong EXCLUSIVELY to THIS product's category
4. Do NOT reference, imagine, or infer any other product category

CATEGORY-SPECIFIC LANGUAGE GUIDE:
- 👟 Sneakers/Fashion → urban, comfort, style, design, versatile, premium materials, everyday wear
- 💊 Supplements → energy, performance, natural, potency, results, wellness, vitality
- 🧴 Skincare → glow, hydration, radiance, healthy skin, clinical, rejuvenation, luminosity
- 📱 Tech → innovation, speed, power, intelligence, connectivity, performance, cutting-edge
- 🏋️ Fitness → strength, endurance, performance, sweat-proof, training, results
- 🍽️ Food/Beverage → flavor, artisanal, natural, fresh, indulgence, authentic, gourmet

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
}`
        },
        {
          role: 'user',
          content: `PRODUCT CONTEXT ANALYSIS (use this as your ONLY source of truth):
${JSON.stringify(productAnalysis, null, 2)}

CAMPAIGN INFO:
- Title: "${campaignTitle || ''}"
- User Instructions: "${userInstructions || ''}"
- Text Overrides (respect if provided): ${JSON.stringify(adTextsOverrides || {})}

TEMPLATE STRUCTURE INFO (for number of text slots only):
- Number of benefit slots: ${templateBenefitsLength || 3}
- Has testimonial slot: ${!!templateHasTestimonial}

Generate copy that makes the ad feel like it was designed SPECIFICALLY for this ${productAnalysis.category || 'product'}.
Do NOT reference any other product category. The product analysis above is your ONLY semantic source.`
        }
      ],
      temperature: 0.4
    });

    const text = response.choices[0]?.message?.content || '{}';
    const parsedCopy = JSON.parse(text);

    return {
      badge: adTextsOverrides?.badge || parsedCopy.badge || '✨ PREMIUM',
      hook: adTextsOverrides?.hook || parsedCopy.hook || 'Descubre lo Mejor',
      desc: adTextsOverrides?.desc || parsedCopy.desc || 'Calidad que se siente.',
      benefits: [
        adTextsOverrides?.benefits?.[0] || parsedCopy.benefits?.[0] || 'Calidad premium',
        adTextsOverrides?.benefits?.[1] || parsedCopy.benefits?.[1] || 'Diseño exclusivo',
        adTextsOverrides?.benefits?.[2] || parsedCopy.benefits?.[2] || 'Garantía oficial',
        parsedCopy.benefits?.[3] || '',
        parsedCopy.benefits?.[4] || '',
      ].filter(Boolean),
      cta: adTextsOverrides?.cta || parsedCopy.cta || 'COMPRAR AHORA',
      testimonial: adTextsOverrides?.testimonial || parsedCopy.testimonial || '',
      lifestyle_phrase: parsedCopy.lifestyle_phrase || '',
      premium_descriptor: parsedCopy.premium_descriptor || ''
    };
  },

  async analyzeTemplateDNA(
    templatePreviewImage: string,
    colors: any
  ): Promise<TemplateDNA> {
    console.log('[OPENAI][STAGE 2.5] Extrayendo Visual DNA con GPT-4o Vision...');
    const openai = getOpenAIClient();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a VISUAL COMPOSITION ANALYZER.
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
}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this VISUAL COMPOSITION. Extract ONLY visual properties: colors, lighting, shadows, gradients, geometry, spacing, glow effects, reflections. Do NOT identify or describe what product is shown. Do NOT read any text in the image. Treat it as an abstract visual structure:' },
            { type: 'image_url', image_url: { url: templatePreviewImage } }
          ]
        }
      ],
      temperature: 0.1
    });

    const text = response.choices[0]?.message?.content || '{}';
    return JSON.parse(text) as TemplateDNA;
  },

  async renderVisual(
    promptText: string,
    imageSource: string, // Base image (template)
    productRefImage: string, // Product ref image
    maskFile: any,
    gptImageSize: string,
    useCompositingMode: boolean
  ): Promise<{ base64: string; provider: string }> {
    console.log(`[OPENAI][STAGE 5] Generando render con gpt-image-1 (Compositing: ${useCompositingMode})...`);
    const openai = getOpenAIClient();

    const VALID_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
    type ValidImageMime = typeof VALID_IMAGE_MIMES[number];

    const detectMimeFromBase64 = (dataUri: string): ValidImageMime | null => {
      const match = dataUri.match(/^data:(image\/[a-zA-Z]+);base64,/);
      if (!match) return null;
      let mime = match[1].toLowerCase();
      if (mime === 'image/jpg') mime = 'image/jpeg';
      if (VALID_IMAGE_MIMES.includes(mime as ValidImageMime)) {
        return mime as ValidImageMime;
      }
      return null;
    };

    const inferMimeFromUrl = (url: string): ValidImageMime => {
      try {
        const pathname = new URL(url).pathname.toLowerCase();
        if (pathname.endsWith('.png')) return 'image/png';
        if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
        if (pathname.endsWith('.webp')) return 'image/webp';
      } catch (e) {}
      return 'image/png';
    };

    const filenameForMime = (baseName: string, mime: ValidImageMime): string => {
      const ext = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '.png';
      const withoutExt = baseName.replace(/\.(png|jpe?g|webp)$/i, '');
      return `${withoutExt}${ext}`;
    };

    const getFileFromInput = async (input: any, baseFilename: string): Promise<{ file: any; mime: string; filename: string }> => {
      if (input && typeof input !== 'string') {
        return { file: input, mime: input.type || 'image/png', filename: input.name || `${baseFilename}.png` };
      }

      let buffer: Buffer;
      let detectedMime: ValidImageMime;

      if (input.startsWith('data:image')) {
        const mime = detectMimeFromBase64(input);
        if (!mime) {
          throw new Error(`[getFileFromInput] MIME inválido o no soportado en base64 para "${baseFilename}". Solo se aceptan image/png, image/jpeg, image/webp.`);
        }
        detectedMime = mime;
        const base64Data = input.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else if (input.startsWith('http')) {
        const response = await fetch(input);
        if (!response.ok) {
          throw new Error(`[getFileFromInput] Fallo al descargar imagen desde URL (${response.status}): ${input.substring(0, 120)}`);
        }
        const contentType = (response.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
        const normalizedCt = contentType === 'image/jpg' ? 'image/jpeg' : contentType;

        if (VALID_IMAGE_MIMES.includes(normalizedCt as ValidImageMime)) {
          detectedMime = normalizedCt as ValidImageMime;
        } else {
          detectedMime = inferMimeFromUrl(input);
        }
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        throw new Error(`[getFileFromInput] Input para "${baseFilename}" debe ser base64 (data:image/...) o URL (http/https).`);
      }

      const finalFilename = filenameForMime(baseFilename, detectedMime);

      try {
        const { toFile } = await import('openai');
        const file = await toFile(buffer, finalFilename, { type: detectedMime });
        return { file, mime: detectedMime, filename: finalFilename };
      } catch (err: any) {
        console.warn(`⚠️ [getFileFromInput] Falló toFile (${err.message}), usando fallback de Blob.`);
        const blob = new Blob([new Uint8Array(buffer)], { type: detectedMime });
        const file: any = blob;
        file.name = finalFilename;
        return { file, mime: detectedMime, filename: finalFilename };
      }
    };

    let imageGeneration;

    // Resolve template/base image
    const templateResult = await getFileFromInput(imageSource, 'template_preview');
    // Resolve product reference image
    const productResult = await getFileFromInput(productRefImage, 'product');
    // Resolve mask image if present and is a string
    let resolvedMask = maskFile;
    if (maskFile && typeof maskFile === 'string') {
      const maskResult = await getFileFromInput(maskFile, 'mask');
      resolvedMask = maskResult.file;
    }

    if (useCompositingMode && resolvedMask) {
      const editPayload: any = {
        model: 'gpt-image-1',
        image: [templateResult.file, productResult.file],
        mask: resolvedMask,
        prompt: promptText,
        n: 1,
        size: gptImageSize,
        input_fidelity: 'high'
      };
      imageGeneration = await openai.images.edit(editPayload);
    } else if (imageSource && productRefImage) {
      const editPayload: any = {
        model: 'gpt-image-1',
        image: [templateResult.file, productResult.file],
        prompt: promptText,
        n: 1,
        size: gptImageSize,
        input_fidelity: 'high'
      };
      imageGeneration = await openai.images.edit(editPayload);
    } else {
      imageGeneration = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: promptText,
        n: 1,
        size: gptImageSize as any,
      });
    }

    const firstImage = imageGeneration.data?.[0];
    if (!firstImage) {
      throw new Error('La respuesta de OpenAI gpt-image-1 está vacía.');
    }

    let base64Result = '';
    if (firstImage.b64_json) {
      base64Result = `data:image/png;base64,${firstImage.b64_json}`;
    } else if (firstImage.url) {
      const r = await fetch(firstImage.url);
      const ab = await r.arrayBuffer();
      base64Result = `data:image/png;base64,${Buffer.from(ab).toString('base64')}`;
    }

    return { base64: base64Result, provider: 'openai-gpt-image-1' };
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
    console.log('[OPENAI][STAGE 6] Ejecutando QA estricto de tres imágenes con GPT-4o Vision...');
    const openai = getOpenAIClient();

    const userContent: any[] = [
      { type: 'text', text: 'Realiza la auditoría de diseño y composición. Compara las siguientes imágenes:' }
    ];

    if (templatePreviewUrl) {
      userContent.push({ type: 'text', text: 'IMAGEN 1: IMAGEN DE REFERENCIA DE LA PLANTILLA ORIGINAL (Plano de Diseño y Composición Rígida):' });
      userContent.push({ type: 'image_url', image_url: { url: templatePreviewUrl } });
    }

    userContent.push({ type: 'text', text: 'IMAGEN 2: IMAGEN DEL PRODUCTO ORIGINAL SUBIDO:' });
    userContent.push({ type: 'image_url', image_url: { url: product_image } });

    userContent.push({ type: 'text', text: 'IMAGEN 3: ANUNCIO PUBLICITARIO GENERADO FINAL (Resultado de la IA):' });
    userContent.push({ type: 'image_url', image_url: { url: base64Image } });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Actúas como un QUALITY CHECK (QA) engine de anuncios de IA sumamente estricto y profesional.
Tu tarea es auditar visualmente el ANUNCIO PUBLICITARIO GENERADO (Imagen 3) comparándolo minuciosamente contra la IMAGEN DE REFERENCIA DE LA PLANTILLA (Imagen 1) y la IMAGEN DEL PRODUCTO REAL (Imagen 2).

La plantilla (Imagen 1) es un BLUEPRINT O PLANO RÍGIDO de composición y diseño. El anuncio final (Imagen 3) debe respetar exactamente la diagramación, ubicación de zonas y geometría de la plantilla, pero reemplazando el producto por el Producto Real (Imagen 2) y adaptando los copys en español.

Debes evaluar visualmente y puntuar con extrema precisión técnica las siguientes 22 Métricas de Calidad.
Este es un sistema de EDICIÓN QUIRÚRGICA de plantillas. La Imagen 3 debe ser una EDICIÓN de Imagen 1, NO una recreación.

--- MÉTRICAS ESTRUCTURALES (UMBRAL ≥ 85) ---
1. TEMPLATE SIMILARITY SCORE (template_similarity_score): 0-100. Similitud visual general con la plantilla: look & feel, geometría de fondo, curvas, pedestales, degradados y atmósfera.
2. LAYOUT PRESERVATION SCORE (layout_preservation_score): 0-100. Fidelidad exacta de diagramación. ¿Producto y bloques de textos/íconos en las mismas coordenadas relativas?
3. PRODUCT IDENTITY SCORE (product_identity_score): 0-100. ¿Es EXACTAMENTE el mismo producto que Imagen 2, sin alterar silueta, costuras, marca, detalles o colores principales?
4. ICON COUNT PRESERVATION (icon_count_preservation): true/false. ¿Se respetó exactamente la cantidad de beneficios, bloques e íconos?
5. TEXT ZONE PRESERVATION (text_zone_preservation): true/false. ¿Todas las zonas de texto en sus posiciones relativas correctas?
6. ICON COLUMN POSITION PRESERVED (icon_column_position_preserved): true/false. ¿La columna de íconos en la MISMA posición relativa?

--- MÉTRICAS DE GEOMETRÍA Y ESPACIADO (UMBRAL ≥ 85) ---
7. BACKGROUND GEOMETRY SCORE (background_geometry_score): 0-100. ¿Las curvas, formas, paneles y geometría del fondo son IDÉNTICAS a la plantilla? Penalizar si se simplifican curvas, se eliminan paneles o se cambia la geometría.
8. PEDESTAL SIMILARITY SCORE (pedestal_similarity_score): 0-100. ¿El pedestal/plataforma tiene la MISMA forma, tamaño, posición y reflejos que en la plantilla?
9. SPACING SIMILARITY SCORE (spacing_similarity_score): 0-100. ¿El espaciado entre TODOS los elementos es idéntico? Verificar distancias entre íconos, entre texto y bordes, entre producto y elementos.
10. VISUAL BALANCE SCORE (visual_balance_score): 0-100. ¿La distribución del peso visual es la misma? ¿Ningún elemento domina más/menos que en la plantilla?
11. TEMPLATE GEOMETRY PRESERVATION SCORE (template_geometry_preservation_score): 0-100. ¿Se preservaron EXACTAMENTE las curvas del fondo, bordes redondeados, paneles divisores, arcos, y formas decorativas? 100 = píxel-perfecto. Penalizar severamente cualquier simplificación de geometría.

--- MÉTRICAS COLOROMÉTRICAS Y DE ILUMINACIÓN (UMBRAL ≥ 85) ---
12. COLOR PALETTE MATCH SCORE (color_palette_match_score): 0-100. ¿Colores del fondo, degradados, pedestales, barras e íconos coinciden EXACTAMENTE con la plantilla? Cambio de tono = penalización severa.
13. SHADOW MATCH SCORE (shadow_match_score): 0-100. ¿Sombras del producto y pedestal tienen misma intensidad, dirección y suavidad?
14. LIGHTING MATCH SCORE (lighting_match_score): 0-100. ¿Iluminación replica exactamente el setup de la plantilla?
15. PREMIUM RENDER SIMILARITY SCORE (premium_render_similarity_score): 0-100. ¿Mismo nivel de calidad de renderizado profesional/cinematográfico?
16. COLOR HARMONY SCORE (color_harmony_score): 0-100. ¿Los colores del producto se integran armoniosamente con la paleta de la plantilla? ¿Se ve premium y cinematográfico?
17. PRODUCT COLOR ENVIRONMENT INFLUENCE SCORE (product_color_environment_influence_score): 0-100. ¿Los colores dominantes del producto influyen VISIBLEMENTE en el entorno? Si el entorno es lavanda/blanco plano sin adaptación = score < 50.

--- MÉTRICAS DE ESCALA Y PESO VISUAL (UMBRAL ≥ 85) ---
18. PRODUCT SCALE SIMILARITY SCORE (product_scale_similarity_score): 0-100. ¿Tamaño relativo del producto en el canvas es idéntico al de la plantilla?
19. VISUAL WEIGHT SIMILARITY SCORE (visual_weight_similarity_score): 0-100. ¿Mismo dominancia visual, profundidad de campo y peso visual?
20. TYPOGRAPHY STRUCTURE PRESERVATION SCORE (typography_structure_preservation_score): 0-100. ¿La estructura tipográfica (tamaños relativos entre título, subtítulo, cuerpo, CTA, footer) es IDÉNTICA a la plantilla? NO evaluar el contenido del texto, SOLO la estructura visual: tamaños, pesos, posiciones. 100 = misma jerarquía tipográfica. Penalizar si cambiaron tamaños relativos de fuentes.

--- MÉTRICAS DE FIDELIDAD QUIRÚRGICA (CRÍTICAS) ---
21. TEMPLATE REINTERPRETATION SCORE (template_reinterpretation_score): 0-100. ¿Cuánto se REINTERPRETÓ el diseño? 0 = edición quirúrgica perfecta. 100 = recreación total. >15 = FAIL.
22. TEMPLATE TEXT LEAKAGE DETECTED (template_text_leakage_detected): true/false. ¿Aparece texto heredado de Imagen 1? true = FAIL AUTOMÁTICO.

--- MÉTRICAS DE REGION FREEZE (CRÍTICAS — BOOLEAN FAIL) ---
23. FROZEN REGION INTEGRITY SCORE (frozen_region_integrity_score): 0-100. Integridad general de TODAS las regiones congeladas. ¿Se preservaron intactas todas las regiones marcadas como FROZEN? 100 = todas congeladas perfectamente. <85 = FAIL.
24. BACKGROUND RECONSTRUCTION DETECTED (background_reconstruction_detected): true/false. ¿El modelo RECONSTRUYÓ el fondo en vez de preservarlo? Buscar: curvas diferentes, gradientes recreados, paneles con geometría distinta, formas simplificadas. Si el fondo fue regenerado en vez de preservado = true = FAIL AUTOMÁTICO.
25. GEOMETRY SHIFT DETECTED (geometry_shift_detected): true/false. ¿Se desplazó, deformó o alteró alguna forma geométrica del template? Curvas, arcos, paneles, divisores, formas decorativas. Cualquier shift = true = FAIL.
26. SPACING SHIFT DETECTED (spacing_shift_detected): true/false. ¿Cambió el espaciado entre elementos? Verificar gaps entre íconos, márgenes de texto, distancias producto-borde. Cualquier cambio visible = true = FAIL.
27. TYPOGRAPHY REFLOW DETECTED (typography_reflow_detected): true/false. ¿Cambiaron los tamaños relativos de tipografía? ¿El heading es más grande/pequeño relativo al body? ¿La jerarquía tipográfica se alteró? Cualquier cambio = true = FAIL.

⚠️ REGLA DE ADAPTABILIDAD UNIVERSAL: NO penalizar si el producto de Imagen 2 pertenece a categoría diferente. La plantilla es estructura visual abstracta.

⚠️ REGLA DE EDICIÓN QUIRÚRGICA: Este NO es un ejercicio de diseño creativo. Es una operación de edición de contenido sobre un documento gráfico terminado. PENALIZAR SEVERAMENTE cualquier reinterpretación, recreación, o alteración estructural.

⚠️ REGLA DE TEXT LEAKAGE: Cualquier texto heredado del template original (en cualquier idioma) es un FALLO CRÍTICO.

Devuelve OBLIGATORIAMENTE este JSON:
{
  "template_similarity_score": 85,
  "layout_preservation_score": 90,
  "product_identity_score": 95,
  "background_geometry_score": 88,
  "pedestal_similarity_score": 90,
  "spacing_similarity_score": 87,
  "visual_balance_score": 89,
  "template_geometry_preservation_score": 90,
  "color_palette_match_score": 90,
  "shadow_match_score": 92,
  "lighting_match_score": 88,
  "premium_render_similarity_score": 91,
  "color_harmony_score": 85,
  "product_color_environment_influence_score": 88,
  "product_scale_similarity_score": 90,
  "visual_weight_similarity_score": 92,
  "typography_structure_preservation_score": 88,
  "template_reinterpretation_score": 5,
  "frozen_region_integrity_score": 95,
  "icon_count_preservation": true,
  "icon_column_position_preserved": true,
  "text_zone_preservation": true,
  "template_text_leakage_detected": false,
  "background_reconstruction_detected": false,
  "geometry_shift_detected": false,
  "spacing_shift_detected": false,
  "typography_reflow_detected": false,
  "passed": true,
  "reason": "Explicación detallada justificando cada una de las 27 métricas evaluadas",
  "issues": ["Lista detallada de problemas encontrados"]
}`
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      temperature: 0.1
    });

    const text = response.choices[0]?.message?.content || '{}';
    const parsedQA = JSON.parse(text);

    const similarityScore = parsedQA.template_similarity_score ?? 100;
    const layoutScore = parsedQA.layout_preservation_score ?? 100;
    const productIdentityScore = parsedQA.product_identity_score ?? 100;
    const bgGeometryScore = parsedQA.background_geometry_score ?? 100;
    const pedestalScore = parsedQA.pedestal_similarity_score ?? 100;
    const spacingScore = parsedQA.spacing_similarity_score ?? 100;
    const visualBalanceScore = parsedQA.visual_balance_score ?? 100;
    const colorScore = parsedQA.color_palette_match_score ?? 100;
    const shadowScore = parsedQA.shadow_match_score ?? 100;
    const lightingScore = parsedQA.lighting_match_score ?? 100;
    const renderScore = parsedQA.premium_render_similarity_score ?? 100;
    const colorHarmonyScore = parsedQA.color_harmony_score ?? 100;
    const productColorEnvScore = parsedQA.product_color_environment_influence_score ?? 100;
    const typographyStructureScore = parsedQA.typography_structure_preservation_score ?? 100;
    const templateGeometryScore = parsedQA.template_geometry_preservation_score ?? 100;
    const reinterpretationScore = parsedQA.template_reinterpretation_score ?? 0;
    const frozenRegionScore = parsedQA.frozen_region_integrity_score ?? 100;
    const scaleScore = parsedQA.product_scale_similarity_score ?? 100;
    const weightScore = parsedQA.visual_weight_similarity_score ?? 100;
    const iconColumnOk = parsedQA.icon_column_position_preserved !== false;
    const iconCountOk = parsedQA.icon_count_preservation !== false;
    const textZoneOk = parsedQA.text_zone_preservation !== false;
    const textLeakage = parsedQA.template_text_leakage_detected === true;
    const bgReconstructed = parsedQA.background_reconstruction_detected === true;
    const geoShifted = parsedQA.geometry_shift_detected === true;
    const spacingShifted = parsedQA.spacing_shift_detected === true;
    const typoReflowed = parsedQA.typography_reflow_detected === true;

    const structurePassed = similarityScore >= 85 && layoutScore >= 85 && productIdentityScore >= 85 && iconColumnOk && iconCountOk && textZoneOk;
    const geometryPassed = bgGeometryScore >= 85 && pedestalScore >= 85 && spacingScore >= 85 && visualBalanceScore >= 85 && templateGeometryScore >= 85;
    const colorPassed = colorScore >= 85 && shadowScore >= 85 && lightingScore >= 85 && renderScore >= 85 && colorHarmonyScore >= 85 && productColorEnvScore >= 85;
    const scalePassed = scaleScore >= 85 && weightScore >= 85;
    const fidelityPassed = reinterpretationScore <= 15 && !textLeakage && typographyStructureScore >= 85;
    const freezePassed = frozenRegionScore >= 85 && !bgReconstructed && !geoShifted && !spacingShifted && !typoReflowed;
    const isPassed = parsedQA.passed === true && structurePassed && geometryPassed && colorPassed && scalePassed && fidelityPassed && freezePassed;

    return {
      passed: isPassed,
      template_similarity_score: similarityScore,
      layout_preservation_score: layoutScore,
      product_identity_score: productIdentityScore,
      background_geometry_score: bgGeometryScore,
      pedestal_similarity_score: pedestalScore,
      spacing_similarity_score: spacingScore,
      visual_balance_score: visualBalanceScore,
      color_palette_match_score: colorScore,
      shadow_match_score: shadowScore,
      lighting_match_score: lightingScore,
      premium_render_similarity_score: renderScore,
      color_harmony_score: colorHarmonyScore,
      product_color_environment_influence_score: productColorEnvScore,
      typography_structure_preservation_score: typographyStructureScore,
      template_geometry_preservation_score: templateGeometryScore,
      template_reinterpretation_score: reinterpretationScore,
      frozen_region_integrity_score: frozenRegionScore,
      product_scale_similarity_score: scaleScore,
      visual_weight_similarity_score: weightScore,
      icon_count_preservation: iconCountOk,
      icon_column_position_preserved: iconColumnOk,
      text_zone_preservation: textZoneOk,
      template_text_leakage_detected: textLeakage,
      background_reconstruction_detected: bgReconstructed,
      geometry_shift_detected: geoShifted,
      spacing_shift_detected: spacingShifted,
      typography_reflow_detected: typoReflowed,
      reason: parsedQA.reason || 'Auditoría completada.',
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
    console.log('[OPENAI][STAGE 3] Ejecutando ART DIRECTOR con GPT-4o...');
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
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
      temperature: 0.2
    });

    const text = response.choices[0]?.message?.content || '{}';
    return JSON.parse(text) as ArtDirection;
  },

  async adaptColors(
    templateDNA: TemplateDNA,
    productAnalysis: ProductAnalysis,
    template_json: any,
    strippedStyleIdentity: string
  ): Promise<AdaptedColorsResult> {
    console.log('[OPENAI][STAGE 4] Ejecutando ADAPT COLORS con GPT-4o...');
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
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
      temperature: 0.1
    });

    const text = response.choices[0]?.message?.content || '{}';
    return JSON.parse(text) as AdaptedColorsResult;
  }
};
