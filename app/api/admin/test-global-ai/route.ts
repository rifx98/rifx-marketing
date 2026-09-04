import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { requireAdminPermission } from '@/lib/admin-rbac';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticación y Autorización
    const authorization = await requireAdminPermission(req, 'platform_settings.update');
    if (!authorization.ok) return authorization.response;

    const tenantId = authorization.tenantId;

    // 2. Rate Limiting (10 requests per minute)
    const limit = await checkRateLimit(rateLimitKey('test-global-ai', tenantId || 'admin'), 10, 60_000);
    if (limit.unavailable) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }, { status: 429 });
    }

    // 3. Parsear request
    const body = await req.json();
    let { provider, model, apiKey } = body;

    if (!provider) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (provider).' }, { status: 400 });
    }

    // 4. Si la llave es '***', recuperar la llave original de la base de datos
    if (apiKey === '***' || !apiKey) {
      const supabase = createSupabaseAdmin();
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: 'Error al consultar la configuración en la base de datos.' }, { status: 500 });
      }

      if (data && data.global_ai_config) {
        apiKey = data.global_ai_config.apiKey || '';
      } else {
        apiKey = '';
      }
    }

    if (!apiKey) {
      return NextResponse.json({ status: 'invalid_key', message: 'No hay ninguna API Key configurada para probar.' });
    }

    // 5. Testear la API
    if (provider === 'openai') {
      // Test OpenAI: Generar 1 token para validar llave y saldo
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "hi"' }],
          max_tokens: 1
        })
      });

      const data = await res.json();

      if (res.ok) {
        return NextResponse.json({ status: 'success', message: 'La conexión es exitosa y hay saldo disponible.' });
      } else {
        const errCode = data?.error?.code;
        if (errCode === 'insufficient_quota') {
          return NextResponse.json({ status: 'no_credit', message: 'La API Key es válida, pero el saldo o límite de cuota se ha agotado.' });
        } else if (errCode === 'invalid_api_key' || res.status === 401) {
          return NextResponse.json({ status: 'invalid_key', message: 'La API Key ingresada es incorrecta o ha sido revocada.' });
        } else {
          return NextResponse.json({ status: 'error', message: data?.error?.message || 'Error desconocido al contactar OpenAI.' });
        }
      }
    } 
    
    else if (provider === 'groq') {
      // Test Groq
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'llama3-8b-8192',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1
        })
      });

      const data = await res.json();

      if (res.ok) {
        return NextResponse.json({ status: 'success', message: 'La conexión es exitosa y hay saldo disponible.' });
      } else {
        const errCode = data?.error?.code;
        if (errCode === 'insufficient_quota') {
          return NextResponse.json({ status: 'no_credit', message: 'La API Key es válida, pero se ha agotado la cuota de Groq.' });
        } else if (errCode === 'invalid_api_key' || res.status === 401) {
          return NextResponse.json({ status: 'invalid_key', message: 'La API Key de Groq es incorrecta.' });
        } else {
          return NextResponse.json({ status: 'error', message: data?.error?.message || 'Error desconocido al contactar Groq.' });
        }
      }
    }

    else if (provider === 'gemini') {
      // Test Gemini
      const testModel = model || 'gemini-1.5-flash';
      let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 1 }
        })
      });

      let data = await res.json();

      if (res.ok) {
        return NextResponse.json({ status: 'success', message: 'La conexión es exitosa y la llave funciona.' });
      } else {
        const errorStatus = data?.error?.status || '';
        const errorMessage = data?.error?.message || '';

        // Si el error es 404, listar los modelos disponibles para ayudar al usuario
        if (res.status === 404) {
          try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const listData = await listRes.json();
            if (listRes.ok && listData.models) {
              const availableModels = listData.models
                .map((m: any) => m.name.replace('models/', ''))
                .filter((name: string) => name.includes('gemini'))
                .join(', ');
              return NextResponse.json({ 
                status: 'invalid_key', 
                message: `El modelo ${testModel} no está disponible para tu llave. Modelos disponibles: ${availableModels}` 
              });
            }
          } catch (e) {
            // Ignorar error de listado y seguir con el error original
          }
        }

        if (res.status === 403 || errorStatus === 'PERMISSION_DENIED') {
          return NextResponse.json({ status: 'invalid_key', message: 'La API Key de Gemini es incorrecta o no tiene permisos.' });
        } else if (res.status === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
          return NextResponse.json({ status: 'no_credit', message: 'Se han agotado los créditos o se excedió el límite de la cuota gratuita de Gemini.' });
        } else if (res.status === 400 && errorMessage.includes('API key not valid')) {
          return NextResponse.json({ status: 'invalid_key', message: 'La API Key provista no es válida para Google Gemini.' });
        } else {
          return NextResponse.json({ status: 'error', message: errorMessage || 'Error desconocido al contactar Google Gemini.' });
        }
      }
    }

    else {
      return NextResponse.json({ status: 'error', message: `Proveedor no soportado para test automático: ${provider}` });
    }

  } catch (error: any) {
    console.error('Error en /api/admin/test-global-ai:', error);
    return NextResponse.json({ error: 'Error interno del servidor al probar la API.' }, { status: 500 });
  }
}
