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
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // Table may not exist yet
      console.log('⚠️ payments table error:', error.message);
      return NextResponse.json({ payments: [] });
    }

    return NextResponse.json({ payments: data || [] });
  } catch (err: any) {
    console.error('❌ Error fetching payments:', err);
    return NextResponse.json({ payments: [] });
  }
}
