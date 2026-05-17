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
      const validPlans = ['trial', 'start', 'advanced', 'plus', 'master'];
      if (!validPlans.includes(plan)) {
        return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
      }

      const LIMITS: Record<string, { contacts: number; storage: number }> = {
        trial:    { contacts: 200,   storage: 100 * 1024 * 1024 },
        start:    { contacts: 1000,  storage: 250 * 1024 * 1024 },
        advanced: { contacts: 10000, storage: 500 * 1024 * 1024 },
        plus:     { contacts: 20000, storage: 1024 * 1024 * 1024 },
        master:   { contacts: 50000, storage: 2048 * 1024 * 1024 },
      };

      const limits = LIMITS[plan];
      const supabase = createSupabaseAdmin();
      const { error } = await supabase
        .from('tenants')
        .update({
          plan,
          plan_status: 'active',
          plan_started_at: new Date().toISOString(),
          plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          storage_limit_bytes: limits.storage,
          contact_limit: limits.contacts,
        })
        .eq('id', tenant.tenantId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, plan });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
