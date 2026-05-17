import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// POST /api/panel/migrate - Ejecutar migraciones de base de datos
export async function POST() {
  try {
    const supabase = createSupabaseAdmin();

    // Crear tabla ad_campaigns
    const { error: err1 } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS ad_campaigns (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          title TEXT,
          description TEXT,
          hook TEXT,
          caption TEXT,
          hashtags TEXT,
          daily_budget DECIMAL(10,2) DEFAULT 5.00,
          total_spent DECIMAL(10,2) DEFAULT 0.00,
          target_audience JSONB DEFAULT '{}',
          copy_framework TEXT,
          hook_variants JSONB DEFAULT '[]',
          campaign_config JSONB DEFAULT '{}',
          status TEXT DEFAULT 'draft',
          facebook_campaign_id TEXT,
          facebook_adset_id TEXT,
          facebook_ad_id TEXT,
          published_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    // Si RPC no existe, usar método directo con SQL
    // Intentar crear las tablas de forma individual usando insert/select
    
    // Verificar si las tablas ya existen intentando hacer un select
    const { error: checkErr } = await supabase.from('ad_campaigns').select('id').limit(1);
    
    if (checkErr && checkErr.code === '42P01') {
      // La tabla no existe - el usuario necesita ejecutar el SQL manualmente
      return NextResponse.json({
        success: false,
        message: 'Las tablas no existen aún. Por favor ejecuta el SQL de migración en Supabase Dashboard.',
        instructions: [
          '1. Ve a https://supabase.com/dashboard',
          '2. Selecciona tu proyecto',
          '3. Ve a SQL Editor',
          '4. Copia y pega el contenido del archivo: supabase/migrations/001_ad_campaigns.sql',
          '5. Haz clic en "Run"',
          '6. Vuelve a intentar'
        ],
        sqlFile: 'supabase/migrations/001_ad_campaigns.sql'
      });
    }

    // Las tablas existen, verificar las otras
    const { error: checkErr2 } = await supabase.from('ad_creatives').select('id').limit(1);
    const { error: checkErr3 } = await supabase.from('ad_analytics').select('id').limit(1);

    const tablesStatus = {
      ad_campaigns: !checkErr ? '✅ Lista' : '❌ Falta',
      ad_creatives: !checkErr2 ? '✅ Lista' : '❌ Falta',
      ad_analytics: !checkErr3 ? '✅ Lista' : '❌ Falta',
    };

    const allReady = !checkErr && !checkErr2 && !checkErr3;

    return NextResponse.json({
      success: allReady,
      message: allReady ? 'Todas las tablas están listas' : 'Algunas tablas faltan',
      tables: tablesStatus,
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET /api/panel/migrate - Verificar estado de las tablas
export async function GET() {
  try {
    const supabase = createSupabaseAdmin();

    const tables = ['ad_campaigns', 'ad_creatives', 'ad_analytics'];
    const status: Record<string, string> = {};

    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      status[table] = !error ? '✅ Lista' : `❌ ${error.code === '42P01' ? 'No existe' : error.message}`;
    }

    const allReady = Object.values(status).every(s => s.includes('✅'));

    return NextResponse.json({
      success: allReady,
      message: allReady ? 'Base de datos lista para pautas publicitarias' : 'Tablas pendientes de crear',
      tables: status,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
