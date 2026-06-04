import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTemplates() {
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, category, preview_image_url, config_json');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Se encontraron ${data.length} templates:`);
  data.forEach((t, i) => {
    console.log(`\n[${i + 1}] ID: ${t.id}`);
    console.log(`Nombre: ${t.name}`);
    console.log(`Categoría: ${t.category}`);
    console.log(`Imagen de previsualización: ${t.preview_image_url}`);
    console.log(`Prompt: ${t.config_json?.prompt || 'No especificado'}`);
  });
}

checkTemplates();
