import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// Evita que el build dependa de Supabase. La respuesta exitosa sigue siendo
// cacheable en el CDN durante 60 segundos.
export const dynamic = 'force-dynamic';
// GET: Obtener anuncios activos (visible para todos los usuarios)
export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const now = new Date().toISOString();

    // Solo se muestran los que están activos, ya empezaron (o no tienen
    // fecha de inicio) y no han caducado (o no tienen fecha de caducidad).
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, message, type, image_url, button_text, button_url, starts_at, expires_at, created_at')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Announcements lookup failed:', error.code || 'database_error');
      return NextResponse.json(
        { error: 'Anuncios temporalmente no disponibles' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { announcements: data || [] },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch {
    console.error('Announcements request failed');
    return NextResponse.json(
      { error: 'Anuncios temporalmente no disponibles' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
