import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching platform settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        platform_name: 'Sovereign',
        platform_logo: null,
        sidebar_order: ['dashboard', 'crm', 'settings', 'billing', 'playground', 'campaigns', 'segments', 'analytics', 'admin']
      });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const userPayload = await verifyToken(token);

    if (!userPayload || !userPayload.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const role = userPayload.adminRole || 'full';
    if (role !== 'full') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();
    const body = await request.json();
    const { platform_name, platform_logo, sidebar_order } = body;

    // Check if a row exists
    const { data: existing } = await supabase
      .from('platform_settings')
      .select('id')
      .limit(1)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('platform_settings')
        .update({ platform_name, platform_logo, sidebar_order, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select();
    } else {
      result = await supabase
        .from('platform_settings')
        .insert({ platform_name, platform_logo, sidebar_order })
        .select();
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
