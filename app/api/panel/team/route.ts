import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Valid roles matching the DB check constraint
const VALID_ROLES = ['Administrador', 'Asesor', 'Supervisor'] as const;

// Sections that can be assigned to team members
const ASSIGNABLE_SECTIONS = [
  'dashboard', 'crm', 'conversations', 'wa_campaigns', 'orders',
  'basic_bot', 'appointments', 'banners', 'campaigns', 'social',
  'segments', 'analytics',
] as const;

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'team');
    if (featureError) return featureError;

    const supabase = createSupabaseAdmin();
    const { data: agents, error } = await supabase
      .from('team_agents')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    return NextResponse.json({ agents: agents || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'team');
    if (featureError) return featureError;

    const body = await req.json();
    const { email, name, role, allowedSections } = body;

    if (!email || !name) {
      return NextResponse.json({ error: 'Nombre y correo son obligatorios' }, { status: 400 });
    }

    // Validate role against DB constraint
    const safeRole = VALID_ROLES.includes(role) ? role : 'Asesor';

    // Validate allowed sections
    const safeSections = Array.isArray(allowedSections)
      ? allowedSections.filter((s: string) => (ASSIGNABLE_SECTIONS as readonly string[]).includes(s))
      : [];

    const supabase = createSupabaseAdmin();
    const { data: agent, error } = await supabase
      .from('team_agents')
      .insert([
        {
          tenant_id: tenant.tenantId,
          name,
          email,
          role: safeRole,
          departments: { allowed_sections: safeSections },
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('[Team POST] Error:', error);
      return NextResponse.json({ error: 'Error al crear agente' }, { status: 500 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PATCH — Update agent role and/or allowed sections
export async function PATCH(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'team');
    if (featureError) return featureError;

    const body = await req.json();
    const { agentId, role, allowedSections } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'Falta agentId' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {};

    // Update role if provided and valid
    if (role && VALID_ROLES.includes(role)) {
      updatePayload.role = role;
    }

    // Update allowed sections if provided
    if (Array.isArray(allowedSections)) {
      const safeSections = allowedSections.filter(
        (s: string) => (ASSIGNABLE_SECTIONS as readonly string[]).includes(s)
      );
      updatePayload.departments = { allowed_sections: safeSections };
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: agent, error } = await supabase
      .from('team_agents')
      .update(updatePayload)
      .eq('id', agentId)
      .eq('tenant_id', tenant.tenantId) // Security: only own tenant
      .select()
      .single();

    if (error) {
      console.error('[Team PATCH] Error:', error);
      return NextResponse.json({ error: 'Error al actualizar agente' }, { status: 500 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE — Remove an agent from the team
export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'team');
    if (featureError) return featureError;

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json({ error: 'Falta agentId' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from('team_agents')
      .delete()
      .eq('id', agentId)
      .eq('tenant_id', tenant.tenantId);

    if (error) {
      console.error('[Team DELETE] Error:', error);
      return NextResponse.json({ error: 'Error al eliminar agente' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

