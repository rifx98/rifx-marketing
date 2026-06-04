import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Faltan las variables de entorno de Supabase.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenants() {
  console.log("Conectando a Supabase:", supabaseUrl);
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, email, company_name, plan, plan_status, created_at');

    if (error) {
      console.error("❌ Error al consultar la tabla tenants:", error);
      return;
    }

    console.log(`✅ Conexión exitosa. Se encontraron ${data.length} tenants:`);
    console.table(data);
  } catch (err) {
    console.error("❌ Error inesperado:", err);
  }
}

checkTenants();
