const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function testSupabase(url, key) {
  try {
    const supabase = createClient(url, key);
    const { error } = await supabase.from('announcements').select('id').limit(1);
    return !error;
  } catch (e) {
    return false;
  }
}

async function run() {
  const files = ['.env.production', '.env.test', '.env.vercel.prod', '.env.vercel', '.env.local'];
  let validClient = null;

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const urlMatch = content.match(/NEXT_PUBLIC_SUPABASE_URL=([^\n\r]+)/);
    const keyMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY=([^\n\r]+)/);
    
    if (urlMatch && keyMatch) {
      const url = urlMatch[1].replace(/['"]/g, '').trim();
      const key = keyMatch[1].replace(/['"]/g, '').trim();
      if (url && key) {
        console.log(`Probando credenciales de ${file}...`);
        const isValid = await testSupabase(url, key);
        if (isValid) {
          console.log(`¡Conectado exitosamente usando ${file}!`);
          validClient = createClient(url, key);
          break;
        } else {
          console.log(`Fallo con ${file}`);
        }
      }
    }
  }

  if (validClient) {
    console.log('Borrando anuncios de WEBHOOK...');
    const { data, error } = await validClient.from('announcements').delete().like('title', 'WEBHOOK_%');
    if (error) {
      console.error('Error al borrar:', error);
    } else {
      console.log('Anuncios borrados exitosamente de la base de datos.');
    }
  } else {
    console.log('No se pudo encontrar ninguna credencial válida en los archivos .env.');
  }
}
run();
