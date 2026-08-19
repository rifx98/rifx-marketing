import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { resolveSecretUpdate } from '@/lib/security';
import { createSupabaseAdmin } from '@/lib/supabase';
import { enforceTenantRateLimit, readLimitedJsonObject } from '@/lib/request-guards';

type Provider = 'whatsapp' | 'openai' | 'gemini' | 'groq';

function decodeExtendedConfig(stored: string): Record<string, string> {
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return { openai_key: stored };
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const parsed = await readLimitedJsonObject(req, 8 * 1024);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    const provider = body.provider as Provider;
    if (!['whatsapp', 'openai', 'gemini', 'groq'].includes(provider)) {
      return NextResponse.json({ error: 'Proveedor no soportado' }, { status: 400 });
    }

    const rateDenied = await enforceTenantRateLimit(`connection-check-${provider}`, tenant.tenantId, 10, 60_000);
    if (rateDenied) return rateDenied;

    const supabase = createSupabaseAdmin();
    const { data: config, error } = await supabase
      .from('config')
      .select('whatsapp_token, whatsapp_phone_id, openai_key')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'No se pudo cargar la configuración' }, { status: 500 });

    const extended = decodeExtendedConfig(config?.openai_key || '');
    let url: string;
    let headers: Record<string, string> = {};
    if (provider === 'whatsapp') {
      const credential = resolveSecretUpdate(body.credential, config?.whatsapp_token || '');
      const phoneId = typeof body.phoneId === 'string' && body.phoneId.trim()
        ? body.phoneId.trim()
        : config?.whatsapp_phone_id || '';
      if (!credential || credential.length > 4_096 || !/^\d{6,30}$/.test(phoneId)) {
        return NextResponse.json({ valid: false, reason: 'not_configured' });
      }
      url = `https://graph.facebook.com/v24.0/${encodeURIComponent(phoneId)}`;
      headers = { Authorization: `Bearer ${credential}` };
    } else {
      const field = `${provider}_key`;
      const credential = resolveSecretUpdate(body.credential, extended[field] || '');
      if (!credential || credential.length > 4_096) return NextResponse.json({ valid: false, reason: 'not_configured' });
      if (provider === 'gemini') {
        url = 'https://generativelanguage.googleapis.com/v1beta/models';
        headers = { 'x-goog-api-key': credential };
      } else if (provider === 'groq') {
        url = 'https://api.groq.com/openai/v1/models';
        headers = { Authorization: `Bearer ${credential}` };
      } else {
        url = 'https://api.openai.com/v1/models';
        headers = { Authorization: `Bearer ${credential}` };
      }
    }

    const upstream = await fetch(url, {
      headers,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(7000),
    });
    await upstream.body?.cancel();
    const response = NextResponse.json({
      valid: upstream.ok,
      reason: upstream.status === 429 ? 'quota' : upstream.ok ? 'ok' : 'invalid',
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    console.error('Connection verification failed');
    return NextResponse.json({ valid: false, reason: 'unavailable' }, { status: 502 });
  }
}
