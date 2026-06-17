import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();

    // Eliminar el tenant de la base de datos (desencadena cascada en Supabase)
    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenant.tenantId);

    if (error) {
      console.error('❌ Error al eliminar tenant:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Cuenta eliminada correctamente' });
  } catch (error: any) {
    console.error('❌ Error en auto-eliminación:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
