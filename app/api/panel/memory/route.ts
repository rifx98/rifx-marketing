import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// ============================================
// GESTION DE MEMORIA - Borrar conversaciones
// ============================================

// DELETE: Borrar todas las conversaciones y mensajes del tenant
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const tenant = await getTenantFromRequest(req);

    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 1. Obtener IDs de todas las conversaciones del tenant
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenant.tenantId);

    if (convError) {
      console.error('Error obteniendo conversaciones:', convError.message);
      return NextResponse.json({ error: convError.message }, { status: 500 });
    }

    const convIds = (conversations || []).map((c: { id: string }) => c.id);
    let deletedMessages = 0;
    let deletedConversations = 0;

    // 2. Borrar mensajes de cada conversacion (en lotes de 100)
    if (convIds.length > 0) {
      for (let i = 0; i < convIds.length; i += 100) {
        const batch = convIds.slice(i, i + 100);
        const { error: msgError, count } = await supabase
          .from('messages')
          .delete({ count: 'exact' })
          .in('conversation_id', batch);

        if (msgError) {
          console.error('Error borrando mensajes (lote):', msgError.message);
        }
        deletedMessages += (count || 0);
      }

      // 3. Borrar las conversaciones del tenant
      const { error: delConvError, count: convCount } = await supabase
        .from('conversations')
        .delete({ count: 'exact' })
        .eq('tenant_id', tenant.tenantId);

      if (delConvError) {
        console.error('Error borrando conversaciones:', delConvError.message);
        return NextResponse.json({ error: delConvError.message }, { status: 500 });
      }
      deletedConversations = convCount || 0;
    }

    return NextResponse.json({
      success: true,
      deleted: {
        messages: deletedMessages,
        conversations: deletedConversations,
      },
    });
  } catch (error) {
    console.error('Error en DELETE memoria:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Borrar conversaciones mas antiguas que X dias (auto-purga)
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const tenant = await getTenantFromRequest(req);
    const { retentionDays } = await req.json();

    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!retentionDays || retentionDays < 1) {
      return NextResponse.json({ error: 'retentionDays invalido' }, { status: 400 });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffISO = cutoffDate.toISOString();

    // 1. Obtener conversaciones antiguas
    const { data: oldConversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenant.tenantId)
      .lt('updated_at', cutoffISO);

    const oldIds = (oldConversations || []).map((c: { id: string }) => c.id);
    let deletedMessages = 0;
    let deletedConversations = 0;

    if (oldIds.length > 0) {
      // 2. Borrar mensajes de conversaciones antiguas
      for (let i = 0; i < oldIds.length; i += 100) {
        const batch = oldIds.slice(i, i + 100);
        const { count } = await supabase
          .from('messages')
          .delete({ count: 'exact' })
          .in('conversation_id', batch);
        deletedMessages += (count || 0);
      }

      // 3. Borrar las conversaciones antiguas
      const { count } = await supabase
        .from('conversations')
        .delete({ count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .lt('updated_at', cutoffISO);
      deletedConversations = count || 0;
    }

    return NextResponse.json({
      success: true,
      purged: {
        messages: deletedMessages,
        conversations: deletedConversations,
        olderThanDays: retentionDays,
      },
    });
  } catch (error) {
    console.error('Error en POST purga memoria:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
