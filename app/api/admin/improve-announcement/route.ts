import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAdminPermission } from '@/lib/admin-rbac';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const MAX_TITLE_LENGTH = 300;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_API_KEY_LENGTH = 2_048;
const ALLOWED_TYPES = new Set(['info', 'update', 'warning', 'promo']);

function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function boundedText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback.slice(0, maxLength);
  const normalized = value.trim();
  return (normalized || fallback).slice(0, maxLength);
}

function parseConfiguredApiKey(value: unknown): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw || raw.length > MAX_API_KEY_LENGTH) return '';

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '';
    const config = parsed as Record<string, unknown>;
    const candidate = typeof config.groq_key === 'string'
      ? config.groq_key.trim()
      : typeof config.openai_key === 'string'
        ? config.openai_key.trim()
        : '';
    return candidate.length <= MAX_API_KEY_LENGTH ? candidate : '';
  } catch {
    return raw;
  }
}

// POST: Mejorar anuncio con IA
export async function POST(req: NextRequest) {
  try {
    const authorization = await requireAdminPermission(req, 'announcements.improve');
    if (!authorization.ok) return authorization.response;
    const tenant = authorization.admin;

    const rateDenied = await enforceTenantRateLimit(
      'admin-improve-announcement',
      tenant.tenantId,
      10,
      60_000,
    );
    if (rateDenied) return rateDenied;

    const bodyResult = await readLimitedJsonObject(req, 8 * 1024);
    if (!bodyResult.ok) return bodyResult.response;

    const rawTitle = bodyResult.body.title;
    const rawMessage = bodyResult.body.message;
    const rawType = bodyResult.body.type;
    if (
      (rawTitle !== undefined && typeof rawTitle !== 'string') ||
      (rawMessage !== undefined && typeof rawMessage !== 'string') ||
      (rawType !== undefined && typeof rawType !== 'string')
    ) {
      return jsonError('Solicitud inválida', 400);
    }

    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    const type = typeof rawType === 'string' && rawType.trim() ? rawType.trim() : 'info';
    if (!title && !message) {
      return jsonError('Se requiere al menos un título o mensaje', 400);
    }
    if (
      title.length > MAX_TITLE_LENGTH ||
      message.length > MAX_MESSAGE_LENGTH ||
      !ALLOWED_TYPES.has(type)
    ) {
      return jsonError('Solicitud inválida', 400);
    }

    // Para funciones de Admin (anuncios globales), usamos la API Key del sistema por defecto.
    let groqKey = (process.env.GROQ_API_KEY || '').trim();

    // Si no hay key en el entorno, usamos exclusivamente la configuración del tenant admin.
    if (!groqKey) {
      const supabase = createSupabaseAdmin();
      const { data: config, error: configError } = await supabase
        .from('config')
        .select('openai_key')
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();
      if (configError) return internalApiError();
      groqKey = parseConfiguredApiKey(config?.openai_key);
    }

    if (groqKey.length < 10 || groqKey.length > MAX_API_KEY_LENGTH) {
      return jsonError('Servicio de IA no configurado', 503);
    }

    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 20_000,
      maxRetries: 1,
    });

    const typeLabels: Record<string, string> = {
      info: 'informativo',
      update: 'actualización de producto',
      warning: 'aviso importante',
      promo: 'promocional/celebración',
    };
    const toneLabel = typeLabels[type];

    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [
        {
          role: 'system',
          content: `Eres un redactor profesional de comunicaciones corporativas en español latinoamericano. Tu trabajo es tomar borradores de anuncios y convertirlos en mensajes pulidos, profesionales, sin faltas de ortografía ni gramática, manteniendo un tono ${toneLabel}.

Reglas:
- Corrige toda ortografía y gramática
- Mejora la claridad y fluidez del texto
- Mantén la esencia y el mensaje original
- Usa un tono profesional pero cercano
- El título debe ser conciso y atractivo (máximo 60 caracteres)
- El mensaje debe ser claro y persuasivo (máximo 300 caracteres)
- No uses emojis en el título
- Puedes usar 1-2 emojis relevantes en el mensaje si es apropiado
- Responde SOLO en formato JSON válido usando esta estructura exacta: {"title": "Título mejorado", "message": "Mensaje mejorado"}`,
        },
        {
          role: 'user',
          content: `Mejora este anuncio de tipo "${toneLabel}":\n\nTítulo borrador: ${title || '(sin título)'}\nMensaje borrador: ${message || '(sin mensaje)'}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 500,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    let parsed: Record<string, unknown> = {};
    try {
      const candidate: unknown = JSON.parse(raw);
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      const jsonMatch = raw.slice(0, 4_000).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const candidate: unknown = JSON.parse(jsonMatch[0]);
          if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
            parsed = candidate as Record<string, unknown>;
          }
        } catch {
          // A malformed provider response falls back to the bounded draft.
        }
      }
    }

    const improved = {
      title: boundedText(parsed.title, title, 60),
      message: boundedText(parsed.message, message || raw, 300),
    };
    return NextResponse.json(
      { success: true, improved },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    console.error('Improve announcement request failed');
    return internalApiError();
  }
}
