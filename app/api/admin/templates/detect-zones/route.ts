import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAdminPermission } from '@/lib/admin-rbac';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';
import { decodeImageDataUri, fetchRemoteImage } from '@/lib/safe-fetch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_REMOTE_URL_LENGTH = 2_048;
const MAX_MODEL_OUTPUT_LENGTH = 32 * 1024;

const ZONE_DETECTOR_SYSTEM_PROMPT = `You are a LAYOUT ZONE DETECTOR for visual compositions.
You analyze images to detect the POSITION and SIZE of distinct visual regions.

YOU MUST NOT:
- Read or return any text content visible in the image
- Identify what product is shown
- Infer the product category or marketing intent
- Describe what the image is advertising

YOU MUST ONLY:
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

function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function normalizeVisionImage(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:')) {
    const image = decodeImageDataUri(imageUrl, MAX_IMAGE_BYTES);
    return `data:${image.contentType};base64,${image.buffer.toString('base64')}`;
  }

  if (imageUrl.length > MAX_REMOTE_URL_LENGTH) throw new Error('invalid_remote_url');
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error('invalid_remote_url');
  }
  if (parsedUrl.protocol !== 'https:') throw new Error('invalid_remote_url');

  // Fetch and validate the bytes ourselves. The model never receives a
  // user-controlled remote URL, preventing it from becoming an SSRF proxy.
  const image = await fetchRemoteImage(parsedUrl.toString(), {
    maxBytes: MAX_IMAGE_BYTES,
    timeoutMs: 10_000,
    maxRedirects: 2,
  });
  return `data:${image.contentType};base64,${image.buffer.toString('base64')}`;
}

// POST /api/admin/templates/detect-zones
export async function POST(req: NextRequest) {
  try {
    const authorization = await requireAdminPermission(req, 'templates.detect');
    if (!authorization.ok) return authorization.response;

    const rateDenied = await enforceTenantRateLimit(
      'admin-template-detect-zones',
      authorization.admin.tenantId,
      6,
      60_000,
    );
    if (rateDenied) return rateDenied;

    const bodyResult = await readLimitedJsonObject(req, MAX_REQUEST_BYTES);
    if (!bodyResult.ok) return bodyResult.response;
    const imageUrl = bodyResult.body.image_url;
    if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return jsonError('El campo "image_url" es obligatorio y debe ser un string.', 400);
    }

    let normalizedImage: string;
    try {
      normalizedImage = await normalizeVisionImage(imageUrl.trim());
    } catch {
      return jsonError('La imagen no es válida o no está permitida', 400);
    }

    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (apiKey.length < 10 || apiKey.length > 2_048) {
      return jsonError('Servicio de análisis no configurado', 503);
    }

    const openai = new OpenAI({
      apiKey,
      timeout: 30_000,
      maxRetries: 1,
    });
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
              image_url: { url: normalizedImage, detail: 'low' },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1_600,
    });

    const resultText = response.choices[0]?.message?.content || '';
    if (!resultText || resultText.length > MAX_MODEL_OUTPUT_LENGTH) return internalApiError();

    let parsedResult: Record<string, unknown>;
    try {
      const candidate: unknown = JSON.parse(resultText);
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return internalApiError();
      }
      parsedResult = candidate as Record<string, unknown>;
    } catch {
      return internalApiError();
    }

    return NextResponse.json(
      { ...parsedResult, success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    console.error('Template zone detection request failed');
    return internalApiError();
  }
}
