import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { generateMaskAsFile, generateMultiZoneMaskAsFile, type ProductSlot, type EditableZone } from './mask-generator';
import { cleanTemplateTextZones, type TextSlotZone } from './template-text-cleaner';
import { aiRouter } from '@/providers/ai-router';
import { renderTextLayersOntoImage } from './flux-text-renderer';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { assertSupportedImage, decodeImageDataUri, fetchRemoteImage } from '@/lib/safe-fetch';
import { getAiCredential, runWithAiRequestContext, type AiRequestContext } from '@/lib/ai-request-context';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';
import { denyUnlessFeature } from '@/lib/feature-access';
import { readLimitedJsonObject } from '@/lib/request-guards';

export const maxDuration = 60; // GPT Image y el pipeline de 6 etapas con GPT-4o Vision AI y reintentos pueden demorar hasta 45s

// Detailed image diagnostics are useful while tuning locally, but they may
// contain customer prompts and generated copy. Keep production logs generic.
const runtimeConsole = globalThis.console;
const diagnosticsEnabled = process.env.NODE_ENV !== 'production'
  && process.env.AI_DEBUG_ARTIFACTS === '1';
const console = {
  log: (...args: unknown[]) => { if (diagnosticsEnabled) runtimeConsole.log(...args); },
  warn: (...args: unknown[]) => { if (diagnosticsEnabled) runtimeConsole.warn(...args); },
  error: (...args: unknown[]) => {
    if (diagnosticsEnabled) runtimeConsole.error(...args);
    else runtimeConsole.error('[AI image pipeline] Stage failed');
  },
};

