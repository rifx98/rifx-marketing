import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// ============================================
// CONVERSACIONES Y MENSAJES PARA EL PANEL
// ============================================

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const conversationId = req.nextUrl.searchParams.get('id');

    // Si se pide una conversación específica, devolver con sus mensajes
    if (conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (!conversation) {
        return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
      }

      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      return NextResponse.json({ conversation, messages: messages || [] });
    }

    // Obtener todas las conversaciones
    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('updated_at', { ascending: false });

    const chatting = (conversations || []).filter((c) => c.status === 'chatting');
    const interested = (conversations || []).filter((c) => c.status === 'interested');
    const bought = (conversations || []).filter((c) => c.status === 'bought');

    return NextResponse.json({ chatting, interested, bought });
  } catch (error) {
    console.error('❌ Error obteniendo conversaciones:', error);
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

    const supabase = createSupabaseAdmin();
    const { id, status, name, phone_number } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    
    if (status) {
      const validStatuses = ['chatting', 'interested', 'bought'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
      }
      updates.status = status;
    }

    if (name !== undefined) updates.name = name;
    if (phone_number !== undefined) updates.phone_number = phone_number;

    const { error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenant.tenantId); // Only allow modifying own conversations

    if (error) {
      console.error('❌ Error actualizando conversación:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error en PATCH conversación:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
