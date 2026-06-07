import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { action, plan } = body;

    if (action === 'update_plan') {
      // SECURITY FIX (VULN-07): Only allow downgrade to 'trial' (free).
      // Paid plan upgrades MUST go through /api/panel/checkout → Lemon Squeezy webhook.
      if (plan !== 'trial') {
        return NextResponse.json(
          { error: 'Los planes de pago solo se activan después de completar el checkout. Usa el botón de upgrade en el panel.' },
          { status: 403 }
        );
      }

      const TRIAL_LIMITS = { contacts: 200, storage: 100 * 1024 * 1024 };

      const supabase = createSupabaseAdmin();

      const { error } = await supabase
        .from('tenants')
        .update({
          plan: 'trial',
          plan_status: 'active',
          plan_started_at: new Date().toISOString(),
          plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          storage_limit_bytes: TRIAL_LIMITS.storage,
          contact_limit: TRIAL_LIMITS.contacts,
        })
        .eq('id', tenant.tenantId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      console.log(`✅ Plan downgraded a trial para tenant ${tenant.tenantId}`);

      return NextResponse.json({ success: true, plan: 'trial', scheduled: false });
    }

    // Action: cancel_subscription (keep plan and expires_at, only set status to cancelled)
    if (action === 'cancel_subscription') {
      const supabase = createSupabaseAdmin();

      // Fetch current tenant data to check plan and expiry
      const { data: currentTenant, error: fetchError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenant.tenantId)
        .single();

      if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

      const { error } = await supabase
        .from('tenants')
        .update({
          plan_status: 'cancelled',
        })
        .eq('id', tenant.tenantId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const expiresAt = currentTenant.plan_expires_at
        ? new Date(currentTenant.plan_expires_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : 'su fecha de vencimiento';

      const planName = currentTenant.plan.toUpperCase();

      console.log(`❌ Suscripción cancelada (no renovación) para tenant ${tenant.tenantId}. Activo hasta ${currentTenant.plan_expires_at}`);
      return NextResponse.json({ 
        success: true, 
        plan: currentTenant.plan, 
        planStatus: 'cancelled',
        planExpiresAt: currentTenant.plan_expires_at,
        message: `Suscripción cancelada. Tu plan ${planName} permanecerá activo hasta el ${expiresAt}.` 
      });
    }

    // Action: reactivate_subscription (reactivate auto-renewal by setting plan_status to active)
    if (action === 'reactivate_subscription') {
      const supabase = createSupabaseAdmin();
      const { error } = await supabase
        .from('tenants')
        .update({
          plan_status: 'active',
        })
        .eq('id', tenant.tenantId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ 
        success: true, 
        planStatus: 'active',
        message: '¡Suscripción reactivada! Tu plan se renovará automáticamente al final del período.' 
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
