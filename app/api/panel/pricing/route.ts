import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// ============================================
// CRUD: Service Pricing (Pricing Guard)
// ============================================

// GET: Listar servicios con precios del tenant
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('service_pricing')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('service_name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ services: data || [] });
  } catch (error: any) {
    console.error('❌ Error listando pricing:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

// POST: Crear o actualizar servicio con precios
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const supabase = createSupabaseAdmin();

    // Validaciones básicas
    if (!body.service_name || typeof body.service_name !== 'string') {
      return NextResponse.json({ error: 'service_name es obligatorio' }, { status: 400 });
    }

    const record: Record<string, any> = {
      tenant_id: tenant.tenantId,
      service_name: body.service_name.trim(),
      category: body.category || 'general',
      description: body.description || null,
      base_price: body.base_price ?? null,
      currency: body.currency || 'USD',
      billing_type: body.billing_type || 'one_time',
      included_items: body.included_items || [],
      optional_addons: body.optional_addons || [],
      min_price: body.min_price ?? null,
      max_price: body.max_price ?? null,
      is_custom_quote: body.is_custom_quote ?? false,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (body.id) {
      // UPDATE existente
      const { error } = await supabase
        .from('service_pricing')
        .update(record)
        .eq('id', body.id)
        .eq('tenant_id', tenant.tenantId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'Servicio actualizado' });
    } else {
      // INSERT nuevo
      const { data, error } = await supabase
        .from('service_pricing')
        .insert(record)
        .select('id')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, id: data?.id, message: 'Servicio creado' });
    }
  } catch (error: any) {
    console.error('❌ Error guardando pricing:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

// DELETE: Soft-delete (is_active = false)
export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from('service_pricing')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenant.tenantId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Servicio desactivado' });
  } catch (error: any) {
    console.error('❌ Error eliminando pricing:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
