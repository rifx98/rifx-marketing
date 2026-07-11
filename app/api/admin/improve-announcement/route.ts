import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

// POST: Mejorar anuncio con IA
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { title, message, type } = await req.json();
    if (!title && !message) {
      return NextResponse.json({ error: 'Se requiere al menos un título o mensaje' }, { status: 400 });
    }

    // Para funciones de Admin (anuncios globales), usamos la API Key del sistema por defecto
    let groqKey = process.env.GROQ_API_KEY || '';
    
    // Si no hay key en el .env, intentamos usar la del tenant admin
    if (!groqKey) {
      const supabase = createSupabaseAdmin();
      const { data: config } = await supabase
        .from('config')
        .select('openai_key')
        .eq('tenant_id', tenant.tenantId)
        .single();

      try {
        const parsed = JSON.parse(config?.openai_key || '{}');
        groqKey = parsed.groq_key || parsed.openai_key || '';
      } catch {
        groqKey = config?.openai_key || '';
      }
    }

    if (!groqKey || groqKey.length < 10) {
      return NextResponse.json({ error: 'No hay API Key válida de IA configurada en el sistema' }, { status: 500 });
    }

    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const typeLabels: Record<string, string> = {
      info: 'informativo',
      update: 'actualización de producto',
      warning: 'aviso importante',
      promo: 'promocional/celebración',
    };
    const toneLabel = typeLabels[type] || 'informativo';

    console.log('Solicitando mejora a Groq para anuncio...');
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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
- Responde SOLO en formato JSON válido usando esta estructura exacta: {"title": "Título mejorado", "message": "Mensaje mejorado"}`
        },
        {
          role: 'user',
          content: `Mejora este anuncio de tipo "${toneLabel}":\n\nTítulo borrador: ${title || '(sin título)'}\nMensaje borrador: ${message || '(sin mensaje)'}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    console.log('✅ Respuesta RAW de Groq:', raw);
    
    // Parse the JSON response
    let improved = { title: title || '', message: message || '' };
    try {
      const parsed = JSON.parse(raw);
      improved = {
        title: parsed.title || title || '',
        message: parsed.message || message || '',
      };
      console.log('✅ Anuncio mejorado parseado:', improved);
    } catch (err: any) {
      console.warn('⚠️ Error parseando JSON directo, intentando fallback regex. Error:', err.message);
      // Fallback regex if somehow response_format failed
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          improved = {
            title: parsed.title || title || '',
            message: parsed.message || message || '',
          };
        } catch {
          improved = { title, message: raw || message };
        }
      } else {
        improved = { title, message: raw || message };
      }
    }

    return NextResponse.json({ success: true, improved });
  } catch (error: any) {
    console.error('❌ Error mejorando anuncio:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
