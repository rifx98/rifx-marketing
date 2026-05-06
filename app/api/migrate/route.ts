import { NextResponse } from 'next/server';

// Endpoint temporal para agregar la columna panel_password
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

    // Método: Usar el endpoint de Supabase para ejecutar SQL 
    // via el endpoint PostgREST con una función personalizada
    // Primero, intentamos crear la función exec_sql si no existe
    
    // Alternativa directa: usar el endpoint de la base de datos PostgreSQL
    // Supabase expone un endpoint SQL en /pg/query para service_role
    const sqlRes = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql_query: "ALTER TABLE config ADD COLUMN IF NOT EXISTS panel_password TEXT DEFAULT '';"
      }),
    });

    if (sqlRes.ok) {
      return NextResponse.json({ success: true, message: '✅ Columna agregada via RPC' });
    }

    // Si el RPC no existe, vamos a crearla usando un truco:
    // Insertar un registro con panel_password para forzar el esquema
    // Esto NO funciona en Supabase, pero podemos intentar via pg-meta API
    
    // Intentar con el Supabase Management API
    const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "ALTER TABLE public.config ADD COLUMN IF NOT EXISTS panel_password TEXT DEFAULT '';"
      }),
    });

    if (mgmtRes.ok) {
      const result = await mgmtRes.json();
      return NextResponse.json({ success: true, message: '✅ Columna agregada via Management API', result });
    }

    // Último recurso: usar pg-meta que está disponible en todos los proyectos Supabase
    const pgMetaRes = await fetch(`${supabaseUrl}/pg-meta/default/query`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'X-Connection-Encrypted': 'true',
      },
      body: JSON.stringify({
        query: "ALTER TABLE public.config ADD COLUMN IF NOT EXISTS panel_password TEXT DEFAULT '';"
      }),
    });

    const pgMetaResult = await pgMetaRes.text();
    
    if (pgMetaRes.ok) {
      return NextResponse.json({ 
        success: true, 
        message: '✅ Columna panel_password agregada correctamente via pg-meta.',
        result: pgMetaResult,
      });
    }

    return NextResponse.json({
      success: false,
      message: 'No se pudo agregar automáticamente.',
      pgMetaStatus: pgMetaRes.status,
      pgMetaResult,
      manual_sql: "ALTER TABLE config ADD COLUMN panel_password TEXT DEFAULT '';",
    });

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
