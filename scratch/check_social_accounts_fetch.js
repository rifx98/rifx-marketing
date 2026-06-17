const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Fetching social accounts from Supabase...");
  const res = await fetch(`${supabaseUrl}/rest/v1/social_accounts?select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  if (!res.ok) {
    console.error("Error:", await res.text());
    return;
  }
  const rows = await res.json();
  console.log(`Found ${rows.length} rows.`);
  for (const row of rows) {
    console.log(`\nRow ID: ${row.id}`);
    console.log(`Tenant ID: ${row.tenant_id}`);
    console.log(`Platform: ${row.platform}`);
    console.log(`Username: ${row.platform_username}`);
    console.log(`UserId: ${row.platform_user_id}`);
    console.log(`Expires At: ${row.token_expires_at}`);
  }
}

main().catch(console.error);
