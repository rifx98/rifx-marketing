const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Restoring Dropi token and cleaning up admin123 values...");
  
  // 1. Fetch current config row
  const res = await fetch(`${supabaseUrl}/rest/v1/config?id=eq.b27a2898-b953-42ba-914d-f204f722a81f&select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  
  if (!res.ok) {
    console.error("Failed to fetch config row:", await res.text());
    return;
  }
  
  const data = await res.json();
  const row = data[0];
  if (!row) {
    console.error("Config row not found.");
    return;
  }
  
  // 2. Decode current openai_key JSON
  const parsed = JSON.parse(row.openai_key);
  
  // 3. Restore the correct Dropi token and clean up the autofilled "admin123" values
  parsed.dropi_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vYXBwLmRyb3BpLmVjOjgwIiwiaWF0IjoxNzgwODI2ODQxLCJleHAiOjQ5MzY1MDA0NDEsIm5iZiI6MTc4MDgyNjg0MSwianRpIjoiQkhBOHdEQnBTVlhpQlV5aiIsInN1YiI6IjExNzY4IiwicHJ2IjoiODdlMGFmMWVmOWZkMTU4MTJmZGVjOTcxNTNhMTRlMGIwNDc1NDZhYSIsImF1ZCI6IkNoYXRib3QgQWdlbnRzIiwidG9rZW5fdHlwZSI6IklOVEVHUkFUSU9OUyIsIndiX2lkIjoxLCJpbnRlZ3JhdGlvbl90eXBlIjoiQ2hhdGJvdCBBZ2VudHMiLCJpbnRlZ3JhdGlvbl90eXBlX2lkIjoxNzMsImlwX3VybCI6W3sidXJsIjpudWxsLCJpcCI6IjEzLjU5LjIzMC45NiJ9XSwiaW50ZWdyYXRpb25fdXJsIjoiIn0.flNH9TMY9Tl9-7SHhZtNYXfhkRSXTd8vZ42oGOfaBiQ";
  parsed.dropi_enabled = true;
  parsed.dropi_default_product_id = "119802";
  parsed.dropi_default_price = 20;
  
  if (parsed.openai_key === "admin123") {
    parsed.openai_key = ""; // Clear autofilled admin123
  }
  
  const updatedOpenAIKey = JSON.stringify(parsed);
  
  // 4. Update the DB row
  const updateRes = await fetch(`${supabaseUrl}/rest/v1/config?id=eq.b27a2898-b953-42ba-914d-f204f722a81f`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      openai_key: updatedOpenAIKey,
      updated_at: new Date().toISOString()
    })
  });
  
  if (!updateRes.ok) {
    console.error("Failed to update config row:", await updateRes.text());
  } else {
    console.log("Successfully restored Dropi token and cleaned up config row in database!");
  }
}

main().catch(console.error);
