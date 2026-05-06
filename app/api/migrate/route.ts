import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// Endpoint temporal para agregar la columna panel_password a la tabla config
// ELIMINAR DESPUÉS DE EJECUTAR
export async function GET() {
  try {
    const supabase = createSupabaseAdmin();

    // Intentar agregar la columna usando rpc con SQL directo
    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE config ADD COLUMN IF NOT EXISTS panel_password TEXT DEFAULT '';`
    });

    if (error) {
      // Si rpc no existe, intentar otro enfoque: 
      // simplemente hacer un update con el campo y ver si funciona
      console.log('RPC no disponible, intentando enfoque alternativo...');
      
      // Probar si la columna ya existe haciendo un select
      const { data: testData, error: testError } = await supabase
        .from('config')
        .select('panel_password')
        .limit(1);

      if (testError && testError.message.includes('panel_password')) {
        // La columna no existe — necesitamos crearla via SQL Editor de Supabase
        return NextResponse.json({
          success: false,
          message: 'La columna panel_password no existe. Ejecuta este SQL en Supabase SQL Editor:',
          sql: "ALTER TABLE config ADD COLUMN panel_password TEXT DEFAULT '';",
          instructions: [
            '1. Ve a https://supabase.com/dashboard',
            '2. Selecciona tu proyecto',
            '3. Ve a SQL Editor (icono de código)',
            '4. Pega el SQL de arriba',
            '5. Haz clic en "Run"',
          ]
        });
      }

      // Si no hay error, la columna ya existe
      return NextResponse.json({
        success: true,
        message: '✅ La columna panel_password ya existe en la tabla config.',
        data: testData,
      });
    }

    return NextResponse.json({
      success: true,
      message: '✅ Columna panel_password agregada correctamente.',
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      fallback_sql: "ALTER TABLE config ADD COLUMN panel_password TEXT DEFAULT '';",
    }, { status: 500 });
  }
}
