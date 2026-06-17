const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Fetching conversation details around 2026-06-09T03:35:06...");
  
  // First, find the conversation ID that contains the user message
  const res = await fetch(`${supabaseUrl}/rest/v1/messages?select=*,conversations(*)&content=eq.Hola%20quiero%20agendar%20una%20cita&order=created_at.desc&limit=1`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const msgs = await res.json();
  if (msgs.length === 0) {
    console.log("No message found matching the query.");
    return;
  }
  const msg = msgs[0];
  const convId = msg.conversation_id;
  console.log(`Conversation ID: ${convId}`);
  console.log(`Tenant ID: ${msg.conversations?.tenant_id}`);
  console.log(`Phone number: ${msg.conversations?.phone_number}`);

  // Fetch all messages in this conversation
  const res2 = await fetch(`${supabaseUrl}/rest/v1/messages?select=*&conversation_id=eq.${convId}&order=created_at.asc`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const allMsgs = await res2.json();
  console.log(`\nAll ${allMsgs.length} messages in conversation ${convId}:`);
  for (const m of allMsgs) {
    console.log(`[${m.created_at}] Role: ${m.role}`);
    console.log(`Content: ${m.content}`);
    console.log('---');
  }
}

main().catch(console.error);
