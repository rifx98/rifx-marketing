// Polyfill to bypass the Realtime WS check in Node 20
global.WebSocket = class DummyWebSocket {};

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Faltan variables de entorno!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log("Creando políticas RLS para 'social-videos'...");
  
  const query = `
    -- Eliminar políticas anteriores si existen
    DROP POLICY IF EXISTS "Allow public uploads to social-videos" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public read from social-videos" ON storage.objects;

    -- Crear política de inserción pública (upload)
    CREATE POLICY "Allow public uploads to social-videos"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'social-videos');

    -- Crear política de lectura pública (select)
    CREATE POLICY "Allow public read from social-videos"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'social-videos');
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query });

  if (error) {
    console.error("Error al ejecutar SQL:", error.message);
  } else {
    console.log("Políticas RLS creadas exitosamente!", data);
  }
}

run();
