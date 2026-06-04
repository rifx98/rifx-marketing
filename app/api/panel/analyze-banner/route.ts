import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';

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

// ============================================================
// Llamar a Vision AI (GPT-4o o Groq)
// ============================================================
async function analyzeImage(imageBase64: string): Promise<any> {
  let imgUrl = imageBase64;
  if (!imgUrl.startsWith('data:')) {
    imgUrl = `data:image/jpeg;base64,${imgUrl}`;
  }

  // === Intentar Groq primero (GRATIS) ===
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      console.log('   🔍 Analizando con Groq Llama 4 Scout (gratis)...');
      const base64Part = imgUrl.split(',')[1] || imgUrl;
      const sizeBytes = Math.ceil(base64Part.length * 3 / 4);
      if (sizeBytes > 3.5 * 1024 * 1024) {
        console.warn(`   ⚠️ Imagen muy grande (${(sizeBytes/1024/1024).toFixed(1)}MB)`);
        throw new Error('Image too large for Groq');
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            { role: 'system', content: EXTRACT_JSON_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Sácame el JSON de esta imagen.' },
                { type: 'image_url', image_url: { url: imgUrl } },
              ],
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content?.trim() || '';
        if (raw) {
          try { return JSON.parse(raw); } catch {
            const m = raw.match(/\{[\s\S]*\}/);
            if (m) try { return JSON.parse(m[0]); } catch {}
          }
        }
      } else {
        const err = await response.text().catch(() => '');
        console.warn(`   Groq HTTP ${response.status}:`, err.substring(0, 200));
      }
    } catch (e: any) {
      console.warn('   Groq error:', e?.message);
    }
  }

  // === Fallback: OpenAI GPT-4o (solo si Groq falla) ===
  const openaiKey = process.env.OPENAI_API_KEY || '';
  if (openaiKey && openaiKey.length >= 10) {
    try {
      console.log('   🔍 Fallback: GPT-4o-mini Vision...');
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: openaiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: EXTRACT_JSON_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Sácame el JSON de esta imagen.' },
              { type: 'image_url', image_url: { url: imgUrl, detail: 'low' } },
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
    } catch (e: any) {
      console.warn('   GPT-4o-mini error:', e?.message);
    }
  }

  return null;
}

// ============================================================
// PASO 2: JSON + producto → prompt de recreación → generar imagen
// ============================================================
function buildRecreationPrompt(json: any, productName?: string): string {
  // Usar el overall_scene como base (ya está en inglés y es ultra detallado)
  let base = json.overall_scene || '';
  
  if (!base || base.length < 30) {
    // Construir desde las partes
    base = `Professional advertising banner. ${json.aesthetic || 'premium commercial'} style. `;
    base += `${json.background || 'dark elegant background'}. `;
    base += `Product positioned ${json.product_position || 'center'}. `;
    base += `${json.lighting || 'Studio lighting'}. ${json.shadows || 'Soft shadows'}. `;
    base += `Camera: ${json.camera_angle || 'front view'}. `;
    base += `Color palette: ${json.colors?.primary || '#000'}, ${json.colors?.secondary || '#333'}, accent ${json.colors?.accent || '#fff'}. `;
    base += `${json.decorative_elements || 'Clean design'}. `;
    base += `${json.composition_description || 'Centered product composition'}. `;
  }

  // Reemplazar el producto original por el nuevo
  if (productName) {
    base += ` The main product is ${productName}, showcased as the hero element.`;
  }

  // Añadir calidad
  base += ` High quality, photorealistic, commercial product photography, advertising campaign, 8K resolution, professional studio shot. No text, no logos, no watermarks, no typography.`;

  return base;
}

