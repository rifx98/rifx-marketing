// Environment variables
const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

const headers = {
  'apikey': supabaseServiceKey,
  'Authorization': `Bearer ${supabaseServiceKey}`,
  'Content-Type': 'application/json'
};

async function run() {
  console.log('🏁 Executing SQL via Supabase RPC...');
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pending_plan TEXT;`
    })
  });
  
  if (res.ok) {
    console.log('✅ ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pending_plan TEXT completed successfully!');
  } else {
    console.error('❌ Failed to run SQL:', res.status, await res.text());
  }
}

run();
