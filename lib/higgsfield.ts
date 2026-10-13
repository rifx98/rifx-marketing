import { getAiCredential } from './ai-request-context';

export interface HiggsfieldGenerateOptions {
  prompt: string;
  aspectRatio?: string;
  resolution?: '1k' | '2k' | '4k' | '720p' | '1080p';
  quality?: 'low' | 'medium' | 'high'; // 'low' es el modo más barato ($0.05 vs $0.37)
  enhancePrompt?: boolean; // false por defecto para costo directo más bajo
  textLanguage?: string; // 'es' (Español), 'en', 'pt', 'fr', 'it', 'de', etc.
  headlineText?: string; // Titular o eslogan principal para imprimir en el banner
  brandName?: string; // Nombre exacto de la marca para evitar deformaciones tipográficas
  productCategory?: string; // 'auto' | 'beauty' | 'fitness' | 'perfume' | 'tech' | 'fashion' | 'food'
  backgroundStyle?: 'adaptive' | 'studio_neutral' | 'template';
  productColors?: string; // Colores del producto para armonizar el diseño
  templateName?: string; // Nombre de la plantilla de referencia para mantener orden y estructura
  presetId?: string;
  model?: string;
  apiKey?: string;
  imageUrl?: string;
  imageUrls?: string[];
  negativePrompt?: string;
  batchSize?: number;
}

export interface HiggsfieldMarketingStudioImageOptions {
  prompt: string;
  quality?: 'low' | 'medium' | 'high'; // 'low' ($0.05)
  resolution?: '1k' | '2k' | '4k'; // '2k' por defecto
  aspectRatio?: string; // 'auto', '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9'
  enhancePrompt?: boolean; // false (direct mode, más económico)
  textLanguage?: string; // Idioma de los textos y tipografía en el banner ('es', 'en', etc.)
  headlineText?: string;
  brandName?: string;
  productCategory?: string;
  backgroundStyle?: 'adaptive' | 'studio_neutral' | 'template';
  productColors?: string;
  templateName?: string;
  presetId?: string;
  apiKey?: string;
  imageUrl?: string;
  imageUrls?: string[];
}

export interface HiggsfieldGenerateResult {
  success: boolean;
  imageUrl: string;
  requestId: string;
  status: string;
  costTier?: string;
  raw?: any;
}

const HIGGSFIELD_BASE_URL = 'https://api.higgsfield.ai';
const DEFAULT_MODEL = 'marketing-studio/image';

/**
 * Normaliza la clave de API para la cabecera Authorization requerida por Higgsfield:
 * Formato oficial: "Authorization: Key ${API_KEY_ID}:${API_KEY_SECRET}"
 */
export function formatHiggsfieldAuth(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.toLowerCase().startsWith('key ') || trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed;
  }
  return `Key ${trimmed}`;
}

/**
 * Enriquece el prompt para garantizar que la IA de Marketing Studio escriba
 * todos los textos, titulares y viñetas del afiche en el idioma especificado (ej. Español).
 */
