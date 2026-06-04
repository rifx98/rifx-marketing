import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// GET /api/panel/templates - Obtener plantillas activas para el tenant (globales + específicas)
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    
    // Obtener plantillas donde is_active sea true
    // y (tenant_id IS NULL o tenant_id = tenant.tenantId)
    // Supabase JS no tiene or directo fácil para null y valor, pero podemos usar query filter o RPC.
    // O podemos hacer un select y filtrar en JS, o usar .or('tenant_id.is.null,tenant_id.eq.' + tenant.tenantId)
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('is_active', true)
      .or(`tenant_id.is.null,tenant_id.eq.${tenant.tenantId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error obteniendo plantillas en el panel:', error);
      // Si la tabla no existe en absoluto, podemos devolver un array vacío y no romper la UI
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, templates: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, templates: data || [] });
  } catch (error: any) {
    console.error('❌ Error en GET panel templates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
