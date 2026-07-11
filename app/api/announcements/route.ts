import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// Mismo contenido para todos los tenants (no depende de auth ni de query
// params), así que se cachea 60s en el edge de Vercel en vez de pegarle a
// Supabase en cada carga del dashboard/cada usuario.
export const revalidate = 60;
// GET: Obtener anuncios activos (visible para todos los usuarios)
export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const now = new Date().toISOString();

    // Solo se muestran los que están activos, ya empezaron (o no tienen
    // fecha de inicio) y no han caducado (o no tienen fecha de caducidad).
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching announcements:', error);
      return NextResponse.json({ announcements: [], error: error.message });
    }

    console.log('✅ Announcements fetched:', data?.length || 0);
    return NextResponse.json(
      { announcements: data || [] },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (e: any) {
    console.error('❌ Catch error:', e);
    return NextResponse.json({ announcements: [], error: e?.message });
  }
}
