const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

const newToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vYXBwLmRyb3BpLmVjOjgwIiwiaWF0IjoxNzgwODM4MzA3LCJleHAiOjQ5MzY1MTE5MDcsIm5iZiI6MTc4MDgzODMwNywianRpIjoiQklCZkhOdXdGemcwUDFUZiIsInN1YiI6IjExNzY4IiwicHJ2IjoiODdlMGFmMWVmOWZkMTU4MTJmZGVjOTcxNTNhMTRlMGIwNDc1NDZhYSIsImF1ZCI6Ik1BU1RFUlRPT0xTIiwidG9rZW5fdHlwZSI6IklOVEVHUkFUSU9OUyIsIndiX2lkIjoxLCJpbnRlZ3JhdGlvbl90eXBlIjoiTUFTVEVSVE9PTFMiLCJpbnRlZ3JhdGlvbl90eXBlX2lkIjo0LCJpcF91cmwiOltdLCJpbnRlZ3JhdGlvbl91cmwiOiIifQ.1pLKmZcomfb80IXzkYzdJFu8PAZLTB7HU6biWZGacvE";

async function main() {
  console.log("Fetching config row...");
  const res = await fetch(`${supabaseUrl}/rest/v1/config?tenant_id=eq.26db5d82-84e2-4af5-9458-add284631021&select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  
  if (!res.ok) {
    console.error("Failed to fetch config:", await res.text());
    return;
  }
  
  const data = await res.json();
  const config = data[0];
  const parsed = JSON.parse(config.openai_key);
  
  parsed.dropi_token = newToken;
  
  console.log("Updating config row in database...");
  const updateRes = await fetch(`${supabaseUrl}/rest/v1/config?id=eq.${config.id}`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      openai_key: JSON.stringify(parsed),
      updated_at: new Date().toISOString()
    })
  });
  
  if (updateRes.ok) {
    console.log("Successfully updated Dropi token in the database!");
  } else {
    console.error("Failed to update config row:", await updateRes.text());
  }
}

main().catch(console.error);
