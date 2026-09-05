import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const tenantId = tenant.tenantId;

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
    }

    const mimeType = file.type;
    const allowedMimeTypes = [
      'application/pdf', 
      'image/png', 
      'image/jpeg', 
      'image/jpg',
      'image/webp',
      'image/heic'
    ];

    if (!allowedMimeTypes.includes(mimeType)) {
      return NextResponse.json({ error: 'Tipo de archivo no soportado. Solo PDFs o Imágenes.' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo es demasiado grande (Máx 10MB).' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Obtener configuración para la API Key de Gemini
    const { data: config } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    let extConfig = { gemini_key: '' };
    try {
      const parsed = JSON.parse(config?.openai_key || '{}');
      extConfig = { ...extConfig, ...parsed };
    } catch {
      // Ignorar
    }

    const apiKey = extConfig.gemini_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'No se encontró la API Key de Gemini. Configúrala en el panel de IA.' }, { status: 400 });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    const promptText = "Actúa como un experto en extracción de datos. Extrae todos los productos, servicios, precios, características, descripciones y reglas de negocio presentes en este documento o imagen. Devuelve únicamente el texto extraído formateado de forma limpia y ordenada (idealmente como lista o diccionario). No agregues introducciones ni conclusiones, solo los datos crudos extraídos.";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error de Gemini:', data);
      return NextResponse.json({ error: 'Error al procesar el archivo con la IA.' }, { status: 500 });
    }

    const extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!extractedText.trim()) {
      return NextResponse.json({ error: 'La IA no pudo extraer ningún texto legible del archivo.' }, { status: 400 });
    }

    return NextResponse.json({ text: extractedText.trim() });
  } catch (error) {
    console.error('Error en /api/panel/memory/extract:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
