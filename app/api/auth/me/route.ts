import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// GET: Obtener info completa del tenant actual
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('tenants')
      .select('id, email, company_name, owner_name, plan, plan_status, plan_expires_at, storage_used_bytes, storage_limit_bytes, contact_limit, is_admin, created_at')
      .eq('id', tenant.tenantId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      id: data.id,
      email: data.email,
      companyName: data.company_name,
      ownerName: data.owner_name,
      plan: data.plan,
      planStatus: data.plan_status,
      planExpiresAt: data.plan_expires_at,
      storageLimitBytes: data.storage_limit_bytes,
      storageUsedBytes: data.storage_used_bytes,
      contactLimit: data.contact_limit,
      isAdmin: data.is_admin,
      createdAt: data.created_at,
    });
  } catch (error: any) {
    console.error('❌ Error obteniendo tenant:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
