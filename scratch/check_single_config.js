const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
  console.log(`Fetching config for tenant ${tenantId}...`);
  const res = await fetch(`${supabaseUrl}/rest/v1/config?tenant_id=eq.${tenantId}&select=*`, {
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
  if (rows.length === 0) {
    console.log("No config row found");
    return;
  }
  const config = rows[0];
  console.log("Config ID:", config.id);
  console.log("WhatsApp Token (length):", config.whatsapp_token ? config.whatsapp_token.length : 'null/empty');
  console.log("WhatsApp Phone ID:", config.whatsapp_phone_id);
  
  let extConfig = {};
  try {
    extConfig = JSON.parse(config.openai_key || '{}');
    console.log("Successfully parsed config.openai_key as JSON");
  } catch (e) {
    console.log("config.openai_key is not JSON:", config.openai_key);
  }
  
  const printSafe = (key) => {
    if (!key) return 'undefined/empty';
    if (key.length <= 8) return `too short (${key.length})`;
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };
  
  console.log("Model Selection:", extConfig.model_selection);
  console.log("OpenAI Key:", printSafe(extConfig.openai_key));
  console.log("Gemini Key:", printSafe(extConfig.gemini_key));
  console.log("Groq Key:", printSafe(extConfig.groq_key));
}

main().catch(console.error);

