import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';

// POST /api/panel/generate-image - Generar imagen con IA
// Soporta: Hugging Face (gratis) o Together AI
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

    // Intentar Together AI primero, luego Hugging Face
    const togetherKey = process.env.TOGETHER_API_KEY;
    const hfToken = process.env.HUGGINGFACE_TOKEN;

    if (togetherKey) {
      // === TOGETHER AI (FLUX.1-schnell-Free) ===
      console.log(`🎨 [Together AI] Generando imagen: "${prompt.substring(0, 60)}..."`);
      
      const response = await fetch('https://api.together.xyz/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${togetherKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'black-forest-labs/FLUX.1-schnell-Free',
          prompt,
          width: width || 1024,
          height: height || 1024,
          n: 1,
          response_format: 'b64_json',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?.[0]?.b64_json) {
          console.log('✅ Imagen generada con Together AI');
          return NextResponse.json({
            success: true,
            image: `data:image/png;base64,${data.data[0].b64_json}`,
            model: 'FLUX.1-schnell',
            provider: 'together',
          });
        }
      }
      console.warn('Together AI falló, intentando Hugging Face...');
    }

    if (hfToken) {
      // === HUGGING FACE (Stable Diffusion XL - 100% GRATIS) ===
      console.log(`🎨 [Hugging Face] Generando imagen: "${prompt.substring(0, 60)}..."`);
      
      const response = await fetch(
        'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              width: width || 1024,
              height: height || 1024,
              num_inference_steps: 30,
              guidance_scale: 7.5,
            },
          }),
        }
      );

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('image')) {
          // La API devuelve bytes de imagen directamente
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          console.log('✅ Imagen generada con Hugging Face SDXL');
          return NextResponse.json({
            success: true,
            image: `data:image/jpeg;base64,${base64}`,
            model: 'stable-diffusion-xl',
            provider: 'huggingface',
          });
        } else {
          // Puede ser JSON con error o modelo cargándose
          const data = await response.json();
          if (data.error?.includes('loading')) {
            return NextResponse.json({ 
              error: 'El modelo se está cargando. Intenta de nuevo en 30 segundos.',
              retry: true 
            }, { status: 503 });
          }
          console.error('HF unexpected response:', data);
        }
      } else {
        const errorText = await response.text();
        console.error('HF error:', response.status, errorText);
      }
    }

    // Ninguna API configurada
    if (!togetherKey && !hfToken) {
      return NextResponse.json({ 
        error: 'No hay API de imágenes configurada',
        setup: {
          option1: {
            name: 'Hugging Face (GRATIS - Sin tarjeta)',
            steps: [
              '1. Ve a https://huggingface.co/join',
              '2. Crea cuenta gratis (sin tarjeta de crédito)',
              '3. Ve a https://huggingface.co/settings/tokens',
              '4. Crea un token con permisos "Make calls to inference API"',
              '5. Agrega HUGGINGFACE_TOKEN=hf_xxx en .env.local'
            ]
          },
          option2: {
            name: 'Together AI ($5 crédito gratis)',
            steps: [
              '1. Ve a https://api.together.ai/',
              '2. Crea cuenta',
              '3. Agrega TOGETHER_API_KEY=xxx en .env.local'
            ]
          }
        }
      }, { status: 500 });
    }

    return NextResponse.json({ error: 'Error generando imagen con IA' }, { status: 500 });

  } catch (error: any) {
    console.error('Error generating image:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
