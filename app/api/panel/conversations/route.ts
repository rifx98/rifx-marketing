import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// ============================================
// CONVERSACIONES Y MENSAJES PARA EL PANEL
// ============================================

// GET: Obtener todas las conversaciones agrupadas por estado
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const conversationId = req.nextUrl.searchParams.get('id');

    // Si se pide una conversación específica, devolver con sus mensajes
    if (conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

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
