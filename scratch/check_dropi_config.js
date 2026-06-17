const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Fetching config rows from Supabase...");
  const res = await fetch(`${supabaseUrl}/rest/v1/config?select=*`, {
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
    console.log(`AI Prompt length: ${row.ai_prompt?.length || 0}`);
    console.log("Raw openai_key:", row.openai_key);
    try {
      const parsed = JSON.parse(row.openai_key);
      console.log("Decoded OpenAI Key (extended config):");
      console.log(`  - dropi_enabled: ${parsed.dropi_enabled}`);
      console.log(`  - dropi_default_product_id: ${parsed.dropi_default_product_id}`);
      console.log(`  - dropi_default_price: ${parsed.dropi_default_price}`);
      console.log(`  - dropi_token: ${parsed.dropi_token ? parsed.dropi_token.substring(0, 15) + '...' : '(empty)'}`);
      console.log(`  - dropi_prompt length: ${parsed.dropi_prompt?.length || 0}`);
    } catch (e) {
      console.log("Could not parse openai_key as JSON (Legacy plain text key).");
    }
  }
}

main().catch(console.error);
