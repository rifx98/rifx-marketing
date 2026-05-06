import { NextResponse } from 'next/server';

// Endpoint temporal para agregar la columna panel_password a la tabla config
// Usa la API REST de Supabase directamente con la service role key
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Ejecutar SQL via Supabase REST API (endpoint /rest/v1/rpc o directo via /pg)
    const sql = `ALTER TABLE config ADD COLUMN IF NOT EXISTS panel_password TEXT DEFAULT '';`;
    
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    // Si el RPC no funciona, intentar via el endpoint de management
    // Alternativa: usar pg directamente a través del endpoint SQL de Supabase
    const pgRes = await fetch(`${supabaseUrl}/pg`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    // Tercer intento: simplemente hacer un UPDATE con el campo panel_password
    // Si la columna no existe, esto fallará. Si existe, pasará limpio.
    const testRes = await fetch(`${supabaseUrl}/rest/v1/config?select=id&limit=1`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    });
    const configs = await testRes.json();
    
    if (configs && configs.length > 0) {
      // Intentar actualizar con panel_password para ver si el campo existe
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/config?id=eq.${configs[0].id}`, {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ panel_password: '' }),
      });

      if (updateRes.ok) {
        return NextResponse.json({
          success: true,
          message: '✅ La columna panel_password ya existe y funciona correctamente.',
        });
      } else {
        const errText = await updateRes.text();
        return NextResponse.json({
          success: false,
          message: 'La columna panel_password NO existe aún.',
          error: errText,
          manual_fix: {
            instructions: 'Ejecuta este SQL en Supabase Dashboard > SQL Editor:',
            sql: "ALTER TABLE config ADD COLUMN panel_password TEXT DEFAULT '';",
            url: `https://supabase.com/dashboard/project/enbezuxcljmdsmtzqktp/sql`,
          }
        });
      }
    }

    return NextResponse.json({
      success: false,
      message: 'No se encontró la tabla config',
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
