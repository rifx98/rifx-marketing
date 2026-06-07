import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import OpenAI from 'openai';

// POST /api/panel/social/generate-metadata - Optimizar título y descripción sugerida usando Groq IA
export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { title, caption } = await req.json();
    if (!title?.trim() && !caption?.trim()) {
      return NextResponse.json({ error: 'Por favor, escribe un borrador o ideas en el título o descripción primero.' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // 2. Obtener la clave de API de Groq de la configuración del Tenant o del .env
    const { data: config } = await supabase
      .from('config')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .single();

    let extConfig = { groq_key: '' };
    if (config?.openai_key) {
      try {
        const parsed = JSON.parse(config.openai_key);
        extConfig = { ...extConfig, ...parsed };
      } catch {
        // En caso de que no sea JSON válido
      }
    }

    const apiKey = extConfig.groq_key || process.env.GROQ_API_KEY;
    console.log(`[Generate Metadata] Env GROQ_API_KEY:`, process.env.GROQ_API_KEY ? 'Presente' : 'Ausente');
    console.log(`[Generate Metadata] DB groq_key:`, extConfig.groq_key ? 'Presente' : 'Ausente');
    console.log(`[Generate Metadata] Resolvió API Key como:`, apiKey ? '[CONFIGURED]' : 'Nula');

    if (!apiKey) {
      return NextResponse.json({ error: 'Clave de Groq no configurada en el sistema. Asegúrate de configurar la clave de Groq.' }, { status: 500 });
    }

    // 3. Inicializar cliente OpenAI para Groq
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    console.log(`[Generate Metadata] Optimizando texto con Groq (llama-3.3-70b-versatile)...`);

    const systemPrompt = `Eres un copywriter y estratega de contenido experto en redes sociales (Instagram, TikTok, YouTube Shorts y Facebook Reels).
Tu objetivo es tomar las ideas o el borrador de un usuario para su video y mejorarlo radicalmente para aumentar la retención, los clics y la interacción.

Debes generar un objeto JSON con exactamente estas dos propiedades:
1. "title": Un título super atractivo y corto (máximo 6 palabras) con 1-2 emojis, ideal para enganchar y usar como texto en el video o portada.
2. "caption": La descripción del video. Debe ser persuasiva, organizada, incluir un gancho inicial, desarrollar la idea clave de forma breve, tener un llamado a la acción (CTA) claro al final (ej. "¡Comenta abajo tu opinión!", "Guarda este reel si te sirvió", etc.) y terminar con 3-5 hashtags relevantes.

Responde ÚNICAMENTE con el objeto JSON crudo, sin bloques de código markdown de tipo \`\`\`json y sin textos introductorios.
El idioma de la respuesta debe ser estrictamente español.`;

    const userPrompt = `Borrador/Ideas del usuario:
- Título propuesto: "${title || '(Sin título)'}"
- Descripción/Ideas propuestas: "${caption || '(Sin descripción)'}"

Mejora y optimiza esta información para redes sociales.`;

    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    });

    const resultText = completion.choices[0]?.message?.content;

    if (!resultText) {
      return NextResponse.json({ error: 'La respuesta de la IA fue vacía.' }, { status: 500 });
    }

    console.log(`[Generate Metadata] Respuesta recibida de Groq:`, resultText);

    // 4. Parsear el resultado
    try {
      const parsed = JSON.parse(resultText.trim());
      return NextResponse.json({
        success: true,
        title: parsed.title || '',
        caption: parsed.caption || ''
      });
    } catch (parseErr) {
      console.error('❌ [Generate Metadata] Error parseando JSON de Groq:', resultText);
      return NextResponse.json({
        success: true,
        title: title || 'Video Optimizado 🚀',
        caption: resultText
      });
    }

  } catch (error: any) {
    console.error('❌ [Generate Metadata] Internal error:', error);
    return NextResponse.json({ error: error?.message || 'Error interno en optimización de metadatos' }, { status: 500 });
  }
}
