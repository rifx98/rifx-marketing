const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  // Check social_accounts for Google Calendar
  console.log("Checking social_accounts for Google Calendar...");
  const res = await fetch(`${supabaseUrl}/rest/v1/social_accounts?select=*&tenant_id=eq.26db5d82-84e2-4af5-9458-add284631021`, {
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
  console.log(`Found ${rows.length} social accounts for tenant 26db5d82.`);
  for (const row of rows) {
    console.log(`\n  Platform: ${row.platform}`);
    console.log(`  Account Name: ${row.account_name}`);
    console.log(`  Has encrypted_access_token: ${!!row.encrypted_access_token}`);
    console.log(`  Has encryption_iv: ${!!row.encryption_iv}`);
    console.log(`  Has encryption_tag: ${!!row.encryption_tag}`);
    console.log(`  Token expires at: ${row.token_expires_at}`);
    console.log(`  Created: ${row.created_at}`);
    console.log(`  Updated: ${row.updated_at}`);
  }
  
  // Also check the other tenant (3b13d6ed) which is the one that gets matched by phone_id
  console.log("\n\nChecking social_accounts for tenant 3b13d6ed...");
  const res2 = await fetch(`${supabaseUrl}/rest/v1/social_accounts?select=*&tenant_id=eq.3b13d6ed-7d5d-47d8-bca7-1a13d7da362b`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const rows2 = await res2.json();
  console.log(`Found ${rows2.length} social accounts for tenant 3b13d6ed.`);
  for (const row of rows2) {
    console.log(`\n  Platform: ${row.platform}`);
    console.log(`  Account Name: ${row.account_name}`);
  }

  // Check which tenant's config has the same whatsapp_phone_id
  console.log("\n\nChecking which configs have whatsapp_phone_id 2213190156096315...");
  const res3 = await fetch(`${supabaseUrl}/rest/v1/config?select=id,tenant_id,whatsapp_phone_id&whatsapp_phone_id=eq.2213190156096315`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const rows3 = await res3.json();
  console.log(`Found ${rows3.length} configs with that phone_id:`);
  for (const row of rows3) {
    console.log(`  Tenant: ${row.tenant_id}, Config ID: ${row.id}`);
  }
}

main().catch(console.error);
