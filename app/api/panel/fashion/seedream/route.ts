import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';
import { readLimitedJsonObject } from '@/lib/request-guards';
import { createFalClient } from '@fal-ai/client';
import { getAiCredential } from '@/lib/ai-request-context';
import { deductAiCredits } from '@/lib/ai-credits';

export const maxDuration = 120; // Hasta 2 minutos para inferencia de SeedDream v4

export async function POST(req: NextRequest) {
  try {
    // 1. Autorización estricta del tenant (Seguridad 100% preservada)
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json(
        { 
          error: 'Tu sesión ha expirado o no estás autenticado. Por favor, vuelve a iniciar sesión en la aplicación.',
          session_expired: true 
        }, 
        { status: 401 }
      );
    }

    const featureDenied = denyUnlessFeature(tenant, 'banners');
    if (featureDenied) return featureDenied;

    // 2. Control de tasa de peticiones (15 por minuto por tenant)
    const rateLimit = await checkRateLimit(
      rateLimitKey('fashion-seedream', tenant.tenantId),
      15,
      60_000
    );
    if (rateLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio de rate limit temporalmente no disponible' }, { status: 503 });
    }
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Has alcanzado el límite de generación por minuto. Intenta de nuevo en unos segundos.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    // 3. Lectura segura del cuerpo de la petición (hasta 12MB)
    const parsedBody = await readLimitedJsonObject(req, 12 * 1024 * 1024);
    if (!parsedBody.ok) return parsedBody.response;

    const body = parsedBody.body as Record<string, any>;
    const modelImage = typeof body.model_image === 'string' ? body.model_image.trim() : '';
    const rawGarmentImages = Array.isArray(body.garment_images) ? body.garment_images : [];
    const bannerImage = typeof body.banner_image === 'string' ? body.banner_image.trim() : '';
    const storeName = typeof body.store_name === 'string' ? body.store_name.trim() : '';
    const offerText = typeof body.offer_text === 'string' ? body.offer_text.trim() : '';
    const storeDescription = typeof body.store_description === 'string' ? body.store_description.trim() : '';
    const contactInfo = typeof body.contact_info === 'string' ? body.contact_info.trim() : '';
    const preserveFace = body.preserve_face !== false;
    const promptInput = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const imageSize = typeof body.image_size === 'string' ? body.image_size : 'square_hd';
    const enhancePromptMode = body.enhance_prompt_mode === 'fast' ? 'fast' : 'standard';
    const customApiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';

    if (!modelImage && rawGarmentImages.length === 0 && !bannerImage) {
      return NextResponse.json(
        { error: 'Debes proporcionar al menos la foto de una persona/modelo o una prenda de vestir.' },
        { status: 400 }
      );
    }

    // 4. Resolver FAL_KEY
    let resolvedFalKey = customApiKey;
    if (!resolvedFalKey) {
      try {
        const { createSupabaseAdmin } = await import('@/lib/supabase');
        const supabase = createSupabaseAdmin();
        const { data: cfgRow } = await supabase
          .from('config')
          .select('openai_key')
          .eq('tenant_id', tenant.tenantId)
          .maybeSingle();

        if (cfgRow?.openai_key) {
          let decoded: any = {};
          try {
            decoded = JSON.parse(cfgRow.openai_key);
          } catch {
            decoded = {};
          }
          if (typeof decoded.fal_key === 'string' && decoded.fal_key.trim().length > 5) {
            resolvedFalKey = decoded.fal_key.trim();
          }
        }
      } catch (err: any) {
        console.warn('⚠️ [Fashion SeedDream] No se pudo leer config de Supabase:', err.message);
      }
    }

    if (!resolvedFalKey) {
      resolvedFalKey = getAiCredential('fal') || process.env.FAL_KEY || '';
    }

    if (!resolvedFalKey) {
      return NextResponse.json(
        {
          error:
            'No se encontró la clave FAL_KEY configurada. Añádela en Ajustes > Claves de IA o en tus variables de entorno para usar SeedDream v4.',
          missing_key: true,
        },
        { status: 400 }
      );
    }

    const falClient = createFalClient({ credentials: resolvedFalKey });

    const pricingTier = body.pricing_tier === 'pro' || body.quality === 'high' ? 'pro' : 'standard';
    const maxGarmentsAllowed = pricingTier === 'standard' ? 2 : 4;
    const garmentsToProcess: string[] = rawGarmentImages
      .filter((g: any) => typeof g === 'string' && g.trim().length > 0)
      .slice(0, maxGarmentsAllowed);

    // 5. Normalizar, redimensionar con Sharp y subir imágenes a Fal Storage
    const getRawBuffer = async (img: string): Promise<Buffer | null> => {
      const trimmed = img.trim();
      if (!trimmed) return null;

      if (trimmed.startsWith('/')) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const localPath = path.join(process.cwd(), 'public', trimmed.replace(/^\//, ''));
          if (fs.existsSync(localPath)) {
            return fs.readFileSync(localPath);
          }
        } catch (localErr: any) {
          console.warn('[Fashion Studio] Error leyendo archivo local:', localErr.message);
        }
      } else if (trimmed.startsWith('data:image/')) {
        try {
          const base64Clean = trimmed.replace(/^data:image\/[a-zA-Z0-9.-]+;base64,/, '');
          return Buffer.from(base64Clean, 'base64');
        } catch (decodeErr: any) {
          console.warn('[Fashion Studio] Error decodificando base64:', decodeErr.message);
        }
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
          const resp = await fetch(trimmed);
          if (resp.ok) {
            const arrBuf = await resp.arrayBuffer();
            return Buffer.from(arrBuf);
          }
        } catch (fetchErr: any) {
          console.warn('[Fashion Studio] Error descargando imagen remota:', fetchErr.message);
        }
      }
      return null;
    };

    const uploadOptimizedBuffer = async (buf: Buffer, maxDim: number = 512): Promise<string> => {
      try {
        const sharp = (await import('sharp')).default;
        const compressedBuf = await sharp(buf)
          .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80, progressive: true })
          .toBuffer();

        const blob = new Blob([new Uint8Array(compressedBuf)], { type: 'image/jpeg' });
        console.log(`[Fashion Studio] Imagen optimizada (${Math.round(compressedBuf.length / 1024)} KB, max ${maxDim}px) subida a Fal CDN`);
        return await falClient.storage.upload(blob);
      } catch (sharpErr: any) {
        console.warn('[Fashion Studio] Fallo compresión Sharp, subiendo original:', sharpErr.message);
        const blob = new Blob([new Uint8Array(buf)], { type: 'image/jpeg' });
        return await falClient.storage.upload(blob);
      }
    };

    const uploadIfBase64OrLocal = async (img: string, maxDim: number = 512): Promise<string> => {
      const trimmed = img.trim();
      if (!trimmed) return '';
      const rawBuf = await getRawBuffer(trimmed);
      if (rawBuf) {
        return await uploadOptimizedBuffer(rawBuf, maxDim);
      }
      return trimmed;
    };

    // Procesar prendas: En Standard unimos 2 prendas en un collage 768x384 con Sharp para enviar 1 sola imagen URL y clavar el precio en $0.03612
    let isStitchedGarments = false;
    const garmentUrls: string[] = [];

    if (pricingTier === 'standard' && garmentsToProcess.length === 2) {
      try {
        const buf1 = await getRawBuffer(garmentsToProcess[0]);
        const buf2 = await getRawBuffer(garmentsToProcess[1]);

        if (buf1 && buf2) {
          const sharp = (await import('sharp')).default;
          const tileW = 384;
          const tileH = 384;
          const r1 = await sharp(buf1)
            .resize(tileW, tileH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .toBuffer();
          const r2 = await sharp(buf2)
            .resize(tileW, tileH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .toBuffer();

          const collageBuf = await sharp({
            create: {
              width: tileW * 2, // 768px total
              height: tileH,    // 384px
              channels: 3,
              background: { r: 255, g: 255, b: 255 },
            },
          })
            .composite([
              { input: r1, left: 0, top: 0 },
              { input: r2, left: tileW, top: 0 },
            ])
            .jpeg({ quality: 80, progressive: true })
            .toBuffer();

          const blob = new Blob([new Uint8Array(collageBuf)], { type: 'image/jpeg' });
          const stitchedUrl = await falClient.storage.upload(blob);
          garmentUrls.push(stitchedUrl);
          isStitchedGarments = true;
          console.log(`[Fashion Studio] 2 prendas unidas en 1 imagen collage (${Math.round(collageBuf.length / 1024)} KB) subida a Fal CDN. ¡Tarifa bloqueada en $0.03612!`);
        }
      } catch (stitchErr: any) {
        console.warn('[Fashion Studio] Error uniendo prendas en collage:', stitchErr.message);
      }
    }

    if (!isStitchedGarments) {
      const garmentMaxDim = pricingTier === 'standard' ? 400 : 768;
      for (const g of garmentsToProcess) {
        const uploaded = await uploadIfBase64OrLocal(g, garmentMaxDim);
        if (uploaded) garmentUrls.push(uploaded);
      }
    }

    const imageUrlsToProcess: string[] = [];
    const modelMaxDim = pricingTier === 'standard' ? 512 : 1024;
    const bannerMaxDim = pricingTier === 'standard' ? 768 : 1024;
    let modelImgIndex: number | null = null;
    const garmentImgIndices: number[] = [];
    let bannerImgIndex: number | null = null;

    // Foto del modelo (primera referencia de pose y persona)
    if (modelImage) {
      const uploadedModel = await uploadIfBase64OrLocal(modelImage, modelMaxDim);
      if (uploadedModel) {
        imageUrlsToProcess.push(uploadedModel);
        modelImgIndex = imageUrlsToProcess.length;
      }
    }

    // Fotos de prendas
    for (const gUrl of garmentUrls) {
      imageUrlsToProcess.push(gUrl);
      garmentImgIndices.push(imageUrlsToProcess.length);
    }

    // Foto de la pancarta / plantilla (si se seleccionó una)
    const bannerMode = body.banner_mode || (bannerImage ? 'active' : 'none');
    if (bannerImage && bannerMode !== 'none') {
      const uploadedBanner = await uploadIfBase64OrLocal(bannerImage, bannerMaxDim);
      if (uploadedBanner) {
        imageUrlsToProcess.push(uploadedBanner);
        bannerImgIndex = imageUrlsToProcess.length;
      }
    }

    let engine = 'openai/gpt-image-2.5/sunburst/edit';
    if (body.engine === 'seedream' || body.engine === 'fal-ai/bytedance/seedream/v4/edit') {
      engine = 'fal-ai/bytedance/seedream/v4/edit';
    } else if (body.engine === 'openai-flare' || body.engine === 'flare' || body.engine === 'openai/gpt-image-2.5/flare/edit') {
      engine = 'openai/gpt-image-2.5/flare/edit';
    } else {
      engine = 'openai/gpt-image-2.5/sunburst/edit';
    }

    // Configurar dimensiones para clavar el precio exacto
    // En la tabla oficial de OpenAI / Fal.ai:
    // 1024x768 (o 768x1024, ~786k píxeles) = EXACTAMENTE $0.03612 USD
    let finalImageSize: any = imageSize;
    let finalQuality: string = 'high';

    if (pricingTier === 'standard') {
      finalQuality = 'high';
      if (imageSize === 'portrait_4_3' || imageSize === 'portrait_16_9') {
        finalImageSize = { width: 768, height: 1024 };
      } else if (imageSize === 'square_hd' || imageSize === 'square') {
        finalImageSize = { width: 896, height: 896 };
      } else {
        finalImageSize = { width: 1024, height: 768 };
      }
    } else {
      // Modo Pro / Máxima Calidad: 1024x1024 / 1024x1536 en alto = ~$0.09 - $0.10 USD
      finalQuality = 'high';
      finalImageSize = imageSize === 'portrait_4_3' ? 'portrait_4_3' : 'square_hd';
    }

    // 6. Construir prompt con recreación fiel del diseño de la pancarta, fidelidad facial y oferta comercial
    const promptParts: string[] = [];

    // 1. Identidad facial estricta
    if (preserveFace && modelImgIndex !== null) {
      promptParts.push(
        `CRITICAL MANDATE - FACIAL FIDELITY & IDENTITY PRESERVATION:\n` +
        `Strictly preserve 100% of the exact facial features, face shape, eyes, eyebrows, nose, mouth, lips, jawline, skin texture, natural complexion, hairstyle, and real-life likeness of the person in Image ${modelImgIndex}.\n` +
        `Do NOT distort, morph, beautify, age, or alter the person's face. The person in the final generated image MUST be immediately recognizable as the exact same person from Image ${modelImgIndex}.`
      );
    }

    // 2. Colocación de prendas en el cuerpo (sin productos flotando)
    if (garmentImgIndices.length > 0) {
      const garmentRefs = garmentImgIndices.map((i) => `Image ${i}`).join(' and ');
      if (isStitchedGarments) {
        promptParts.push(
          `CLOTHING & ATTIRE INTEGRATION (NO FLOATING ITEMS):\n` +
          `- The reference garment image (${garmentRefs}) displays the 2 selected clothing pieces side-by-side.\n` +
          `- The model must actually WEAR BOTH clothing items realistically on their body (e.g., top on torso, pants on legs, footwear on feet).\n` +
          `- Absolutely DO NOT place disconnected floating product cutouts in empty spaces.\n` +
          `- Perfectly preserve fabric drape, textile weaves, prints, logos, stitching, colors, and natural shadows.`
        );
      } else {
        promptParts.push(
          `CLOTHING & ATTIRE INTEGRATION (NO FLOATING ITEMS):\n` +
          `- The model must actually WEAR all provided clothing items (${garmentRefs}) realistically on their body.\n` +
          `- Shirts, jackets, coats and tops must be worn on the torso/arms.\n` +
          `- Pants, jeans, and trousers must be worn on the legs.\n` +
          `- Footwear, shoes and sneakers MUST BE WORN ON THE FEET of the model (do NOT leave shoes floating in the background).\n` +
          `- Accessories like sunglasses or hats must be worn on the face/head or held naturally.\n` +
          `- Absolutely DO NOT place disconnected floating product cutouts in empty spaces.\n` +
          `- Perfectly preserve fabric drape, textile weaves, prints, logos, stitching, colors, and natural shadows.`
        );
      }
    }

    // 3. RECREACIÓN ESTRICTA DEL DISEÑO Y CONCEPTO DE LA PANCARTA
    if (bannerImgIndex !== null) {
      const details = [
        storeName ? `Store / Brand Name: "${storeName}"` : '',
        offerText ? `Headline Promo / Offer: "${offerText}"` : '',
        storeDescription ? `Concept / Style / Tagline: "${storeDescription}"` : '',
        contactInfo ? `Contact / Social Media / Website: "${contactInfo}"` : '',
      ]
        .filter(Boolean)
        .join('\n- ');

      promptParts.push(
        `========================================================================\n` +
        `CRITICAL MANDATE - FAITHFULLY RECREATE BANNER DESIGN TEMPLATE (Image ${bannerImgIndex}):\n` +
        `========================================================================\n` +
        `Image ${bannerImgIndex} is the MASTER ADVERTISING DESIGN TEMPLATE and CREATIVE CONCEPT for this composition.\n` +
        `You MUST RECREATE the exact visual concept, scene layout, camera perspective, framing, background environment, and artistic aesthetic of Image ${bannerImgIndex}:\n\n` +
        `1. EXACT SCENE, CAMERA ANGLE & CREATIVE PERSPECTIVE RECREATION:\n` +
        `- Carefully analyze Image ${bannerImgIndex}.\n` +
        `- Replicate the EXACT visual perspective, camera angle, depth, background environment, lighting direction, and scene framing of Image ${bannerImgIndex}.\n` +
        `- CREATIVE CONCEPTUAL PERSPECTIVES: If Image ${bannerImgIndex} features a unique creative framing perspective (e.g., looking outward from inside a brown paper shopping bag/tunnel, looking up from below, an architectural corridor, a specific studio backdrop, geometric graphic shapes, or editorial textures), YOU MUST RECREATE THAT EXACT UNIQUE PERSPECTIVE AND SCENE!\n` +
        `- If Image ${bannerImgIndex} contains graphic design elements (such as receipts, stamps, discount badges, typography frames, borders, or paper textures), REPRODUCE THEM in the same positions, hierarchy, and aesthetic style.\n` +
        `- STRICT PROHIBITION: DO NOT default to a generic brick wall, graffiti alley, or wooden crate unless Image ${bannerImgIndex} itself shows one. Strictly match the unique background and environment of Image ${bannerImgIndex}!\n\n` +
        `2. SUBJECT REPLACEMENT & POSE INTEGRATION:\n` +
        `- The human subject in the generated composition must be the model ${modelImgIndex ? `from Image ${modelImgIndex}` : ''}, dressed in the clothing ${garmentImgIndices.length > 0 ? `from ${garmentImgIndices.map((i) => `Image ${i}`).join(' and ')}` : ''}.\n` +
        `- The model must adopt the camera angle, framing, interaction (such as holding props if present in the design), and perspective established by the design in Image ${bannerImgIndex}.\n\n` +
        `3. EDIT ONLY THE TEXT, BRAND INFORMATION & COLOR PALETTE:\n` +
        `- Customize and replace the text in the banner design with the user's business details:\n` +
        `${details ? `- ${details}` : '- Use clean, sharp commercial typography without duplicates or misspellings.'}\n` +
        `- Replace the main headline/title with: "${storeName || offerText || 'NEW COLLECTION'}".\n` +
        `- Replace any promotional discount badge/sticker with: "${offerText || 'SPECIAL OFFER'}".\n` +
        `- Replace any contact / website / handle text with: "${contactInfo || ''}".\n` +
        `- Keep typography clean, crisp, legible, and perfectly aligned in the design.\n` +
        `- Adapt the color accents and lighting to harmonize with the brand and clothing colors while keeping the master design layout intact.`
      );
    } else {
      promptParts.push(
        'COMMERCIAL STUDIO FASHION PHOTOSHOOT:\n' +
        '- Clean minimalist e-commerce fashion photoshoot, soft diffuse studio lighting, neutral clean studio background, natural confident pose, 8k crisp commercial quality.'
      );
      if (storeName || offerText) {
        promptParts.push(
          `BRANDING OVERLAY:\n- Brand: "${storeName}"\n- Promo: "${offerText}"\n- Clean commercial badge.`
        );
      }
    }

    if (promptInput && !promptInput.includes('dynamic urban streetwear campaign')) {
      promptParts.push(`USER DIRECTIVES: ${promptInput}`);
    }

    const finalPrompt = promptParts.join('\n\n');
    const isGptModel = engine.startsWith('openai/');

    console.log(`👗 [Fashion Studio] Iniciando ${engine} | Tier: ${pricingTier} | Imágenes: ${imageUrlsToProcess.length} | FacePreserve: ${preserveFace} | Banner: ${!!bannerImage} | Quality: ${finalQuality} | Tenant: ${tenant.tenantId}`);

    let result: any;
    if (isGptModel) {
      result = await falClient.subscribe(engine as any, {
        input: {
          prompt: finalPrompt,
          image_urls: imageUrlsToProcess,
          quality: finalQuality as any,
          image_size: finalImageSize as any,
          output_format: 'png',
          enable_safety_checker: true,
        },
      });
    } else {
      result = await falClient.subscribe('fal-ai/bytedance/seedream/v4/edit', {
        input: {
          prompt: finalPrompt,
          image_urls: imageUrlsToProcess,
          image_size: finalImageSize as any,
          enhance_prompt_mode: enhancePromptMode,
          enable_safety_checker: true,
          num_images: 1,
        },
      });
    }

    const generatedUrl = result?.data?.images?.[0]?.url || result?.images?.[0]?.url;

    if (!generatedUrl) {
      throw new Error(`El modelo ${engine} completó la solicitud pero no devolvió ninguna URL de imagen.`);
    }

    // Descontar créditos en la base de datos de manera segura
    try {
      const { createSupabaseAdmin } = await import('@/lib/supabase');
      const supabase = createSupabaseAdmin();
      await deductAiCredits(
        supabase,
        tenant.tenantId,
        1,
        isGptModel ? `Edición de Ropa ${engine}` : 'Edición de Ropa SeedDream v4'
      );
    } catch (creditErr: any) {
      console.warn('⚠️ [Fashion Studio] Error registrando deducción de crédito:', creditErr.message);
    }

    return NextResponse.json({
      success: true,
      image: generatedUrl,
      requestId: result?.requestId || '',
      seed: result?.data?.seed,
      model: engine,
      engine: engine,
      metadata: {
        storeName,
        offerText,
        storeDescription,
        contactInfo,
        hasBanner: !!bannerImage,
        preserveFace,
        engine,
        quality: finalQuality,
      },
    });
  } catch (err: any) {
    console.error('❌ [Fashion SeedDream Error]:', err);
    return NextResponse.json(
      {
        error: err.message || 'Error interno al comunicarse con ByteDance SeedDream v4 en Fal.ai',
      },
      { status: 500 }
    );
  }
}
