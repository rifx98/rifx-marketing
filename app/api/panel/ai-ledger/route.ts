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
    
    // Get ledgers
    const { data: ledgers, error: ledgerError } = await supabase
      .from('ai_credit_ledgers')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false });

    if (ledgerError) {
      console.error('Error fetching AI ledger:', ledgerError);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    // Get current balance
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('ai_credits_balance')
      .eq('id', tenant.tenantId)
      .single();

    return NextResponse.json({ 
      ledgers: ledgers || [],
      balance: tenantData?.ai_credits_balance || 0
    });
  } catch (error) {
    console.error('Error in ai-ledger route:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
