import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();

    // Try to fetch from payments table
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, currency, status, provider, plan, created_at')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Payment history lookup failed:', error.code || 'database_error');
      return NextResponse.json(
        { error: 'No se pudo consultar el historial de pagos' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { payments: data || [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    console.error('Payment history request failed');
    return NextResponse.json(
      { error: 'No se pudo consultar el historial de pagos' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