// ============================================================
// ENDPOINT PRINCIPAL
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { referenceImage, templateJson, productImage, productName, brandName } = await req.json();

    if (!referenceImage && !templateJson) {
      return NextResponse.json({ error: 'Selecciona una plantilla o sube una imagen de referencia' }, { status: 400 });
    }

    console.log('');
    console.log('🎨 ═══════════════════════════════════════');
    console.log('🎨  RIFX AdGenius — Banner Recreation');
    console.log('🎨 ═══════════════════════════════════════');

    // ──────────────────────────────────────
    // PASO 1: Obtener el JSON del estilo
    // ──────────────────────────────────────
    let imageJson: any = null;

    if (templateJson) {
      // PLANTILLA PRE-HECHA → $0 costo, sin llamada a Vision AI
      imageJson = templateJson;
      console.log('📋 PASO 1: Usando plantilla pre-hecha (GRATIS - sin API call)');
      console.log('   🎨 Estética:', imageJson.aesthetic);
    } else {
      // IMAGEN PERSONALIZADA → análisis con Vision AI
      console.log('📊 PASO 1: Sacando JSON de la imagen de referencia...');
      imageJson = await analyzeImage(referenceImage);
    }
    
    if (!imageJson) {
      return NextResponse.json({ 
        error: 'No se pudo analizar la imagen. Verifica OPENAI_API_KEY o GROQ_API_KEY.' 
      }, { status: 400 });
    }

    console.log('✅ JSON extraído:');
    console.log('   🎨 Estética:', imageJson.aesthetic);
    console.log('   🎨 Fondo:', imageJson.background);
    console.log('   📸 Producto original:', imageJson.product_description);
    console.log('   📸 Posición:', imageJson.product_position);
    console.log('   💡 Iluminación:', imageJson.lighting);
    console.log('   🎨 Colores:', JSON.stringify(imageJson.colors));
    console.log('   📝 Escena:', imageJson.overall_scene?.substring(0, 150) + '...');

    // ──────────────────────────────────────
    // PASO 2: JSON + producto → prompt → imagen
    // ──────────────────────────────────────
    console.log('📊 PASO 2: Combinando JSON + producto → generando imagen...');
    
    const recreationPrompt = buildRecreationPrompt(imageJson, productName);
    console.log('   🖼️ Prompt:', recreationPrompt.substring(0, 200) + '...');

    let generatedImage: string | null = null;
    let usedProvider = '';

    // ═══ COST CONTROL: Read visual_render_provider from DB config ═══
    let visualProvider = 'flux'; // Default to FLUX (cheapest)
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );
      const { data: configRows } = await supabase
        .from('panel_config')
        .select('value')
        .eq('tenant_id', tenant.tenantId)
        .eq('key', 'visual_render_provider')
        .single();
      if (configRows?.value) {
        visualProvider = configRows.value;
      }
    } catch (e) {
      console.warn('[analyze-banner] Could not read visual_render_provider from DB, defaulting to flux');
    }

    console.log(`[VISUAL PROVIDER ACTIVE] ${visualProvider}`);
    console.log(`[AI COST AUDIT] analyze-banner — provider: ${visualProvider}`);

    if (visualProvider === 'flux') {
      // ═══ FLUX ONLY — OpenAI images BLOCKED ═══
      console.log('[AI COST AUDIT] OpenAI images.generate: BLOCKED (provider=flux)');
      console.log('[AI COST AUDIT] OpenAI dall-e-3: BLOCKED (provider=flux)');

      // === fal.ai FLUX ===
      const falKey = process.env.FAL_KEY;
      if (falKey) {
        try {
          console.log('   🎨 Generando con fal.ai FLUX...');
          const { fal } = await import('@fal-ai/client');
          fal.config({ credentials: falKey });
          const result = await fal.subscribe('fal-ai/flux/schnell', {
            input: { prompt: recreationPrompt, image_size: 'square' as any, num_inference_steps: 4, num_images: 1, enable_safety_checker: false },
          }) as any;
          if (result?.data?.images?.[0]?.url) {
            const r = await fetch(result.data.images[0].url);
            if (r.ok) {
              const ab = await r.arrayBuffer();
              generatedImage = `data:image/jpeg;base64,${Buffer.from(ab).toString('base64')}`;
              usedProvider = 'fal.ai/flux';
              console.log('✅ fal.ai FLUX');
            }
          }
        } catch (e: any) { console.warn('   fal.ai error:', e?.message); }
      }

      // === Together AI FLUX (fallback, still FLUX, no OpenAI) ===
      if (!generatedImage) {
        const togetherKey = process.env.TOGETHER_API_KEY;
        if (togetherKey) {
          try {
            console.log('   🎨 Fallback: Together AI FLUX...');
            const r = await fetch('https://api.together.xyz/v1/images/generations', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${togetherKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-schnell-Free', prompt: recreationPrompt, width: 1024, height: 1024, n: 1, response_format: 'b64_json' }),
            });
            if (r.ok) {
              const d = await r.json();
              if (d.data?.[0]?.b64_json) {
                generatedImage = `data:image/png;base64,${d.data[0].b64_json}`;
                usedProvider = 'together/flux';
                console.log('✅ Together AI FLUX');
              }
            } else { console.warn('   Together HTTP', r.status); }
          } catch (e: any) { console.warn('   Together error:', e?.message); }
        }
      }

      // === Pollinations (gratis, still FLUX, no OpenAI) ===
      if (!generatedImage) {
        try {
          console.log('   🎨 Fallback: Pollinations...');
          const encoded = encodeURIComponent(recreationPrompt.substring(0, 1500));
          const r = await fetch(`https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${Date.now()}&nologo=true&model=flux`, {
            signal: AbortSignal.timeout(60000),
          });
          if (r.ok) {
            const ct = r.headers.get('content-type');
            if (ct?.includes('image')) {
              const ab = await r.arrayBuffer();
              generatedImage = `data:${ct.split(';')[0]};base64,${Buffer.from(ab).toString('base64')}`;
              usedProvider = 'pollinations/flux';
              console.log('✅ Pollinations');
            }
          }
        } catch (e: any) { console.warn('   Pollinations error:', e?.message); }
      }

    } else {
      // ═══ OpenAI MODE — explicitly selected by admin ═══
      console.log('[AI COST AUDIT] OpenAI mode explicitly selected by admin');
      const openaiKey = process.env.OPENAI_API_KEY || '';
      if (openaiKey && openaiKey.length >= 10) {
        try {
          console.log('   🎨 Generando con OpenAI gpt-image-1...');
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey: openaiKey });
          const result = await openai.images.generate({
            model: 'gpt-image-1',
            prompt: recreationPrompt,
            n: 1,
            size: '1024x1024',
            quality: 'medium',
          });
          if (result.data?.[0]?.b64_json) {
            generatedImage = `data:image/png;base64,${result.data[0].b64_json}`;
            usedProvider = 'openai/gpt-image-1';
          } else if (result.data?.[0]?.url) {
            const r = await fetch(result.data[0].url);
            if (r.ok) {
              const ab = await r.arrayBuffer();
              generatedImage = `data:image/png;base64,${Buffer.from(ab).toString('base64')}`;
              usedProvider = 'openai/gpt-image-1';
            }
          }
          if (generatedImage) console.log('✅ Imagen generada con gpt-image-1');
        } catch (e: any) {
          console.warn('   OpenAI error:', e?.message);
        }
      }
    }

    if (!generatedImage) {
      return NextResponse.json({ error: 'No se pudo generar la imagen.', imageJson, prompt: recreationPrompt }, { status: 500 });
    }

    console.log('');
    console.log('🎨 ✅ BANNER RECREADO — Provider:', usedProvider);
    console.log(`[AI COST AUDIT] analyze-banner complete — provider: ${usedProvider} | openai_called: ${usedProvider.includes('openai')} | flux_called: ${!usedProvider.includes('openai')}`);
    console.log('');

    return NextResponse.json({
      success: true,
      generatedImage,
      imageJson,
      prompt: recreationPrompt,
      provider: usedProvider,
    });

  } catch (error: any) {
    console.error('❌ Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
