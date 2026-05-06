import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// ============================================
// PAUSAR / REANUDAR IA PARA UNA CONVERSACIÓN
// Usa mensajes con rol 'assistant' y contenido especial
// como señal invisible. No requiere cambios de esquema.
// ============================================

const PAUSE_SIGNAL = '__SYSTEM_PAUSE__';
const RESUME_SIGNAL = '__SYSTEM_RESUME__';

// POST: Pausar o reanudar la IA
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const { conversationId, paused } = await req.json();

    if (!conversationId || typeof paused !== 'boolean') {
      return NextResponse.json({ error: 'Faltan conversationId o paused (boolean)' }, { status: 400 });
    }

    const signal = paused ? PAUSE_SIGNAL : RESUME_SIGNAL;

    // Insertar la señal usando rol 'assistant' (permitido por la DB)
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: signal,
    });

    if (error) {
      console.error('❌ Error insertando señal de pausa:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`${paused ? '⏸️' : '▶️'} Conversación ${conversationId} ${paused ? 'PAUSADA' : 'REANUDADA'} por humano`);

    return NextResponse.json({ success: true, paused });
  } catch (error) {
    console.error('❌ Error en pause:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET: Verificar si una conversación está pausada
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const conversationId = req.nextUrl.searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'Falta conversationId' }, { status: 400 });
    }

    const { data: messages } = await supabase
      .from('messages')
      .select('content')
      .eq('conversation_id', conversationId)
      .in('content', [PAUSE_SIGNAL, RESUME_SIGNAL])
      .order('created_at', { ascending: false })
      .limit(1);

    const isPaused = messages && messages.length > 0 && messages[0].content === PAUSE_SIGNAL;

    return NextResponse.json({ paused: isPaused });
  } catch (error) {
    return NextResponse.json({ paused: false });
  }
}
