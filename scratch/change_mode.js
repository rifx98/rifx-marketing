const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
  console.log(`1. Fetching current config for tenant ${tenantId}...`);
  
  const getRes = await fetch(`${supabaseUrl}/rest/v1/config?tenant_id=eq.${tenantId}&select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  if (!getRes.ok) {
    throw new Error(`Get config failed: ${await getRes.text()}`);
  }
  
  const configs = await getRes.json();
  if (configs.length === 0) {
    throw new Error("No config row found for this tenant!");
  }
  
  const config = configs[0];
  const extended = JSON.parse(config.openai_key || '{}');
  console.log("Current extended config:", extended);
  
  // Set dropi_enabled to false
  extended.dropi_enabled = false;
  console.log("New extended config to save:", extended);
  
  console.log("2. Updating config in Supabase...");
  const updateRes = await fetch(`${supabaseUrl}/rest/v1/config?id=eq.${config.id}`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      openai_key: JSON.stringify(extended),
      updated_at: new Date().toISOString()
    })
  });
  
  if (!updateRes.ok) {
    throw new Error(`Update failed: ${await updateRes.text()}`);
  }
  
  const updatedData = await updateRes.json();
  console.log("Successfully updated config! New database response:", updatedData);
}

main().catch(console.error);
