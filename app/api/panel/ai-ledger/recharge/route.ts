import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    
    // NOTA DE SEGURIDAD: Se ha removido la verificación de administrador temporalmente para pruebas.
    // Para producción, se DEBE integrar una pasarela de pago (Stripe) antes de dar los créditos.
    if (!tenant?.tenantId) {
      return NextResponse.json(
        { error: 'No autorizado. Debes iniciar sesión.' }, 
        { status: 403 }
      );
    }

    const body = await req.json();
    const amount = Number(body.amount);
    const note = body.note || 'Recarga manual';

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    
    // Use atomic RPC transaction
    const { data: newBalance, error: rpcError } = await supabase.rpc('increment_ai_credits', {
      p_tenant_id: tenant.tenantId,
      p_amount: amount,
      p_note: note,
      p_user_id: tenant.tenantId // using tenant id as the actor for now
    });

    if (rpcError) {
      console.error('Error en RPC increment_ai_credits:', rpcError);
      return NextResponse.json({ error: 'Error al procesar la recarga' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      balance: newBalance
    });
  } catch (error) {
    console.error('Error in recharge route:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
