import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { internalApiError } from '@/lib/request-guards';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('flow_versions')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching flow versions:', error);
      return internalApiError();
    }

    return NextResponse.json({ success: true, flows: data });
  } catch (error) {
    console.error('Flow versions GET error:', error);
    return internalApiError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, nodes, edges, kind } = body;

    const supabase = createSupabaseAdmin();
    
    let result;
    
    // If we have a valid UUID id, we update
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
    
    if (isUuid) {
      result = await supabase
        .from('flow_versions')
        .update({
          flow_name: name || 'Mi Bot',
          flow_data: { nodes, edges },
          kind: kind || 'draft'
        })
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .select();
    } else {
      // If it's a string like 'captacion_vip' (from mock) or new, we insert or upsert based on flow_name
      // Let's check if one with this flow_name exists for this tenant
      const existingName = name || id || 'Mi Bot';
      
      const { data: existing } = await supabase
        .from('flow_versions')
        .select('id')
        .eq('tenant_id', tenant.tenantId)
        .eq('flow_name', existingName)
        .limit(1);
        
      if (existing && existing.length > 0) {
        // Update existing by name
        result = await supabase
          .from('flow_versions')
          .update({
            flow_data: { nodes, edges },
            kind: kind || 'draft'
          })
          .eq('id', existing[0].id)
          .select();
      } else {
        // Insert new
        result = await supabase
          .from('flow_versions')
          .insert({
            tenant_id: tenant.tenantId,
            flow_name: existingName,
            flow_data: { nodes, edges },
            kind: kind || 'draft',
            flow_version: 1
          })
          .select();
      }
    }

    if (result.error) {
      console.error('Template save error:', result.error.message);
      return internalApiError();
    }

    return NextResponse.json({ success: true, flow: result.data[0] });
  } catch (error) {
    console.error('Flow save POST error:', error);
    return internalApiError();
  }
}