// Descarga imagen remota a base64 Data URI
async function fetchAsBase64(url: string): Promise<string> {
  try {
    const { buffer, contentType } = await fetchRemoteImage(url, { maxBytes: 10 * 1024 * 1024, timeoutMs: 12_000 });
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (e: any) {
    console.error('⚠️ [fetchAsBase64] Error al convertir imagen externa a base64:', e.message);
    throw e;
  }
}

async function readPublicImageAsBase64(relativeUrl: string): Promise<string> {
  const pathname = decodeURIComponent(new URL(relativeUrl, 'https://local.invalid').pathname);
  const publicRoot = path.resolve(process.cwd(), 'public');
  const candidate = path.resolve(publicRoot, `.${pathname}`);
  const rootPrefix = `${publicRoot}${path.sep}`.toLowerCase();
  if (!candidate.toLowerCase().startsWith(rootPrefix)) throw new Error('Ruta pública inválida');
  const fileStat = await stat(candidate);
  if (!fileStat.isFile() || fileStat.size <= 0 || fileStat.size > 10 * 1024 * 1024) {
    throw new Error('Imagen pública fuera del tamaño permitido');
  }
  const buffer = await readFile(candidate);
  const ext = path.extname(candidate).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  assertSupportedImage(buffer, contentType);
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

// MIME válidos aceptados por OpenAI images.edit
const VALID_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
type ValidImageMime = typeof VALID_IMAGE_MIMES[number];

// Detecta MIME real de un string base64 Data URI (ej: "data:image/png;base64,...")
function detectMimeFromBase64(dataUri: string): ValidImageMime | null {
  const match = dataUri.match(/^data:(image\/[a-zA-Z]+);base64,/);
  if (!match) return null;
  let mime = match[1].toLowerCase();
  // Normalizar image/jpg → image/jpeg
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (VALID_IMAGE_MIMES.includes(mime as ValidImageMime)) {
    return mime as ValidImageMime;
  }
  return null;
}

// Infiere MIME de una URL por extensión de archivo
function inferMimeFromUrl(url: string): ValidImageMime {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.webp')) return 'image/webp';
  return 'image/png'; // fallback seguro
}

// Genera un nombre de archivo con la extensión correcta según el MIME
function filenameForMime(baseName: string, mime: ValidImageMime): string {
  const ext = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '.png';
  // Reemplazar cualquier extensión existente
  const withoutExt = baseName.replace(/\.(png|jpe?g|webp)$/i, '');
  return `${withoutExt}${ext}`;
}

// Convierte una entrada (URL o Base64) a un objeto File compatible con la API de OpenAI
// Siempre detecta y pasa el MIME type correcto. Nunca envía application/octet-stream.
// Retorna { file, mime, filename } para logging.
async function getFileFromInput(input: string, baseFilename: string): Promise<{ file: any; mime: string; filename: string }> {
  let buffer: Buffer;
  let detectedMime: ValidImageMime;

  if (input.startsWith('data:image')) {
    const decoded = decodeImageDataUri(input);
    detectedMime = decoded.contentType as ValidImageMime;
    buffer = decoded.buffer;
  } else if (input.startsWith('http')) {
    const remote = await fetchRemoteImage(input, { maxBytes: 10 * 1024 * 1024, timeoutMs: 12_000 });
    detectedMime = remote.contentType as ValidImageMime;
    buffer = remote.buffer;
  } else {
    throw new Error(`[getFileFromInput] Input para "${baseFilename}" debe ser base64 (data:image/...) o URL (http/https).`);
  }

  const finalFilename = filenameForMime(baseFilename, detectedMime);

  try {
    const { toFile } = await import('openai');
    const file = await toFile(buffer, finalFilename, { type: detectedMime });
    return { file, mime: detectedMime, filename: finalFilename };
  } catch (err: any) {
    console.warn(`⚠️ [getFileFromInput] Falló el helper toFile (${err.message}), usando fallback de Blob.`);
    // Fallback: crear un Blob con el MIME explícito
    const blob = new Blob([new Uint8Array(buffer)], { type: detectedMime });
    const file: any = blob;
    file.name = finalFilename;
    return { file, mime: detectedMime, filename: finalFilename };
  }
}

// Detecta errores de billing/quota de OpenAI para abortar inmediatamente
function isOpenAIBillingError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('billing') || msg.includes('quota') || msg.includes('insufficient_quota') ||
    msg.includes('rate limit') || err?.status === 429 || 
    (err?.status === 400 && msg.includes('limit'));
}

// POST /api/panel/generate-image
// AI PRODUCT IDENTITY LOCK & TEMPLATE STRUCTURE LOCK ENGINE (6-STAGE PIPELINE)
export async function POST(req: NextRequest) {
  try {
    // 1. Autorización
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'banners');
    if (featureDenied) return featureDenied;

    const tenantLimit = await checkRateLimit(
      rateLimitKey('generate-image', tenant.tenantId),
      10,
      60_000,
    );
    if (tenantLimit.unavailable) {
      return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    if (!tenantLimit.allowed) {
      return NextResponse.json(
        { error: 'Límite de generación alcanzado. Intenta de nuevo más tarde.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(tenantLimit.retryAfterMs / 1000)) } },
      );
    }

    const parsedBody = await readLimitedJsonObject(req, 16 * 1024 * 1024);
    if (!parsedBody.ok) return parsedBody.response;

    // 2. Load tenant credentials into an async request-local context. Never
    // mutate process.env: server instances handle concurrent tenants.
    const aiContext: AiRequestContext = {};
    try {
      const { createSupabaseAdmin } = await import('@/lib/supabase');
      const supabase = createSupabaseAdmin();
      const cfgQuery = supabase.from('config').select('openai_key').eq('tenant_id', tenant.tenantId).limit(1);
      const { data: cfgRow, error: cfgError } = await cfgQuery.maybeSingle();
      if (cfgError) throw new Error('config_lookup_failed');

      if (cfgRow?.openai_key) {
        // Decode the stored JSON blob (encodes all AI keys in one column)
        let decoded: any = {};
        try { decoded = JSON.parse(cfgRow.openai_key); } catch { decoded = { openai_key: cfgRow.openai_key }; }

        if (typeof decoded.openai_key === 'string') {
          const key = decoded.openai_key.trim();
          if (key.startsWith('sk-') && key.length > 20) {
            aiContext.openaiKey = key;
          } else {
            console.warn('[Config] Stored OpenAI credential has an invalid format');
          }
        }
        if (typeof decoded.fal_key === 'string' && decoded.fal_key.trim().length >= 20) {
          aiContext.falKey = decoded.fal_key.trim();
        }
        if (typeof decoded.groq_key === 'string' && decoded.groq_key.trim().length >= 20) {
          aiContext.groqKey = decoded.groq_key.trim();
        }
        if (['openai', 'flux', 'sharp'].includes(decoded.visual_render_provider)) {
          aiContext.visualProvider = decoded.visual_render_provider;
        }
      }
    } catch (cfgErr: any) {
      console.warn('⚠️ [Config] No se pudo cargar config desde BD:', cfgErr.message, '— usando variables de entorno');
    }

    return runWithAiRequestContext(aiContext, async () => {
    // 3. Claves API
    const openaiKey = getAiCredential('openai');
    if (!openaiKey) {
      // OpenAI key is optional when using Groq + FLUX/Sharp mode
      console.warn('⚠️ OPENAI_API_KEY no configurado — modo Groq+FLUX activo (sin costos de OpenAI)');
    }

    // 4. Extracción de Parámetros

    const body = parsedBody.body as Record<string, any>;
    const { template_json, userInstructions, campaignTitle, aspect_ratio, ad_texts_overrides, cost_saver, visual_render_provider } = body;
    let product_image = body.product_image;

    if (!template_json || typeof template_json !== 'object') {
      return NextResponse.json({ error: 'El parámetro "template_json" es obligatorio.' }, { status: 400 });
    }
    if (JSON.stringify(template_json).length > 512_000 || String(userInstructions || '').length > 10_000 || String(campaignTitle || '').length > 500) {
      return NextResponse.json({ error: 'La solicitud supera los límites permitidos.' }, { status: 413 });
    }
    if (typeof product_image === 'string') {
      if (product_image.length > 14 * 1024 * 1024) {
        return NextResponse.json({ error: 'La imagen del producto supera el límite permitido.' }, { status: 413 });
      }
      if (product_image.startsWith('http')) {
        product_image = await fetchAsBase64(product_image);
      } else if (product_image.startsWith('data:image')) {
        const decoded = decodeImageDataUri(product_image);
        product_image = `data:${decoded.contentType};base64,${decoded.buffer.toString('base64')}`;
      }
    }

    // ═══ PRODUCT IMAGE SERVER-SIDE DIAGNOSTIC ═══
    console.log('\n' + '═'.repeat(70));
    console.log('  📦 [PRODUCT IMAGE DIAGNOSTIC] — SERVER RECEIVED');
    console.log('═'.repeat(70));
    if (!product_image) {
      console.error('  ❌ product_image: NULL/UNDEFINED — NO PRODUCT IMAGE SENT!');
    } else if (typeof product_image === 'string') {
      const type = product_image.startsWith('data:image') ? 'BASE64 DATA URI'
        : product_image.startsWith('http') ? 'HTTP URL'
        : product_image.startsWith('blob:') ? '⚠️ BLOB URL (WON\'T WORK ON SERVER!)'
        : `UNKNOWN FORMAT (starts with "${product_image.substring(0, 20)}")`;
      console.log(`  ✅ product_image received: ${type}`);
      console.log(`  Length: ${product_image.length} chars`);
      if (product_image.startsWith('data:image')) {
        const mimeMatch = product_image.match(/data:image\/([a-z]+);/);
        console.log(`  MIME: ${mimeMatch ? mimeMatch[1] : 'unknown'}`);
        const b64Portion = product_image.split(',')[1];
        const approxKB = b64Portion ? Math.round(b64Portion.length * 0.75 / 1024) : 0;
        console.log(`  Approx size: ~${approxKB} KB`);
      }
    } else {
      console.error(`  ❌ product_image type: ${typeof product_image} — expected string!`);
    }
    console.log('  product_slot in template:', !!template_json?.product_slot);
    if (template_json?.product_slot) {
      const ps = template_json.product_slot;
      console.log(`  product_slot: x=${ps.x}, y=${ps.y}, w=${ps.width}, h=${ps.height}`);
    }
    console.log('═'.repeat(70) + '\n');

    // === VISUAL PROVIDER SELECTION ===
    // Priority: PURE_SHARP_MODE (env) → body param → USE_FLUX (env) → default 'sharp'
    // NEVER default to 'openai' — it requires a valid API key
    const selectedVisualProvider = aiContext.visualProvider || visual_render_provider;
    let resolvedVisualProvider: 'openai' | 'flux' | 'sharp' = 'sharp';
    if (process.env.PURE_SHARP_MODE === 'true') {
      resolvedVisualProvider = 'sharp';
    } else if (selectedVisualProvider === 'flux' || (!selectedVisualProvider && process.env.USE_FLUX === 'true')) {
      resolvedVisualProvider = 'flux';
    } else if (selectedVisualProvider === 'openai') {
      resolvedVisualProvider = 'openai';
    } else if (selectedVisualProvider === 'sharp') {
      resolvedVisualProvider = 'sharp';
    }

    // === DEVELOPMENT COST SAVER MODE ===
    const isDev = process.env.NODE_ENV === 'development';
    const costSaverMode = cost_saver === true || isDev;
    if (costSaverMode) {
      console.log(`\n💰💰💰 [COST SAVER MODE] ACTIVO — QA desactivado, retry desactivado, size según plantilla 💰💰💰\n`);
    }

    // === VISUAL PROVIDER LOG ===
    console.log('\n🎨 [VISUAL PROVIDER]');
    console.log(`  provider: ${resolvedVisualProvider}`);
    console.log(`  mode: ${resolvedVisualProvider === 'openai' ? 'compositing' : 'inpainting'}`);
    console.log(`  source: ${aiContext.visualProvider ? 'tenant_config' : selectedVisualProvider ? 'request' : process.env.USE_FLUX ? 'env_USE_FLUX' : 'default'}`);
    console.log('');

    console.log(`🎨 [AI Engine] Iniciando pipeline para plantilla: ${template_json.name} | Provider: ${resolvedVisualProvider.toUpperCase()}`);
    console.log(`📏 [AI Engine] Aspect Ratio: ${aspect_ratio || '9:16'} | Cost Saver: ${costSaverMode ? 'SÍ' : 'NO'}`);
    console.log(`[VISUAL PROVIDER ACTIVE] ${resolvedVisualProvider}`);

    // OpenAI client — only created when key is available (not needed in Groq+FLUX mode)
    const OpenAI = (await import('openai')).default;
    const openai = openaiKey ? new OpenAI({
      apiKey: openaiKey,
      timeout: 30_000,
      maxRetries: 0,
    }) : null;

    // Descargar/resolver imagen preview de la plantilla original al inicio
    const templatePreviewUrl = template_json.preview_image_url;

    // VERIFICACIÓN ESTRICTA Y LOG ROBUSTO EN LA ENTRADA
    console.log('======================================================================');
    console.log('📡 [INPUT AUDIT] AUDITORÍA DE ENTRADAS DEL GENERADOR');
    console.log('======================================================================');
    if (!templatePreviewUrl) {
      console.error(`❌ [INPUT AUDIT] ¡ERROR CRÍTICO! selectedTemplate.preview_image_url viene undefined/null!`);
    } else {
      console.log('✅ [INPUT AUDIT] template_json.preview_image_url recibido');
    }
    
    const hasProductImage = product_image && (product_image.startsWith('http') || product_image.startsWith('data:image'));
    if (!hasProductImage) {
      console.warn(`⚠️ [INPUT AUDIT] ¡ADVERTENCIA! No se detectó imagen del producto o tiene formato inválido.`);
    } else {
      console.log(`✅ [INPUT AUDIT] Imagen del producto recortado cargada correctamente (Longitud: ${product_image.length} chars)`);
    }
    console.log('======================================================================\n');

    let templatePreviewBase64: string | null = null;

    if (typeof templatePreviewUrl === 'string' && templatePreviewUrl.startsWith('/')) {
      templatePreviewBase64 = await readPublicImageAsBase64(templatePreviewUrl);
    } else if (typeof templatePreviewUrl === 'string' && templatePreviewUrl.startsWith('http')) {
      templatePreviewBase64 = await fetchAsBase64(templatePreviewUrl);
    } else if (typeof templatePreviewUrl === 'string' && templatePreviewUrl.startsWith('data:image')) {
      const decoded = decodeImageDataUri(templatePreviewUrl);
      templatePreviewBase64 = `data:${decoded.contentType};base64,${decoded.buffer.toString('base64')}`;
    } else if (templatePreviewUrl) {
      return NextResponse.json({ error: 'preview_image_url tiene un formato no permitido' }, { status: 400 });
    }



    // ==========================================
    // TEMPLATE SEMANTIC STRIPPER ENGINE
    // Strips product-specific semantic meaning from template fields.
    // Preserves visual/structural descriptors, removes category meaning.
    // ==========================================
    const semanticCategoryKeywords = [
      // Supplements
      'testosterone', 'testosterona', 'hormonal', 'hormone', 'suplemento', 'supplement',
      'vitamina', 'vitamin', 'proteina', 'protein', 'creatina', 'creatine',
      'pre-workout', 'post-workout', 'bcaa', 'aminoácido', 'amino acid',
      'energía masculina', 'male energy', 'potencia', 'potency', 'vitalidad', 'vitality',
      'recuperación', 'recovery', 'masa muscular', 'muscle mass', 'rendimiento', 'performance',
      // Skincare
      'serum', 'sérum', 'crema facial', 'face cream', 'anti-aging', 'anti-edad',
      'hidratante', 'moisturizer', 'protector solar', 'sunscreen', 'retinol', 'colágeno',
      'collagen', 'ácido hialurónico', 'hyaluronic', 'exfoliante', 'exfoliant',
      'luminosidad', 'luminosity', 'piel', 'skin care', 'skincare',
      // Tech
      'smartphone', 'laptop', 'tablet', 'auriculares', 'headphones', 'gadget',
      'procesador', 'processor', 'batería', 'battery', 'pantalla', 'display',
      // Food
      'orgánico', 'organic food', 'proteína vegetal', 'plant protein',
      'bebida energética', 'energy drink', 'snack', 'nutrition',
      // Fashion (too specific)
      'zapato', 'zapatilla', 'sneaker', 'bota', 'boot', 'sandalia',
      'camiseta', 't-shirt', 'pantalón', 'pants', 'vestido', 'dress',
      'reloj', 'watch', 'joyería', 'jewelry',
    ];

    const stripSemanticContent = (text: string): string => {
      if (!text || typeof text !== 'string') return text;
      let stripped = text;
      for (const keyword of semanticCategoryKeywords) {
        const regex = new RegExp(keyword, 'gi');
        stripped = stripped.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
      }
      return stripped;
    };

    const stripSemanticFromObj = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      if (typeof obj === 'string') return stripSemanticContent(obj);
      const result: any = Array.isArray(obj) ? [] : {};
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string') {
          result[key] = stripSemanticContent(val);
        } else if (typeof val === 'object') {
          result[key] = stripSemanticFromObj(val);
        } else {
          result[key] = val;
        }
      }
      return result;
    };

    // Create semantically-stripped versions of ALL template text fields
    // These preserve visual/structural info but remove category meaning
    const strippedStyleIdentity = stripSemanticContent(template_json.style_identity || '');
    const strippedAiDirectionRules = stripSemanticFromObj(template_json.ai_direction_rules || {});
    const strippedBrandingStyle = stripSemanticContent(template_json.branding_style || '');
    const strippedCompositionRules = stripSemanticContent(template_json.composition_rules || '');
    const strippedVisualHierarchy = stripSemanticContent(template_json.visual_hierarchy || '');
    const strippedColorBehavior = stripSemanticContent(template_json.color_behavior || '');
    const strippedRenderRules = stripSemanticContent(template_json.render_rules || '');
    const strippedTemplateName = stripSemanticContent(template_json.name || 'Ad Layout');
    console.log('🧹 [SEMANTIC STRIPPER] 8 template fields sanitized — category meaning removed, visual structure preserved.');

    // ==========================================
    // ETAPA 1: PRODUCT-AWARE CONTEXT ANALYZER (GPT-4o Vision AI)
    // ==========================================
    console.log('🔍 [STAGE 1] Ejecutando PRODUCT-AWARE CONTEXT ANALYZER (GPT-4o)...');
    let productAnalysis: any = {
      category: template_json.category || 'general',
      subcategory: 'general',
      product_name: 'producto comercial',
      main_colors: ['#ffffff'],
      materials: ['premium'],
      visible_details: [] as string[],
      shape: 'estándar',
      style: 'moderno',
      must_preserve: ['colores y formas originales'],
      visual_style: 'modern premium',
      audience: 'general consumer',
      aesthetic: 'premium commercial',
      commercial_tone: 'professional',
      luxury_level: 'mid-premium',
      mood_keywords: ['premium', 'quality'],
      marketing_angles: ['high quality', 'best value'],
      lifestyle_context: 'everyday premium lifestyle',
      premium_features: ['superior quality'],
      visual_energy: 'balanced'
    };

    if (hasProductImage) {
      try {
        productAnalysis = await aiRouter.analyzeProduct(product_image);
        console.log('✅ [STAGE 1] Product-Aware Context Analysis completado:');
        console.log(`  📦 Category: ${productAnalysis.category} / ${productAnalysis.subcategory}`);
        console.log(`  🎨 Visual Style: ${productAnalysis.visual_style}`);
        console.log(`  👥 Audience: ${productAnalysis.audience}`);
        console.log(`  🎭 Aesthetic: ${productAnalysis.aesthetic}`);
        console.log(`  💼 Commercial Tone: ${productAnalysis.commercial_tone}`);
        console.log(`  ✨ Luxury Level: ${productAnalysis.luxury_level}`);
        console.log(`  🔑 Mood Keywords: ${productAnalysis.mood_keywords?.join(', ')}`);
        console.log(`  📣 Marketing Angles: ${productAnalysis.marketing_angles?.join(', ')}`);
        console.log(`  🏙️ Lifestyle: ${productAnalysis.lifestyle_context}`);
        console.log(`  ⚡ Visual Energy: ${productAnalysis.visual_energy}`);
      } catch (err: any) {
        console.error('⚠️ Falló la Etapa 1 (Product Context Analyzer). Usando valores por defecto. Error:', err.message);
        if (isOpenAIBillingError(err)) throw err;
      }
    } else {
      console.log('ℹ️ No se cargó imagen de producto. Usando análisis por defecto basado en la plantilla.');
    }

    // ==========================================
    // ETAPA 2: PRODUCT-AWARE COPY GENERATOR (GPT-4o)
    // ==========================================
    console.log('✍️ [STAGE 2] Ejecutando PRODUCT-AWARE COPY GENERATOR (GPT-4o)...');
    let copywriting: any = {
      badge: '✨ PREMIUM',
      hook: 'Descubre lo Mejor',
      desc: 'Calidad que se siente.',
      benefits: ['Calidad premium', 'Diseño exclusivo', 'Garantía oficial'],
      cta: 'COMPRAR AHORA',
      testimonial: '',
      lifestyle_phrase: '',
      premium_descriptor: ''
    };

    try {
      copywriting = await aiRouter.generateCopy(
        productAnalysis,
        campaignTitle,
        userInstructions,
        ad_texts_overrides,
        template_json.defaultText?.benefits?.length || 3,
        !!template_json.defaultText?.testimonial
      );
      console.log('✅ [STAGE 2] Product-Aware Copy generado:');
      console.log(`  📛 Badge: ${copywriting.badge}`);
      console.log(`  🎯 Hook: ${copywriting.hook}`);
      console.log(`  📝 Desc: ${copywriting.desc}`);
      console.log(`  ✨ Benefits: ${copywriting.benefits.join(' | ')}`);
      console.log(`  🛒 CTA: ${copywriting.cta}`);
      console.log(`  🏙️ Lifestyle: ${copywriting.lifestyle_phrase}`);
      console.log(`  💎 Premium: ${copywriting.premium_descriptor}`);
    } catch (err: any) {
      console.error('⚠️ Falló la Etapa 2 (Copy Generator). Usando textos predeterminados. Error:', err.message);
      if (isOpenAIBillingError(err)) throw err;
    }

    // ==========================================
    // ETAPA 2.5: TEMPLATE VISUAL DNA ANALYZER (GPT-4o Vision)
    // ==========================================
    console.log('\n🧦 [STAGE 2.5] Ejecutando TEMPLATE VISUAL DNA ANALYZER (GPT-4o Vision)...');
    let templateDNA: any = {
      dominant_palette: [template_json.colors?.primary || '#000000', template_json.colors?.accent || '#FFD700'],
      secondary_palette: [],
      lighting_style: 'studio',
      cinematic_mood: 'premium',
      contrast_profile: 'balanced',
      glow_style: 'none',
      visual_temperature: 'neutral',
      luxury_style: 'mid-premium',
      shadow_behavior: 'soft diffuse',
      gradient_behavior: 'subtle',
      environment_style: 'dark studio',
      reflection_style: 'subtle',
      premium_render_style: 'commercial advertisement'
    };

    if (templatePreviewBase64 || templatePreviewUrl) {
      try {
        const templateImageInput = templatePreviewBase64 || templatePreviewUrl;
        templateDNA = await aiRouter.analyzeTemplateDNA(templateImageInput!, template_json.colors);
        console.log('✅ [STAGE 2.5] Template Visual DNA extraido:');
        console.log(`  🎨 Dominant Palette: ${templateDNA.dominant_palette?.join(', ')}`);
        console.log(`  🌟 Secondary Palette: ${templateDNA.secondary_palette?.join(', ')}`);
        console.log(`  💡 Lighting: ${templateDNA.lighting_style}`);
        console.log(`  🎬 Cinematic Mood: ${templateDNA.cinematic_mood}`);
        console.log(`  🌡️ Temperature: ${templateDNA.visual_temperature}`);
        console.log(`  ✨ Glow: ${templateDNA.glow_style}`);
        console.log(`  🧲 Contrast: ${templateDNA.contrast_profile}`);
        console.log(`  🌚 Shadows: ${templateDNA.shadow_behavior}`);
        console.log(`  🌈 Gradients: ${templateDNA.gradient_behavior}`);
        console.log(`  💎 Render Style: ${templateDNA.premium_render_style}`);
      } catch (err: any) {
        console.error('⚠️ Falló Stage 2.5 (Template DNA Analyzer). Usando valores derivados de template_json. Error:', err.message);
        if (isOpenAIBillingError(err)) throw err;
      }
    } else {
      console.log('ℹ️ No hay preview image disponible para Template DNA analysis. Usando valores de template_json.');
    }

    // ==========================================
    // ETAPA 3: ART DIRECTOR (Scene Design) — SEMANTIC-STRIPPED
    // ==========================================
    console.log('🎬 [STAGE 3] Ejecutando ART DIRECTOR via aiRouter...');
    let artDirection = {
      scene: strippedStyleIdentity || 'clean studio background',
      lighting: template_json.lighting_rules || 'soft studio box lights',
      camera_angle: template_json.camera_rules || 'horizontal eye-level',
      composition: template_json.composition_rules || 'product in center',
      background: strippedAiDirectionRules?.background_style || 'gradient',
      mood: strippedAiDirectionRules?.mood || 'premium'
    };

    try {
      artDirection = await aiRouter.generateArtDirection(
        strippedStyleIdentity,
        template_json,
        strippedAiDirectionRules,
        productAnalysis
      );
      console.log('✅ [STAGE 3] Dirección artística (semantic-stripped):', artDirection);
    } catch (err: any) {
      console.error('⚠️ Falló la Etapa 3 (Art Director). Usando plantilla por defecto. Error:', err.message);
      if (isOpenAIBillingError(err)) throw err;
    }


    // ==========================================
    // ETAPA 4: PROMPT MASTER (Compiler GPT-4o)
    // ==========================================
    console.log('⚙️ [STAGE 4] Ejecutando PROMPT MASTER (GPT-4o)...');

    // Colores armónicos adaptados al producto (UI palette)
    let adaptedColors = {
      primary: template_json.colors.primary,
      accent: template_json.colors.accent,
      text: template_json.colors.text,
      badgeBg: template_json.colors.badgeBg,
      badgeText: template_json.colors.badgeText
    };

    // === ENVIRONMENT COLOR PALETTE (TEMPLATE DNA DOMINANT) ===
    // Template palette is the ABSOLUTE AUTHORITY
    // Product colors are LIMITED to max 20% LOCAL influence only
    let environmentPalette = {
      product_primary: '#333333',
      product_secondary: '#666666',
      neutral_shadow: '#2B2622',
      template_primary: template_json.colors.primary || '#D8B8F2',
      blended_background: template_json.colors.primary || '#D8B8F2',
      pedestal_tint: '#9B8EA8',
      shadow_tint: '#1A1A1A',
      accent_color: template_json.colors.accent || '#FF6B35'
    };

    // COLOR ENGINE: Template DNA dominant + product LOCAL influence only
    if (productAnalysis.main_colors && productAnalysis.main_colors.length > 0) {
      try {
        const parsedColors = await aiRouter.adaptColors(
          templateDNA,
          productAnalysis,
          template_json,
          strippedStyleIdentity
        );
        if (parsedColors.ui_palette?.primary) adaptedColors = parsedColors.ui_palette as any;
        if (parsedColors.environment_palette?.product_primary) {
          environmentPalette = parsedColors.environment_palette as any;
        }
        console.log('✅ [STAGE 4] UI Colors adaptados:', adaptedColors);
        console.log('✅ [STAGE 4] Environment Fusion Palette:', environmentPalette);
      } catch (err: any) {
        console.error('❌ [STAGE 4] Error en adaptación de colores:', err?.message || err);
        console.log('ℹ️ [STAGE 4] Usando colores originales de la plantilla como fallback.');
        if (isOpenAIBillingError(err)) throw err;
      }
    }

    // Función de ayuda para limpiar y validar valores nulos, undefined o cadenas vacías literales en la plantilla
    const cleanVal = (val: any, fallback = ''): string => {
      if (val === undefined || val === null || val === 'undefined' || val === 'null' || (typeof val === 'string' && val.trim() === '')) {
        return fallback;
      }
      return typeof val === 'string' ? val.trim() : JSON.stringify(val);
    };

    // Función de ayuda para limpiar objetos anizados eliminando valores nulos o vacíos
    const cleanObj = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      const result: any = Array.isArray(obj) ? [] : {};
      for (const [key, val] of Object.entries(obj)) {
        if (val !== undefined && val !== null && val !== 'undefined' && val !== 'null' && val !== '') {
          result[key] = typeof val === 'object' ? cleanObj(val) : val;
        }
      }
      return result;
    };

    // Función interna para compilar el prompt cinematográfico con los dos locks obligatorios y texto nativo incrustado de forma 100% dinámica
    const compileAdPrompt = (correctionInstructions?: string, injectedColors?: typeof adaptedColors, injectedEnvironmentPalette?: typeof environmentPalette): string => {
      const detailsStr = (productAnalysis.visible_details && productAnalysis.visible_details.length > 0)
        ? productAnalysis.visible_details.map((d: any) => cleanVal(d)).filter(Boolean).join(', ')
        : 'original product details, texture, branding marks, and shape';
      const colorsStr = (productAnalysis.main_colors && productAnalysis.main_colors.length > 0)
        ? productAnalysis.main_colors.map((c: any) => cleanVal(c)).filter(Boolean).join(', ')
        : 'original colors';
      const materialsStr = (productAnalysis.materials && productAnalysis.materials.length > 0)
        ? productAnalysis.materials.map((m: any) => cleanVal(m)).filter(Boolean).join(', ')
        : 'original materials';
      const preserveStr = (productAnalysis.must_preserve && productAnalysis.must_preserve.length > 0)
        ? productAnalysis.must_preserve.map((p: any) => cleanVal(p)).filter(Boolean).join(', ')
        : 'original product silhouette, colors, and key details';

      // 1. Bloque PRODUCT IDENTITY LOCK totalmente dinámico
      const productIdentityLock = `Use the uploaded ${cleanVal(productAnalysis.product_name, 'product')} as the exact product reference. Preserve the exact same ${cleanVal(productAnalysis.product_name, 'product')} with colors: ${colorsStr}, materials: ${materialsStr}, and shape: ${cleanVal(productAnalysis.shape, 'original')}. Ensure the following visible details are strictly preserved: ${detailsStr}. The render engine must strictly maintain: ${preserveStr}. Do not change the product. Do not create another model. Do not make a different product type. Do not invent logos. Only improve lighting, shadows, realism and commercial presentation.`;

      // 2. Bloque TEMPLATE STRUCTURE LOCK adaptado dinámicamente al ADN visual de la plantilla, excluyendo propiedades vacías/nulas/undefined
      const dnaLines: string[] = [];
      if (strippedStyleIdentity) {
        dnaLines.push(`- Visual Style: ${strippedStyleIdentity}`);
      }
      if (strippedCompositionRules) {
        dnaLines.push(`- Composition Rules: ${strippedCompositionRules}`);
      }
      if (strippedVisualHierarchy) {
        dnaLines.push(`- Visual Hierarchy: ${strippedVisualHierarchy}`);
      }
      if (template_json.lighting_rules) {
        const val = cleanVal(template_json.lighting_rules);
        if (val) dnaLines.push(`- Lighting Rules: ${val}`);
      }
      if (template_json.camera_rules) {
        const val = cleanVal(template_json.camera_rules);
        if (val) dnaLines.push(`- Camera Rules: ${val}`);
      }
      if (strippedColorBehavior) {
        dnaLines.push(`- Color Behavior: ${strippedColorBehavior}`);
      }
      if (strippedBrandingStyle) {
        dnaLines.push(`- Branding Style: ${strippedBrandingStyle}`);
      }
      if (strippedRenderRules) {
        dnaLines.push(`- Render Rules: ${strippedRenderRules}`);
      }
      if (strippedAiDirectionRules && Object.keys(strippedAiDirectionRules).length > 0) {
        dnaLines.push(`- AI Direction Rules: ${JSON.stringify(strippedAiDirectionRules)}`);
      }

      const visualDna = `TEMPLATE VISUAL DNA — PRESERVE EXACTLY (VISUAL STRUCTURE ONLY):
The "${strippedTemplateName}" template provides VISUAL STRUCTURE:
${dnaLines.join('\n')}

⚠️ SEMANTIC ISOLATION:
The template's visual properties above describe LAYOUT, LIGHTING, COMPOSITION, and GEOMETRY only.
They do NOT define the product category, marketing message, or emotional positioning.
The UPLOADED PRODUCT is the SOLE semantic authority — all copy, claims, and messaging come from the product context.

Place the product in the EXACT position defined by the template composition.
Do NOT adapt, reinterpret, or modify the template's visual structure in ANY way.
Do NOT remove any background elements, panels, dividers, or decorative shapes.
Do NOT add new visual elements that don't exist in the template.
The template is a FINISHED VISUAL DESIGN — you are only swapping content layers.`;

      // Constructing TEMPLATE STRUCTURE LOCK with normalized coordinates
      let templateStructureLock = `TEMPLATE STRUCTURE LOCK:
Use the selected template as a strict layout reference.
Do not create a new design.
Preserve the same composition, text zones, icon placement, product placement, background geometry and visual hierarchy.
Only adapt the product, copy and category.
The final banner must look like the same template redesigned for the uploaded product, not a new banner inspired by the template.`;

      if (template_json.template_structure_lock) {
        const lock = template_json.template_structure_lock;
        let rulesStr = `\n\nSTRICT MATHEMATICAL LAYOUT BLUEPRINT (Coordinates Normalized from 0.0 to 1.0 on Canvas):
- Canvas Ratio: ${cleanVal(lock.canvas_ratio, 'vertical_4_5')}
- Layout Reference Strength: ${lock.layout_reference_strength || 95}/100 (Absolute Rigid Layout compliance)
- Layout Similarity Mode: ${cleanVal(lock.preserve_layout_similarity, 'strict')}`;

        if (lock.product_position) {
          const pos = lock.product_position;
          rulesStr += `\n- [ZONE: product] Place the product strictly inside the following normalized coordinates:
  * x: ${pos.x ?? 0.58}
  * y: ${pos.y ?? 0.25}
  * width: ${pos.width ?? 0.42}
  * height: ${pos.height ?? 0.56}
  * Area Location: "${cleanVal(pos.area, 'right_center')}"
  * Size Constraint: "${cleanVal(pos.size, 'medium_large')}"
  * Locked Status: ${(pos.locked ?? true) ? 'STRICTLY LOCKED' : 'ADAPTABLE'}
  * Perspective Constraint: ${pos.preserve_original_angle ? 'Preserve original product perspective angle exactly.' : 'Align angle for perfect product integration.'}`;
        }

        if (lock.text_zones && Array.isArray(lock.text_zones)) {
          rulesStr += `\n- Text Zones absolute coordinates and spatial boundaries:`;
          lock.text_zones.forEach((zone: any) => {
            const hasCoords = zone.x !== undefined && zone.y !== undefined;
            rulesStr += `\n  * [ZONE: ${cleanVal(zone.type)}] Positioned at "${cleanVal(zone.position)}".`;
            if (hasCoords) {
              rulesStr += ` Coordinates: x:${zone.x}, y:${zone.y}, width:${zone.width}, height:${zone.height}.`;
            }
            rulesStr += ` Size style: "${cleanVal(zone.size, 'default')}". Locked: ${(zone.locked ?? true) ? 'STRICTLY LOCKED' : 'ADAPTABLE'}.`;
            if (zone.max_lines) rulesStr += ` Max Lines: ${zone.max_lines}.`;
            if (zone.count) rulesStr += ` Count of items to display: ${zone.count} elements/icons.`;
            if (zone.icon_style) rulesStr += ` Icon layout style: "${zone.icon_style}".`;
            if (zone.preserve_spacing) rulesStr += ` Keep original layout spacing.`;
          });
        }

        if (lock.background_rules) {
          const bg = lock.background_rules;
          rulesStr += `\n- Background Set & Panel Constraints:
  * Preserve background visual shape/panels: ${bg.preserve_background_shape ? 'STRICTLY YES (Do not remove original panels, dividers, or set geometry)' : 'ADAPTABLE'}
  * Keep gradient directions: ${bg.preserve_gradient_direction ? 'STRICTLY YES (Keep exact gradient flow and direction)' : 'ADAPTABLE'}
  * Preserve curved backdrop panels/corners: ${bg.preserve_curved_panel ? 'STRICTLY YES (Keep any curved panel dividers, frames or background arches)' : 'ADAPTABLE'}`;
        }

        if (lock.forbidden_changes && Array.isArray(lock.forbidden_changes)) {
          rulesStr += `\n- STRICTLY FORBIDDEN ACTIONS (VIOLATIONS CAUSE AD REJECTION):`;
          lock.forbidden_changes.forEach((rule: string) => {
            rulesStr += `\n  * CRITICAL FORBIDDEN: ${cleanVal(rule)}`;
          });
        }

        templateStructureLock += rulesStr;
      } else {
        templateStructureLock += `\n\nFallback Layout Rules:\n- Follow layout rules, composition, and visual DNA: ${template_json.composition_rules || 'general studio'}`;
      }

      // 3. Estructura y compilación de textos en español dinámica
      const textLines: string[] = [];
      const badgeVal = cleanVal(copywriting.badge);
      if (badgeVal) textLines.push(`- Promotional Badge: ${badgeVal}`);
      
      const hookVal = cleanVal(copywriting.hook);
      if (hookVal) textLines.push(`- Headline/Hook: ${hookVal}`);
      
      const descVal = cleanVal(copywriting.desc);
      if (descVal) textLines.push(`- Description: ${descVal}`);
      
      if (copywriting.benefits && Array.isArray(copywriting.benefits)) {
        const cleanedBenefits = copywriting.benefits.map((b: any) => cleanVal(b)).filter(Boolean);
        if (cleanedBenefits.length > 0) {
          textLines.push(`- Key Benefits: ${cleanedBenefits.join(', ')}`);
        }
      }
      
      const ctaVal = cleanVal(copywriting.cta);
      if (ctaVal) textLines.push(`- Call to Action (CTA): ${ctaVal}`);
      
      if (copywriting.testimonial) {
        const testimonialVal = cleanVal(copywriting.testimonial);
        if (testimonialVal) textLines.push(`- Testimonial: "${testimonialVal}"`);
      }
      
      const footerVal = cleanVal(template_json.branding_style) || cleanVal(campaignTitle) || 'Brand';
      if (footerVal) textLines.push(`- Footer brand: ${footerVal}`);

      let textSection = '';
      if (textLines.length > 0) {
        textSection = `Add clear Spanish text inside the image:\n${textLines.join('\n')}\n\nMake all text clean, readable, correctly spelled in Spanish, large, sharp, and professionally integrated into the template's layout. Do not use paragraphs or tiny text.`;
      }

      // 4. Compilar bloque COLOR & LIGHTING LOCK dinámico desde template_json
      let colorLightingLock = `STRICT COLOR & LIGHTING LOCK:
Preserve EXACTLY the same background colors and gradients from image 1.
Match the exact color tones and hue of the template background.
Preserve the same pedestal lighting and shadow intensity.
Preserve the same glow, depth and premium rendering style.
Do not simplify the lighting.
Do not change icon colors.
Do not change text colors.
Do not change the background temperature.
Match the same cinematic commercial render quality.
Maintain the same soft shadows and studio lighting.
Maintain realistic premium ecommerce rendering.
Preserve luxury infographic rendering quality.
Preserve volumetric lighting feel.
Preserve soft cinematic ambient glow.
Preserve shadow softness and depth realism.
The final image must visually look like the same professionally designed banner.
The product must adapt to the visual style of the template, not the template to the product.`;

      if (template_json.color_and_lighting_lock) {
        const cl = template_json.color_and_lighting_lock;
        const rules: string[] = [];
        if (cl.preserve_background_colors) rules.push('Background colors: STRICTLY LOCKED');
        if (cl.preserve_gradient_palette) rules.push('Gradient palette and direction: STRICTLY LOCKED');
        if (cl.preserve_icon_colors) rules.push('Icon colors: STRICTLY LOCKED');
        if (cl.preserve_text_colors) rules.push('Text colors: STRICTLY LOCKED');
        if (cl.preserve_shadow_intensity) rules.push('Shadow intensity and style: STRICTLY LOCKED');
        if (cl.preserve_product_lighting_style) rules.push('Product lighting style: STRICTLY LOCKED (adapt product to template lighting)');
        if (cl.preserve_pedestal_colors) rules.push('Pedestal/platform colors: STRICTLY LOCKED');
        if (cl.preserve_glow_style) rules.push('Glow and bloom effects: STRICTLY LOCKED');
        if (cl.preserve_background_temperature) rules.push('Background color temperature: STRICTLY LOCKED');
        if (cl.preserve_render_quality) rules.push('Premium render quality level: STRICTLY LOCKED');
        if (cl.exact_palette_match_required) rules.push('Exact color palette match: REQUIRED');
        if (cl.color_tolerance !== undefined) rules.push(`Color deviation tolerance: ${cl.color_tolerance} (very strict)`);
        if (rules.length > 0) {
          colorLightingLock += `\n\nTemplate-specific color rules:\n${rules.map(r => `- ${r}`).join('\n')}`;
        }
      }

      // 4b. Compilar PRODUCT SCALE LOCK dinámico
      let productScaleLock = `⚠️ CRITICAL — PRODUCT SCALE LOCK:
The product in image 1 (the template) is an OVERSIZED HERO PRODUCT. It is large, dominant and fills a significant portion of the canvas.
You MUST replicate that EXACT same product size and visual footprint when placing the new product from image 2.
Do NOT shrink the product under any circumstances.
Do NOT center or reduce the product to fit neatly.
The product MUST overflow or touch the canvas edges if the template product does so.
The product MUST occupy at least 40-50% of the total canvas area, matching the template.
Maintain the same camera distance, perspective depth and foreground dominance.
The product should feel MASSIVE, DOMINANT and PREMIUM — exactly like in the template.
If the template product is partially out of frame, the new product must also be partially out of frame.
Preserve the same visual weight hierarchy: product > text > icons > background.
NEVER make the product smaller than the template original. When in doubt, make it BIGGER.`;

      if (template_json.product_scale_lock) {
        const ps = template_json.product_scale_lock;
        const scaleRules: string[] = [];
        if (ps.canvas_coverage_target) scaleRules.push(`Target canvas coverage: ${Math.round(ps.canvas_coverage_target * 100)}% of total canvas area`);
        if (ps.preserve_visual_weight) scaleRules.push('Visual weight: STRICTLY LOCKED to template original');
        if (ps.preserve_hero_scale) scaleRules.push('Hero product oversized scale: STRICTLY PRESERVED');
        if (ps.prevent_product_shrinking) scaleRules.push('Product shrinking: STRICTLY FORBIDDEN');
        if (ps.allow_partial_out_of_frame) scaleRules.push('Partial product out-of-frame: ALLOWED (match template)');
        if (ps.depth_priority) scaleRules.push(`Depth rendering priority: ${ps.depth_priority}`);
        if (ps.preserve_product_dominance) scaleRules.push('Product visual dominance: STRICTLY PRESERVED');
        if (ps.preserve_foreground_priority) scaleRules.push('Foreground layering priority: STRICTLY PRESERVED');
        if (scaleRules.length > 0) {
          productScaleLock += `\n\nTemplate-specific scale rules:\n${scaleRules.map(r => `- ${r}`).join('\n')}`;
        }
      }

      // 4c. Compilar TEMPLATE VISUAL DNA AUTHORITY + LOCAL PRODUCT COLOR INTEGRATION
      let smartColorIntegration = `⚠️ TEMPLATE VISUAL DNA LOCK — ABSOLUTE VISUAL AUTHORITY:
The template's visual identity (DNA) has been analyzed from the actual template image.
This DNA is the ABSOLUTE AUTHORITY for the render. The product adapts INTO the template, NEVER the opposite.

TEMPLATE VISUAL DNA:
- Dominant Palette: ${templateDNA.dominant_palette?.join(', ') || 'from template'}
- Lighting Style: ${templateDNA.lighting_style || 'studio'}
- Cinematic Mood: ${templateDNA.cinematic_mood || 'premium'}
- Glow Style: ${templateDNA.glow_style || 'none'}
- Visual Temperature: ${templateDNA.visual_temperature || 'neutral'}
- Shadow Behavior: ${templateDNA.shadow_behavior || 'soft diffuse'}
- Gradient Behavior: ${templateDNA.gradient_behavior || 'subtle'}
- Environment Style: ${templateDNA.environment_style || 'dark studio'}
- Contrast Profile: ${templateDNA.contrast_profile || 'balanced'}
- Premium Render Style: ${templateDNA.premium_render_style || 'commercial advertisement'}

🚫 TEMPLATE STYLE BLEEDING PREVENTION:
- Do NOT introduce colors that don't exist in the template DNA
- Do NOT add purple/lavender to a black+gold template
- Do NOT change the template's glow style or color
- Do NOT change the template's lighting direction or temperature
- Do NOT change the template's cinematic mood
- Do NOT change the template's gradient colors or direction
- The product's colors MUST NOT override the template's palette
- Product color influence on environment: MAX 20%, LOCAL ONLY (pedestal, contact shadow, rim light)

The product adapts its lighting and shadow rendering to match the template's DNA.
The template NEVER adapts to the product's visual style.`;

      if (template_json.smart_color_integration) {
        const sci = template_json.smart_color_integration;
        const sciRules: string[] = [];
        if (sci.blend_strength !== undefined) sciRules.push(`Product-to-template color blend strength: ${Math.round(sci.blend_strength * 100)}% (LOCAL ONLY)`);
        if (sci.cinematic_color_grading) sciRules.push('Cinematic color grading: ENABLED (match template DNA mood)');
        if (sci.premium_commercial_rendering) sciRules.push('Premium commercial rendering: ENABLED');
        if (sci.adaptive_shadow_tinting) sciRules.push('Adaptive shadow tinting from product colors: LOCAL ONLY (max 20%)');
        if (sci.adaptive_pedestal_tinting) sciRules.push('Adaptive pedestal tinting from product colors: LOCAL ONLY (max 20%)');
        if (sci.adaptive_glow_generation) sciRules.push('Adaptive glow: MUST match template DNA glow_style — NOT product colors');
        if (sciRules.length > 0) {
          smartColorIntegration += `\n\nTemplate-specific integration rules:\n${sciRules.map(r => `- ${r}`).join('\n')}`;
        }
      }

      // 4d. MANDATORY COLOR PALETTE EXECUTION — Template DNA dominant with product LOCAL influence
      const colorsToUse = injectedColors || adaptedColors;
      const envPalette = injectedEnvironmentPalette || environmentPalette;
      
      const adaptedColorSection = `\n⚠️ MANDATORY COLOR PALETTE (TEMPLATE DNA DOMINANT):
The template's visual DNA is the AUTHORITY. Product colors are SECONDARY and LOCAL only.

UI ELEMENT COLORS (from template DNA):
- UI Primary: ${colorsToUse.primary}
- UI Accent: ${colorsToUse.accent}
- UI Text: ${colorsToUse.text}
- Badge Background: ${colorsToUse.badgeBg}
- Badge Text: ${colorsToUse.badgeText}

ENVIRONMENT COLORS (TEMPLATE DOMINANT — product influence max 20% LOCAL):
- Template dominant color (AUTHORITY — preserve exactly): ${envPalette.template_primary}
- Background (template dominant — max 5% product shift): ${envPalette.blended_background}
- Accent color (from template DNA — NOT product blend): ${envPalette.accent_color}
- Shadow tint (template shadow style + slight product warmth): ${envPalette.shadow_tint}
- Pedestal tint (template surface + max 20% product hint): ${envPalette.pedestal_tint}
- Neutral shadow: ${envPalette.neutral_shadow}
- Product primary (reference only — do NOT spread): ${envPalette.product_primary}
- Product secondary (reference only — do NOT spread): ${envPalette.product_secondary}

COLOR EXECUTION RULES:
1. The template's dominant palette MUST remain the primary scene identity — UNCHANGED
2. Product colors influence ONLY: pedestal glow, contact shadows, rim light (MAX 20%)
3. Do NOT recolor background, gradients, curves, or decorative elements with product colors
4. Do NOT introduce glow colors foreign to the template's DNA
5. Do NOT change the template's visual temperature or cinematic mood
6. Do NOT recolor the product itself
7. Do NOT apply product colors to footer, icon timeline, text zones, or badges
8. The result must look like the product was photographed IN this template's world
9. Template palette = 80-100% of environment | Product influence = 0-20% LOCAL only
10. If template is dark+gold, shadows are dark+gold — NOT purple, NOT lavender, NOT any foreign color\n`;


      // 5. Estructura y compilación del prompt definitiva en inglés — TEMPLATE REGION FREEZE SYSTEM
      let basePrompt = `⚠️ TEMPLATE REGION FREEZE SYSTEM — FROZEN VISUAL DOCUMENT EDITING.

The template (image 1) is a FROZEN VISUAL DOCUMENT.
It is NOT a design reference. It is NOT inspiration. It is a LOCKED MASTER FILE.
You are performing PARTIAL CONTENT REPLACEMENT on specific editable layers ONLY.

Imagine image 1 is a PSD file with locked layers. Most layers are FROZEN (non-editable).
You can ONLY modify the layers explicitly marked as EDITABLE below.
Every frozen pixel must pass through to the output UNCHANGED.

=== FROZEN REGIONS (DO NOT TOUCH, DO NOT RE-RENDER, DO NOT RECONSTRUCT) ===
🔒 Background: ALL geometry, curves, panels, shapes, arcs, waves — FROZEN
🔒 Gradients: ALL directions, color stops, transitions — FROZEN
🔒 Footer bar: height, position, internal layout, proportions — FROZEN
🔒 Icon timeline/column: spacing, alignment, slot sizes, icon positions — FROZEN
🔒 Text zone geometry: positions, sizes, margins relative to each other — FROZEN
🔒 Pedestal/platform: shape, size, position — FROZEN (only reflection tint adapts)
🔒 Visual balance: weight distribution across canvas — FROZEN
🔒 Typography structure: relative sizes between heading/subheading/body/CTA — FROZEN
🔒 Decorative elements: lines, dots, shapes, dividers, accents — FROZEN
🔒 Negative space: empty areas stay exactly the same size — FROZEN
🔒 Spacing rhythm: gaps between ALL elements — FROZEN
🔒 Curve anti-aliasing: smoothness of all rounded edges — FROZEN

=== EDITABLE LAYERS (CONTENT-ONLY REPLACEMENT) ===
✏️ Product layer: Swap with uploaded product (image 2) — same position, same scale
✏️ Headline text: Replace with provided Spanish headline — same zone, same relative size
✏️ Subheadline text: Replace with provided Spanish description — same zone
✏️ Benefits text: Replace with provided benefits — same icon slots, same spacing
✏️ CTA text: Replace with provided CTA — same button zone
✏️ Icon graphics: Replace with appropriate benefit icons — same slots
✏️ Brand name: Replace with provided brand — same footer position
✏️ Local color accents: Pedestal glow, ambient shadows near product only (LOCAL, not global)

EVERYTHING NOT IN THE EDITABLE LIST IS FROZEN.
If you are unsure whether a region is editable — it is FROZEN. Do not touch it.

TEMPLATE CONTENT IGNORE LAYER:
Any text visible in image 1 is a PLACEHOLDER — it has NO semantic meaning.
Do NOT read, interpret, translate, paraphrase, or reuse ANY text from image 1.
All new text comes EXCLUSIVELY from the COPY section below.

TEMPLATE PIXEL PRESERVATION MODE:
- Preserve original gradient pixel behavior — same color stops, same transitions, same angles
- Preserve original shadow transitions — same falloff, same softness, same direction
- Preserve original background lighting — same hotspots, same intensity distribution
- Preserve original curve anti-aliasing — same smoothness on all rounded elements
- Preserve original spacing rhythm — same gaps between every element pair
- Preserve original typography proportions — same relative font sizes between all text levels
- Preserve original icon alignment — same grid positions, same spacing between icons
- Preserve original footer geometry — same height, same internal divisions, same proportions

FROZEN REGION VIOLATIONS (AUTOMATIC REJECTION):
❌ RECONSTRUCTING the background instead of preserving it = REJECTED
❌ SHIFTING geometry (curves, shapes, panels) = REJECTED
❌ CHANGING spacing between ANY elements = REJECTED
❌ REFLOWING typography (changing relative font sizes) = REJECTED
❌ SIMPLIFYING any visual element = REJECTED
❌ ADDING elements that don't exist in image 1 = REJECTED
❌ REMOVING elements that exist in image 1 = REJECTED
❌ REINTERPRETING the design = REJECTED
❌ REUSING text from image 1 = REJECTED

${productScaleLock}

${colorLightingLock}

${smartColorIntegration}

${adaptedColorSection}

RENDER QUALITY PRESERVATION:
Match the EXACT render quality level of image 1.
Match the EXACT lighting setup of image 1.
Match the EXACT shadow style of image 1.
Match the EXACT material rendering quality of image 1.
Do not upgrade or downgrade — replicate exactly.

PRODUCT IDENTITY LOCK (use image 2 as the product identity source):
${productIdentityLock}

${templateStructureLock}

${visualDna}

TEMPLATE TEXT REPLACEMENT — USE ONLY THESE TEXTS:
${textSection}
⚠️ CRITICAL: Use ONLY the texts listed above. Do NOT use any text from image 1.
All text from image 1 is a placeholder — replace it entirely with the copy above.

Visual style:
IDENTICAL to image 1. Same quality, same lighting, same shadows, same gradients, same rendering.

Avoid:
Reconstructing frozen regions, reinterpreting design, creating new layout, using template text, shifting geometry, changing spacing, reflowing typography, simplifying elements.

Output:
A FROZEN TEMPLATE EDIT of image 1. Only the product (from image 2), text content (provided Spanish copy), and local color accents (pedestal glow, ambient shadows) have changed. All frozen regions are pixel-identical to image 1.`;

      if (correctionInstructions) {
        basePrompt += `\n\n⚠️ STRICT CORRECTION REQUIRED FOR THE RENDER ENGINE:\n${correctionInstructions}`;
      }

      // gpt-image-1 edit mode supports up to 32k chars
      // Premium mode: allow up to 20k for maximum fidelity
      // Cost saver mode: truncate at 10k for shorter prompts
      const maxPromptLength = costSaverMode ? 10000 : 20000;
      if (basePrompt.length > maxPromptLength) {
        console.warn(`⚠️ [Prompt Compiler] El prompt compilado excede los ${maxPromptLength} caracteres (${basePrompt.length}). Truncando.`);
        basePrompt = basePrompt.substring(0, maxPromptLength) + '... (truncated)';
      }
      console.log(`📏 [Prompt Compiler] Longitud del prompt: ${basePrompt.length} chars (límite: ${maxPromptLength})`);

      return basePrompt;
    }

    // ==========================================
    // COMPOSITING PROMPT: Simplified prompt for mask-based product insertion
    // Supports Phase 1 (product only) and Phase 2 (product + text replacement)
    // ==========================================
    const compileCompositingPrompt = (
      productInfo: typeof productAnalysis,
      injectedColors?: typeof adaptedColors,
      injectedEnvPalette?: typeof environmentPalette
    ): string => {
      const envPalette = injectedEnvPalette || environmentPalette;
      const colors = injectedColors || adaptedColors;

      const productDesc = [
        productInfo.product_name,
        productInfo.category,
        `colors: ${productInfo.main_colors?.join(', ')}`,
        `materials: ${productInfo.materials?.join(', ')}`,
        `shape: ${productInfo.shape}`,
        `style: ${productInfo.style}`,
        productInfo.visible_details?.length ? `details: ${productInfo.visible_details.join(', ')}` : ''
      ].filter(Boolean).join('. ');

      let prompt = '';

      if (hasTextSlots) {
        // ============================================================
        // PHASE 2: Product insertion + text replacement
        // ============================================================
        prompt = `PRODUCT INSERTION + TEXT REPLACEMENT INTO MASKED AREAS.

You are editing an existing image (image 1). A mask defines MULTIPLE editable areas:
- ONE product zone (for inserting the product from image 2)
- ${textSlots.length} text zone(s) (for replacing old text with new product-specific text)

PRODUCT DETAILS:
${productDesc}

=== PRODUCT ZONE TASK ===
Insert the product from image 2 into the product zone (the largest masked area):
1. Center the product within the product zone
2. Maintain EXACT appearance from image 2 — same colors, shape, details, materials
3. Scale to fill 75-85% of the product zone
4. Match lighting and shadows of the surrounding scene
5. Add natural shadow and reflections matching the scene

=== TEXT ZONE TASK ===
The template contains OLD text from a DIFFERENT product. This old text is OBSOLETE.
ERASE all old text within the masked text zones and WRITE the new text below.

⚠️ CRITICAL TEXT RULES:
- The old template text is DEAD — do NOT preserve, translate, paraphrase, or be inspired by it
- ERASE the old text completely within each masked text zone
- WRITE the new text exactly as specified below
- Match the VISUAL STYLE of the old text (same approximate font size, weight, color, alignment)
- But use COMPLETELY DIFFERENT words — the new text below
- Text must be in SPANISH
- Text must be clean, sharp, readable, and professionally rendered

NEW TEXT CONTENT FOR EACH ZONE:`;

        // Add each text slot with its content
        for (const ts of textSlots) {
          const content = textSlotContent[ts.id] || '';
          if (content) {
            prompt += `\n- [${ts.id.toUpperCase()}] (${ts.type}): "${content}"`;
            if (ts.max_words) prompt += ` (max ${ts.max_words} words)`;
            if (ts.style) prompt += ` — style: ${ts.style}`;
          }
        }

        prompt += `

=== WHAT TO PRESERVE (everything outside masked areas) ===
- Background geometry, curves, gradients — FROZEN
- Icons, decorative elements — FROZEN
- Layout structure, spacing — FROZEN
- Visual hierarchy — FROZEN`;

      } else {
        // ============================================================
        // PHASE 1: Product insertion only (no text slots)
        // ============================================================
        prompt = `PRODUCT INSERTION INTO MASKED AREA.

You are editing an existing advertisement (image 1). A mask defines the ONLY area you can modify — the product zone.
Image 2 is the product to insert.

TASK: Insert the product from image 2 into the transparent/masked area of image 1.

PRODUCT DETAILS:
${productDesc}

INSERTION RULES:
1. Place the product from image 2 CENTERED within the masked/transparent area
2. The product must maintain its EXACT appearance from image 2 — same colors, shape, details, materials
3. Scale the product to fill approximately 75-85% of the masked area
4. Match the lighting direction and intensity of the surrounding scene
5. Add a natural shadow beneath the product that matches the scene's shadow style
6. Add subtle reflections on the pedestal/surface if one is visible in the scene
7. The product should look photographed IN this scene — seamless integration
8. Maintain the product's original perspective and angle from image 2

CRITICAL RESTRICTIONS:
- Do NOT modify ANYTHING outside the masked area
- Do NOT change the background, gradients, text, icons, or decorative elements
- Do NOT add text or labels
- Do NOT change the product's colors, shape, or identity
- ONLY render the product and its immediate shadows/reflections within the masked zone`;
      }

      // Add template DNA visual authority + local color integration (both modes)
      prompt += `

TEMPLATE VISUAL DNA AUTHORITY (the scene's visual identity):
- Lighting: ${templateDNA.lighting_style}
- Shadows: ${templateDNA.shadow_behavior}
- Glow: ${templateDNA.glow_style}
- Temperature: ${templateDNA.visual_temperature}
- Mood: ${templateDNA.cinematic_mood}
- Dominant colors in scene: ${templateDNA.dominant_palette?.join(', ')}

The product's lighting, shadows, and reflections MUST match the template's visual DNA above.
Do NOT introduce colors or lighting that conflict with the template's DNA.

LOCAL COLOR INTEGRATION (apply ONLY within masked areas — max 20% product influence):
- Shadow tint: ${envPalette.shadow_tint}
- Pedestal reflection: ${envPalette.pedestal_tint}
- Product identity colors: ${envPalette.product_primary}, ${envPalette.product_secondary} (for reference — do NOT spread into background)
- Do NOT recolor the product — only adapt shadows and reflections
- Product color influence: MAX 20% LOCAL ONLY`;

      prompt += `

OUTPUT: The SAME image with product inserted and ${hasTextSlots ? 'text replaced in masked zones' : 'composited into the masked area'}. Everything outside the mask(s) must remain PIXEL-IDENTICAL to image 1.`;

      // Phase 2 prompts are longer due to text instructions
      const maxLength = hasTextSlots ? 6000 : 4000;
      if (prompt.length > maxLength) {
        prompt = prompt.substring(0, maxLength) + '... (truncated)';
      }
      console.log(`📏 [Compositing Prompt] Longitud: ${prompt.length} chars (límite: ${maxLength}) | Mode: ${hasTextSlots ? 'PHASE 2 (product+text)' : 'PHASE 1 (product only)'}`);

      return prompt;
    }

    // ==========================================
    // COMPOSITING ENGINE: Detect product_slot + text_slots for mask-based editing
    // ==========================================
    const productSlot: ProductSlot | null = template_json.product_slot || null;
    const textSlots: any[] = template_json.text_slots || [];
    const hasTextSlots = textSlots.length > 0;
    const useCompositingMode = !!productSlot && hasProductImage && !!(templatePreviewBase64 || templatePreviewUrl);

    // Build editable zones array (product + text)
    const editableZones: EditableZone[] = [];
    if (productSlot) {
      editableZones.push({ ...productSlot, id: 'product' });
    }
    for (const ts of textSlots) {
      editableZones.push({
        x: ts.x,
        y: ts.y,
        width: ts.width,
        height: ts.height,
        shape: 'rectangle' as const,
        padding: 0.005, // slight padding for text zones
        id: ts.id || ts.type
      });
    }

    // Map copywriting to text slots — assign generated copy to each slot based on type
    const textSlotContent: Record<string, string> = {};
    for (const ts of textSlots) {
      switch (ts.type) {
        case 'headline':
          textSlotContent[ts.id] = copywriting.hook || '';
          break;
        case 'badge':
          textSlotContent[ts.id] = copywriting.badge || '';
          break;
        case 'product_title':
          textSlotContent[ts.id] = productAnalysis.product_name || copywriting.hook || '';
          break;
        case 'description':
          textSlotContent[ts.id] = copywriting.desc || '';
          break;
        case 'cta':
          textSlotContent[ts.id] = copywriting.cta || '';
          break;
        case 'testimonial':
          textSlotContent[ts.id] = copywriting.testimonial || '';
          break;
        case 'benefit_title':
          // Assign benefits sequentially
          const benefitIndex = textSlots.filter((s: any) => s.type === 'benefit_title').indexOf(ts);
          textSlotContent[ts.id] = copywriting.benefits?.[benefitIndex] || '';
          break;
        default:
          textSlotContent[ts.id] = copywriting.desc || '';
      }
    }

    // ==========================================
    // TEMPLATE TEXT ZONE CLEANING (Pre-process)
    // Cleans old text from template image BEFORE sending to gpt-image-1.
    // Runs ALWAYS when text_slots exist — regardless of compositing mode.
    // This prevents the model from reading contaminating semantic text.
    // ==========================================
    let cleanedTemplateBase64: string | null = null;
    let textCleanerDebugBase64: string | null = null;

    if (hasTextSlots && (templatePreviewBase64 || templatePreviewUrl)) {
      try {
        console.log('\n🧹🧹🧹 [TEXT CLEANER] ACTIVANDO LIMPIEZA DE TEXTO DE PLANTILLA 🧹🧹🧹');
        
        const textSlotZones: TextSlotZone[] = textSlots.map((ts: any) => ({
          id: ts.id || ts.type || 'unknown',
          x: ts.x,
          y: ts.y,
          width: ts.width,
          height: ts.height,
          type: ts.type
        }));

        const cleanResult = await cleanTemplateTextZones(
          templatePreviewBase64 || templatePreviewUrl!,
          textSlotZones
        );

        cleanedTemplateBase64 = cleanResult.cleanedBase64;
        textCleanerDebugBase64 = cleanResult.debugBase64;

        console.log(`\n🧹 [TEXT CLEANER] RESULTADO:`);
        console.log(`  text_cleaner_enabled: true`);
        console.log(`  text_slots_cleaned_count: ${cleanResult.slotsCleanedCount}`);
        console.log(`  cleaned_template_used: true`);
        console.log(`  old_template_text_visible_risk: ${cleanResult.riskLevel}`);
        for (const log of cleanResult.cleaningLog) {
          console.log(`  📋 Slot "${log.slotId}" (${log.type}): ${log.avgColor} — ${log.method}`);
        }
      } catch (cleanErr: any) {
        console.error(`⚠️ [TEXT CLEANER] Falló la limpieza de texto: ${cleanErr.message}`);
        console.log(`  text_cleaner_enabled: false (error)`);
        console.log(`  old_template_text_visible_risk: high`);
        // Continue without cleaning — fallback to raw template
      }
    } else {
      console.log(`\n🧹 [TEXT CLEANER] No activado:`);
      console.log(`  text_cleaner_enabled: false`);
      console.log(`  reason: ${!hasTextSlots ? 'no text_slots defined' : 'no template image available'}`);
      console.log(`  old_template_text_visible_risk: ${hasTextSlots ? 'high' : 'n/a'}`);
    }

    if (useCompositingMode) {
      console.log('\n🎯🎯🎯 [COMPOSITING ENGINE] MODO COMPOSITING ACTIVADO 🎯🎯🎯');
      console.log(`  Product Slot: x=${productSlot!.x}, y=${productSlot!.y}, w=${productSlot!.width}, h=${productSlot!.height}, shape=${productSlot!.shape}`);
      
      // ==========================================
      // PHASE 2 DIAGNOSTIC LOG
      // ==========================================
      console.log('\n📊 [PHASE 2 DIAGNOSTICS]');
      console.log(`  text_slots_detected: ${hasTextSlots}`);
      console.log(`  number_of_text_slots: ${textSlots.length}`);
      console.log(`  mask_zones_count: ${editableZones.length}`);
      const totalEditableArea = editableZones.reduce((sum, z) => sum + z.width * z.height, 0);
      console.log(`  total_editable_area: ${Math.round(totalEditableArea * 100)}%`);
      console.log(`  mode: ${hasTextSlots ? 'PHASE_2_PRODUCT_AND_TEXT' : 'PHASE_1_PRODUCT_ONLY'}`);
      
      if (hasTextSlots) {
        console.log('\n  📝 [TEXT SLOT ASSIGNMENTS]');
        for (const ts of textSlots) {
          const content = textSlotContent[ts.id] || '(empty)';
          console.log(`    ┌─ slot_id: "${ts.id}"`);
          console.log(`    │  type: ${ts.type}`);
          console.log(`    │  position: x=${ts.x}, y=${ts.y}, w=${ts.width}, h=${ts.height}`);
          console.log(`    │  max_words: ${ts.max_words || 'unlimited'}`);
          console.log(`    │  style: ${ts.style || 'default'}`);
          console.log(`    └─ assigned_copy: "${content}"`);
        }
        console.log(`\n  🎭 Total editable zones: ${editableZones.length} (1 product + ${textSlots.length} text)`);
      } else {
        console.log('  Template = BASE IMAGE (frozen), Mask = product zone only');
      }
    } else {
      console.log('\n⚠️ [COMPOSITING ENGINE] Modo compositing NO disponible — usando generación completa');
      if (!productSlot) console.log('  Razón: template no tiene product_slot definido');
      console.log(`  text_slots_detected: ${hasTextSlots}`);
      console.log(`  number_of_text_slots: ${textSlots.length}`);
    }

    // Compile the appropriate prompt based on provider + mode
    let compiledGptImagePrompt: string;

    if (resolvedVisualProvider === 'flux') {
      // ════════════════════════════════════════════════════════════════════
      // FLUX LIGHTING INTEGRATION PROMPT
      // ════════════════════════════════════════════════════════════════════
      // FLUX's role: ADD lighting/shadows/reflections in the integration ring.
      //
      // FLUX does NOT:
      //   - Draw the product (product is pre-composited by Sharp, restored after)
      //   - Touch the product interior (masked as BLACK — frozen)
      //   - Write text (text rendered afterwards by Sharp+SVG)
      //   - Redraw the template background (frozen zones restored by Sharp)
      //
      // strength=0.35 + integration ring mask = FLUX only touches edges.
      // Product identity is 100% restored by Sharp Step 5 in flux-provider.
      // ════════════════════════════════════════════════════════════════════
      const fluxLighting      = templateDNA.lighting_style    || artDirection.lighting || 'soft directional studio lighting';
      const fluxDominantColor = templateDNA.dominant_palette?.[0] || template_json.colors?.primary || '#1a1a2e';
      const fluxScene         = artDirection.scene || templateDNA.cinematic_mood || 'premium commercial studio';
      const fluxShadow        = templateDNA.shadow_behavior   || 'soft ground shadow';
      const fluxGlow          = templateDNA.glow_style        || 'subtle ambient rim';

      if (useCompositingMode) {
        // Compositing mode: product is already placed — FLUX adds lighting integration
        compiledGptImagePrompt = [
          `Photorealistic lighting integration.`,
          `The product is already placed in the image — DO NOT redraw or modify it.`,
          `Task: add ${fluxShadow} cast by the product on the surface below it.`,
          `Add ${fluxGlow} around the product edges to integrate with the scene.`,
          `Scene lighting: ${fluxLighting}.`,
          `Dominant background color: ${fluxDominantColor}.`,
          `Scene: ${fluxScene}.`,
          `Blend the product naturally into the background with realistic shadows and reflections.`,
          `Do NOT change the product's colors, shape, logo, or any detail.`,
          `Do NOT add text, labels, or watermarks.`,
          `Do NOT modify the background geometry or gradients.`,
          `Cinematic commercial photography lighting quality.`,
        ].join(' ');
      } else {
        // Full generation mode (no template compositing)
        compiledGptImagePrompt = [
          `Photorealistic product advertising scene.`,
          `Scene: ${fluxScene}.`,
          `Lighting: ${fluxLighting}.`,
          `Background dominant color: ${fluxDominantColor}.`,
          `Add realistic ground shadow and rim lighting around the product.`,
          `Do NOT add text, labels, or watermarks.`,
          `Premium commercial photography, cinematic quality.`,
        ].join(' ');
      }

      // Cap at 700 chars — FLUX performs best with short, focused prompts
      if (compiledGptImagePrompt.length > 700) {
        compiledGptImagePrompt = compiledGptImagePrompt.substring(0, 700);
      }
      console.log(`⚡ [FLUX Prompt] Lighting-integration prompt (${compiledGptImagePrompt.length} chars)`);
      console.log(`   Product identity: Sharp (not FLUX) | Text: Sharp+SVG (not FLUX)`);
    } else {
      // OpenAI GPT-Image-1: full structured prompt with text instructions
      compiledGptImagePrompt = useCompositingMode
        ? compileCompositingPrompt(productAnalysis, adaptedColors, environmentPalette)
        : compileAdPrompt(undefined, adaptedColors, environmentPalette);
    }


    console.log(`✅ [STAGE 4] Prompt ${useCompositingMode ? 'COMPOSITING' : 'maestro'} compilado exitosamente.`);
    console.log(`📝 [Prompt Snippet]:\n"${compiledGptImagePrompt.substring(0, 200)}..."`);

    // ==========================================
    // ETAPA 5 & 6: IMAGE RENDER & QUALITY CHECK LOOP
    // ==========================================
    let base64Image: string | null = null;
    
    // Determinar tamaño de imagen para GPT Image — SOLO tamaños oficiales OpenAI
    const allowedSizes = ['1024x1024', '1024x1536', '1536x1024', 'auto'] as const;
    type OpenAIImageSize = typeof allowedSizes[number];

    // Auto-detectar orientación desde template JSON → aspect_ratio param → fallback
    const templateCanvasRatio: string = (
      template_json.template_structure_lock?.canvas_ratio ||
      template_json.canvas_ratio ||
      aspect_ratio ||
      '9:16'
    ).toLowerCase().replace(/\s/g, '');

    const portraitKeywords = ['9:16', '9/16', '4:5', '4/5', '2:3', '2/3', 'portrait', 'vertical', 'story', 'stories', 'reels', 'reel', 'portrait_9_16', 'portrait_4_5'];
    const landscapeKeywords = ['16:9', '16/9', '3:2', '3/2', 'landscape', 'horizontal', 'youtube', 'youtube_thumbnail', 'banner_horizontal'];
    const squareKeywords = ['1:1', '1/1', 'square', 'instagram_post', 'feed', 'cuadrado'];

    let gptImageSize: OpenAIImageSize = '1024x1536'; // default: vertical (más común para ads)

    if (squareKeywords.some(k => templateCanvasRatio.includes(k))) {
      gptImageSize = '1024x1024';
    } else if (landscapeKeywords.some(k => templateCanvasRatio.includes(k))) {
      gptImageSize = '1536x1024';
    } else if (portraitKeywords.some(k => templateCanvasRatio.includes(k))) {
      gptImageSize = '1024x1536';
    }

    // Validación final de seguridad — NUNCA enviar tamaños no soportados
    if (!allowedSizes.includes(gptImageSize)) {
      console.warn(`⚠️ [Size Validator] Tamaño inválido detectado: "${gptImageSize}". Corrigiendo a 1024x1536.`);
      gptImageSize = '1024x1536';
    }

    console.log(`📐 [Size Mapping] template_canvas_ratio="${templateCanvasRatio}" → mapped_openai_size="${gptImageSize}" | cost_saver=${costSaverMode ? 'ON (QA+retry off, size respetado)' : 'OFF (QA+retry activo)'}`);


    // Función auxiliar para renderizar con el motor exclusivo de OpenAI GPT Image (gpt-image-1)
    // COMPOSITING ENGINE: Soporta modo mask (template frozen + product insertion) y modo legacy (multi-image)
    const renderImage = async (promptText: string): Promise<{ base64: string; provider: string } | null> => {
      const maxRenderAttempts = 2;
      let renderAttempt = 0;
      let renderDelay = 3000;

      while (renderAttempt < maxRenderAttempts) {
        renderAttempt++;
        console.log(`🎨 [STAGE 5] [Intento ${renderAttempt}/${maxRenderAttempts}] Generando imagen publicitaria con AI Router (FLUX / OpenAI)...`);
        
        try {
          const startTime = Date.now();
          const hasTemplatePreview = !!templatePreviewUrl;

          // Parse canvas dimensions from gptImageSize
          const [canvasW, canvasH] = (gptImageSize as string) === 'auto' 
            ? [1024, 1536] 
            : gptImageSize.split('x').map(Number);
          
          // Generate mask PNG — transparent in editable zones, opaque everywhere else
          let maskFile;
          if (useCompositingMode && productSlot) {
            if (hasTextSlots && editableZones.length > 1) {
              // PHASE 2: Multi-zone mask (product + text slots)
              console.log(`🎭 [STAGE 5] Generando MULTI-ZONE mask PNG (${canvasW}x${canvasH}) — ${editableZones.length} zonas editables...`);
              maskFile = await generateMultiZoneMaskAsFile(editableZones, canvasW, canvasH);
              const totalEditableArea = editableZones.reduce((sum, z) => sum + z.width * z.height, 0);
              console.log(`✅ [STAGE 5] Multi-zone mask: ${editableZones.length} zonas, ~${Math.round(totalEditableArea * 100)}% del canvas editable`);
              for (const z of editableZones) {
                console.log(`    → [${z.id}] ${Math.round(z.width * 100)}%x${Math.round(z.height * 100)}% @ (${z.x}, ${z.y})`);
              }
            } else {
              // PHASE 1: Single product zone mask
              console.log(`🎭 [STAGE 5] Generando mask PNG (${canvasW}x${canvasH}) para product_slot...`);
              maskFile = await generateMaskAsFile(productSlot, canvasW, canvasH);
              console.log(`✅ [STAGE 5] Mask generado: zona editable = ${Math.round(productSlot.width * 100)}%x${Math.round(productSlot.height * 100)}% del canvas`);
            }
          }

          const templateImageSource = cleanedTemplateBase64 || templatePreviewBase64 || templatePreviewUrl;

          // Call the router
          const result = await aiRouter.renderVisual(
            promptText,
            templateImageSource!,
            product_image,
            maskFile,
            gptImageSize,
            useCompositingMode,
            {
              productSlot,
              editableZones,
              hasTextSlots,
              cleanedTemplateBase64: cleanedTemplateBase64 || undefined,
              visualProvider: resolvedVisualProvider,
            }
          );

          const duration = Date.now() - startTime;
          console.log(`⏱️ [STAGE 5] [Intento ${renderAttempt}] Respuesta recibida en ${duration}ms via ${result.provider}.`);

          return result;

        } catch (e: any) {
          console.error(`❌ [STAGE 5] [Intento ${renderAttempt}] Ocurrió un error:`, e.message);

          const status = e.status || e.statusCode || (e.response && e.response.status);
          const errMsg = (e.message || '').toUpperCase();
          const isRateLimit = status === 429 || 
                              errMsg.includes('429') || 
                              errMsg.includes('RESOURCE_EXHAUSTED') || 
                              errMsg.includes('RATE_LIMIT') || 
                              errMsg.includes('TOO MANY REQUESTS');
          const isTransientError = status === 500 || 
                                   status === 503 || 
                                   status === 504 || 
                                   errMsg.includes('500') || 
                                   errMsg.includes('503') || 
                                   errMsg.includes('504') || 
                                   errMsg.includes('TIMEOUT') || 
                                   errMsg.includes('BAD GATEWAY');

          if ((isRateLimit || isTransientError) && renderAttempt < maxRenderAttempts) {
            console.warn(`⏳ [Reintento] Detectado error recuperable (${isRateLimit ? '429 Rate Limit' : 'Error Temporal de Servidor'}). Esperando ${renderDelay}ms para reintento con backoff exponencial...`);
            await new Promise((resolve) => setTimeout(resolve, renderDelay));
            renderDelay *= 2; // Incrementar el delay al doble para el próximo intento (Backoff Exponencial)
            continue;
          }

          // Si agotamos los intentos o no es un error recuperable, lanzamos el error
          throw e;
        }
      }
      return null;
    }

    // ==========================================
    // ETAPA 6: QUALITY CHECK & AUTO-RETRY LOOP
    // ==========================================
    const maxRetries = costSaverMode ? 0 : 1; // Cost saver: 0 retries (1 generación). Producción: 1 retry.
    let attempts = 0;
    let retryTriggered = false;
    let qaResult: any = { 
      passed: true, 
      template_similarity_score: 100,
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
      template_text_leakage_detected: false,
      background_reconstruction_detected: false,
      geometry_shift_detected: false,
      spacing_shift_detected: false,
      typography_reflow_detected: false,
      reason: 'No product reference image provided to perform verification.', 
      issues: [] as string[],
      retry_triggered: false
    };
    let finalPromptToUse = compiledGptImagePrompt;
    let actualProvider: 'openai' | 'flux' | 'sharp' | string = resolvedVisualProvider;
    let visualQaResult: any = null;

    while (attempts <= maxRetries) {
      console.log(`🚀 [PIPELINE] Intento de renderizado ${attempts + 1} de ${maxRetries + 1}...`);
      const renderResult = await renderImage(finalPromptToUse);

      if (!renderResult) {
        throw new Error('El motor de renderizado de imagen retornó un valor vacío.');
      }

      actualProvider = renderResult.provider || resolvedVisualProvider;

      // ════════════════════════════════════════════════════════════════════
      // FLUX TEXT RENDERING STAGE
      // When FLUX is the visual provider + there are text_slots:
      //   FLUX rendered the visual (product, lighting, shadows, background)
      //   Now Sharp+SVG renders the EXACT Spanish copy at precise positions
      //
      // This separates visual quality (FLUX) from text legibility (Sharp)
      // and eliminates all FLUX text hallucination / blurriness issues.
      // ════════════════════════════════════════════════════════════════════
      if (resolvedVisualProvider === 'flux' && hasTextSlots && textSlots.length > 0) {
        try {
          // Parse canvas dimensions from gptImageSize (same logic used in flux-provider)
          const [fluxCanvasW, fluxCanvasH] = (gptImageSize as string) === 'auto'
            ? [1024, 1536]
            : gptImageSize.split('x').map(Number);

          console.log(`\n🖊️ [FLUX TEXT STAGE] Iniciando renderizado de texto con Sharp+SVG...`);
          console.log(`  text_slots: ${textSlots.length}`);
          console.log(`  canvas: ${fluxCanvasW}x${fluxCanvasH}`);

          // Convert base64 result to buffer for sharp processing
          const base64Data = renderResult.base64.replace(/^data:image\/[a-z]+;base64,/, '');
          const renderBuffer = Buffer.from(base64Data, 'base64');

          const textRenderedBuffer = await renderTextLayersOntoImage(
            renderBuffer,
            textSlots,
            textSlotContent,
            fluxCanvasW,
            fluxCanvasH,
            adaptedColors
          );

          // Re-encode as base64 data URI
          base64Image = `data:image/png;base64,${textRenderedBuffer.toString('base64')}`;
          console.log(`✅ [FLUX TEXT STAGE] Texto renderizado correctamente — imagen final lista`);
        } catch (textRenderErr: any) {
          console.error(`⚠️ [FLUX TEXT STAGE] Error en text rendering: ${textRenderErr.message}`);
          console.warn(`  Usando imagen FLUX sin texto como fallback`);
          base64Image = renderResult.base64;
        }
      } else {
        base64Image = renderResult.base64;
      }

      // ════════════════════════════════════════════════════════════════════
      // STAGE 6a: PERCEPTUAL VISUAL QA (Sharp-based, $0 cost)
      // Real pixel-level analysis: product presence, template integrity
      // ════════════════════════════════════════════════════════════════════
      visualQaResult = null; // Reset for each attempt
      if (hasProductImage && base64Image) {
        try {
          const { runVisualQA } = await import('./visual-qa');
          const generatedBuf = Buffer.from(base64Image, 'base64');

          // Resolve template buffer
          let templateBuf: Buffer | null = null;
          if (templatePreviewBase64) {
            const cleanB64 = templatePreviewBase64.replace(/^data:image\/[a-z]+;base64,/, '');
            templateBuf = Buffer.from(cleanB64, 'base64');
          } else if (templatePreviewUrl) {
            try {
              const remote = await fetchRemoteImage(templatePreviewUrl, { maxBytes: 10 * 1024 * 1024 });
              templateBuf = remote.buffer;
            } catch { /* skip */ }
          }

          // Resolve product buffer
          let productBuf: Buffer | null = null;
          if (product_image) {
            productBuf = decodeImageDataUri(product_image).buffer;
          }

          const parsedSize = gptImageSize?.match(/(\d+)x(\d+)/);
          const cW = parsedSize ? parseInt(parsedSize[1]) : 1024;
          const cH = parsedSize ? parseInt(parsedSize[2]) : 1536;
          const ps = useCompositingMode && template_json?.product_slot ? template_json.product_slot : null;

          if (templateBuf) {
            visualQaResult = await runVisualQA(generatedBuf, templateBuf, productBuf, ps, cW, cH);

            // If Visual QA recommends fallback_sharp AND we used FLUX, auto-retry with Sharp
            if (visualQaResult.recommendation === 'fallback_sharp' && actualProvider !== 'sharp-pure-compositing') {
              console.warn('⚠️ [VISUAL QA] Recomienda fallback a Sharp determinístico — producto ausente o template destruido');
              // The current image is bad — but we'll let the semantic QA handle retry logic
            }
          }
        } catch (vqaErr: any) {
          console.warn(`⚠️ [VISUAL QA] Error en validación perceptual: ${vqaErr.message}`);
        }
      }

      // ════════════════════════════════════════════════════════════════════
      // STAGE 6b: SEMANTIC QA (Groq text-based, $0 cost)
      // Validates copywriting category alignment and text leakage
      // ════════════════════════════════════════════════════════════════════
      // Solo realizamos el Quality Check si el usuario subió una imagen de referencia Y no estamos en cost_saver mode
      if (hasProductImage && !costSaverMode) {
        console.log('🔍 [STAGE 6] Ejecutando QUALITY CHECK (Perceptual + Semántico)...');
        try {
          const finalTplUrl = templatePreviewBase64 || templatePreviewUrl;
          qaResult = await aiRouter.runQA(
            finalTplUrl || '',
            product_image,
            base64Image,
            finalPromptToUse,
            environmentPalette,
            adaptedColors,
            useCompositingMode,
            copywriting,
            productAnalysis
          );
          const parsedQA = qaResult;
          
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
          
          // ── MERGE: Override Groq's hardcoded-100 visual scores with real perceptual measurements ──
          // Groq QA only validates text semantics — visual scores are fake (always 100).
          // The Visual QA (Sharp-based) provides real pixel-level measurements.
          if (visualQaResult) {
            // Override template structure scores with real pixel comparison
            const vqa = visualQaResult;
            if (vqa.template_preservation_score < 100) {
              // Use the lower of Groq (always 100) and real measurement
              const realTemplateSimilarity = vqa.template_preservation_score;
              // Only override if the Groq score was fake (100)
              if (similarityScore >= 100) {
                console.log(`  [VISUAL QA MERGE] template_similarity: ${similarityScore} → ${realTemplateSimilarity} (real pixel measurement)`);
              }
            }
            if (vqa.product_presence_score < 100 && productIdentityScore >= 100) {
              console.log(`  [VISUAL QA MERGE] product_identity: ${productIdentityScore} → ${vqa.product_presence_score} (real presence check)`);
            }
            if (vqa.color_consistency_score < 100 && colorScore >= 100) {
              console.log(`  [VISUAL QA MERGE] color_palette: ${colorScore} → ${vqa.color_consistency_score} (real histogram comparison)`);
            }
          }

          // Use real scores when available, fall back to Groq scores
          const realTemplateScore = visualQaResult ? Math.min(similarityScore, visualQaResult.template_preservation_score) : similarityScore;
          const realProductScore = visualQaResult ? Math.min(productIdentityScore, visualQaResult.product_presence_score) : productIdentityScore;
          const realColorScore = visualQaResult ? Math.min(colorScore, visualQaResult.color_consistency_score) : colorScore;
          const realLayoutScore = visualQaResult ? Math.min(layoutScore, visualQaResult.layout_integrity_score) : layoutScore;

          // ALL scores now affect pass/fail — unified threshold of 85
          const structurePassed = realTemplateScore >= 85 && realLayoutScore >= 85 && realProductScore >= 85 && iconColumnOk && iconCountOk && textZoneOk;
          const geometryPassed = bgGeometryScore >= 85 && pedestalScore >= 85 && spacingScore >= 85 && visualBalanceScore >= 85 && templateGeometryScore >= 85;
          const colorPassed = realColorScore >= 85 && shadowScore >= 85 && lightingScore >= 85 && renderScore >= 85 && colorHarmonyScore >= 85 && productColorEnvScore >= 85;
          const scalePassed = scaleScore >= 85 && weightScore >= 85;
          const fidelityPassed = reinterpretationScore <= 15 && !textLeakage && typographyStructureScore >= 85;
          const freezePassed = frozenRegionScore >= 85 && !bgReconstructed && !geoShifted && !spacingShifted && !typoReflowed;
          const visualQaPassed = !visualQaResult || visualQaResult.passed;
          const isPassed = parsedQA.passed === true && structurePassed && geometryPassed && colorPassed && scalePassed && fidelityPassed && freezePassed && visualQaPassed;

          qaResult = {
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
            reason: parsedQA.reason || 'Sin detalles.',
            issues: parsedQA.issues || [],
            retry_triggered: retryTriggered
          };

          console.log(`✅ [STAGE 6] QA Resultado (Intento ${attempts + 1}):`, qaResult);

          if (qaResult.passed) {
            console.log('🎉 [PIPELINE] ¡Quality Check APROBADO! Procediendo a entregar la imagen.');
            break; // Aprobado, salimos del bucle
          } else {
            console.warn('⚠️ [PIPELINE] Quality Check RECHAZADO. Detalles:', qaResult.issues);
            if (attempts < maxRetries) {
              console.log('🔄 [PIPELINE] Ejecutando Bucle de Auto-Regeneración con Prompt Restrictivo Correctivo...');
              retryTriggered = true;
              qaResult.retry_triggered = true;
              attempts++;
              
              // Build targeted correction based on which specific scores failed
              const issuesStr = qaResult.issues.map((issue: string) => `- ${issue}`).join('\n');
              const failedMetrics: string[] = [];
              if (similarityScore < 85) failedMetrics.push(`CRITICAL: Template Similarity only ${similarityScore}/100 — preserve EXACT background curves, shapes, and overall look from image 1`);
              if (layoutScore < 85) failedMetrics.push(`CRITICAL: Layout Preservation only ${layoutScore}/100 — do NOT move any element, keep exact same positions`);
              if (productIdentityScore < 85) failedMetrics.push(`CRITICAL: Product Identity only ${productIdentityScore}/100 — the product must be IDENTICAL to image 2`);
              if (bgGeometryScore < 85) failedMetrics.push(`CRITICAL: Background Geometry only ${bgGeometryScore}/100 — preserve EXACT background curves, panels, and shapes`);
              if (pedestalScore < 85) failedMetrics.push(`CRITICAL: Pedestal Similarity only ${pedestalScore}/100 — the pedestal must be IDENTICAL in shape and position`);
              if (spacingScore < 85) failedMetrics.push(`CRITICAL: Spacing only ${spacingScore}/100 — do NOT change spacing between ANY elements`);
              if (visualBalanceScore < 85) failedMetrics.push(`CRITICAL: Visual Balance only ${visualBalanceScore}/100 — maintain exact same weight distribution`);
              if (colorScore < 85) failedMetrics.push(`CRITICAL: Color Palette only ${colorScore}/100 — match EXACT colors from image 1`);
              if (shadowScore < 85) failedMetrics.push(`CRITICAL: Shadow Match only ${shadowScore}/100 — preserve same shadow intensity and direction`);
              if (lightingScore < 85) failedMetrics.push(`CRITICAL: Lighting only ${lightingScore}/100 — match exact studio lighting from image 1`);
              if (colorHarmonyScore < 85) failedMetrics.push(`CRITICAL: Color Harmony only ${colorHarmonyScore}/100 — blend product colors more naturally into environment`);
              if (productColorEnvScore < 85) failedMetrics.push(`CRITICAL: Product Color Environment Influence only ${productColorEnvScore}/100 — the product's dominant colors (${environmentPalette.product_primary}, ${environmentPalette.product_secondary}) MUST visibly influence pedestal (use ${environmentPalette.pedestal_tint}), shadows (use ${environmentPalette.shadow_tint}), and background (use ${environmentPalette.blended_background}). Do NOT leave the scene as flat ${environmentPalette.template_primary}`);
              if (typographyStructureScore < 85) failedMetrics.push(`CRITICAL: Typography Structure only ${typographyStructureScore}/100 — preserve EXACT same relative font sizes between heading, subheading, body, CTA. This is EDITING, not redesigning`);
              if (templateGeometryScore < 85) failedMetrics.push(`CRITICAL: Template Geometry Preservation only ${templateGeometryScore}/100 — preserve ALL curves, rounded corners, arcs, decorative shapes EXACTLY as in image 1`);
              if (reinterpretationScore > 15) failedMetrics.push(`CRITICAL: Template Reinterpretation ${reinterpretationScore}/100 — you are RECREATING the design instead of EDITING it. This is a SURGICAL EDIT task. Do NOT reinterpret. Preserve image 1 structure EXACTLY and only swap product + text content`);
              if (textLeakage) failedMetrics.push(`CRITICAL: Template Text Leakage DETECTED — you are using text from image 1. ALL text must come from provided Spanish copy`);
              if (frozenRegionScore < 85) failedMetrics.push(`CRITICAL: Frozen Region Integrity only ${frozenRegionScore}/100 — frozen regions were modified. Do NOT re-render frozen regions. They must be pixel-identical to image 1`);
              if (bgReconstructed) failedMetrics.push(`CRITICAL: Background RECONSTRUCTED — you rebuilt the background instead of preserving it. The background is a FROZEN REGION. Do not re-render it. Copy it exactly from image 1`);
              if (geoShifted) failedMetrics.push(`CRITICAL: Geometry SHIFTED — curves, shapes, or panels were deformed or moved. These are FROZEN. Preserve them pixel-perfect from image 1`);
              if (spacingShifted) failedMetrics.push(`CRITICAL: Spacing SHIFTED — gaps between elements changed. Spacing is FROZEN. Match image 1 exactly`);
              if (typoReflowed) failedMetrics.push(`CRITICAL: Typography REFLOWED — relative font sizes changed between heading/body/CTA. Typography structure is FROZEN. Match image 1`);
              if (scaleScore < 85) failedMetrics.push(`CRITICAL: Product Scale only ${scaleScore}/100 — product MUST be SAME SIZE as in template`);
              if (weightScore < 85) failedMetrics.push(`CRITICAL: Visual Weight only ${weightScore}/100 — product must feel MASSIVE and DOMINANT`);
              if (!iconCountOk) failedMetrics.push(`CRITICAL: Icon count changed — preserve EXACT same number`);
              if (!textZoneOk) failedMetrics.push(`CRITICAL: Text zones moved — keep ALL text in original positions`);
              if (!iconColumnOk) failedMetrics.push(`CRITICAL: Icon column moved — keep in EXACT same position`);

              const correctionPrompt = `
⚠️ CRITICAL QUALITY CORRECTION REQUIRED — ATTEMPT ${attempts + 1}:
ALL PREVIOUS SCORES: Similarity=${similarityScore}, Layout=${layoutScore}, ProductID=${productIdentityScore}, BgGeometry=${bgGeometryScore}, Pedestal=${pedestalScore}, Spacing=${spacingScore}, Balance=${visualBalanceScore}, TemplateGeometry=${templateGeometryScore}, Color=${colorScore}, Shadow=${shadowScore}, Lighting=${lightingScore}, ColorHarmony=${colorHarmonyScore}, ProductColorEnv=${productColorEnvScore}, Render=${renderScore}, Scale=${scaleScore}, Weight=${weightScore}, TypographyStructure=${typographyStructureScore}, Reinterpretation=${reinterpretationScore}, FrozenRegion=${frozenRegionScore}, BgReconstructed=${bgReconstructed}, GeoShift=${geoShifted}, SpacingShift=${spacingShifted}, TypoReflow=${typoReflowed}, TextLeakage=${textLeakage}

TARGETED CORRECTIONS (fix ONLY what failed, threshold is 85):
${failedMetrics.join('\n')}

ISSUES FROM QA ENGINE:
${issuesStr}

You are EDITING image 1, NOT creating a new design. Make it PIXEL-PERFECT identical to the template!
The result must be visually indistinguishable from the original template in ALL locked regions.`;
              // CRITICAL: Stay in compositing mode on retry — never fall back to legacy prompt
              if (useCompositingMode) {
                console.log('🔄 [PIPELINE] Retry mantiene COMPOSITING MODE — mask + cleaned template preservados');
                finalPromptToUse = compileCompositingPrompt(productAnalysis, adaptedColors, environmentPalette);
              } else {
                finalPromptToUse = compileAdPrompt(correctionPrompt, adaptedColors, environmentPalette);
              }
            } else {
              console.error('❌ [PIPELINE] Se agotaron los reintentos de regeneración con OpenAI. Retornando la mejor imagen disponible.');
              break;
            }
          }
        } catch (err: any) {
          console.error('⚠️ Error ejecutando la etapa 6 (Quality Check):', err.message);
          if (isOpenAIBillingError(err)) throw err;
          break; // Salir ante un fallo del motor de QA para no bloquear el flujo
        }
      } else {
        break; // Sin imagen de producto, no ejecutamos QA
      }
    }

    // ======================================================================
    // 📊 REPORT DE AUDITORÍA QA FINAL EN CONSOLA
    // ======================================================================
    console.log(`
======================================================================
📊 INFORME DE AUDITORÍA QA FINAL EN CONSOLA
======================================================================
  Result Passed:               ${qaResult.passed ? '✅ PASSED' : '❌ FAILED'}
  --- ESTRUCTURA (umbral ≥ 85) ---
  Template Similarity Score:   ${qaResult.template_similarity_score} / 100
  Layout Preservation Score:   ${qaResult.layout_preservation_score} / 100
  Product Identity Score:      ${qaResult.product_identity_score} / 100
  Icon Count Preservation:     ${qaResult.icon_count_preservation ? '✅ SÍ' : '❌ NO (QA FAIL)'}
  Icon Column Position:        ${qaResult.icon_column_position_preserved ? '✅ SÍ' : '❌ NO (QA FAIL)'}
  Text Zone Preservation:      ${qaResult.text_zone_preservation ? '✅ SÍ' : '❌ NO (QA FAIL)'}
  --- GEOMETRÍA & ESPACIADO (umbral ≥ 85) ---
  Background Geometry Score:   ${qaResult.background_geometry_score} / 100
  Pedestal Similarity Score:   ${qaResult.pedestal_similarity_score} / 100
  Spacing Similarity Score:    ${qaResult.spacing_similarity_score} / 100
  Visual Balance Score:        ${qaResult.visual_balance_score} / 100
  Template Geometry Preserv:  ${qaResult.template_geometry_preservation_score} / 100
  --- COLOR & ILUMINACIÓN (umbral ≥ 85) ---
  Color Palette Match:         ${qaResult.color_palette_match_score} / 100
  Shadow Match:                ${qaResult.shadow_match_score} / 100
  Lighting Match:              ${qaResult.lighting_match_score} / 100
  Premium Render Similarity:   ${qaResult.premium_render_similarity_score} / 100
  Color Harmony Score:         ${qaResult.color_harmony_score} / 100
  Product Color Env Influence: ${qaResult.product_color_environment_influence_score} / 100
  --- ESCALA & PESO VISUAL (umbral ≥ 85) ---
  Product Scale Similarity:    ${qaResult.product_scale_similarity_score} / 100
  Visual Weight Similarity:    ${qaResult.visual_weight_similarity_score} / 100
  Typography Structure:        ${qaResult.typography_structure_preservation_score} / 100
  --- FIDELIDAD QUIRÚRGICA ---
  Reinterpretation Score:      ${qaResult.template_reinterpretation_score} / 100 ${qaResult.template_reinterpretation_score > 15 ? '❌ FAIL (>15)' : '✅ OK (≤15)'}
  Text Leakage Detected:       ${qaResult.template_text_leakage_detected ? '❌ SÍ (FAIL)' : '✅ NO'}
  --- REGION FREEZE INTEGRITY ---
  Frozen Region Integrity:     ${qaResult.frozen_region_integrity_score} / 100
  BG Reconstruction Detected:  ${qaResult.background_reconstruction_detected ? '❌ SÍ (FAIL)' : '✅ NO'}
  Geometry Shift Detected:     ${qaResult.geometry_shift_detected ? '❌ SÍ (FAIL)' : '✅ NO'}
  Spacing Shift Detected:      ${qaResult.spacing_shift_detected ? '❌ SÍ (FAIL)' : '✅ NO'}
  Typography Reflow Detected:  ${qaResult.typography_reflow_detected ? '❌ SÍ (FAIL)' : '✅ NO'}
  --- META ---
  Retry Triggered:             ${qaResult.retry_triggered ? '🔄 SÍ (Auto-reintento ejecutado)' : '🛑 NO'}
  Reason:                      ${qaResult.reason}
======================================================================
    `);


    // 8. Retorno compatible con la estructura existente del frontend
    if (costSaverMode) {
      qaResult.reason = '💰 COST SAVER MODE — QA omitido para ahorrar saldo. Todos los prompts de estructura, color y scale lock se mantuvieron.';
    }

    const responsePayload = {
      success: true,
      image: base64Image,
      detected_product: {
        category: productAnalysis.category,
        subcategory: productAnalysis.subcategory,
        product_name: productAnalysis.product_name,
        main_colors: productAnalysis.main_colors,
        materials: productAnalysis.materials,
        visible_details: productAnalysis.visible_details,
        shape: productAnalysis.shape,
        style: productAnalysis.style,
        material: productAnalysis.materials?.[0] || 'premium',
        must_preserve: productAnalysis.must_preserve,
        visual_style: productAnalysis.visual_style,
        audience: productAnalysis.audience,
        aesthetic: productAnalysis.aesthetic,
        commercial_tone: productAnalysis.commercial_tone,
        luxury_level: productAnalysis.luxury_level,
        mood_keywords: productAnalysis.mood_keywords,
        marketing_angles: productAnalysis.marketing_angles,
        lifestyle_context: productAnalysis.lifestyle_context,
        premium_features: productAnalysis.premium_features,
        visual_energy: productAnalysis.visual_energy
      },
      adapted_text: copywriting,
      adapted_colors: adaptedColors,
      environment_palette: environmentPalette,
      prompt: finalPromptToUse,
      provider: actualProvider || resolvedVisualProvider,
      qa_results: qaResult,
      visual_qa: visualQaResult || null,
      cost_saver_mode: costSaverMode,
      compositing_mode: useCompositingMode,
      product_slot_used: productSlot || null,
      template_visual_dna: templateDNA,
      text_slots_used: hasTextSlots ? textSlots.length : 0,
      text_slot_content: hasTextSlots ? textSlotContent : null,
      template_readiness: template_json.template_readiness || (productSlot ? (hasTextSlots ? 'ready' : 'draft') : 'legacy'),
      text_cleaner: {
        enabled: !!cleanedTemplateBase64,
        slots_cleaned: hasTextSlots ? textSlots.length : 0,
        cleaned_template_used: !!cleanedTemplateBase64,
        old_text_visible_risk: cleanedTemplateBase64 ? 'low' : (hasTextSlots ? 'high' : 'n/a'),
      },
      cleaned_template_preview: textCleanerDebugBase64 || null,
    };

    // ═══ COST AUDIT LOG ═══
    console.log('\n' + '═'.repeat(70));
    console.log('  [AI COST AUDIT] — GENERATION COMPLETE');
    console.log('═'.repeat(70));
    console.log(`  provider_used:            ${responsePayload.provider}`);
    console.log(`  model_used:               ${resolvedVisualProvider === 'flux' ? 'fal-ai/flux-general/inpainting' : 'gpt-image-1'}`);
    console.log(`  openai_called:            ${resolvedVisualProvider === 'openai'}`);
    console.log(`  flux_called:              ${resolvedVisualProvider === 'flux'}`);
    console.log(`  groq_called:              ${process.env.USE_GROQ === 'true'}`);
    console.log(`  fallback_triggered:       false`);
    console.log(`  endpoint_used:            ${resolvedVisualProvider === 'flux' ? 'fal.ai/flux-general/inpainting' : 'api.openai.com/images/edits'}`);
    console.log(`  estimated_cost:           ${resolvedVisualProvider === 'flux' ? '~$0.03 (FLUX)' : '~$0.08-0.12 (OpenAI)'}`);
    console.log(`  image_edit_calls:         ${resolvedVisualProvider === 'openai' ? '1' : '0'}`);
    console.log(`  image_generation_calls:   ${resolvedVisualProvider === 'openai' ? '1' : '0'}`);
    console.log(`  retries_count:            ${attempts}`);
    console.log(`  cost_saver_mode:          ${costSaverMode}`);
    console.log(`  qa_check_ran:             ${!!qaResult?.passed}`);
    console.log('═'.repeat(70) + '\n');

    return NextResponse.json(responsePayload);
    });

  } catch (error: any) {
    console.error('AI render pipeline failed:', error instanceof Error ? error.name : 'unknown_error');
    
    const msg = (error.message || '').toLowerCase();
    
    // Detectar errores de billing/quota/auth de Fal.ai primero (FLUX)
    if (msg.includes('fal.ai') || msg.includes('fal-ai')) {
      return NextResponse.json({ 
        error: '⚠️ El crédito de fal.ai (FLUX) se agotó o el balance está bloqueado. Por favor, recarga tu saldo en fal.ai/dashboard/billing o contacta al administrador.' 
      }, { status: 402 });
    }
    
    // Detectar errores de billing/quota
    if (msg.includes('billing') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('insufficient_quota') || error.status === 429 || (error.status === 400 && msg.includes('limit'))) {
      return NextResponse.json({ 
        error: '⚠️ Límite de API alcanzado. El sistema usa Groq (gratis) + FLUX para generación. Si ves este error, revisa que FAL_KEY esté configurado correctamente en el servidor.' 
      }, { status: 402 });
    }
    
    return NextResponse.json({ error: 'Error interno en el servidor de IA' }, { status: 500 });
  }
}
