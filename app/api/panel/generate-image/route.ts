import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';

// POST /api/panel/generate-image - Generar imagen con Together AI (FLUX)
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, width, height } = await req.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt requerido' }, { status: 400 });
    }

    const togetherKey = process.env.TOGETHER_API_KEY;
    if (!togetherKey) {
      return NextResponse.json({ 
        error: 'TOGETHER_API_KEY no configurada. Agrega tu key de Together AI en .env.local',
        setup_url: 'https://api.together.ai/settings/api-keys'
      }, { status: 500 });
    }

    console.log(`🎨 Generando imagen IA: "${prompt.substring(0, 80)}..."`);

    // Usar FLUX.1-schnell-Free (gratis, sin limites)
    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${togetherKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        prompt: prompt,
        width: width || 1024,
        height: height || 1024,
        n: 1,
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Together AI error:', errorData);
      return NextResponse.json({ 
        error: `Error de Together AI: ${response.status}`,
        details: errorData 
      }, { status: 500 });
    }

    const data = await response.json();
    
    if (!data.data || !data.data[0]) {
      return NextResponse.json({ error: 'No se generó imagen' }, { status: 500 });
    }

    const imageBase64 = data.data[0].b64_json;

    console.log(`✅ Imagen generada exitosamente (${width || 1024}x${height || 1024})`);

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${imageBase64}`,
      model: 'FLUX.1-schnell-Free',
      prompt_used: prompt,
    });

  } catch (error: any) {
    console.error('Error generating image:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
