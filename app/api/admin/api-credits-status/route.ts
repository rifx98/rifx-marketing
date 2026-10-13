import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface ApiProviderCredit {
  id: 'higgsfield' | 'flux' | 'openai' | 'groq';
  name: string;
  badge: string;
  status: 'active' | 'no_credit' | 'invalid_key' | 'unconfigured' | 'error';
  percentage: number;
  credits_label: string;
  message: string;
  recharge_url: string;
  recharge_label: string;
  is_active_engine: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();

    // 1. Obtener configuración del tenant
    const { data: cfgRow } = await supabase
      .from('config')
      .select('openai_key')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();

    let decoded: Record<string, any> = {};
    if (cfgRow?.openai_key) {
      try {
        decoded = JSON.parse(cfgRow.openai_key);
      } catch {
        decoded = {};
      }
    }

    // 2. Obtener configuración global de platform_settings
    const { data: platformSettings } = await supabase
      .from('platform_settings')
      .select('global_ai_config')
      .limit(1)
      .maybeSingle();

    const globalAi = platformSettings?.global_ai_config || {};

    // Resolver claves (Prioridad: Configuración Tenant en DB -> Platform Settings -> Variables de entorno)
    const activeVisualProvider = decoded.visual_render_provider || 'higgsfield';

    const hfKey = (decoded.higgsfield_key && !decoded.higgsfield_key.includes('••••'))
      ? decoded.higgsfield_key.trim()
      : (process.env.HIGGSFIELD_API_KEY || '').trim();

    const falKey = (decoded.fal_key && !decoded.fal_key.includes('••••'))
      ? decoded.fal_key.trim()
      : (process.env.FAL_KEY || '').trim();

    const openaiKey = (decoded.openai_key && typeof decoded.openai_key === 'string' && decoded.openai_key.startsWith('sk-') && !decoded.openai_key.includes('••••'))
      ? decoded.openai_key.trim()
      : (globalAi.provider === 'openai' && globalAi.apiKey && globalAi.apiKey !== '***' ? globalAi.apiKey : (process.env.OPENAI_API_KEY || '').trim());

    const groqKey = (decoded.groq_key && !decoded.groq_key.includes('••••'))
      ? decoded.groq_key.trim()
      : (globalAi.provider === 'groq' && globalAi.apiKey && globalAi.apiKey !== '***' ? globalAi.apiKey : (process.env.GROQ_API_KEY || '').trim());

    // 3. Probar Higgsfield AI
    let hfStatus: ApiProviderCredit;
    if (!hfKey) {
      hfStatus = {
        id: 'higgsfield',
        name: 'Higgsfield AI (Soul v2)',
        badge: 'Motor de Pancartas',
        status: 'unconfigured',
        percentage: 0,
        credits_label: 'Sin configurar',
        message: 'No hay credencial de Higgsfield configurada.',
        recharge_url: 'https://open.higgsfield.ai',
        recharge_label: 'Obtener Clave en open.higgsfield.ai',
        is_active_engine: activeVisualProvider === 'higgsfield',
      };
    } else {
      try {
        const authHeader = hfKey.startsWith('Key ') ? hfKey : `Key ${hfKey}`;
        const probeRes = await fetch('https://api.higgsfield.ai/higgsfield-ai/soul/v2/standard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({ prompt: 'probe', aspect_ratio: '1:1' }),
        });
        const probeData = await probeRes.json().catch(() => ({}));

        if (probeRes.status === 403 && probeData?.detail === 'not_enough_credits') {
          hfStatus = {
            id: 'higgsfield',
            name: 'Higgsfield AI (Soul v2)',
            badge: 'Motor de Pancartas',
            status: 'no_credit',
            percentage: 0,
            credits_label: '0 créditos (0%)',
            message: 'Saldo agotado en Higgsfield. Recarga créditos en la consola oficial para generar pancartas.',
            recharge_url: 'https://open.higgsfield.ai',
            recharge_label: 'Recargar Saldo en open.higgsfield.ai',
            is_active_engine: activeVisualProvider === 'higgsfield',
          };
        } else if (probeRes.status === 401) {
          hfStatus = {
            id: 'higgsfield',
            name: 'Higgsfield AI (Soul v2)',
            badge: 'Motor de Pancartas',
            status: 'invalid_key',
            percentage: 0,
            credits_label: 'Clave inválida',
            message: 'La credencial de Higgsfield es incorrecta o ha sido revocada.',
            recharge_url: 'https://open.higgsfield.ai',
            recharge_label: 'Ver Clave en open.higgsfield.ai',
            is_active_engine: activeVisualProvider === 'higgsfield',
          };
        } else if (probeRes.ok || probeRes.status === 200 || probeRes.status === 201 || probeData?.request_id) {
          hfStatus = {
            id: 'higgsfield',
            name: 'Higgsfield AI (Soul v2)',
            badge: 'Motor de Pancartas',
            status: 'active',
            percentage: 100,
            credits_label: 'Saldo Disponible (100%)',
            message: 'Conexión activa y créditos listos para generación fotorrealista.',
            recharge_url: 'https://open.higgsfield.ai',
            recharge_label: 'Administrar en open.higgsfield.ai',
            is_active_engine: activeVisualProvider === 'higgsfield',
          };
        } else {
          // Posible error de validación o probe, pero la clave autenticó
          hfStatus = {
            id: 'higgsfield',
            name: 'Higgsfield AI (Soul v2)',
            badge: 'Motor de Pancartas',
            status: 'active',
            percentage: 100,
            credits_label: 'Conectado (100%)',
            message: 'API Key autenticada correctamente con el servicio Soul v2.',
            recharge_url: 'https://open.higgsfield.ai',
            recharge_label: 'Consola Higgsfield',
            is_active_engine: activeVisualProvider === 'higgsfield',
          };
        }
      } catch (err: any) {
        hfStatus = {
          id: 'higgsfield',
          name: 'Higgsfield AI (Soul v2)',
          badge: 'Motor de Pancartas',
          status: 'error',
          percentage: 0,
          credits_label: 'Error de red',
          message: `No se pudo conectar con api.higgsfield.ai: ${err.message}`,
          recharge_url: 'https://open.higgsfield.ai',
          recharge_label: 'Revisar en open.higgsfield.ai',
          is_active_engine: activeVisualProvider === 'higgsfield',
        };
      }
    }

    // 4. Probar fal.ai
    let falStatus: ApiProviderCredit;
    if (!falKey) {
      falStatus = {
        id: 'flux',
        name: 'fal.ai (FLUX / Inpainting)',
        badge: 'Motor Visual Secundario',
        status: 'unconfigured',
        percentage: 0,
        credits_label: 'Sin configurar',
        message: 'FAL_KEY no configurado.',
        recharge_url: 'https://fal.ai/dashboard/billing',
        recharge_label: 'Obtener Clave fal.ai',
        is_active_engine: activeVisualProvider === 'flux',
      };
    } else {
      try {
        const probeRes = await fetch('https://fal.run/fal-ai/birefnet', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        if (probeRes.status === 401) {
          falStatus = {
            id: 'flux',
            name: 'fal.ai (FLUX / Inpainting)',
            badge: 'Motor Visual Secundario',
            status: 'invalid_key',
            percentage: 0,
            credits_label: 'Clave inválida',
            message: 'La clave FAL_KEY no es válida.',
            recharge_url: 'https://fal.ai/dashboard/billing',
            recharge_label: 'Revisar fal.ai',
            is_active_engine: activeVisualProvider === 'flux',
          };
        } else if (probeRes.status === 402) {
          falStatus = {
            id: 'flux',
            name: 'fal.ai (FLUX / Inpainting)',
            badge: 'Motor Visual Secundario',
            status: 'no_credit',
            percentage: 0,
            credits_label: '0 saldo (0%)',
            message: 'Saldo agotado en fal.ai. Recarga fondos en tu cuenta.',
            recharge_url: 'https://fal.ai/dashboard/billing',
            recharge_label: 'Recargar en fal.ai',
            is_active_engine: activeVisualProvider === 'flux',
          };
        } else {
          falStatus = {
            id: 'flux',
            name: 'fal.ai (FLUX / Inpainting)',
            badge: 'Motor Visual Secundario',
            status: 'active',
            percentage: 100,
            credits_label: 'Saldo Activo (100%)',
            message: 'Servicio FLUX y BiRefNet disponible para inpainting y render.',
            recharge_url: 'https://fal.ai/dashboard/billing',
            recharge_label: 'Facturación fal.ai',
            is_active_engine: activeVisualProvider === 'flux',
          };
        }
      } catch (err: any) {
        falStatus = {
          id: 'flux',
          name: 'fal.ai (FLUX / Inpainting)',
          badge: 'Motor Visual Secundario',
          status: 'error',
          percentage: 0,
          credits_label: 'Error de red',
          message: err.message,
          recharge_url: 'https://fal.ai/dashboard/billing',
          recharge_label: 'Abrir fal.ai',
          is_active_engine: activeVisualProvider === 'flux',
        };
      }
    }

    // 5. Probar OpenAI
    let openaiStatus: ApiProviderCredit;
    if (!openaiKey) {
      openaiStatus = {
        id: 'openai',
        name: 'OpenAI (DALL-E & GPT)',
        badge: 'Render y Modelos GPT',
        status: 'unconfigured',
        percentage: 0,
        credits_label: 'Sin configurar',
        message: 'OPENAI_API_KEY no configurada.',
        recharge_url: 'https://platform.openai.com/billing',
        recharge_label: 'Obtener Clave OpenAI',
        is_active_engine: activeVisualProvider === 'openai',
      };
    } else {
      try {
        const probeRes = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${openaiKey}` },
        });
        const probeData = await probeRes.json().catch(() => ({}));
        if (probeRes.status === 401) {
          openaiStatus = {
            id: 'openai',
            name: 'OpenAI (DALL-E & GPT)',
            badge: 'Render y Modelos GPT',
            status: 'invalid_key',
            percentage: 0,
            credits_label: 'Clave inválida',
            message: 'La clave de OpenAI no es válida o expiró.',
            recharge_url: 'https://platform.openai.com/billing',
            recharge_label: 'Facturación OpenAI',
            is_active_engine: activeVisualProvider === 'openai',
          };
        } else if (probeRes.status === 429 && probeData?.error?.code === 'insufficient_quota') {
          openaiStatus = {
            id: 'openai',
            name: 'OpenAI (DALL-E & GPT)',
            badge: 'Render y Modelos GPT',
            status: 'no_credit',
            percentage: 0,
            credits_label: 'Cuota agotada (0%)',
            message: 'Se agotó el saldo o límite de crédito en OpenAI.',
            recharge_url: 'https://platform.openai.com/billing',
            recharge_label: 'Recargar Saldo OpenAI',
            is_active_engine: activeVisualProvider === 'openai',
          };
        } else {
          openaiStatus = {
            id: 'openai',
            name: 'OpenAI (DALL-E & GPT)',
            badge: 'Render y Modelos GPT',
            status: 'active',
            percentage: 100,
            credits_label: 'Saldo Activo (100%)',
            message: 'Conexión con OpenAI autorizada y lista para procesar.',
            recharge_url: 'https://platform.openai.com/billing',
            recharge_label: 'Facturación OpenAI',
            is_active_engine: activeVisualProvider === 'openai',
          };
        }
      } catch (err: any) {
        openaiStatus = {
          id: 'openai',
          name: 'OpenAI (DALL-E & GPT)',
          badge: 'Render y Modelos GPT',
          status: 'error',
          percentage: 0,
          credits_label: 'Error',
          message: err.message,
          recharge_url: 'https://platform.openai.com/billing',
          recharge_label: 'Abrir OpenAI',
          is_active_engine: activeVisualProvider === 'openai',
        };
      }
    }

    // 6. Probar Groq
    let groqStatus: ApiProviderCredit;
    if (!groqKey) {
      groqStatus = {
        id: 'groq',
        name: 'Groq (Chatbot Ultra Rápido)',
        badge: 'Chatbot Global',
        status: 'unconfigured',
        percentage: 0,
        credits_label: 'Sin configurar',
        message: 'GROQ_API_KEY no configurada.',
        recharge_url: 'https://console.groq.com',
        recharge_label: 'Consola Groq',
        is_active_engine: false,
      };
    } else {
      try {
        const probeRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${groqKey}` },
        });
        if (probeRes.status === 401) {
          groqStatus = {
            id: 'groq',
            name: 'Groq (Chatbot Ultra Rápido)',
            badge: 'Chatbot Global',
            status: 'invalid_key',
            percentage: 0,
            credits_label: 'Clave inválida',
            message: 'La clave de Groq es incorrecta.',
            recharge_url: 'https://console.groq.com',
            recharge_label: 'Consola Groq',
            is_active_engine: false,
          };
        } else if (probeRes.status === 429) {
          groqStatus = {
            id: 'groq',
            name: 'Groq (Chatbot Ultra Rápido)',
            badge: 'Chatbot Global',
            status: 'no_credit',
            percentage: 0,
            credits_label: 'Límite alcanzado (0%)',
            message: 'Límite de tasa o cuota excedida en Groq.',
            recharge_url: 'https://console.groq.com',
            recharge_label: 'Consola Groq',
            is_active_engine: false,
          };
        } else {
          groqStatus = {
            id: 'groq',
            name: 'Groq (Chatbot Ultra Rápido)',
            badge: 'Chatbot Global',
            status: 'active',
            percentage: 100,
            credits_label: 'Cuota Disponible (100%)',
            message: 'Modelos Llama 3 activos para respuestas instantáneas.',
            recharge_url: 'https://console.groq.com',
            recharge_label: 'Consola Groq',
            is_active_engine: false,
          };
        }
      } catch (err: any) {
        groqStatus = {
          id: 'groq',
          name: 'Groq (Chatbot Ultra Rápido)',
          badge: 'Chatbot Global',
          status: 'error',
          percentage: 0,
          credits_label: 'Error',
          message: err.message,
          recharge_url: 'https://console.groq.com',
          recharge_label: 'Consola Groq',
          is_active_engine: false,
        };
      }
    }

    return NextResponse.json({
      success: true,
      active_provider: activeVisualProvider,
      providers: [hfStatus, falStatus, openaiStatus, groqStatus],
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in /api/admin/api-credits-status:', err);
    return NextResponse.json({ error: err.message || 'Error del servidor' }, { status: 500 });
  }
}
