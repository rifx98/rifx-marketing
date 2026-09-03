import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import { internalApiError } from '@/lib/request-guards';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const featureDenied = denyUnlessFeature(tenant, 'banners');
    if (featureDenied) return featureDenied;

    const templateId = params.id;
    if (!templateId) {
      return NextResponse.json({ error: 'ID de plantilla requerido' }, { status: 400 });
    }

    const body = await req.json();
    const { name, nodes, edges } = body;

    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('templates')
      .update({
        name: name || undefined,
        config_json: { nodes, edges },
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .eq('tenant_id', tenant.tenantId)
      .select();

    if (error) {
      console.error('Template update failed:', error.message);
      return internalApiError();
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Plantilla no encontrada o no tienes permisos para editarla' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template: data[0] });
  } catch (error) {
    console.error('Template save request failed:', error);
    return internalApiError();
  }
}
