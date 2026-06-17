const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Checking if any message contains scheduling tags...");
  const res = await fetch(`${supabaseUrl}/rest/v1/messages?select=*,conversations(tenant_id)&or=(content.ilike.*VERIFICAR_DISPONIBILIDAD*,content.ilike.*AGENDAR_CITA*)&order=created_at.desc&limit=20`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  if (!res.ok) {
    console.error("Error:", await res.text());
    return;
  }
  const messages = await res.json();
  console.log(`Found ${messages.length} messages with tags:`);
  for (const m of messages) {
    console.log(`[${m.created_at}] [Tenant: ${m.conversations?.tenant_id}] Role: ${m.role}`);
    console.log(`Content: ${m.content}`);
    console.log(`---`);
  }
}

main().catch(console.error);
