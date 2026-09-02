import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data: accounts, error } = await supabase
      .from('whatsapp_accounts')
      .select('id, phone_number_id, name, is_default, status')
      .eq('tenant_id', tenant.tenantId)
      .order('is_default', { ascending: false });

    if (error) {
      console.error('Error fetching whatsapp accounts:', error);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    return NextResponse.json({ accounts: accounts || [] });
  } catch (error) {
    console.error('Error in whatsapp-accounts route:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
