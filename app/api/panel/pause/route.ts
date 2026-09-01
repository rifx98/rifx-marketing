import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
  readLimitedResponseJson,
} from '@/lib/request-guards';

const PAUSE_SIGNAL = '__SYSTEM_PAUSE__';
const RESUME_SIGNAL = '__SYSTEM_RESUME__';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESUME_MESSAGE = 'Espero que hayamos podido solucionar tu consulta. ¿Hay algo más en lo que pueda ayudarte el día de hoy?';

async function authorize(req: NextRequest, attempts: number) {
  const tenant = await getTenantFromRequest(req);
  if (!tenant?.tenantId) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const;
  }
  const featureDenied = denyUnlessFeature(tenant, 'crm');
  if (featureDenied) return { response: featureDenied } as const;
  const rateDenied = await enforceTenantRateLimit('conversation-pause', tenant.tenantId, attempts, 60_000);
  if (rateDenied) return { response: rateDenied } as const;
  return { tenant } as const;
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorize(req, 40);
    if ('response' in authorization) return authorization.response;
    const parsed = await readLimitedJsonObject(req, 4 * 1024);
    if (!parsed.ok) return parsed.response;
    const { conversationId, paused } = parsed.body;
    if (typeof conversationId !== 'string' || !UUID_PATTERN.test(conversationId) || typeof paused !== 'boolean') {
      return NextResponse.json({ error: 'Datos de pausa invalidos' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id,phone_number')
      .eq('id', conversationId)
      .eq('tenant_id', authorization.tenant.tenantId)
      .maybeSingle();
    if (conversationError) {
      console.error('Conversation ownership lookup failed:', conversationError.code || 'database_error');
      return internalApiError();
    }
    if (!conversation) return NextResponse.json({ error: 'Conversacion no encontrada' }, { status: 404 });

    const signal = paused ? PAUSE_SIGNAL : RESUME_SIGNAL;
    const { error: signalError } = await supabase.from('messages').insert({
      tenant_id: authorization.tenant.tenantId,
      conversation_id: conversationId,
      role: 'assistant',
      content: signal,
    });
    if (signalError) {
      console.error('Conversation pause signal failed:', signalError.code || 'database_error');
      return internalApiError();
    }

    if (paused) return NextResponse.json({ success: true, paused: true });

    const { data: config, error: configError } = await supabase
      .from('config')
      .select('whatsapp_token,whatsapp_phone_id')
      .eq('tenant_id', authorization.tenant.tenantId)
      .maybeSingle();
    if (configError) {
      console.error('WhatsApp resume configuration lookup failed:', configError.code || 'database_error');
      return NextResponse.json({ success: true, paused: false, notificationSent: false });
    }
    if (
      typeof config?.whatsapp_token !== 'string'
      || !config.whatsapp_token
      || typeof config.whatsapp_phone_id !== 'string'
      || !/^\d{5,32}$/.test(config.whatsapp_phone_id)
      || typeof conversation.phone_number !== 'string'
      || !/^\+?\d{7,20}$/.test(conversation.phone_number)
    ) {
      return NextResponse.json({ success: true, paused: false, notificationSent: false });
    }

    let providerResponse: Response;
    try {
      providerResponse = await fetch(
        `https://graph.facebook.com/v24.0/${encodeURIComponent(config.whatsapp_phone_id)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.whatsapp_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: conversation.phone_number,
            type: 'text',
            text: { body: RESUME_MESSAGE },
          }),
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(12_000),
        },
      );
      await readLimitedResponseJson(providerResponse, 64 * 1024);
    } catch {
      console.error('WhatsApp resume notification request failed');
      return NextResponse.json({ success: true, paused: false, notificationSent: false });
    }
    if (!providerResponse.ok) {
      console.error('WhatsApp resume notification rejected:', providerResponse.status);
      return NextResponse.json({ success: true, paused: false, notificationSent: false });
    }

    const { error: historyError } = await supabase.from('messages').insert({
      tenant_id: authorization.tenant.tenantId,
      conversation_id: conversationId,
      role: 'assistant',
      content: RESUME_MESSAGE,
    });
    if (historyError) {
      console.error('WhatsApp resume history write failed:', historyError.code || 'database_error');
    }
    return NextResponse.json({
      success: true,
      paused: false,
      notificationSent: true,
      historySaved: !historyError,
    });
  } catch {
    console.error('Conversation pause mutation failed');
    return internalApiError();
  }
}

export async function GET(req: NextRequest) {
  try {
    const authorization = await authorize(req, 120);
    if ('response' in authorization) return authorization.response;
    const conversationId = req.nextUrl.searchParams.get('conversationId');
    if (!conversationId || !UUID_PATTERN.test(conversationId)) {
      return NextResponse.json({ error: 'ID de conversacion invalido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('tenant_id', authorization.tenant.tenantId)
      .maybeSingle();
    if (conversationError) {
      console.error('Conversation ownership lookup failed:', conversationError.code || 'database_error');
      return internalApiError();
    }
    if (!conversation) return NextResponse.json({ error: 'Conversacion no encontrada' }, { status: 404 });

    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('content')
      .eq('tenant_id', authorization.tenant.tenantId)
      .eq('conversation_id', conversationId)
      .in('content', [PAUSE_SIGNAL, RESUME_SIGNAL])
      .order('created_at', { ascending: false })
      .limit(1);
    if (messagesError) {
      console.error('Conversation pause state lookup failed:', messagesError.code || 'database_error');
      return internalApiError();
    }

    return NextResponse.json(
      { paused: messages?.[0]?.content === PAUSE_SIGNAL },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    console.error('Conversation pause state request failed');
    return internalApiError();
  }
}
