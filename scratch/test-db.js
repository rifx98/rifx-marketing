const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing supabase URL or service role key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  try {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id, email, company_name, is_admin, created_at');
    
    if (error) {
      console.error("Error fetching tenants:", error);
    } else {
      console.log("Success! Tenants count:", tenants?.length);
      console.log("Tenants details:", JSON.stringify(tenants, null, 2));
    }
  } catch (e) {
    console.error("Exception occurred:", e);
  }
}

test();
