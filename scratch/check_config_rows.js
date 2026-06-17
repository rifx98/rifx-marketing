const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Listing all config rows...");
  const res = await fetch(`${supabaseUrl}/rest/v1/config?select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  if (!res.ok) {
    console.error("Error querying config table:", await res.text());
  } else {
    const data = await res.json();
    console.log(`Found ${data.length} config rows:`);
    for (const row of data) {
      console.log(`- ID: ${row.id}, TenantID: ${row.tenant_id}, PhoneID: ${row.whatsapp_phone_id}, Token: ${row.whatsapp_token ? row.whatsapp_token.substring(0,15) + '...' : 'null'}`);
    }
  }
}

main().catch(console.error);
