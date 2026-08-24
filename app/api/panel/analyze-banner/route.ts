import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ============================================================
// PASO 1: "Sácame el JSON de esta imagen"
// ============================================================
const EXTRACT_JSON_PROMPT = `Analiza esta imagen publicitaria/banner y extrae su ADN visual completo.

Devuelve SOLAMENTE un JSON válido. Sin backticks, sin markdown, sin explicación.

{
  "aesthetic": "estilo visual general en 5-8 palabras",
  "mood": "mood/vibra",
  "background": "descripción detallada del fondo (colores, gradientes, texturas, patrones)",
  "product_position": "dónde está el producto (centro, derecha, izquierda, flotando, etc)",
  "product_description": "descripción del producto original que aparece en la imagen",
  "lighting": "tipo de iluminación y dirección",
  "shadows": "tipo de sombras",
  "camera_angle": "ángulo de cámara",
  "colors": {
    "primary": "#HEX exacto del color dominante",
    "secondary": "#HEX segundo color",
    "accent": "#HEX color de acento/highlight",
    "text_color": "#HEX color del texto principal"
  },
  "decorative_elements": "elementos decorativos (formas geométricas, líneas, partículas, humo, bokeh, etc)",
  "composition_description": "descripción completa de la composición en 2-3 oraciones",
  "overall_scene": "descripción cinematográfica completa de TODA la escena en inglés, ultra detallada, mínimo 80 palabras. Describe exactamente qué ves: fondo, producto, iluminación, colores, perspectiva, atmósfera, efectos visuales. NO menciones texto ni tipografía."
}`;

function buildRecreationPrompt(imageJson: Record<string, any>, productName: string): string {
  const scene = imageJson.overall_scene || imageJson.composition_description || '';
  const colors = imageJson.colors || {};
  const elements = imageJson.decorative_elements || '';
  return [
    `Professional product advertisement photograph featuring ${productName || 'the product'}.`,
    scene,
    `Color palette: primary ${colors.primary || ''}, secondary ${colors.secondary || ''}, accent ${colors.accent || ''}.`,
    elements ? `Decorative elements: ${elements}.` : '',
    `Lighting: ${imageJson.lighting || ''}. Shadows: ${imageJson.shadows || ''}.`,
    `Camera angle: ${imageJson.camera_angle || ''}. Style: ${imageJson.aesthetic || ''}.`,
    'Photorealistic, high-quality commercial photography, no text, no typography.',
  ].filter(Boolean).join(' ');
}

// ============================================================
// Llamar a Vision AI (usa openai_key del tenant)
// ============================================================
async function analyzeImageWithOpenAI(
  imageDataUri: string,
  openaiKey: string,
): Promise<Record<string, any> | null> {
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: openaiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: EXTRACT_JSON_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Sácame el JSON de esta imagen.' },
            { type: 'image_url', image_url: { url: imageDataUri } },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });
    const raw = response.choices?.[0]?.message?.content?.trim() || '';
    if (raw) {
      try { return JSON.parse(raw); } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) try { return JSON.parse(m[0]); } catch {}
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function generateImageWithOpenAI(
  prompt: string,
  openaiKey: string,
): Promise<string | null> {
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: openaiKey });
    const result = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
    });
    if (result.data?.[0]?.b64_json) {
      return `data:image/png;base64,${result.data[0].b64_json}`;
    }
    if (result.data?.[0]?.url) {
      const r = await fetch(result.data[0].url);
      if (r.ok) {
        const ab = await r.arrayBuffer();
        return `data:image/png;base64,${Buffer.from(ab).toString('base64')}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const tenant = await getTenantFromRequest(req);
  if (!tenant?.tenantId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
    }

    const { referenceImage, productName } = body as Record<string, unknown>;
    if (typeof referenceImage !== 'string' || !referenceImage) {
      return NextResponse.json({ error: 'Se requiere una imagen de referencia' }, { status: 400 });
    }

    // Read the tenant's openai_key from the canonical config table
    const supabase = createSupabaseAdmin();
    const { data: configRow, error: configError } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    if (configError || !configRow) {
      return NextResponse.json({ error: 'Configuración no disponible' }, { status: 404 });
    }

    // The openai_key field may contain a JSON blob with extended config
    let openaiKey = '';
    try {
      const parsed = JSON.parse(configRow.openai_key ?? '');
      if (parsed && typeof parsed === 'object' && typeof parsed.openai_key === 'string') {
        openaiKey = parsed.openai_key;
      } else if (typeof configRow.openai_key === 'string') {
        openaiKey = configRow.openai_key;
      }
    } catch {
      openaiKey = configRow.openai_key ?? '';
    }

    if (!openaiKey || openaiKey.length < 10) {
      return NextResponse.json({ error: 'OpenAI no está configurado para este tenant' }, { status: 400 });
    }

    const imgDataUri = referenceImage.startsWith('data:')
      ? referenceImage
      : `data:image/jpeg;base64,${referenceImage}`;

    // PASO 1: Analizar imagen
    const imageJson = await analyzeImageWithOpenAI(imgDataUri, openaiKey);
    if (!imageJson) {
      return NextResponse.json(
        { error: 'No se pudo analizar la imagen. Verifica la configuración de OpenAI.' },
        { status: 400 },
      );
    }

    // PASO 2: Generar nueva imagen
    const recreationPrompt = buildRecreationPrompt(
      imageJson,
      typeof productName === 'string' ? productName : '',
    );

    const generatedImage = await generateImageWithOpenAI(recreationPrompt, openaiKey);
    if (!generatedImage) {
      return NextResponse.json(
        { error: 'No se pudo generar la imagen.', imageJson, prompt: recreationPrompt },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      generatedImage,
      imageJson,
      prompt: recreationPrompt,
      provider: 'openai/gpt-image-1',
    });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
