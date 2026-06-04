const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Checking database tables via REST API...");

  // Get tenants column sample
  const resTenants = await fetch(`${supabaseUrl}/rest/v1/tenants?limit=1`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Range-Unit': 'items'
    }
  });
  if (!resTenants.ok) {
    console.error("Error querying tenants table:", await resTenants.text());
  } else {
    const data = await resTenants.json();
    console.log("Tenants columns sample object keys:", Object.keys(data[0] || {}));
  }

  // Get platform_settings
  const resSettings = await fetch(`${supabaseUrl}/rest/v1/platform_settings?limit=1`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Range-Unit': 'items'
    }
  });
  if (!resSettings.ok) {
    console.error("Error querying platform_settings table:", await resSettings.text());
  } else {
    const data = await resSettings.json();
    console.log("platform_settings table exists!");
    console.log("platform_settings columns sample object:", data[0] || "No rows");
  }
}

main().catch(console.error);
