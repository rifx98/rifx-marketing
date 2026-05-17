import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
// GET: Obtener anuncios activos (visible para todos los usuarios)
export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching announcements:', error);
      return NextResponse.json({ announcements: [], error: error.message });
    }

    console.log('✅ Announcements fetched:', data?.length || 0);
    return NextResponse.json({ announcements: data || [] });
  } catch (e: any) {
    console.error('❌ Catch error:', e);
    return NextResponse.json({ announcements: [], error: e?.message });
  }
}