export function enrichPromptWithLanguage(prompt: string, lang?: string, headline?: string, brandName?: string): string {
  let enriched = prompt.trim();
  const normalized = (lang || 'es').toLowerCase().trim();

  // Si se proporcionó un nombre de marca explícito
  if (brandName && brandName.trim()) {
    const b = brandName.trim();
    if (!enriched.toLowerCase().includes(b.toLowerCase())) {
      enriched = `${enriched} Brand: "${b}".`;
    }
  }

  // Si se proporcionó un titular o eslogan explícito
  if (headline && headline.trim()) {
    const h = headline.trim();
    if (!enriched.toLowerCase().includes(h.toLowerCase())) {
      enriched = `${enriched} Headline: "${h}".`;
    }
  }

  // Guardia Anti-Glitches Tipográfico conciso (solo si no se menciona ya tipografía)
  const hasTypoGuard = enriched.toLowerCase().includes('typograph') || enriched.toLowerCase().includes('anti-glitch') || enriched.toLowerCase().includes('tipograf');
  if (!hasTypoGuard) {
    enriched = `${enriched} Clean vector typography, zero artifacts.`;
  }

  // Directiva de idioma concisa (solo si no se especifica ya el idioma)
  const hasLangDirective = enriched.toLowerCase().includes('spanish') || enriched.toLowerCase().includes('español') || enriched.toLowerCase().includes('language directive');
  if (!hasLangDirective) {
    if (normalized === 'es' || normalized === 'español' || normalized === 'spanish') {
      enriched = `${enriched} All visible text in Spanish (Español).`;
    } else if (normalized === 'pt' || normalized === 'português' || normalized === 'portuguese') {
      enriched = `${enriched} All visible text in Portuguese.`;
    } else if (normalized === 'fr' || normalized === 'français' || normalized === 'french') {
      enriched = `${enriched} All visible text in French.`;
    } else if (normalized === 'it' || normalized === 'italiano' || normalized === 'italian') {
      enriched = `${enriched} All visible text in Italian.`;
    } else if (normalized === 'de' || normalized === 'deutsch' || normalized === 'german') {
      enriched = `${enriched} All visible text in German.`;
    } else if (lang && lang.trim() && normalized !== 'en' && normalized !== 'english') {
      enriched = `${enriched} All visible text in ${lang.trim()}.`;
    }
  }

  // Guardia anti-textos de plantilla (nunca copiar 'Plantilla de...', 'Template', o textos de prueba)
  const hasAntiPlaceholder = enriched.toLowerCase().includes('never copy') || enriched.toLowerCase().includes('do not write template');
  if (!hasAntiPlaceholder) {
    enriched = `${enriched} Never copy dummy placeholder words like "Plantilla de..." from the template; only write product-relevant copy.`;
  }

  return enriched;
}

/**
 * Enriquece el prompt para adaptar dinámicamente el fondo, la ambientación y la paleta de colores
 * al producto real entregado, mientras preserva con fidelidad la estructura, orden y jerarquía de la plantilla.
 */
export function enrichPromptWithProductAdaptation(
  prompt: string,
  options: {
    productCategory?: string;
    backgroundStyle?: 'adaptive' | 'studio_neutral' | 'template';
    productColors?: string;
    templateName?: string;
  }
): string {
  let enriched = prompt;
  const colors = options.productColors?.trim();
  const tplName = options.templateName?.trim();

  // Si el prompt ya contiene directrices estructurales precisas, no duplicar ni distorsionar
  const alreadyHasStructure =
    prompt.toLowerCase().includes('structural layout') ||
    prompt.toLowerCase().includes('replicating the layout') ||
    prompt.toLowerCase().includes('layout structure') ||
    prompt.toLowerCase().includes('concentric circular') ||
    prompt.toLowerCase().includes('clone layout') ||
    prompt.toLowerCase().includes('circular 360');

  let structureRule = '';
  if (!alreadyHasStructure && tplName) {
    const isCircular =
      tplName.toLowerCase().includes('ruleta') ||
      tplName.toLowerCase().includes('circular') ||
      tplName.toLowerCase().includes('360') ||
      tplName.toLowerCase().includes('ritmo');
    if (isCircular) {
      structureRule = `Circular 360° layout: real product on central 3D pedestal, surrounded by curved arc panels, customer models, trust badges, and clean typography.`;
    } else {
      structureRule = `Strictly clone the geometric layout structure, visual zones, and framing of reference template "${tplName}". Replace focal subject with uploaded real product.`;
    }
  }

  // Si el prompt ya contiene adaptación de paleta o color, no duplicar
  const alreadyHasColorRule =
    prompt.toLowerCase().includes('color adaptation') ||
    prompt.toLowerCase().includes('palette:') ||
    prompt.toLowerCase().includes('recolor all background') ||
    prompt.toLowerCase().includes('product palette');

  let colorRule = '';
  if (!alreadyHasColorRule && colors) {
    colorRule = `Color adaptation: recolor all background, geometric shapes, and lighting to match product palette: ${colors}.`;
  }

  return [enriched, structureRule, colorRule].filter(Boolean).join(' ');
}

/**
 * Mapea aspect ratios comunes a los soportados por Marketing Studio y Soul v2:
 * 'auto', '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9'
 */
