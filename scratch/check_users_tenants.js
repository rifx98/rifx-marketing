const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Fetching tenants...");
  const tenantsRes = await fetch(`${supabaseUrl}/rest/v1/tenants?select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  if (!tenantsRes.ok) {
    console.error("Error fetching tenants:", await tenantsRes.text());
    return;
  }
  const tenants = await tenantsRes.json();
  console.log(`Found ${tenants.length} tenants:`);
  for (const t of tenants) {
    console.log(`- ID: ${t.id} | Email: ${t.email} | Name: ${t.company_name} | Plan: ${t.plan}`);
  }

  console.log("\nFetching configs...");
  const configsRes = await fetch(`${supabaseUrl}/rest/v1/config?select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const configs = await configsRes.json();
  console.log(`Found ${configs.length} configs:`);
  for (const c of configs) {
    let hasToken = false;
    let hasPhoneId = !!c.whatsapp_phone_id;
    try {
      const p = JSON.parse(c.openai_key);
      hasToken = !!p.dropi_token;
    } catch {}
    console.log(`- Row ID: ${c.id} | Tenant ID: ${c.tenant_id} | Phone ID: ${c.whatsapp_phone_id || '(none)'} | Has Dropi Token: ${hasToken}`);
  }
}

main().catch(console.error);
