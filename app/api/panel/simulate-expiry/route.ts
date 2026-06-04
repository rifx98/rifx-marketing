import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// ============================================
// SIMULATE EXPIRATION — For testing only
// Sets plan_expires_at to yesterday and plan_status to 'expired'
// ============================================

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Only admins can simulate expiration
    if (!tenant.isAdmin) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const { targetTenantId } = await req.json();
    const tenantIdToExpire = targetTenantId || tenant.tenantId;

    const supabase = createSupabaseAdmin();

    // Set expiration to yesterday
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('tenants')
      .update({
        plan_status: 'expired',
        plan_expires_at: yesterday,
      })
      .eq('id', tenantIdToExpire);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`⚠️ [TEST] Plan expirado manualmente para tenant ${tenantIdToExpire}`);

    return NextResponse.json({
      success: true,
      message: `Plan expirado para ${tenantIdToExpire}. Recarga la página para ver el bloqueo.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