export function mapHiggsfieldAspectRatio(ratio?: string): string {
  if (!ratio) return 'auto';
  const clean = ratio.trim().toLowerCase();
  const valid = new Set(['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9']);
  if (valid.has(clean)) return clean;
  if (clean === '4:5') return '3:4'; // 4:5 vertical se mapea al ratio de retrato 3:4
  if (clean === '5:4') return '4:3';
  return 'auto';
}

/**
 * Sube una imagen en Base64 o Buffer directamente a la CDN oficial de Higgsfield AI (S3/CloudFront).
 * Retorna una URL pública corta (https://d3snorpfx4xhv8.cloudfront.net/...) para evitar el error de Pydantic
 * "image_url URL should have at most 2083 characters" [type=url_too_long].
 */
export async function uploadHiggsfieldImageCdn(
  dataUriOrBuffer: string | Buffer,
  credentials: string
): Promise<string> {
  const authHeader = formatHiggsfieldAuth(credentials);

  let buffer: Buffer | undefined;
  let contentType = 'image/png';

  if (typeof dataUriOrBuffer === 'string') {
    // Si ya es una URL pública externa accesible por internet
    if (
      (dataUriOrBuffer.startsWith('http://') || dataUriOrBuffer.startsWith('https://')) &&
      !dataUriOrBuffer.includes('localhost') &&
      !dataUriOrBuffer.includes('127.0.0.1')
    ) {
      return dataUriOrBuffer;
    }

    // Si es una ruta relativa local (ej: /templates/...) o URL de localhost
    if (dataUriOrBuffer.startsWith('/') || dataUriOrBuffer.includes('localhost') || dataUriOrBuffer.includes('127.0.0.1')) {
      try {
        const { readFile } = await import('node:fs/promises');
        const path = await import('node:path');
        const cleanPath = dataUriOrBuffer.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
        const localPath = path.resolve(process.cwd(), 'public', cleanPath);
        buffer = await readFile(localPath);
        const ext = path.extname(localPath).toLowerCase();
        contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
      } catch (err: any) {
        console.warn(`[Higgsfield Upload] No se pudo leer archivo local ${dataUriOrBuffer}:`, err.message);
      }
    }

    if (!buffer) {
      const match = dataUriOrBuffer.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        contentType = match[1] || 'image/png';
        buffer = Buffer.from(match[2], 'base64');
      } else {
        buffer = Buffer.from(dataUriOrBuffer, 'base64');
      }
    }
  } else {
    buffer = dataUriOrBuffer;
  }

  if (!buffer || buffer.length === 0) {
    throw new Error('El buffer de imagen para subir a Higgsfield está vacío o no es válido.');
  }

  console.log(`[Higgsfield CDN Upload] Solicitando URL de carga para imagen (${contentType}, ${Math.round(buffer.length / 1024)} KB)...`);

  const genRes = await fetch(`${HIGGSFIELD_BASE_URL}/files/generate-upload-url`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      'User-Agent': 'higgsfield-server-js/2.0',
    },
    body: JSON.stringify({
      content_type: contentType,
    }),
  });

  if (!genRes.ok) {
    const errBody = await genRes.json().catch(() => ({}));
    throw new Error(`Error al solicitar enlace de subida a Higgsfield: ${errBody?.detail || genRes.statusText}`);
  }

  const genData = await genRes.json();
  const { upload_url, public_url, upload_headers } = genData;

  if (!upload_url || !public_url) {
    throw new Error('Higgsfield no devolvió URLs válidas para la carga del archivo.');
  }

  console.log(`[Higgsfield CDN Upload] Subiendo binario a almacenamiento S3/CloudFront...`);

  const putHeaders: Record<string, string> = {
    ...(upload_headers || {}),
    'Content-Type': contentType,
  };

  const uploadRes = await fetch(upload_url, {
    method: 'PUT',
    headers: putHeaders,
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    throw new Error(`Error al subir la imagen al CDN de Higgsfield (${uploadRes.status}): ${uploadRes.statusText}`);
  }

  console.log(`[Higgsfield CDN Upload] Imagen subida exitosamente: ${public_url}`);
  return public_url;
}

/**
 * Cliente HTTP nativo para Higgsfield AI.
 * Reemplaza el SDK oficial para evitar dependencias de Node.js (form-data/fs)
 * que provocan errores de módulo no disponible en Next.js App Router / Turbopack.
 */
