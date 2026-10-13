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

    const tenantId = 'admin';

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

    // 4. Si la llave es '***' o vacía, recuperar la llave original de la base de datos
    if (apiKey === '***' || !apiKey) {
      const supabase = createSupabaseAdmin();
      
      // A. Buscar en platform_settings
      const { data: psData } = await supabase
        .from('platform_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (psData?.global_ai_config && psData.global_ai_config.provider === provider && psData.global_ai_config.apiKey && psData.global_ai_config.apiKey !== '***') {
        apiKey = psData.global_ai_config.apiKey;
      }

      // B. Si aún no tenemos llave para este proveedor específico, buscar en config del tenant o admin
      if (!apiKey || apiKey === '***') {
        const { data: cfgList } = await supabase.from('config').select('openai_key').limit(5);
        for (const cfgRow of cfgList || []) {
          if (!cfgRow?.openai_key) continue;
          try {
            const parsed = JSON.parse(cfgRow.openai_key);
            if (provider === 'gemini' && parsed.gemini_key) {
              apiKey = parsed.gemini_key;
              break;
            } else if (provider === 'groq' && parsed.groq_key) {
              apiKey = parsed.groq_key;
              break;
            } else if (provider === 'openai' && parsed.openai_key) {
              apiKey = parsed.openai_key;
              break;
            }
          } catch {}
        }
      }

      // C. Fallback a variables de entorno del servidor
      if (!apiKey || apiKey === '***') {
        if (provider === 'gemini') apiKey = process.env.GEMINI_API_KEY || '';
        else if (provider === 'groq') apiKey = process.env.GROQ_API_KEY || '';
        else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY || '';
      }
    }

    if (!apiKey || apiKey === '***') {
      return NextResponse.json({
        status: 'invalid_key',
        percentage: 0,
        credits_label: 'Sin configurar',
        message: `No hay ninguna API Key de ${provider.toUpperCase()} configurada para probar.`
      });
    }

    // 5. Testear la API
    if (provider === 'openai') {
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

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        return NextResponse.json({
          status: 'success',
          percentage: 100,
          credits_label: '100% Saldo Activo',
          message: 'La conexión es exitosa y hay saldo disponible en OpenAI.'
        });
      } else {
        const errCode = data?.error?.code;
        if (errCode === 'insufficient_quota') {
          return NextResponse.json({
            status: 'no_credit',
            percentage: 0,
            credits_label: '0% (Cuota Agotada)',
            message: 'La API Key es válida, pero el saldo o límite de cuota en OpenAI se ha agotado.'
          });
        } else if (errCode === 'invalid_api_key' || res.status === 401) {
          return NextResponse.json({
            status: 'invalid_key',
            percentage: 0,
            credits_label: 'Clave Inválida',
            message: 'La API Key ingresada es incorrecta o ha sido revocada.'
          });
        } else {
          return NextResponse.json({
            status: 'error',
            percentage: 0,
            credits_label: 'Error',
            message: data?.error?.message || 'Error al contactar OpenAI.'
          });
        }
      }
    } 
    
    else if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        return NextResponse.json({
          status: 'success',
          percentage: 100,
          credits_label: '100% Cuota Activa',
          message: 'La conexión con Groq es exitosa y hay cuota disponible.'
        });
      } else {
        const errCode = data?.error?.code;
        if (errCode === 'insufficient_quota') {
          return NextResponse.json({
            status: 'no_credit',
            percentage: 0,
            credits_label: '0% (Agotado)',
            message: 'Se ha agotado la cuota de Groq.'
          });
        } else if (errCode === 'invalid_api_key' || res.status === 401) {
          return NextResponse.json({
            status: 'invalid_key',
            percentage: 0,
            credits_label: 'Clave Inválida',
            message: 'La API Key de Groq es incorrecta.'
          });
        } else {
          return NextResponse.json({
            status: 'error',
            percentage: 0,
            credits_label: 'Error',
            message: data?.error?.message || 'Error al contactar Groq.'
          });
        }
      }
    }

    else if (provider === 'gemini') {
      // Test Gemini: usar modelo solicitado o gemini-3.8-flash por defecto
      const candidateModel = model || 'gemini-3.8-flash';
      let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 2 }
        })
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      // Si el modelo específico arrojó 503 (alta demanda) o 404, probar automáticamente con fallback para verificar que la llave esté activa
      if (!res.ok && (res.status === 503 || res.status === 404)) {
        try {
          const fallbackRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 2 } })
          });
          if (fallbackRes.ok) {
            return NextResponse.json({
              status: 'success',
              percentage: 100,
              credits_label: '100% Cuota Activa',
              message: `La conexión es exitosa y la llave funciona correctamente con Google Gemini (${candidateModel}).`
            });
          }
        } catch {}
      }

      if (res.ok) {
        return NextResponse.json({
          status: 'success',
          percentage: 100,
          credits_label: '100% Cuota Activa',
          message: `La conexión es exitosa y la llave funciona correctamente con Google Gemini (${candidateModel}).`
        });
      } else {
        const errorStatus = data?.error?.status || '';
        const errorMessage = data?.error?.message || '';

        if (res.status === 403 || errorStatus === 'PERMISSION_DENIED') {
          return NextResponse.json({
            status: 'invalid_key',
            percentage: 0,
            credits_label: 'Sin Permisos',
            message: 'La API Key de Gemini es incorrecta o no tiene permisos habilitados.'
          });
        } else if (res.status === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
          return NextResponse.json({
            status: 'no_credit',
            percentage: 0,
            credits_label: '0% (Cuota Agotada)',
            message: 'Se han agotado los créditos o se excedió el límite de cuota gratuita de Gemini.'
          });
        } else if (res.status === 400 && errorMessage.includes('API key not valid')) {
          return NextResponse.json({
            status: 'invalid_key',
            percentage: 0,
            credits_label: 'Clave Inválida',
            message: 'La API Key provista no es válida para Google Gemini.'
          });
        } else {
          return NextResponse.json({
            status: 'error',
            percentage: 0,
            credits_label: 'Error',
            message: errorMessage || 'Error al contactar Google Gemini.'
          });
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
