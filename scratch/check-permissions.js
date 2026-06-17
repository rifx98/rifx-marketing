import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

async function main() {
  console.log("Checking platform_settings via REST API...");
  const res = await fetch(`${supabaseUrl}/rest/v1/platform_settings?select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    }
  });

  if (res.ok) {
    const data = await res.json();
    console.log("platform_settings:", JSON.stringify(data, null, 2));
  } else {
    console.error("Failed to fetch platform_settings:", await res.text());
  }

  console.log("Checking config (tenants) via REST API...");
  const res2 = await fetch(`${supabaseUrl}/rest/v1/config?select=tenant_id,plan,plan_status,email&limit=15`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    }
  });

  if (res2.ok) {
    const data2 = await res2.json();
    console.log("Tenants:", JSON.stringify(data2, null, 2));
  } else {
    console.error("Failed to fetch tenants:", await res2.text());
  }
}

main().catch(console.error);
