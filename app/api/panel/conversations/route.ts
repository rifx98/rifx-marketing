import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PATCH_BYTES = 8 * 1024;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

async function readPatchBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PATCH_BYTES) return null;
  if (!req.body) return null;
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let raw = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PATCH_BYTES) throw new Error('payload_too_large');
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

// ============================================
// CONVERSACIONES Y MENSAJES PARA EL PANEL
// ============================================

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;

    const supabase = createSupabaseAdmin();
    const conversationId = req.nextUrl.searchParams.get('id');

    // Si se pide una conversación específica, devolver con sus mensajes
    if (conversationId) {
      if (!UUID_PATTERN.test(conversationId)) {
        return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });
      }
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (conversationError || !conversation) {
        return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
      }

      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(501);
      if (messagesError) {
        console.error('Conversation message lookup failed:', messagesError.code || 'database_error');
        return NextResponse.json({ error: 'No se pudieron consultar los mensajes' }, { status: 500 });
      }

      const messagePage = (messages || []).slice(0, 500).reverse();

      return NextResponse.json(
        { conversation, messages: messagePage, hasMoreMessages: (messages || []).length > 500 },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Obtener todas las conversaciones
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('updated_at', { ascending: false })
      .limit(501);
    if (conversationsError) {
      console.error('Conversation list lookup failed:', conversationsError.code || 'database_error');
      return NextResponse.json({ error: 'No se pudieron consultar las conversaciones' }, { status: 500 });
    }

    const conversationPage = (conversations || []).slice(0, 500);

    const chatting = conversationPage
      .filter((c) => c.status === 'chatting' || c.status === 'requires_attention')
      .map((c) => c.status === 'requires_attention' ? { ...c, status: 'chatting', is_paused: true } : c);
    const interested = conversationPage.filter((c) => c.status === 'interested');
    const bought = conversationPage.filter((c) => c.status === 'bought');

    // Contar órdenes de Dropi válidas en la base de datos basándose en el prefijo __ORDER_DATA__
    const convIds = conversationPage.map((c) => c.id);
    let dropiOrdersCount = 0;
    if (convIds.length > 0) {
      const { data: orderMessages } = await supabase
        .from('messages')
        .select('content')
        .in('conversation_id', convIds)
        .like('content', '__ORDER_DATA__:%');
      
      dropiOrdersCount = (orderMessages || []).filter(m => m.content !== '__ORDER_DATA__:null').length;
    }

    return NextResponse.json(
      {
        chatting,
        interested,
        bought,
        dropiOrdersCount,
        hasMoreConversations: (conversations || []).length > 500,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    console.error('Conversation request failed');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH: Actualizar estado, nombre o número de una conversación
export async function PATCH(req: NextRequest) {
  try {
    // Auth check — VULN-06 fix
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;

    const supabase = createSupabaseAdmin();
    const body = await readPatchBody(req);
    if (!body) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    const { id, status, name, phone_number: phoneNumber, sales_stage: salesStage } = body;

    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });
    }

    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    
    if (status !== undefined) {
      const validStatuses = ['chatting', 'interested', 'bought'];
      if (typeof status !== 'string' || !validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
      }
      updates.status = status;
    }

    if (salesStage !== undefined) {
      const validStages = ['new_lead', 'discovery', 'qualified', 'proposal', 'objection', 'closing', 'appointment_booked', 'won', 'lost'];
      if (typeof salesStage !== 'string' || !validStages.includes(salesStage)) {
        return NextResponse.json({ error: 'Sales stage inválido' }, { status: 400 });
      }
      updates.sales_stage = salesStage;
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 160 || CONTROL_CHARACTER_PATTERN.test(name)) {
        return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
      }
      updates.customer_name = name.trim();
    }
    if (phoneNumber !== undefined) {
      if (typeof phoneNumber !== 'string' || !/^\+?[0-9 ()-]{7,24}$/.test(phoneNumber)) {
        return NextResponse.json({ error: 'Número de teléfono inválido' }, { status: 400 });
      }
      updates.phone_number = phoneNumber.replace(/[^0-9+]/g, '');
    }
    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'No hay cambios válidos' }, { status: 400 });
    }

    const { data: updatedConversation, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenant.tenantId)
      .select('id')
      .maybeSingle(); // Only allow modifying own conversations

    if (error) {
      console.error('Conversation update failed:', error.code || 'database_error');
      return NextResponse.json({ error: 'No se pudo actualizar la conversación' }, { status: 500 });
    }
    if (!updatedConversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    console.error('Conversation update request failed');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
