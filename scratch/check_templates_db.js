import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTemplates() {
  console.log("Conectando a Supabase para leer plantillas...");
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('id, name, category, preview_image_url, is_active, tenant_id, config_json');

    if (error) {
      console.error("❌ Error al consultar la tabla templates:", error);
      return;
    }

    console.log(`✅ Conexión exitosa. Se encontraron ${data.length} templates:`);
    for (const tpl of data) {
      console.log(`- ID: ${tpl.id} | Nombre: "${tpl.name}" | Categoría: "${tpl.category}"`);
      console.log(`  Imagen: ${tpl.preview_image_url}`);
      console.log(`  Config:`, JSON.stringify(tpl.config_json, null, 2));
    }
  } catch (err) {
    console.error("❌ Error inesperado:", err);
  }
}

checkTemplates();
