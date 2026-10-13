import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { readLimitedJsonObject } from '@/lib/request-guards';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

interface ProductAnalysisResponse {
  product_name: string;
  category: string;
  headline: string;
  subheadline: string;
  badge: string;
  cta: string;
  contact: string;
}

const SYSTEM_PROMPT = `Eres un Director Creativo y Copywriter Publicitario de élite para e-commerce y redes sociales.
Analiza la foto del producto subida por el usuario y genera textos publicitarios de ALTO IMPACTO y ALTA CONVERSIÓN en ESPAÑOL, adaptados exactamente a lo que se ve en la imagen.

Devuelve OBLIGATORIAMENTE un JSON válido sin markdown ni backticks:
{
  "product_name": "Nombre descriptivo exacto del producto (ej: 'Zapatillas Deportivas Urbanas', 'Zapatos de Cuero Elegantes', 'Shampoo Reparador de Cabello', 'Reloj Inteligente Fit')",
  "category": "Categoría (ej: 'Calzado', 'Moda Deportiva', 'Belleza y Cuidado', 'Tecnología', 'Accesorios')",
  "headline": "Titular publicitario principal en MAYÚSCULAS de alto impacto (2 a 5 palabras, ej: 'MÁXIMO CONFORT Y ESTILO' para zapatos deportivos, 'PASOS CON PODER Y ELEGANCIA', 'RESTAURACIÓN Y BRILLO TOTAL')",
  "subheadline": "Subtitular o beneficio clave persuasivo (4 a 8 palabras, ej: 'Suela ergonómica y diseño urbano duradero', 'Máximo agarre y confort para cada día')",
  "badge": "Insignia o etiqueta de 1 a 2 palabras (ej: 'NUEVA COLECCIÓN', 'EDICIÓN ESPECIAL', 'ALTA DURABILIDAD')",
  "cta": "Llamado a la acción de 2 a 3 palabras (ej: 'PIDE LOS TUYOS', 'COMPRAR AHORA', 'OFERTA EXCLUSIVA')",
  "contact": "Texto de pie de página o contacto (ej: 'Envíos a todo el país | Pago contra entrega', 'Garantía 100% de satisfacción')"
}`;

function getFallbackForTemplate(templateName?: string): ProductAnalysisResponse {
  const t = (templateName || '').toLowerCase();
  if (t.includes('prenda') || t.includes('deport') || t.includes('atlet') || t.includes('sport')) {
    return {
      product_name: 'Calzado Deportivo',
      category: 'Calzado Deportivo',
      headline: 'MÁXIMO RENDIMIENTO Y ESTILO',
      subheadline: 'Suela ergonómica con amortiguación y diseño moderno',
      badge: 'NUEVA COLECCIÓN',
      cta: 'PIDE LOS TUYOS',
      contact: 'Envíos a todo el país | Pago contra entrega',
    };
  }
  if (t.includes('belleza') || t.includes('cosmet') || t.includes('spa') || t.includes('pelo') || t.includes('cabello')) {
    return {
      product_name: 'Tratamiento Cosmético',
      category: 'Cuidado y Belleza',
      headline: 'BRILLO Y REPARACIÓN PROFUNDA',
      subheadline: 'Fórmula nutritiva avanzada para resultados visibles',
      badge: 'FÓRMULA PREMIUM',
      cta: 'COMPRAR AHORA',
      contact: 'Envío gratis por tiempo limitado',
    };
  }
  return {
    product_name: 'Producto Exclusivo',
    category: 'E-commerce',
    headline: 'CALIDAD Y DISEÑO PREMIUM',
    subheadline: 'Innovación y máxima durabilidad para tu estilo',
    badge: 'EDICIÓN ESPECIAL',
    cta: 'COMPRAR AHORA',
    contact: 'Envíos a todo el país | Garantía oficial',
  };
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsed = await readLimitedJsonObject(req, 6 * 1024 * 1024);
    if (!parsed.ok) return parsed.response;

    const body = parsed.body as Record<string, any>;
    const productImage = typeof body.product_image === 'string' ? body.product_image.trim() : '';
    const templateName = typeof body.template_name === 'string' ? body.template_name.trim() : '';

    if (!productImage) {
      return NextResponse.json({ error: 'Se requiere la imagen del producto' }, { status: 400 });
    }

    // Resolver clave de OpenAI (primero config del tenant, luego env)
    let openaiKey = '';
    try {
      const supabase = createSupabaseAdmin();
      const { data: cfgRow } = await supabase
        .from('config')
        .select('openai_key')
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();

      if (cfgRow?.openai_key) {
        try {
          const parsed = JSON.parse(cfgRow.openai_key);
          if (typeof parsed?.openai_key === 'string' && parsed.openai_key.length > 5) {
            openaiKey = parsed.openai_key.trim();
          }
        } catch {
          if (typeof cfgRow.openai_key === 'string' && cfgRow.openai_key.length > 5) {
            openaiKey = cfgRow.openai_key.trim();
          }
        }
      }
    } catch (e: any) {
      console.warn('⚠️ [Analyze Product] Error leyendo config tenant:', e.message);
    }

    if (!openaiKey && process.env.OPENAI_API_KEY) {
      openaiKey = process.env.OPENAI_API_KEY.trim();
    }

    // Si no hay OpenAI key, retornar fallback contextual sin romper
    if (!openaiKey) {
      return NextResponse.json({
        success: true,
        source: 'fallback',
        ...getFallbackForTemplate(templateName),
      });
    }

    // Llamar a Vision AI con gpt-4o-mini (ultra rápido y económico)
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: openaiKey });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analiza este producto y redacta textos comerciales para una pancarta publicitaria${templateName ? ` basada en la plantilla '${templateName}'` : ''}. Responde con el JSON exacto.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: productImage,
                  detail: 'low', // 'low' es instantáneo (~500ms) y consume muy pocos tokens
                },
              },
            ],
          },
        ],
        temperature: 0.4,
        max_tokens: 350,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices?.[0]?.message?.content?.trim() || '';
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) parsedJson = JSON.parse(match[0]);
      }

      if (parsedJson && parsedJson.product_name && parsedJson.headline) {
        return NextResponse.json({
          success: true,
          source: 'vision_ai',
          product_name: parsedJson.product_name,
          category: parsedJson.category || 'Producto',
          headline: parsedJson.headline,
          subheadline: parsedJson.subheadline || 'Calidad y diseño exclusivo',
          badge: parsedJson.badge || 'NUEVA COLECCIÓN',
          cta: parsedJson.cta || 'COMPRAR AHORA',
          contact: parsedJson.contact || 'Envíos a todo el país',
        });
      }
    } catch (visionErr: any) {
      console.warn('⚠️ [Analyze Product] Error en Vision AI:', visionErr?.message);
    }

    // Fallback elegante
    return NextResponse.json({
      success: true,
      source: 'fallback',
      ...getFallbackForTemplate(templateName),
    });
  } catch (err: any) {
    console.error('❌ [Analyze Product] Error general:', err);
    return NextResponse.json(
      { error: err?.message || 'Error analizando producto' },
      { status: 500 }
    );
  }
}