async function higgsfieldSubscribe(
  endpoint: string,
  input: Record<string, any>,
  credentials: string
): Promise<any> {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const authHeader = formatHiggsfieldAuth(credentials);

  console.log(`[Higgsfield Native HTTP] Iniciando llamada a: ${HIGGSFIELD_BASE_URL}${path}`);

  const res = await fetch(`${HIGGSFIELD_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      'User-Agent': 'higgsfield-server-js/2.0',
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody?.detail || errorBody?.message || errorBody?.error || res.statusText;
    console.error(`[Higgsfield Native HTTP] Error ${res.status}:`, errorBody);

    if (res.status === 401 || (typeof message === 'string' && (message.toLowerCase().includes('auth') || message.toLowerCase().includes('credential')))) {
      throw new Error(
        'Credenciales de Higgsfield inválidas. Verifica tu Key ID y Key Secret en open.higgsfield.ai.'
      );
    }
    if (res.status === 403 || (typeof message === 'string' && message.toLowerCase().includes('credit'))) {
      throw new Error(
        'Saldo insuficiente en tu cuenta de Higgsfield AI (Not enough credits). Por favor recarga créditos en open.higgsfield.ai o console.higgsfield.ai para continuar generando.'
      );
    }
    throw new Error(`Error en Higgsfield AI (${res.status}): ${typeof message === 'string' ? message : JSON.stringify(message)}`);
  }

  let data = await res.json();
  const requestId = data.request_id;

  if (data.status === 'completed' || data.status === 'failed' || data.status === 'nsfw' || data.status === 'canceled') {
    return data;
  }

  if (requestId) {
    const startTime = Date.now();
    const maxPollTime = 120_000;
    const pollInterval = 2_500;

    while (Date.now() - startTime < maxPollTime) {
      await new Promise((r) => setTimeout(r, pollInterval));
      try {
        const pollRes = await fetch(`${HIGGSFIELD_BASE_URL}/requests/${requestId}/status`, {
          headers: {
            Authorization: authHeader,
          },
        });
        if (pollRes.ok) {
          data = await pollRes.json();
          if (
            data.status === 'completed' ||
            data.status === 'failed' ||
            data.status === 'nsfw' ||
            data.status === 'canceled'
          ) {
            break;
          }
        }
      } catch (pollErr: any) {
        console.warn(`[Higgsfield Polling] Advertencia en sondeo:`, pollErr.message);
      }
    }
  }

  return data;
}

/**
 * Cliente para generar imágenes y pancartas publicitarias con la API de Higgsfield.ai
 * Soporta Marketing Studio Image (con modo low a $0.02 USD) y Soul v2.
 */
export async function generateHiggsfieldImage(
  options: HiggsfieldGenerateOptions
): Promise<HiggsfieldGenerateResult> {
  const credentials =
    options.apiKey?.trim() ||
    getAiCredential('higgsfield') ||
    process.env.HF_CREDENTIALS ||
    process.env.HIGGSFIELD_API_KEY;

  if (!credentials) {
    throw new Error(
      'No se encontró la API Key de Higgsfield. Configura tu credencial (Key ID:Key Secret) en Ajustes o en el generador de pancartas.'
    );
  }

  const requestedModel = options.model?.trim() || DEFAULT_MODEL;
  const isMarketingStudio =
    requestedModel === 'marketing-studio/image' ||
    requestedModel === 'marketing-studio' ||
    requestedModel === DEFAULT_MODEL;

  let response: any;
  let costTier = 'low ($0.05 USD)';

  if (isMarketingStudio) {
    // ═══════════════════════════════════════════════════════════════
    // MARKETING STUDIO IMAGE (Configuración económica: Low = $0.05 USD con referencias)
    // ═══════════════════════════════════════════════════════════════
    const quality = options.quality || 'low'; // Configuración de máximo ahorro ($0.05)
    costTier = quality === 'low' ? 'low ($0.05 USD)' : quality === 'medium' ? 'medium (~$0.18 USD)' : 'high ($0.37 USD)';
    const resolution = (options.resolution === '1k' || options.resolution === '4k') ? options.resolution : '2k';
    const mappedRatio = mapHiggsfieldAspectRatio(options.aspectRatio);
    // Direct mode es false (ahorra 10% adicional). Si enhance_prompt es true, quality debe ser high según spec.
    const enhancePrompt = options.enhancePrompt ?? false;

    const effectivePromptWithLang = enrichPromptWithLanguage(options.prompt, options.textLanguage, options.headlineText, options.brandName);
    const effectivePrompt = enrichPromptWithProductAdaptation(effectivePromptWithLang, {
      productCategory: options.productCategory,
      backgroundStyle: options.backgroundStyle,
      productColors: options.productColors,
      templateName: options.templateName,
    });

    // Higgsfield Marketing Studio y Soul v2 tienen validación estricta de longitud de prompt (~1000 chars máx).
    // Truncamos de forma segura en límite de palabra a 850 caracteres para garantizar HTTP 200 OK siempre.
    let finalPrompt = effectivePrompt.trim();
    if (finalPrompt.length > 850) {
      finalPrompt = finalPrompt.slice(0, 850).replace(/\s+\S*$/, '').trim();
      console.warn(`[Higgsfield Marketing Studio] Prompt truncado a ${finalPrompt.length} caracteres para respetar el límite de la API.`);
    }

    const input: Record<string, any> = {
      prompt: finalPrompt,
      quality,
      resolution,
      aspect_ratio: mappedRatio,
      enhance_prompt: enhancePrompt,
    };

    if (options.presetId) {
      input.preset_id = options.presetId;
    }

    // Procesar imágenes de referencia / producto (Up to 16 images)
    // Preservar prioritariamente el orden provisto en options.imageUrls (ej. Template -> Producto)
    const rawImages: string[] = [];
    if (Array.isArray(options.imageUrls) && options.imageUrls.length > 0) {
      for (const img of options.imageUrls) {
        if (img && typeof img === 'string' && img.trim() && !rawImages.includes(img.trim())) {
          rawImages.push(img.trim());
        }
      }
    }
    if (options.imageUrl && typeof options.imageUrl === 'string' && options.imageUrl.trim() && !rawImages.includes(options.imageUrl.trim())) {
      rawImages.push(options.imageUrl.trim());
    }

    if (rawImages.length > 0) {
      const uploadedUrls: string[] = [];
      for (const img of rawImages) {
        if ((img.startsWith('http://') || img.startsWith('https://')) && !img.includes('localhost') && !img.includes('127.0.0.1')) {
          uploadedUrls.push(img);
        } else {
          console.log(`[Higgsfield Marketing Studio] Subiendo imagen a CDN oficial de Higgsfield...`);
          const cdnUrl = await uploadHiggsfieldImageCdn(img, credentials);
          uploadedUrls.push(cdnUrl);
        }
      }
      input.image_urls = uploadedUrls;
    }

    console.log(`[Higgsfield Marketing Studio] 🎨 Generando imagen con endpoint "marketing-studio/image" | Calidad: ${quality} (${costTier}) | Res: ${resolution} | Ratio: ${mappedRatio} | Enhance: ${enhancePrompt}`);

    try {
      response = await higgsfieldSubscribe('marketing-studio/image', input, credentials);
    } catch (err: any) {
      console.error('[Higgsfield Marketing Studio] Error:', err);
      throw err;
    }
  } else {
    // ═══════════════════════════════════════════════════════════════
    // SOUL V2 (STANDARD / IMAGE-TO-IMAGE)
    // ═══════════════════════════════════════════════════════════════
    let model = requestedModel;
    if (options.imageUrl && (model === 'higgsfield-ai/soul/v2/standard')) {
      model = 'higgsfield-ai/soul/v2/image-to-image';
    }
    const mappedRatio = mapHiggsfieldAspectRatio(options.aspectRatio);

    let soulPrompt = options.prompt.trim();
    if (soulPrompt.length > 850) {
      soulPrompt = soulPrompt.slice(0, 850).replace(/\s+\S*$/, '').trim();
      console.warn(`[Higgsfield Image] Prompt truncado a ${soulPrompt.length} caracteres para respetar el límite de la API.`);
    }

    const input: Record<string, any> = {
      prompt: soulPrompt,
      aspect_ratio: mappedRatio,
      resolution: options.resolution || '1080p',
    };

    if (options.negativePrompt) {
      input.negative_prompt = options.negativePrompt;
    }
    if (options.imageUrl) {
      if (options.imageUrl.startsWith('data:image/')) {
        console.log(`[Higgsfield Image] Detectada imagen en Base64. Subiendo a CDN oficial de Higgsfield...`);
        input.image_url = await uploadHiggsfieldImageCdn(options.imageUrl, credentials);
      } else {
        input.image_url = options.imageUrl;
      }
    }

    console.log(`[Higgsfield Image] Iniciando generación con modelo: ${model} | Ratio: ${mappedRatio} | Res: ${input.resolution}`);

    try {
      response = await higgsfieldSubscribe(model, input, credentials);
    } catch (err: any) {
      console.error('[Higgsfield Image] Error:', err);
      throw err;
    }
  }

  if (response.status === 'completed') {
    const finalUrl =
      response.images?.[0]?.url ||
      response.image?.url ||
      response.output?.url ||
      response.url ||
      (Array.isArray(response.images) && typeof response.images[0] === 'string' ? response.images[0] : null);

    if (!finalUrl) {
      throw new Error('Higgsfield completó la generación pero no retornó la URL de la imagen.');
    }

    console.log(`[Higgsfield Image] Éxito. Imagen generada con éxito (${costTier}): ${finalUrl}`);
    return {
      success: true,
      imageUrl: finalUrl,
      requestId: response.request_id || '',
      status: 'completed',
      costTier,
      raw: response,
    };
  }

  if (response.status === 'failed' || response.status === 'canceled') {
    const rawError = response.error || response.detail || response.message || '';
    if (typeof rawError === 'string' && (rawError.toLowerCase().includes('balance') || rawError.toLowerCase().includes('credit'))) {
      throw new Error(
        'Saldo insuficiente en tu cuenta de Higgsfield AI (Your credit balance is too low). Por favor recarga saldo en https://open.higgsfield.ai para continuar generando.'
      );
    }
    throw new Error(rawError || `La generación en Higgsfield AI falló con estado "${response.status}".`);
  }

  if (response.status === 'nsfw') {
    throw new Error('La imagen fue moderada por las políticas de contenido de Higgsfield (NSFW).');
  }

  const fallbackUrl = response.images?.[0]?.url || response.image?.url || response.url || (Array.isArray(response.images) && typeof response.images[0] === 'string' ? response.images[0] : null);
  if (fallbackUrl) {
    return {
      success: true,
      imageUrl: fallbackUrl,
      requestId: response.request_id || '',
      status: response.status,
      costTier,
      raw: response,
    };
  }

  throw new Error(`Estado inesperado de Higgsfield AI: ${response.status}`);
}

/**
 * Cliente dedicado para Marketing Studio Image de Higgsfield AI.
 * Por defecto aplica la configuración más barata: quality: 'low' ($0.02 USD), resolution: '2k', enhance_prompt: false.
 */
export async function generateHiggsfieldMarketingStudioImage(
  options: HiggsfieldMarketingStudioImageOptions
): Promise<HiggsfieldGenerateResult> {
  return generateHiggsfieldImage({
    ...options,
    model: 'marketing-studio/image',
    quality: options.quality || 'low',
    resolution: options.resolution || '2k',
    enhancePrompt: options.enhancePrompt ?? false,
  });
}

/**
 * Consulta la lista de Presets visibles de Marketing Studio desde la API de Higgsfield.
 */
export async function getHiggsfieldPresets(
  apiKey?: string,
  size = 50,
  cursor?: string | null
): Promise<{ total: number; cursor: string | null; items: Array<{ id: string; type: string; name: string }> }> {
  const credentials =
    apiKey?.trim() ||
    getAiCredential('higgsfield') ||
    process.env.HF_CREDENTIALS ||
    process.env.HIGGSFIELD_API_KEY;

  if (!credentials) {
    throw new Error('Credenciales de Higgsfield no configuradas.');
  }

  const authHeader = formatHiggsfieldAuth(credentials);
  const url = new URL(`${HIGGSFIELD_BASE_URL}/marketing-studio/image/presets`);
  url.searchParams.set('size', String(size));
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: authHeader,
      'User-Agent': 'higgsfield-server-js/2.0',
    },
  });

  if (!res.ok) {
    throw new Error(`Error al consultar presets de Higgsfield: ${res.statusText}`);
  }

  return await res.json();
}

export interface HiggsfieldVideoOptions {
  prompt: string;
  duration?: 5 | 10;
  resolution?: '720p' | '1080p';
  aspectRatio?: string;
  apiKey?: string;
  imageUrl?: string;
}

export interface HiggsfieldVideoResult {
  success: boolean;
  videoUrl: string;
  requestId: string;
  status: string;
  raw?: any;
}

/**
 * Cliente para generar videos comerciales cinemáticos con ByteDance Seedance 2.5 via Higgsfield
 * Soporta Text-to-Video e Image-to-Video (partiendo de la foto real del producto)
 */
export async function generateHiggsfieldVideo(
  options: HiggsfieldVideoOptions
): Promise<HiggsfieldVideoResult> {
  const credentials =
    options.apiKey?.trim() ||
    getAiCredential('higgsfield') ||
    process.env.HF_CREDENTIALS ||
    process.env.HIGGSFIELD_API_KEY;

  if (!credentials) {
    throw new Error(
      'No se encontró la credencial de Higgsfield. Configura tu credencial (Key ID:Key Secret) en Ajustes o en el panel de administrador.'
    );
  }

  const duration = options.duration === 10 ? 10 : 5;
  const resolution = options.resolution === '1080p' ? '1080p' : '720p';
  const aspect_ratio = options.aspectRatio || '16:9';

  const hasImage = !!(options.imageUrl && (options.imageUrl.startsWith('http') || options.imageUrl.startsWith('data:image/')));
  const endpoint = hasImage
    ? 'bytedance/seedance-2.5/image-to-video'
    : 'bytedance/seedance-2.5/text-to-video';

  const payload: Record<string, any> = {
    prompt: options.prompt,
    duration,
    resolution,
    aspect_ratio,
  };

  if (hasImage && options.imageUrl) {
    if (options.imageUrl.startsWith('data:image/')) {
      console.log(`[Higgsfield Video] Subiendo imagen a CDN oficial de Higgsfield para Seedance 2.5...`);
      payload.image_url = await uploadHiggsfieldImageCdn(options.imageUrl, credentials);
    } else {
      payload.image_url = options.imageUrl;
    }
  }

  console.log(`[Higgsfield Video] Iniciando Seedance 2.5 (${hasImage ? 'Image-to-Video (con foto de producto real)' : 'Text-to-Video'}) | Endpoint: ${endpoint} | Duración: ${duration}s, Res: ${resolution}, Ratio: ${aspect_ratio}`);

  let response: any;
  try {
    response = await higgsfieldSubscribe(
      endpoint,
      payload,
      credentials
    );
  } catch (err: any) {
    console.error('[Higgsfield Video] Error:', err);
    throw err;
  }

  if (response.status === 'completed' && response.video?.url) {
    console.log(`[Higgsfield Video] Éxito. Video generado con éxito: ${response.video.url}`);
    return {
      success: true,
      videoUrl: response.video.url,
      requestId: response.request_id || '',
      status: response.status,
      raw: response,
    };
  }

  if (response.status === 'failed') {
    const rawError = response.error || response.detail || response.message || '';
    if (typeof rawError === 'string' && (rawError.toLowerCase().includes('balance') || rawError.toLowerCase().includes('credit'))) {
      throw new Error(
        'Saldo insuficiente en tu cuenta de Higgsfield AI (Your credit balance is too low). Por favor recarga saldo en https://open.higgsfield.ai para continuar generando videos.'
      );
    }
    throw new Error(rawError || 'La generación de video con Seedance 2.5 falló o fue cancelada por Higgsfield.');
  }

  if (response.status === 'nsfw') {
    throw new Error('El video fue moderado por las políticas de contenido de Higgsfield (NSFW).');
  }

  if (response.video?.url) {
    return {
      success: true,
      videoUrl: response.video.url,
      requestId: response.request_id || '',
      status: response.status,
      raw: response,
    };
  }

  throw new Error(`Estado inesperado de Higgsfield: ${response.status}`);
}
