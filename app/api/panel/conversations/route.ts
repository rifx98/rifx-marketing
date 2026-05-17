import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// ============================================
// CONVERSACIONES Y MENSAJES PARA EL PANEL
// ============================================

// GET: Obtener todas las conversaciones agrupadas por estado
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const tenant = await getTenantFromRequest(req);
    const conversationId = req.nextUrl.searchParams.get('id');

    // Si se pide una conversación específica, devolver con sus mensajes
    if (conversationId) {
      let convQuery = supabase.from('conversations').select('*').eq('id', conversationId);
      if (tenant?.tenantId) convQuery = convQuery.eq('tenant_id', tenant.tenantId);
      const { data: conversation } = await convQuery.single();

      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      return NextResponse.json({ conversation, messages: messages || [] });
    }

    // Obtener todas las conversaciones
    let allQuery = supabase.from('conversations').select('*').order('updated_at', { ascending: false });
    if (tenant?.tenantId) allQuery = allQuery.eq('tenant_id', tenant.tenantId);
    const { data: conversations } = await allQuery;

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
      .eq('id', id);

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
