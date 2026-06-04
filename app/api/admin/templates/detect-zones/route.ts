import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';

const ZONE_DETECTOR_SYSTEM_PROMPT = `You are a LAYOUT ZONE DETECTOR for visual compositions.
You analyze images to detect the POSITION and SIZE of distinct visual regions.

🚫 YOU MUST NOT:
- Read or return any text content visible in the image
- Identify what product is shown
- Infer the product category or marketing intent
- Describe what the image is advertising

✅ YOU MUST ONLY:
- Detect the POSITION and SIZE of each distinct visual region
- Identify which region contains the main product/object
- Identify which regions contain text blocks
- Identify decorative/structural elements

Return this JSON:
{
  "canvas_ratio": "detected aspect ratio (e.g. '1:1', '4:5', '9:16', '16:9')",
  "product_slot": {
    "x": center_x_normalized,
    "y": center_y_normalized,
    "width": width_normalized,
    "height": height_normalized,
    "shape": "rectangle",
    "padding": 0.02
  },
  "text_slots": [
    {
      "id": "descriptive_zone_id (e.g. headline, left_claim, right_claim, footer, benefit_1)",
      "x": center_x, "y": center_y, "width": w, "height": h,
      "type": "headline|benefit_title|product_title|cta|badge|description",
      "max_words": estimated_max_words,
      "style": "visual_style_hint (e.g. bold_uppercase, small_text, gold_accent)"
    }
  ],
  "detected_zones_count": total_number,
  "confidence": "high|medium|low",
  "editable_regions": ["product", "headline", ...],
  "locked_regions": ["background", "curves", ...]
}

Coordinate system: (0,0) = top-left, (1,1) = bottom-right.
x,y = CENTER of zone. width,height = size as fraction of canvas.`;

// POST /api/admin/templates/detect-zones
export async function POST(req: NextRequest) {
  try {
    // Auth check — admin only
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Parse body
    const body = await req.json();
    const { image_url } = body;

    if (!image_url || typeof image_url !== 'string') {
      return NextResponse.json({ error: 'El campo "image_url" es obligatorio y debe ser un string.' }, { status: 400 });
    }

    console.log(`🔍 [detect-zones] Analizando imagen para detección de zonas: ${image_url.substring(0, 80)}...`);

    // Call GPT-4o Vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: ZONE_DETECTOR_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this visual composition. Detect all distinct visual zones with their positions and sizes. Do NOT read any text. Do NOT identify the product. Only detect layout regions:',
            },
            {
              type: 'image_url',
              image_url: { url: image_url },
            },
          ],
        },
      ],
      temperature: 0.1,
    });

    const resultText = response.choices[0]?.message?.content || '{}';
    let parsedResult: any;

    try {
      parsedResult = JSON.parse(resultText);
    } catch (parseErr) {
      console.error('❌ [detect-zones] Falló el parsing del JSON de GPT-4o:', resultText);
      return NextResponse.json({ error: 'La respuesta del modelo no es un JSON válido.', raw: resultText }, { status: 500 });
    }

    console.log(`✅ [detect-zones] Zonas detectadas: ${parsedResult.detected_zones_count || 'N/A'} | Confianza: ${parsedResult.confidence || 'N/A'}`);

    return NextResponse.json({
      success: true,
      ...parsedResult,
    });
  } catch (error: any) {
    console.error('❌ [detect-zones] Error interno:', error);
    return NextResponse.json({ error: error?.message || 'Error interno en detección de zonas' }, { status: 500 });
  }
}
