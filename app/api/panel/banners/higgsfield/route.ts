import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';
import { readLimitedJsonObject } from '@/lib/request-guards';
import { generateHiggsfieldVideo } from '@/lib/higgsfield';
import { runWithAiRequestContext, type AiRequestContext, getAiCredential } from '@/lib/ai-request-context';
import { createFalClient } from '@fal-ai/client';
import { deductAiCredits } from '@/lib/ai-credits';

export const maxDuration = 120; // Hasta 120s para inferencia de modelos visuales avanzados

export async function POST(req: NextRequest) {
  try {
    // 1. Autorización estricta del tenant
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
      rateLimitKey('banners-higgsfield', tenant.tenantId),
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

    // 3. Lectura segura del cuerpo de la petición (hasta 12MB para soportar imágenes en base64)
    const parsedBody = await readLimitedJsonObject(req, 12 * 1024 * 1024);
    if (!parsedBody.ok) return parsedBody.response;

    const body = parsedBody.body as Record<string, any>;
    const mode = body.mode === 'video' || body.media_type === 'video' ? 'video' : 'image';
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    let rawRatio = typeof body.aspect_ratio === 'string' ? body.aspect_ratio : (mode === 'video' ? '16:9' : '4:5');
    if (body.image_size === 'square_hd') rawRatio = '1:1';
    else if (body.image_size === 'portrait_4_3') rawRatio = '3:4';
    else if (body.image_size === 'portrait_16_9') rawRatio = '9:16';
    const aspectRatio = rawRatio;

    const customApiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';
    const requestedQuality = body.quality === 'high' ? 'high' : 'medium';
    const productImage = typeof body.product_image === 'string' && body.product_image.trim()
      ? body.product_image
      : (typeof body.model_image === 'string' ? body.model_image : undefined);
    const logoImage = typeof body.logo_image === 'string' && body.logo_image.trim()
      ? body.logo_image
      : (typeof body.secondary_image === 'string' && body.secondary_image.trim() ? body.secondary_image : undefined);
    const templateImage = typeof body.template_image === 'string' && body.template_image.trim()
      ? body.template_image
      : (typeof body.banner_image === 'string' ? body.banner_image : undefined);
    const referenceImage = typeof body.reference_image === 'string' ? body.reference_image : undefined;

    const textLanguage = typeof body.text_language === 'string' && body.text_language.trim()
      ? body.text_language.trim()
      : (typeof body.language === 'string' && body.language.trim() ? body.language.trim() : 'es');
    const headlineText = typeof body.headline_text === 'string' && body.headline_text.trim()
      ? body.headline_text.trim()
      : (typeof body.offer_text === 'string' && body.offer_text.trim() ? body.offer_text.trim() : undefined);
    const productOffer = typeof body.product_offer === 'string' && body.product_offer.trim()
      ? body.product_offer.trim()
      : (typeof body.subheadline_text === 'string' && body.subheadline_text.trim()
        ? body.subheadline_text.trim()
        : (typeof body.store_description === 'string' && body.store_description.trim() ? body.store_description.trim() : undefined));
    const brandName = typeof body.brand_name === 'string' && body.brand_name.trim()
      ? body.brand_name.trim()
      : (typeof body.store_name === 'string' && body.store_name.trim() ? body.store_name.trim() : undefined);
    const productColors = typeof body.product_colors === 'string' && body.product_colors.trim()
      ? body.product_colors.trim()
      : undefined;
    const templateName = typeof body.template_name === 'string' && body.template_name.trim()
      ? body.template_name.trim()
      : undefined;

    // =========================================================================
    // MODO VIDEO: BYTEDANCE SEEDANCE 2.5 A TRAVÉS DE HIGGSFIELD
    // =========================================================================
    if (mode === 'video') {
      const duration = body.duration === 10 ? 10 : 5;
      const resolution = body.resolution || '720p';

      let resolvedHfKey = customApiKey;
      if (!resolvedHfKey) {
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
            if (typeof decoded.higgsfield_key === 'string' && decoded.higgsfield_key.trim().length > 5) {
              resolvedHfKey = decoded.higgsfield_key.trim();
            }
          }
        } catch (err: any) {
          console.warn('⚠️ [Video Route] No se pudo leer config de Supabase:', err.message);
        }
      }

      if (!resolvedHfKey && (process.env.HF_CREDENTIALS || process.env.HIGGSFIELD_API_KEY)) {
        resolvedHfKey = (process.env.HF_CREDENTIALS || process.env.HIGGSFIELD_API_KEY || '').trim();
      }

      if (!resolvedHfKey) {
        return NextResponse.json(
          {
            error:
              'No se encontró la API Key de Higgsfield.ai para Video Seedance. Ingresa tu credencial en el panel o en Ajustes (formato: Key ID:Key Secret).',
            missing_key: true,
          },
          { status: 400 }
        );
      }

      const aiContext: AiRequestContext = {
        higgsfieldKey: resolvedHfKey,
        visualProvider: 'higgsfield',
      };

      return await runWithAiRequestContext(aiContext, async () => {
        console.log(`[Video Route] Iniciando Seedance 2.5 | Tenant: ${tenant.tenantId}`);
        const videoResult = await generateHiggsfieldVideo({
          prompt: prompt || 'Commercial product advertising video in dynamic studio presentation',
          duration,
          resolution: resolution === '1080p' ? '1080p' : '720p',
          aspectRatio,
          apiKey: resolvedHfKey,
          imageUrl: (productImage?.startsWith('http') || productImage?.startsWith('data:image/')) ? productImage : undefined,
        });

        return NextResponse.json({
          success: true,
          mode: 'video',
          video: videoResult.videoUrl,
          requestId: videoResult.requestId,
          status: videoResult.status,
        });
      });
    }

    // =========================================================================
    // MODO IMAGEN: GENERADOR OPENAI GPT IMAGE 2.5 (SUNBURST EDIT) EN FAL.AI
    // =========================================================================
    let resolvedFalKey = typeof body.fal_key === 'string' ? body.fal_key.trim() : '';
    if (!resolvedFalKey && customApiKey) {
      resolvedFalKey = customApiKey;
    }

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
        console.warn('⚠️ [Banner Route Image 2.5] No se pudo leer config de Supabase:', err.message);
      }
    }

    if (!resolvedFalKey) {
      resolvedFalKey = getAiCredential('fal') || process.env.FAL_KEY || '';
    }

    if (!resolvedFalKey) {
      return NextResponse.json(
        {
          error:
            'No se encontró la clave FAL_KEY configurada para OpenAI GPT Image 2.5. Añádela en Ajustes > Claves de IA o en tus variables de entorno.',
          missing_key: true,
        },
        { status: 400 }
      );
    }

    const falClient = createFalClient({ credentials: resolvedFalKey });

    // Helper para normalizar y subir imágenes a Fal Storage (CDN)
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
          console.warn('[Banner Route Image 2.5] Error leyendo archivo local:', localErr.message);
        }
      } else if (trimmed.startsWith('data:image/')) {
        try {
          const base64Clean = trimmed.replace(/^data:image\/[a-zA-Z0-9.-]+;base64,/, '');
          return Buffer.from(base64Clean, 'base64');
        } catch (decodeErr: any) {
          console.warn('[Banner Route Image 2.5] Error decodificando base64:', decodeErr.message);
        }
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
          const resp = await fetch(trimmed);
          if (resp.ok) {
            const arrBuf = await resp.arrayBuffer();
            return Buffer.from(arrBuf);
          }
        } catch (fetchErr: any) {
          console.warn('[Banner Route Image 2.5] Error descargando imagen remota:', fetchErr.message);
        }
      }
      return null;
    };

    const uploadOptimizedBuffer = async (buf: Buffer, maxDim: number = 768): Promise<string> => {
      try {
        const sharp = (await import('sharp')).default;
        const compressedBuf = await sharp(buf)
          .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80, progressive: true })
          .toBuffer();

        const blob = new Blob([new Uint8Array(compressedBuf)], { type: 'image/jpeg' });
        return await falClient.storage.upload(blob);
      } catch (sharpErr: any) {
        console.warn('[Banner Route Image 2.5] Fallo Sharp, subiendo original:', sharpErr.message);
        const blob = new Blob([new Uint8Array(buf)], { type: 'image/jpeg' });
        return await falClient.storage.upload(blob);
      }
    };

    const uploadIfBase64OrLocal = async (img: string, maxDim: number = 768): Promise<string> => {
      const trimmed = img.trim();
      if (!trimmed) return '';
      const rawBuf = await getRawBuffer(trimmed);
      if (rawBuf) {
        return await uploadOptimizedBuffer(rawBuf, maxDim);
      }
      return trimmed;
    };

    // Helper para extraer automáticamente la paleta de colores dominante de una imagen
    const extractDominantColorsFromBuffer = async (buf: Buffer): Promise<{ colorNames: string; hexCodes: string[] } | null> => {
      try {
        const sharp = (await import('sharp')).default;
        const { data } = await sharp(buf)
          .resize(48, 48, { fit: 'inside' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const buckets: Record<string, { name: string; hex: string; count: number; isNeutral?: boolean }> = {
          naranja: { name: 'Naranja Vibrante', hex: '#FF6B00', count: 0 },
          azulMarino: { name: 'Azul Marino / Navy', hex: '#0F2744', count: 0 },
          azul: { name: 'Azul Eléctrico', hex: '#2563EB', count: 0 },
          cyan: { name: 'Turquesa / Cian', hex: '#06B6D4', count: 0 },
          dorado: { name: 'Dorado / Oro', hex: '#F59E0B', count: 0 },
          amarillo: { name: 'Amarillo Brillante', hex: '#FACC15', count: 0 },
          verde: { name: 'Verde Esmeralda', hex: '#10B981', count: 0 },
          verdeLima: { name: 'Verde Neón', hex: '#84CC16', count: 0 },
          rojo: { name: 'Rojo Rubí', hex: '#EF4444', count: 0 },
          rosa: { name: 'Rosa / Fucsia', hex: '#EC4899', count: 0 },
          morado: { name: 'Morado / Violeta', hex: '#8B5CF6', count: 0 },
          blanco: { name: 'Blanco Puro', hex: '#FFFFFF', count: 0, isNeutral: true },
          negro: { name: 'Negro Profundo', hex: '#0B0F19', count: 0, isNeutral: true },
        };

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 50) continue; // Píxeles transparentes

          const rN = r / 255, gN = g / 255, bN = b / 255;
          const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
          const l = (max + min) / 2;
          let h = 0, s = 0;
          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === rN) h = (gN - bN) / d + (gN < bN ? 6 : 0);
            else if (max === gN) h = (bN - rN) / d + 2;
            else h = (rN - gN) / d + 4;
            h *= 60;
          }

          if (l < 0.12) {
            buckets.negro.count++;
          } else if (s < 0.12 && l > 0.85) {
            buckets.blanco.count++;
          } else if (h >= 14 && h < 42 && s > 0.28) {
            buckets.naranja.count++;
          } else if (h >= 42 && h < 58 && s > 0.35) {
            buckets.dorado.count++;
          } else if (h >= 58 && h < 75 && s > 0.35) {
            buckets.amarillo.count++;
          } else if (h >= 75 && h < 115 && s > 0.25) {
            buckets.verdeLima.count++;
          } else if (h >= 115 && h < 165 && s > 0.20) {
            buckets.verde.count++;
          } else if (h >= 165 && h < 200 && s > 0.20) {
            buckets.cyan.count++;
          } else if (h >= 200 && h < 250 && s > 0.18) {
            if (l < 0.35) buckets.azulMarino.count++;
            else buckets.azul.count++;
          } else if (h >= 250 && h < 320 && s > 0.18) {
            buckets.morado.count++;
          } else if (h >= 320 && h < 350 && s > 0.20) {
            buckets.rosa.count++;
          } else if ((h >= 350 || h < 14) && s > 0.25) {
            buckets.rojo.count++;
          }
        }

        // Priorizar colores cromáticos de marca sobre negro/blanco neutro (hasta un máximo de 3 colores)
        const chromatic = Object.values(buckets).filter(b => !b.isNeutral && b.count > 10).sort((a, b) => b.count - a.count);
        const neutrals = Object.values(buckets).filter(b => b.isNeutral && b.count > 10).sort((a, b) => b.count - a.count);

        const chosen: typeof buckets[string][] = [];
        for (const c of chromatic) {
          if (chosen.length < 3) chosen.push(c);
        }
        for (const n of neutrals) {
          if (chosen.length < 3) chosen.push(n);
        }

        if (chosen.length === 0) return null;

        const names = chosen.length === 1
          ? chosen[0].name
          : chosen.length === 2
          ? `${chosen[0].name} y ${chosen[1].name}`
          : `${chosen[0].name}, ${chosen[1].name} y ${chosen[2].name}`;
        const hexes = chosen.map(c => c.hex);
        return { colorNames: names, hexCodes: hexes };
      } catch (err: any) {
        console.warn('⚠️ [Banner Route] Error extrayendo colores con Sharp:', err.message);
        return null;
      }
    };

    // Helper para subir la plantilla pura y limpia (Imagen 1) adaptada a 1024x768 / 768x1024 sin recortar
    // Usa fit: 'contain' y color de fondo extraído de los bordes para preservar el 100% del encabezado, marco y pie
    const uploadCleanTemplate = async (
      templateBuf: Buffer,
      targetW: number,
      targetH: number
    ): Promise<string> => {
      try {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(templateBuf).metadata();
        const imgW = meta.width || targetW;
        const imgH = meta.height || targetH;

        // Extraer color de fondo de las esquinas del diseño original para rellenar márgenes de forma invisible
        let bgColor = { r: 245, g: 245, b: 245, alpha: 1 };
        try {
          const sampleW = Math.max(1, Math.min(15, imgW));
          const sampleH = Math.max(1, Math.min(15, imgH));
          const stats = await sharp(templateBuf)
            .extract({ left: 0, top: 0, width: sampleW, height: sampleH })
            .stats();
          if (stats.channels.length >= 3) {
            bgColor = {
              r: Math.round(stats.channels[0].mean),
              g: Math.round(stats.channels[1].mean),
              b: Math.round(stats.channels[2].mean),
              alpha: 1,
            };
          }
        } catch {}

        // ADAPTACIÓN SIN RECORTAR: fit: 'contain' garantiza que el 100% de la pancarta
        // (encabezados, avatar de perfil, textos superiores, bordes del marco y pie) se preserve intacto sin cortar píxeles.
        const finalBuf = await sharp(templateBuf)
          .resize(targetW, targetH, {
            fit: 'contain',
            background: bgColor,
            position: 'center',
          })
          .jpeg({ quality: 88, progressive: true })
          .toBuffer();

        const blob = new Blob([new Uint8Array(finalBuf)], { type: 'image/jpeg' });
        const uploadedUrl = await falClient.storage.upload(blob);
        console.log(`🖼️ [Banner Route] Plantilla Maestra Pura (Imagen 1) adaptada sin recorte a ${targetW}x${targetH} (${Math.round(finalBuf.length / 1024)} KB)`);
        return uploadedUrl;
      } catch (err: any) {
        console.warn('⚠️ [Banner Route] Error adaptando plantilla limpia:', err.message);
        const blob = new Blob([new Uint8Array(templateBuf)], { type: 'image/jpeg' });
        return await falClient.storage.upload(blob);
      }
    };

    // Helper para subir la foto del Sujeto / Modelo / Producto del usuario como Imagen 2 independiente
    // Con resolución completa (768px), recorte de márgenes negros/vacíos y nitidez máxima para que la visión de IA capte cada rasgo facial e identidad
    const uploadSubjectImage = async (buf: Buffer, maxDim: number = 768): Promise<string> => {
      try {
        const sharp = (await import('sharp')).default;
        let pipeline = sharp(buf);
        try {
          // Si la imagen contiene márgenes negros o transparentes vacíos alrededor del sujeto, recortarlos para maximizar el tamaño del rostro
          const trimmedBuf = await sharp(buf).trim({ threshold: 15 }).toBuffer();
          const meta = await sharp(trimmedBuf).metadata();
          if (meta.width && meta.height && meta.width > 80 && meta.height > 80) {
            pipeline = sharp(trimmedBuf);
          }
        } catch {
          // Si no tiene bordes recortables, continuar con el buffer original
        }

        const compressed = await pipeline
          .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 92, progressive: true })
          .toBuffer();
        const blob = new Blob([new Uint8Array(compressed)], { type: 'image/jpeg' });
        const url = await falClient.storage.upload(blob);
        console.log(`👤 [Banner Route] Sujeto / Modelo (Imagen 2) optimizado y subido a Fal CDN (${Math.round(compressed.length / 1024)} KB)`);
        return url;
      } catch (err: any) {
        console.warn('⚠️ [Banner Route] Fallo compresión Sharp en sujeto, subiendo original:', err.message);
        const blob = new Blob([new Uint8Array(buf)], { type: 'image/jpeg' });
        return await falClient.storage.upload(blob);
      }
    };

    // Coleccionar y preparar las imágenes de referencia
    const imageUrlsToProcess: string[] = [];
    let serverDetectedPalette: string | undefined = undefined;

    const rawTemplate = templateImage || referenceImage || (Array.isArray(body.image_urls) ? body.image_urls[0] : undefined);
    const rawTemplateBuf = rawTemplate ? await getRawBuffer(rawTemplate) : null;

    // Logo oficial de la marca (subido en Sección 4 o pasado en el body)
    const rawLogo = logoImage;
    const rawLogoBuf = (rawLogo && rawLogo !== rawTemplate) ? await getRawBuffer(rawLogo) : null;
    if (rawLogoBuf) {
      // Analizar colores reales exclusivamente desde los bytes del LOGO oficial
      const logoColors = await extractDominantColorsFromBuffer(rawLogoBuf);
      if (logoColors) {
        serverDetectedPalette = `${logoColors.colorNames} (${logoColors.hexCodes.join(', ')})`;
        console.log(`🎨 [Banner Route] Colores detectados exclusivamente del LOGO oficial: ${serverDetectedPalette}`);
      }
    }

    // Sujeto / Modelo / Producto real (subido en Sección 3 del panel)
    const rawProduct = productImage || (Array.isArray(body.image_urls) && body.image_urls.length > 1 ? body.image_urls[1] : undefined);
    const rawProdBuf = (rawProduct && rawProduct !== rawTemplate && rawProduct !== rawLogo) ? await getRawBuffer(rawProduct) : null;

    // Detección automática del aspect ratio y orientación de la plantilla para adaptar a 1024×768 / 768×1024
    let isVerticalTemplate = true;
    let detectedTemplateRatio: '1:1' | '3:4' | '16:9' | '9:16' = '3:4';
    let templateMetaWidth = 768;
    let templateMetaHeight = 1024;
    if (rawTemplateBuf) {
      try {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(rawTemplateBuf).metadata();
        if (meta.width && meta.height) {
          templateMetaWidth = meta.width;
          templateMetaHeight = meta.height;
          isVerticalTemplate = meta.height >= meta.width;
          const ratio = meta.width / meta.height;
          if (ratio >= 0.90 && ratio <= 1.10) {
            detectedTemplateRatio = '1:1';
          } else if (ratio > 1.25) {
            detectedTemplateRatio = '16:9';
          } else if (ratio < 0.65) {
            detectedTemplateRatio = '9:16';
          } else {
            detectedTemplateRatio = '3:4';
          }
        }
      } catch {}
    }

    const templateMode = typeof body.template_mode === 'string' ? body.template_mode : (typeof body.selected_banner_mode === 'string' ? body.selected_banner_mode : undefined);
    const isCustomBanner = body.is_custom_banner === true || templateMode === 'custom' || (!templateName && !body.template_id);

    // Dimensiones fijadas para tarifa canónica protegida en Fal.ai ($0.03612 USD):
    // REGLA: Si el usuario sube cualquier tamaño de pancarta personalizada, respetar fielmente
    // la proporción nativa exacta de la imagen subida, calculando dimensiones múltiplos de 16
    // sin recortar nada ni deformar la composición original:
    let finalImageSize: { width: number; height: number };
    if (aspectRatio === '9:16' || aspectRatio === 'story') {
      finalImageSize = { width: 768, height: 1344 }; // 9:16 Vertical Story
    } else if (aspectRatio === '1:1' && detectedTemplateRatio === '1:1') {
      finalImageSize = { width: 1024, height: 1024 }; // 1:1 Cuadrado genuino
    } else if (rawTemplateBuf && isCustomBanner && templateMetaWidth && templateMetaHeight) {
      if (isVerticalTemplate) {
        // Vertical: base de altura en 1024 px y ancho proporcional exacto múltiplo de 16:
        const targetH = 1024;
        const computedW = Math.max(512, Math.min(1024, Math.round((targetH * (templateMetaWidth / templateMetaHeight)) / 16) * 16));
        finalImageSize = { width: computedW, height: targetH };
      } else {
        // Horizontal: base de anchura en 1024 px y alto proporcional exacto múltiplo de 16:
        const targetW = 1024;
        const computedH = Math.max(512, Math.min(1024, Math.round((targetW / (templateMetaWidth / templateMetaHeight)) / 16) * 16));
        finalImageSize = { width: targetW, height: computedH };
      }
    } else if (!isVerticalTemplate) {
      // Pancarta apaisada / horizontal -> Estándar 1024×768
      finalImageSize = { width: 1024, height: 768 };
    } else {
      // Pancarta vertical / retrato -> Estándar vertical 768×1024 (formato 3:4 canónico de 1024x768)
      finalImageSize = { width: 768, height: 1024 };
    }

    // Imagen 1: Plantilla maestra pura (sin enviar imagen de logotipo para mantener tarifa de $0.03612 USD)
    if (rawTemplateBuf) {
      const cleanTemplateUrl = await uploadCleanTemplate(
        rawTemplateBuf,
        finalImageSize.width,
        finalImageSize.height
      );
      if (cleanTemplateUrl) {
        imageUrlsToProcess.push(cleanTemplateUrl);
      }
    }

    // Imagen 2: Sujeto / Modelo / Producto del usuario (Sección 3 del panel)
    // Se sube como referencia dedicada e independiente para que la IA capte su rostro, pose e identidad al 100%
    let hasDedicatedSubject = false;
    if (rawProdBuf && rawProdBuf !== rawTemplateBuf && rawProdBuf !== rawLogoBuf) {
      const subjectUrl = await uploadSubjectImage(rawProdBuf, 768);
      if (subjectUrl) {
        imageUrlsToProcess.push(subjectUrl);
        hasDedicatedSubject = true;
      }
    }

    // Tipo de sujeto especificado por el usuario ('person' o 'product')
    const subjectType = typeof body.subject_type === 'string' && body.subject_type === 'product' ? 'product' : 'person';

    // Determinar si el usuario proporcionó un logotipo oficial para extraer colores de marca:
    const hasBrandLogo = Boolean(rawLogoBuf);
    const hasBrandLogoOrColors = Boolean(hasBrandLogo || (productColors && productColors !== 'Colores auténticos del producto' && productColors.trim() !== ''));
    const effectiveProductColors = serverDetectedPalette || (hasBrandLogoOrColors ? productColors : undefined);

    const bulletPoints = Array.isArray(body.bullet_points)
      ? body.bullet_points.map((p: any) => String(p).trim()).filter(Boolean)
      : undefined;
    const contactInfo = typeof body.contact_info === 'string' && body.contact_info.trim()
      ? body.contact_info.trim()
      : undefined;

    // Elevar y pulir automáticamente la idea borrador con copywriting publicitario
    const { enhanceBannerCopywriting } = await import('@/lib/banner-copywriting');
    const copyEnhanced = await enhanceBannerCopywriting({
      brandName,
      offerText: headlineText,
      storeDescription: productOffer,
      contactInfo,
      language: textLanguage,
    });

    const effectiveBrand = copyEnhanced.brandName || brandName || 'TU MARCA';
    const effectiveHeadline = copyEnhanced.headline || headlineText || 'MÁXIMO CONFORT Y ESTILO';
    const effectiveOffer = copyEnhanced.offerText || productOffer || '';
    const effectiveDescription = copyEnhanced.storeDescription || productOffer || '';
    const effectiveBullets = (bulletPoints && bulletPoints.length > 0)
      ? bulletPoints
      : copyEnhanced.bulletPoints;
    const effectiveBulletsStr = effectiveBullets.join(' • ');
    const effectiveContact = contactInfo || copyEnhanced.contactInfo;

    // Generar o extraer el handle social para cuentas (ej: @rifx_marketing):
    let brandHandle = `@${effectiveBrand.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
    if (effectiveContact) {
      const handleMatch = effectiveContact.match(/@[a-zA-Z0-9._-]+/);
      if (handleMatch) {
        brandHandle = handleMatch[0];
      }
    }

    const langName = textLanguage === 'es' ? 'Spanish (Español)' : textLanguage.toUpperCase();

    // Construcción del Prompt calibrado para REPLICACIÓN EXACTA 1:1 de la pancarta según directrices oficiales de OpenAI Sunburst Edit:
    // REGLA FUNDAMENTAL: Replicar el diseño de Image 1 de forma idéntica; SOLO adaptar:
    // 1. El modelo/sujeto CON SU PROPIA ROPA ORIGINAL DE IMAGE 2 (sin usar la ropa de la plantilla)
    // 2. Las palabras (texto) reemplazando nombres y titulares viejos con los datos del usuario
    // 3. El color de la marca (o replicar los colores originales de la pancarta si no hay logo)
    const promptParts: string[] = [];

    promptParts.push(
      `========================================================================\n` +
      `SUNBURST EDIT MANDATE 1 - STRICT 1:1 DESIGN REPLICATION & ZERO CROPPING (IMAGE 1 BLUEPRINT):\n` +
      `========================================================================\n` +
      `Image 1 is the MASTER ADVERTISING BLUEPRINT and VISUAL TEMPLATE.\n` +
      `YOUR ABSOLUTE TASK IS A STRICT 1:1 REPLICATION OF THE VISUAL DESIGN OF IMAGE 1:\n` +
      `- ZERO CROPPING MANDATE (CRITICAL): RENDER THE ENTIRE VISUAL COMPOSITION OF IMAGE 1 COMPLETE AND FULLY VISIBLE FROM THE TOPMOST EDGE TO THE BOTTOMMOST EDGE!\n` +
      `  * DO NOT CROP THE TOP: Any top design elements, logos, or titles at the top of Image 1 MUST BE 100% IN-FRAME AND FULLY VISIBLE.\n` +
      `  * DO NOT CROP THE BOTTOM: Any bottom footers, cards, icons, shoes/feet, or text at the bottom edge MUST REMAIN 100% IN-FRAME AND UNCUT.\n` +
      `  * The output dimensions (${finalImageSize.width}x${finalImageSize.height}) must contain the entire uncropped layout of Image 1.\n` +
      `- EXACT VISUAL CLONING: Replicate the exact visual layout, background, camera framing, lighting, perspective, and graphical composition of Image 1 (${isCustomBanner ? 'PANCARTA PERSONALIZADA DEL USUARIO' : `Plantilla "${templateName || 'Diseño Comercial'}"`}).\n` +
      `- BACKGROUND INTEGRITY: Preserve the exact style, color, texture, and studio lighting of the background in Image 1. Do NOT invent new contrasting backgrounds or unrequested textures.\n` +
      `- FRAME & PROPS INTEGRITY: If Image 1 features a physical cutout frame (such as an Instagram post frame, social media cutout card, 3D props, or seating box), REPLICATE THAT EXACT FRAME, its proportions, icons, and seating arrangement exactly as shown in Image 1! If Image 1 does NOT have a cutout frame, DO NOT INVENT ONE!\n` +
      `- PRESERVE ALL ORIGINAL GRAPHIC ACCENTS: If Image 1 features floating elements or icons, keep them in their exact positions and 3D depth around the character.\n` +
      `- NO UNWANTED EXTRA CARDS: If Image 1 does NOT feature rectangular bottom cards or ribbons, do not invent them!\n\n` +
      `========================================================================\n` +
      `SUNBURST EDIT MANDATE 2 - HERO MODEL, MULTI-PERSON ENSEMBLE & AUTHENTIC CLOTHING (IMAGE 2):\n` +
      `========================================================================\n` +
      `${hasDedicatedSubject ? (
        `CRITICAL MANDATORY DIRECTIVE - TRANSFER THE PERSON AND THEIR AUTHENTIC CLOTHING FROM IMAGE 2:\n` +
        `Image 2 contains the user's AUTHENTIC MODEL / HERO SUBJECT.\n` +
        `${subjectType === 'person' ? (
          `1) MULTI-PERSON ENSEMBLE & STRICT ANTI-CLONING DIRECTIVE (CRITICAL):\n` +
          `  * SCENARIO A: IF IMAGE 1 CONTAINS MULTIPLE PEOPLE (a group, team, students, classroom, crowd, or ensemble with several people):\n` +
          `    - REPLACE ONLY THE PRIMARY HERO / CENTRAL FOCAL CHARACTER:\n` +
          `      The user's authentic model from Image 2 must replace ONLY the single main hero subject of the scene (the central prominent figure, such as the person seated in the chair in the center of the scene).\n` +
          `    - STRICT ANTI-CLONING NEGATIVE CONSTRAINT - UNDER NO CIRCUMSTANCES CLONE THE MODEL:\n` +
          `      DO NOT REPEAT OR DUPLICATE THE USER'S MODEL ACROSS MULTIPLE CHARACTERS!\n` +
          `      DO NOT turn all the people into clones of the same guy/girl!\n` +
          `      The user's model from Image 2 must appear EXACTLY ONCE as the central hero.\n` +
          `    - PRESERVE DIVERSE, UNIQUE SUPPORTING CHARACTERS:\n` +
          `      All the OTHER surrounding people (classmates, colleagues, background team members, bystanders) MUST REMAIN DIVERSE, DISTINCT, AND UNIQUE INDIVIDUALS!\n` +
          `      Preserve the diversity of the supporting ensemble from Image 1: keep varied ethnicities, different genders (men and women), different haircuts, unique faces, and their individual outfits from Image 1.\n` +
          `      They must NOT share the same face, gender, or clothing as the user's model.\n` +
          `  * SCENARIO B: IF IMAGE 1 CONTAINS ONLY ONE SINGLE PERSON:\n` +
          `    - Replace that single person with the user's model from Image 2.\n\n` +
          `2) 100% FACIAL IDENTITY OF THE HERO SUBJECT:\n` +
          `  * Strictly map and replicate 100% of the authentic facial features of the model from Image 2 for the hero character: identical face shape, jawline, dark expressive eyes, eyebrows, nose bridge, mouth, lips, chin, skin texture, natural complexion, and haircut.\n` +
          `  * The hero character MUST be immediately and undeniably recognizable as the EXACT same person from Image 2!\n\n` +
          `3) MANDATORY CLOTHING RETENTION FROM IMAGE 2 (DO NOT BORROW CLOTHES FROM IMAGE 1):\n` +
          `  * THE HERO MODEL MUST KEEP AND WEAR HIS/HER OWN AUTHENTIC CLOTHING AS SHOWN IN IMAGE 2!\n` +
          `  * STRICT FORBIDDEN DIRECTIVE - DO NOT DRESS THE HERO MODEL IN THE CLOTHING OF IMAGE 1:\n` +
          `    - DISCARD AND COMPLETELY REMOVE the jacket, blazer, coat, suit, or sweater worn by the person in Image 1!\n` +
          `    - DRESS THE HERO MODEL EXCLUSIVELY IN HIS/HER AUTHENTIC CLOTHING FROM IMAGE 2 (replicate their actual shirt/top, collar, sleeves, fabric texture, and clothing color exactly as shown in Image 2).\n` +
          `  * The hero model must look like THEMSELVES from Image 2, wearing their own authentic outfit from Image 2, placed naturally into the scene.\n\n` +
          `4) POSE & SCENE INTERACTION:\n` +
          `  * The hero model from Image 2 must adopt the anatomical pose, posture, body angle, limb position, and spatial interaction of the main hero subject in Image 1 (for example, sitting on the office chair, interacting with the scene).\n` +
          `  * Maintain natural fabric drape, realistic wrinkles, and lighting on his authentic clothing consistent with the scene.\n`
        ) : (
          `1) 100% PRODUCT FIDELITY & HERO SHOWCASE:\n` +
          `  * Image 2 features the user's authentic commercial product/packaging.\n` +
          `  * Integrate that EXACT physical product from Image 2 as the central hero showcase in the scene, maintaining realistic lighting and shadows.\n`
        )}`
      ) : (
        `- Preserve the human poses, ensemble, and scene interaction from Image 1.\n`
      )}\n` +
      `========================================================================\n` +
      `SUNBURST EDIT MANDATE 3 - TEXT, BRANDING & CONTACT ADAPTATION:\n` +
      `========================================================================\n` +
      `CRITICAL MANDATE: ADAPT ALL VISIBLE TEXT ACCORDING TO THE USER'S BUSINESS DATA:\n\n` +
      `1) TOP HEADER AREA & CONDITIONAL SOCIAL MEDIA BAR (CRITICAL NEGATIVE CONSTRAINT):\n` +
      `   * STRICT NEGATIVE CONSTRAINT - DO NOT INVENT SOCIAL MEDIA HEADERS ON STANDARD BANNERS:\n` +
      `     - IF Image 1 DOES NOT physically feature an Instagram post frame (e.g. it is a standard poster, flyer, collage, educational ad, or typography banner):\n` +
      `       STRICTLY FORBIDDEN TO DRAW OR INVENT ANY TOP INSTAGRAM BARS, AVATAR CIRCLES, BLUE VERIFIED BADGES, HEART, COMMENT, SHARE, BOOKMARK, OR THREE-DOT ICONS!\n` +
      `       Keep the top header area completely clean and faithful to Image 1 (if Image 1 has small sponsor/partner logos, cleanly adapt them to "${effectiveBrand}" or keep it clean).\n` +
      `     - IF AND ONLY IF Image 1 ALREADY PHYSICALLY CONTAINS an Instagram cutout frame with an existing profile header bar:\n` +
      `       Replace the old account name with "${effectiveBrand}" and the handle with "${brandHandle}". If there is an avatar circle in that frame, use the model from Image 2.\n\n` +
      `2) PRIMARY ADVERTISING HEADLINE / 3D TYPOGRAPHY REPLACEMENT:\n` +
      `   * Replace the prominent advertising headline / large typography from Image 1 (e.g. "ESSENCE", "WELCOME TO", or original main slogan) with the user's headline: "${effectiveHeadline}".\n` +
      `   * Render "${effectiveHeadline}" in the exact 3D typographic style, scale, position, perspective, and depth layering (behind or in front of the characters) as seen in Image 1!\n\n` +
      `3) CONTACT INFO, PHONE NUMBER & SOCIAL MEDIA FOOTER (USER REQUESTED & APPROVED):\n` +
      `${effectiveContact ? (
        `   * THE USER PROVIDED CONTACT DETAILS: "${effectiveContact}".\n` +
        `   * CLEANLY ADAPT AND DISPLAY THIS CONTACT INFO at the bottom / footer area of the banner with sleek modern icons (e.g. WhatsApp icon + phone number, Instagram icon + handle, web icon + URL), seamlessly integrated into the design.\n`
      ) : (
        `   * If Image 1 contains footer contact info or websites, replace them cleanly with the user's brand "${effectiveBrand}" or handle "${brandHandle}".\n`
      )}` +
      `${effectiveDescription ? `   * If Image 1 contains secondary description text or subheadlines, cleanly render: "${effectiveDescription}".\n` : ''}` +
      `${effectiveBulletsStr ? `   * Feature cards / badges: If Image 1 contains feature boxes, badges, or pill cards (e.g. key benefits or highlights), adapt their text with: "${effectiveBulletsStr}".\n` : ''}` +
      `\n` +
      `4) STRICT TEXT PURGE (ZERO OLD / FOREIGN WORDS):\n` +
      `   * STRICTLY FORBIDDEN: DO NOT LEAVE ANY OLD WORDS, PLACEHOLDERS, RUSSIAN LETTERS, OR FOREIGN TEMPLATE TEXT FROM IMAGE 1!\n` +
      `   * Every single word on the design must belong strictly to the user's business data in ${langName}.\n\n` +
      `========================================================================\n` +
      `SUNBURST EDIT MANDATE 4 - COLOR ADAPTATION & FIDELITY:\n` +
      `========================================================================\n` +
      `${hasBrandLogoOrColors && effectiveProductColors ? (
        `DIRECTIVE - ADAPT TO OFFICIAL LOGO BRAND COLORS:\n` +
        `- The user uploaded an official logo with brand colors: "${effectiveProductColors}".\n` +
        `- Harmoniously adapt the primary headline text ("${effectiveHeadline}") and subtle accent highlights to match these official logo colors.\n` +
        `- Keep all other natural background tones, lighting, and shadows clean and faithful to Image 1.\n`
      ) : (
        `CRITICAL DIRECTIVE - REPLICATE EXACT ORIGINAL COLORS FROM TEMPLATE (NO LOGO PROVIDED):\n` +
        `- THE USER DID NOT UPLOAD ANY LOGO: THERE ARE NO PREDEFINED OR DEFAULT COLORS!\n` +
        `- STRICT COLOR CLONING: Replicate 100% of the exact color scheme, typography colors, and natural styling of Image 1!\n` +
        `- The headline text ("${effectiveHeadline}") and typography must copy the exact typographic color, shading, and tone seen in Image 1 (for example, if Image 1 features bright yellow 3D letters, match that exact bright yellow; if Image 1 features white/black/neon letters, match that exact color scheme).\n`
      )}\n` +
      `========================================================================\n` +
      `SUNBURST EDIT MANDATE 5 - QUALITY & FINISH:\n` +
      `========================================================================\n` +
      `- Zero cropping: Complete visual composition from top edge to bottom edge.\n` +
      `- All visible copy must be 100% legible, crisp, spelled with perfect grammar, and rendered in ultra-high resolution 8k graphic design quality.`
    );

    if (prompt && !prompt.includes('SUNBURST EDIT MANDATE')) {
      promptParts.push(`USER DIRECTIVES: ${prompt}`);
    }

    const finalPrompt = promptParts.join('\n\n');
    const engine = 'openai/gpt-image-2.5/sunburst/edit';

    console.log(`🎨 [Banner Route Image 2.5] Iniciando ${engine} | Imágenes: ${imageUrlsToProcess.length} (Plantilla limpia + Sujeto) | Size: ${finalImageSize.width}x${finalImageSize.height} (${isVerticalTemplate ? '768x1024 Vertical' : '1024x768 Horizontal'}) | Quality: medium ($0.03612 USD) | Tenant: ${tenant.tenantId}`);

    const result: any = await falClient.subscribe(engine as any, {
      input: {
        prompt: finalPrompt,
        image_urls: imageUrlsToProcess,
        quality: 'medium', // Tarifa canónica bloqueada a $0.03612 USD
        image_size: finalImageSize as any,
        output_format: 'png',
        enable_safety_checker: true,
      },
    });

    const generatedUrl = result?.data?.images?.[0]?.url || result?.images?.[0]?.url;

    if (!generatedUrl) {
      throw new Error(`El modelo OpenAI GPT Image 2.5 completó la solicitud pero no devolvió ninguna URL de imagen.`);
    }

    // Descontar créditos en la base de datos de manera segura
    try {
      const { createSupabaseAdmin } = await import('@/lib/supabase');
      const supabase = createSupabaseAdmin();
      await deductAiCredits(
        supabase,
        tenant.tenantId,
        1,
        'Pancarta OpenAI GPT Image 2.5 ($0.03612 USD)'
      );
    } catch (creditErr: any) {
      console.warn('⚠️ [Banner Route Image 2.5] Error deduciendo crédito:', creditErr.message);
    }

    return NextResponse.json({
      success: true,
      mode: 'image',
      image: generatedUrl,
      requestId: result?.requestId || '',
      seed: result?.data?.seed,
      model: engine,
      status: 'COMPLETED',
      text_language: textLanguage,
      cost_tier: '$0.03612 USD',
    });
  } catch (err: any) {
    console.error('❌ [Banner Route Error]:', err);
    return NextResponse.json(
      {
        error: err.message || 'Error interno al comunicarse con el motor visual',
      },
      { status: 500 }
    );
  }
}
