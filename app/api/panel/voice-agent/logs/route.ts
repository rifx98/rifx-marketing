import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'voice_agent');
    if (featureError) return featureError;

    const supabase = createSupabaseAdmin();
    const { data: logs, error } = await supabase
      .from('voice_call_logs')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[voice-agent] Error obteniendo historial:', error);
      return NextResponse.json({ error: 'Error al consultar historial de llamadas' }, { status: 500 });
    }

    return NextResponse.json({ logs: logs || [] });
  } catch (err: any) {
    console.error('[voice-agent] Excepción en GET logs:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
