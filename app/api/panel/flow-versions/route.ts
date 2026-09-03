import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { internalApiError } from '@/lib/request-guards';

const MAX_FLOW_DATA_BYTES = 512_000; // 500 KB max for flow_data

function validateFlowPayload(nodes: unknown, edges: unknown): string | null {
  if (!Array.isArray(nodes)) return 'nodes must be an array';
  if (!Array.isArray(edges)) return 'edges must be an array';
  if (nodes.length === 0) return 'Flow must have at least one node';
  if (nodes.length > 500) return 'Flow exceeds maximum of 500 nodes';
  if (edges.length > 2000) return 'Flow exceeds maximum of 2000 edges';
  
  const hasStart = nodes.some((n: any) => n.type === 'start');
  if (!hasStart) return 'Flow must contain a Start node';

  const serialized = JSON.stringify({ nodes, edges });
  if (serialized.length > MAX_FLOW_DATA_BYTES) {
    return `Flow data exceeds ${MAX_FLOW_DATA_BYTES / 1000}KB limit`;
  }

  return null;
}

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

    return NextResponse.json({ success: true, flows: data || [] });
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
    const { id, name, nodes, edges, kind, publish } = body;

    // --- VALIDATION ---
    const validationError = validateFlowPayload(nodes, edges);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const flowName = (typeof name === 'string' && name.trim()) ? name.trim() : 'Mi Bot';
    const flowKind = publish ? 'published' : (kind || 'draft');

    const supabase = createSupabaseAdmin();
    
    let result;
    
    // If we have a valid UUID id, we update
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
    
    if (isUuid) {
      // Verify this flow belongs to the tenant before updating
      const { data: existing } = await supabase
        .from('flow_versions')
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: 'Flow not found or access denied' }, { status: 404 });
      }

      result = await supabase
        .from('flow_versions')
        .update({
          flow_name: flowName,
          flow_data: { nodes, edges },
          kind: flowKind
        })
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .select();
    } else {
      // Non-UUID id: check if a flow with this name exists for this tenant
      const lookupName = flowName;
      
      const { data: existing } = await supabase
        .from('flow_versions')
        .select('id')
        .eq('tenant_id', tenant.tenantId)
        .eq('flow_name', lookupName)
        .limit(1);
        
      if (existing && existing.length > 0) {
        // Update existing by name
        result = await supabase
          .from('flow_versions')
          .update({
            flow_data: { nodes, edges },
            kind: flowKind
          })
          .eq('id', existing[0].id)
          .eq('tenant_id', tenant.tenantId)
          .select();
      } else {
        // Insert new
        result = await supabase
          .from('flow_versions')
          .insert({
            tenant_id: tenant.tenantId,
            flow_name: lookupName,
            flow_data: { nodes, edges },
            kind: flowKind,
            flow_version: 1
          })
          .select();
      }
    }

    if (result.error) {
      console.error('Flow save error:', result.error.message);
      return internalApiError();
    }

    const savedFlow = result.data?.[0];

    // --- PUBLISH: sync to config.bot_menu_config ---
    if (publish && savedFlow) {
      try {
        await supabase
          .from('config')
          .update({ bot_menu_config: { nodes, edges } })
          .eq('tenant_id', tenant.tenantId);
        
        console.log(`[FlowZap] Published flow "${flowName}" to config.bot_menu_config for tenant ${tenant.tenantId}`);
      } catch (syncErr) {
        console.error('[FlowZap] Failed to sync published flow to config:', syncErr);
        // Don't fail the save — the flow is saved, just the sync failed
      }
    }

    return NextResponse.json({ success: true, flow: savedFlow });
  } catch (error) {
    console.error('Flow save POST error:', error);
    return internalApiError();
  }
}
