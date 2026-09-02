import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'wa_campaigns');
    if (featureError) return featureError;

    const supabase = createSupabaseAdmin();
    const { data: campaigns, error } = await supabase
      .from('wa_campaigns')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    return NextResponse.json({ campaigns: campaigns || [] });
  } catch (error) {
    console.error('Error in wa-campaigns GET:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'wa_campaigns');
    if (featureError) return featureError;

    const body = await req.json();
    const { whatsapp_account_id, name, schedule_time, template_name, template_language } = body;

    if (!whatsapp_account_id || !name || !template_name) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: campaign, error } = await supabase
      .from('wa_campaigns')
      .insert([
        {
          tenant_id: tenant.tenantId,
          whatsapp_account_id,
          name,
          schedule_time: schedule_time || null,
          template_name,
          template_language: template_language || 'es',
          status: 'draft'
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating campaign:', error);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Error in wa-campaigns POST:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
