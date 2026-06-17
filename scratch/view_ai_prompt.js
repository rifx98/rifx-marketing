const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
  console.log(`Fetching ai_prompt for tenant ${tenantId}...`);
  const res = await fetch(`${supabaseUrl}/rest/v1/config?tenant_id=eq.${tenantId}&select=ai_prompt`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const data = await res.json();
  if (data.length > 0) {
    console.log("=== FULL AI PROMPT ===");
    console.log(data[0].ai_prompt);
  } else {
    console.log("No config found");
  }
}

main().catch(console.error);
