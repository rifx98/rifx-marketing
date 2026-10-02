import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  getTenantKnowledge,
  saveTenantKnowledge,
  deleteTenantKnowledge,
  BrainKnowledgeItem,
} from '@/lib/brain-knowledge-store';

export const dynamic = 'force-dynamic';

async function resolveTenant(req: NextRequest) {
  let tenant = await getTenantFromRequest(req);
  if (!tenant) {
    if (process.env.NODE_ENV !== 'production') {
      const supabase = createSupabaseAdmin();
      const { data: firstTenant } = await supabase.from('tenants').select('id, email, plan').limit(1).maybeSingle();
      if (firstTenant) {
        tenant = { tenantId: firstTenant.id, email: firstTenant.email, plan: 'master', planStatus: 'active', isAdmin: true };
      }
    }
  }
  return tenant;
}

// GET: List knowledge items
export async function GET(req: NextRequest) {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!tenant.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso restringido: El conocimiento del Cerebro IA es exclusivo para administradores' },
        { status: 403 }
      );
    }
    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;

    const items = await getTenantKnowledge(tenant.tenantId);
    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('[brain-knowledge] GET error:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener conocimiento' }, { status: 500 });
  }
}

// POST: Add or update knowledge item
export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!tenant.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso restringido: El conocimiento del Cerebro IA es exclusivo para administradores' },
        { status: 403 }
      );
    }
    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;

    const body = await req.json();
    const { title, content, category } = body as {
      title: string;
      content: string;
      category?: BrainKnowledgeItem['category'];
    };

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Título y contenido son requeridos' }, { status: 400 });
    }

    const saved = await saveTenantKnowledge(tenant.tenantId, {
      title,
      content,
      category,
    });

    return NextResponse.json({
      success: true,
      item: saved,
      message: 'Conocimiento asimilado y sincronizado con WhatsApp y llamadas telefónicas.',
    });
  } catch (error: any) {
    console.error('[brain-knowledge] POST error:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar conocimiento' }, { status: 500 });
  }
}

// DELETE: Remove knowledge item
export async function DELETE(req: NextRequest) {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!tenant.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso restringido: El conocimiento del Cerebro IA es exclusivo para administradores' },
        { status: 403 }
      );
    }
    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const deleted = await deleteTenantKnowledge(tenant.tenantId, id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    console.error('[brain-knowledge] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar conocimiento' }, { status: 500 });
  }
}
