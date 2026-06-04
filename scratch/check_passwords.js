import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPasswords() {
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, email, password_hash');

  if (error) {
    console.error("Error fetching tenants:", error);
    return;
  }

  const testPasswords = ['rifx2026', 'admin', 'admin123', 'rifx', '123456'];

  for (const tenant of tenants) {
    console.log(`\nEmail: ${tenant.email}`);
    console.log(`Hash: ${tenant.password_hash}`);
    let found = false;
    for (const pwd of testPasswords) {
      const isValid = await bcrypt.compare(pwd, tenant.password_hash);
      if (isValid) {
        console.log(`  👉 Contraseña válida encontrada en la lista de pruebas: "${pwd}"`);
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`  ❌ Ninguna de las contraseñas de prueba coincide.`);
    }
  }
}

checkPasswords();
