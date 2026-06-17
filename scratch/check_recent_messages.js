const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Fetching latest messages...");
  const res = await fetch(`${supabaseUrl}/rest/v1/messages?select=id,conversation_id,role,content,created_at&order=created_at.desc&limit=25`, {
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
  console.log("Latest 25 messages:");
  for (const m of messages) {
    console.log(`[${m.created_at}] [Conv: ${m.conversation_id}] ${m.role.toUpperCase()}: ${m.content}`);
  }
}

main().catch(console.error);
